# 001 - Continuum V1 Data Model

Status: Accepted

## Context

Continuum V1 is a multi-user personal tracking application with the following core entities:

- Goals
- Projects
- Notes
- Sticky Notes
- Timeline Entries
- Library Items
- Library Types
- Generic Entity Links

The application uses:

- PostgreSQL
- Supabase Free for PostgreSQL hosting
- Supabase Auth for authentication
- FastAPI + SQLAlchemy for backend application logic
- BlockNote for the note editor

The data model should stay explicit and relational for core entities while remaining flexible enough for rich note content and cross-entity linking.

The goal is to avoid over-generalizing the schema while also avoiding unnecessary migrations for every future editor block type.

---

## Decision

Continuum V1 will use explicit relational tables for core domain entities.

The main tables are:

- `goals`
- `projects`
- `notes`
- `sticky_notes`
- `timeline_entries`
- `library_items`
- `library_types`
- `entity_links`

All application-owned entities belong to a user through `user_id`.

All primary keys should use UUIDs.

Timestamps should use timezone-aware PostgreSQL timestamps where applicable.

---

# 1. User Ownership

Authentication is handled by Supabase Auth.

Continuum should not maintain a separate authentication system.

Application-owned entities reference the authenticated Supabase user through:

```text
user_id UUID NOT NULL
```

Every query that reads or modifies user-owned data must be scoped to the authenticated user.

Users must never be able to access another user's Continuum data.

---

# 2. Goals

Goals are intentionally simple in V1.

A goal is a flat entity with no sub-goal hierarchy.

## Fields

```text
id              UUID PRIMARY KEY
user_id         UUID NOT NULL

title           TEXT NOT NULL

status          active | completed
progress        SMALLINT NULL

created_at      TIMESTAMPTZ NOT NULL
updated_at      TIMESTAMPTZ NOT NULL

completed_at    TIMESTAMPTZ NULL
archive_at      TIMESTAMPTZ NULL
```

## Rules

`progress`, when present, must be between 0 and 100.

A goal starts in the `active` state.

When a goal is completed:

```text
status       = completed
completed_at = now()
archive_at   = now() + 48 hours
```

When a completed goal is reopened:

```text
status       = active
completed_at = NULL
archive_at   = NULL
```

Goals are not manually archived in V1.

A goal is considered archived when:

```text
archive_at <= now()
```

The application should not require a background scheduler to move goals into an archive table or toggle an archive flag.

Archive behavior is derived from `archive_at`.

---

# 3. Projects

Projects represent active work and have a slightly richer lifecycle than goals.

## Fields

```text
id              UUID PRIMARY KEY
user_id         UUID NOT NULL

title           TEXT NOT NULL
description     TEXT NULL

status          active | paused | completed | abandoned

created_at      TIMESTAMPTZ NOT NULL
updated_at      TIMESTAMPTZ NOT NULL

closed_at       TIMESTAMPTZ NULL
archive_at      TIMESTAMPTZ NULL
```

## Rules

A project starts in the `active` state.

Valid states are:

```text
active
paused
completed
abandoned
```

`closed_at` is used instead of `completed_at` because both `completed` and `abandoned` are terminal states.

When a project becomes `completed` or `abandoned`:

```text
closed_at  = now()
archive_at = now() + 48 hours
```

When a closed project is reopened to `active` or `paused`:

```text
closed_at  = NULL
archive_at = NULL
```

Projects are not manually archived in V1.

A project is considered archived when:

```text
archive_at <= now()
```

No deadline or due-date field exists in V1.

---

# 4. Notes

Notes are standalone, free-flowing entities.

They do not belong to projects or goals by default.

Relationships to other entities are represented through `entity_links`.

## Fields

```text
id              UUID PRIMARY KEY
user_id         UUID NOT NULL

title           TEXT NOT NULL
content         JSONB NOT NULL

created_at      TIMESTAMPTZ NOT NULL
updated_at      TIMESTAMPTZ NOT NULL

archived_at     TIMESTAMPTZ NULL
```

## Content Storage

BlockNote content is stored as a single PostgreSQL `JSONB` field.

The BlockNote document should not be normalized into relational block tables in V1.

Example conceptual content:

```json
[
  {
    "type": "paragraph",
    "content": "Some text"
  },
  {
    "type": "checkListItem",
    "content": "Finish architecture"
  }
]
```

Future BlockNote block types may store additional structured data inside the JSON document.

Example:

```json
{
  "type": "projectReference",
  "props": {
    "projectId": "..."
  }
}
```

## Reasoning

Using `JSONB` allows Continuum to keep the core data model relational while preserving flexibility for BlockNote.

This avoids schema migrations whenever a new editor block type is introduced.

The tradeoff is that individual editor blocks are not first-class relational rows in V1.

This is acceptable.

## Note Behavior

V1 note content supports:

- text
- Markdown-style content
- checklists

Block reordering is supported by the editor.

Notes may be manually archived.

Manual archive sets:

```text
archived_at = now()
```

Restoring a note clears:

```text
archived_at = NULL
```

---

# 5. Sticky Notes

Sticky Notes are lightweight dashboard-oriented items.

They remain separate from full Notes.

## Fields

```text
id              UUID PRIMARY KEY
user_id         UUID NOT NULL

content         TEXT NOT NULL
color_variant   TEXT NULL

created_at      TIMESTAMPTZ NOT NULL
updated_at      TIMESTAMPTZ NOT NULL

archived_at     TIMESTAMPTZ NULL
```

## Rules

Sticky Notes are primarily displayed on the dashboard.

They may still be linked to Goals, Projects, Notes, Library Items, Timeline Entries, or other supported entities.

`color_variant` is visual only.

It has no semantic meaning.

Sticky Notes may be manually archived.

Sticky Notes may be converted into full Notes.

The exact conversion implementation is application behavior and does not require a direct database relationship between the Sticky Note and resulting Note.

---

# 6. Timeline Entries

The Timeline is manually curated.

It is not an automatic application activity log.

## Fields

```text
id              UUID PRIMARY KEY
user_id         UUID NOT NULL

title           TEXT NOT NULL
description     TEXT NULL

occurred_on     DATE NOT NULL

created_at      TIMESTAMPTZ NOT NULL
updated_at      TIMESTAMPTZ NOT NULL
```

## Rules

Each Timeline Entry represents a single date.

V1 does not support:

- date ranges
- start/end dates
- precise event times

Timeline Entries may link to multiple other entities through `entity_links`.

Entries are editable, but editing historical entries is a secondary interaction rather than the primary timeline experience.

Automatic system events should not be inserted into the Timeline in V1.

---

# 7. Library Items

The Library contains things the user consumes or references rather than things the user creates.

Examples include:

- books
- movies
- series
- articles
- courses
- videos

## Fields

```text
id              UUID PRIMARY KEY
user_id         UUID NOT NULL

title           TEXT NOT NULL
type_id         UUID NOT NULL

url             TEXT NULL
description     TEXT NULL

created_at      TIMESTAMPTZ NOT NULL
updated_at      TIMESTAMPTZ NOT NULL
```

## Rules

Library Items use one uniform schema in V1.

There are no per-type custom fields.

V1 does not include fields such as:

```text
author
rating
pages
duration
progress
completed
started_at
finished_at
```

Library Items have no lifecycle or progress state in V1.

Progress belongs to Goals or Projects, not Library Items.

Library Items may be linked to other entities.

---

# 8. Library Types

Continuum provides default Library types while allowing users to create reusable custom types.

## Fields

```text
id              UUID PRIMARY KEY
user_id         UUID NULL

name            TEXT NOT NULL
is_system       BOOLEAN NOT NULL

created_at      TIMESTAMPTZ NOT NULL
```

## Rules

System-defined types use:

```text
user_id   = NULL
is_system = true
```

Examples:

```text
Book
Movie
Series
Article
Course
Video
```

User-created reusable types use:

```text
user_id   = authenticated user
is_system = false
```

Custom types are reusable by that user across multiple Library Items.

They are not one-off free-text values.

---

# 9. Generic Entity Links

Continuum supports flexible links between core entities.

Links are generic and intentionally have no semantic relationship type in V1.

## Fields

```text
id              UUID PRIMARY KEY
user_id         UUID NOT NULL

source_type     TEXT NOT NULL
source_id       UUID NOT NULL

target_type     TEXT NOT NULL
target_id       UUID NOT NULL

created_at      TIMESTAMPTZ NOT NULL
```

## Meaning

A link means only:

```text
these two entities are connected
```

V1 does not support semantic edge types such as:

```text
belongs_to
references
depends_on
supports
derived_from
contains
```

The edge itself carries no meaning beyond connection.

## Supported Relationships

Examples:

```text
Project <-> Goal
Project <-> Note
Project <-> Timeline Entry
Project <-> Library Item
Note <-> Goal
Note <-> Library Item
Timeline Entry <-> Note
```

Multiple links per entity are allowed.

A single Timeline Entry may link to multiple entities.

---

# 10. Archive Model

Continuum uses two archive mechanisms depending on the entity lifecycle.

## Lifecycle-driven archive

Used by:

- Goals
- Projects

These use:

```text
archive_at TIMESTAMPTZ
```

They are considered archived when:

```text
archive_at <= now()
```

This avoids introducing a background scheduler in V1.

## Manual archive

Used by:

- Notes
- Sticky Notes

These use:

```text
archived_at TIMESTAMPTZ
```

Manual archive:

```text
archived_at = now()
```

Restore:

```text
archived_at = NULL
```

---

# 11. Explicit V1 Non-Goals

The V1 data model intentionally does not include:

- sub-goals
- project deadlines
- semantic relationship types
- normalized Note block tables
- automatic Timeline activity
- offline/local-first synchronization
- autosave infrastructure
- tags
- per-type Library metadata
- Library progress
- AI-related entities
- collaboration or shared ownership
- complex audit/event logging
- background workers for delayed archive behavior

These may be introduced in later versions if required.

---

# 12. Implementation Guidance

The existing Continuum V1 implementation may already contain models or fields that differ from this document.

This document should not trigger a blind rewrite.

Before modifying the implementation:

1. Audit the existing SQLAlchemy models.
2. Audit existing Alembic migrations.
3. Compare API schemas and frontend types.
4. Identify differences from this accepted data model.
5. Distinguish harmless implementation differences from architectural conflicts.
6. Produce a migration plan.
7. Preserve existing data wherever possible.
8. Apply database changes through Alembic migrations.
9. Avoid unrelated refactoring.
10. Do not introduce features outside V1.

The preferred strategy is to adapt the existing implementation rather than rebuild it.

---

# Consequences

This model gives Continuum:

- explicit domain entities
- strong relational ownership
- flexible cross-entity links
- flexible note content through JSONB
- simple archive behavior without background infrastructure
- room to add richer editor blocks later
- a clean path toward future schema migrations

The tradeoff is intentional simplicity.

Some future features will require migrations.

That is acceptable and preferred over prematurely generalizing the V1 architecture.