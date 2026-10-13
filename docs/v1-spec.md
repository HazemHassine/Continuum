**CONTINUUM**

V1 Product  Technical Specification

A deliberately small, handcrafted personal tracking app that keeps goals, projects, notes, references, and life events connected without becoming a productivity suite.

| Document | V1 Product  Technical Specification |
|---|---|
| Date | 24 September 2026 |
| Status | Implementation-ready draft; deferred items are explicitly marked |
| Target | tracker.hazemhassine.space |

**V1 in one sentence**

**A multi-user, dashboard-first tracker where each user can manage simple goals and projects, keep notes and sticky notes, save external resources, curate a personal timeline, connect entities with generic links, and review archived work.**

| Scope rule<br>V1 should prove the core loop and visual identity. Anything not explicitly required below is deferred, even if an AI coding agent could implement it quickly. |
|---|

# 1. Decision snapshot

| LOCKED | Core entities, lifecycle rules, generic links, single-date timeline, BlockNote, PostgreSQL + FastAPI + Next.js, and the sketch-style toolchain. |
|---|---|

| DEFERRED | Semantic link types, sub-goals, project deadlines, timeline date ranges, autosave/offline sync, tags, AI, rich media blocks, activity log, and per-type Library metadata. |
|---|---|

| CAUTION | Deletion/restoration behavior and Library archive behavior were not explicitly decided. Do not add irreversible behavior until those choices are made. |
|---|---|

# 2. Product principles

**Dashboard first. **The main screen should provide an immediate picture of what matters now. The user should be able to open, glance, update, and leave.

**Structured, but not rigid everywhere. **Goals and projects have clear lifecycle rules. Notes, links, timeline entries, and Library items remain flexible.

**Connections are optional. **Entities stand on their own. Linking enriches context but is never required.

**Curated history, not an activity dump. **The Timeline is a deliberate visual history. Automatic activity logging is a separate future concept.

**Handcrafted, not chaotic. **The interface uses selective hand-drawn accents over a normal, reliable UI foundation. Readability always wins.

**No feature drift. **New ideas go to the deferred list unless they are required to satisfy a V1 acceptance criterion.

# 3. V1 user experience

## Entry and onboarding

One-screen landing page; no long marketing page is required.

Email + password registration and sign-in using native FastAPI Auth (JWT + bcrypt).

A very small first-run onboarding tour highlights the main areas and controls.

Every user sees only their own data.

## Main application areas

| Area | Purpose |
|---|---|
| Dashboard | Current-state overview and home for sticky notes. |
| Goals | Simple outcomes with optional percentage progress. |
| Projects | Execution units with a small lifecycle. |
| Notes | Durable block-based writing. |
| Sticky Notes | Fast, lightweight dashboard thoughts that can become Notes. |
| Library | External things the user did not create: books, films, articles, courses, videos, etc. |
| Timeline | A manually curated visual history of meaningful events. |
| Archive | A global place for items that have left the active workspace. |

# 4. V1 domain model

| Modeling rule<br>Core concepts stay explicit (Goal, Project, Note, Sticky Note, Library Item, Timeline Entry). Cross-cutting relationships use a generic Link mechanism. Do not collapse everything into one giant polymorphic “Entity” table. |
|---|

## Goal

**Purpose: **A small, direct expression of something the user wants to achieve.

title: Required text; the primary human-facing value.

status: active | completed

progress_percent: Optional 0–100 percentage.

created_at: System timestamp.

updated_at: System timestamp.

completed_at: Set when completed.

archived_at: Set after lifecycle archive transition.

No sub-goals in V1.

No manual archive for Goals.

Completed Goals enter a two-day grace period, then archive automatically.

Reopening during the grace period cancels the archive countdown.

## Project

**Purpose: **A unit of execution that may optionally connect to Goals, Notes, Timeline entries, Library items, or other entities.

title: Required text.

description: Optional text.

status: active | paused | completed | abandoned

created_at: System timestamp.

updated_at: System timestamp.

completed_at: Set for the completion transition; abandoned timing can reuse the same terminal timestamp in implementation or use a separate field later if needed.

archived_at: Set after lifecycle archive transition.

No deadline in V1.

No separate started-at field in V1.

No manual archive for Projects.

Completed or abandoned Projects enter a two-day grace period, then archive automatically.

Returning to active/paused during the grace period cancels the archive countdown.

## Timeline Entry

**Purpose: **A deliberately curated point in the user’s personal history.

title: Required text.

description: Optional text.

event_date: One calendar date only in V1; no date ranges.

created_at: System timestamp.

updated_at: System timestamp.

Timeline entries are manually created/curated. Completion of a Goal or Project must not automatically create a Timeline entry.

Timeline entries are editable, but editing is a secondary interaction rather than a dominant UI affordance.

A Timeline entry may link to multiple other entities.

Timeline color semantics are deliberately not defined in V1.

## Note

**Purpose: **Durable, free-flowing writing that can exist independently or connect to anything else.

title: Required or lightweight title; UI may allow a simple default if desired.

content: BlockNote document stored as structured JSON (recommended implementation).

created_at: System timestamp.

updated_at: System timestamp.

archived_at: Set by manual archive action.

Notes are standalone/free-flowing; they do not belong to a Project or Goal by default.

V1 editor content is intentionally narrow: text/Markdown-style writing and checklists.

Blocks can be reordered.

Rich custom blocks such as Project/Goal/Library reference cards are future work, but the storage choice should not block them.

Notes can be manually archived.

## Sticky Note

**Purpose: **Fast, lightweight thoughts that visually live on the Dashboard.

Always presented as a Dashboard concept while active.

May link to Projects, Goals, Notes, Library items, Timeline entries, or other supported entities.

Can be converted/promoted into a full Note.

Color is decorative only; it carries no semantic meaning in V1.

Can be manually archived.

V1 content should remain lightweight; rich images/embedded media are deferred.

## Library Item

**Purpose: **Store external things the user did not create and may want to read, watch, take, or reference.

title: Required text.

type: One default or user-created Library type.

url: Optional URL.

description: Optional text.

created_at: System timestamp.

updated_at: System timestamp.

Default types: book, movie, series, article, course, video.

Users can create additional reusable custom types. Custom types are global to that user, not one-off labels.

No per-type fields in V1 (for example, no author-only field for books).

Library items have no inherent progress/lifecycle. Progress belongs to a Goal or Project if the Library item is linked there.

The Library is not a place for the user’s own Notes or writing.

# 5. Linking and lifecycle rules

## Generic links

V1 has one generic relationship: link.

The edge itself has no semantic meaning such as “belongs to”, “references”, or “depends on”.

An entity may link to multiple entities, and an entity may be linked from multiple entities.

Examples: Project ↔ Goal, Project ↔ Note, Timeline ↔ Project, Note ↔ Library Item, Sticky Note ↔ Goal.

Semantic relationship types are deferred until a concrete need appears.

| Project ─────┐Goal ───────┼── generic Link ──→ any supported entityNote ───────┤Sticky ─────┤Timeline ───┤Library ────┘ |
|---|

## Archive behavior

| Entity | Trigger | Grace period | Manual archive |
|---|---|---|---|
| Goal | Completed | 2 days | No |
| Project | Completed / abandoned | 2 days | No |
| Note | User action | None | Yes |
| Sticky Note | User action | None | Yes |
| Timeline | Not specified | — | Not specified |
| Library | Not specified | — | Not specified |

| Important implementation boundary<br>Do not invent delete, restore, Timeline archive, or Library archive behavior. These were not explicitly decided. Prefer reversible/no-op behavior until the product choice is made. |
|---|

# 6. Recommended V1 database schema

**Database: **PostgreSQL (Local / Docker). **ORM: **SQLAlchemy. **Migrations: **Alembic (recommended default).

| Schema philosophy<br>Use explicit tables for core concepts and one polymorphic link table for cross-entity relationships. PostgreSQL remains the source of truth. Do not add a universal “everything” table just to make links easier. |
|---|

| Table | V1 columns |
|---|---|
| users | id uuid PK, email text unique, hashed_password text, created_at timestamptz |
| profiles | id uuid PK FK(users.id), onboarding_completed_at timestamptz nullable, created_at timestamptz |
| goals | id uuid PK, user_id uuid, title text, status text, progress_percent smallint nullable, created_at, updated_at, completed_at nullable, archived_at nullable |
| projects | id uuid PK, user_id uuid, title text, description text nullable, status text, created_at, updated_at, completed_at nullable, archived_at nullable |
| notes | id uuid PK, user_id uuid, title text, content jsonb, created_at, updated_at, archived_at nullable |
| sticky_notes | id uuid PK, user_id uuid, content text, color_token text nullable, created_at, updated_at, archived_at nullable |
| timeline_entries | id uuid PK, user_id uuid, title text, description text nullable, event_date date, created_at, updated_at |
| library_types | id uuid PK, user_id uuid nullable for system defaults, name text, slug text, is_system boolean, created_at |
| library_items | id uuid PK, user_id uuid, type_id uuid FK, title text, url text nullable, description text nullable, created_at, updated_at |
| entity_links | id uuid PK, user_id uuid, source_type text, source_id uuid, target_type text, target_id uuid, created_at |

**Security rule: **The client must never choose an arbitrary user_id. FastAPI derives the authenticated user from the verified JWT and scopes every query/mutation to that user.

**Polymorphic link caveat: **entity_links cannot enforce a normal foreign key across multiple target tables. V1 should validate source/target ownership and existence in the API layer and prevent duplicate links.

# 7. Technical architecture

| Browser  │  ├── Next.js / React UI  │      ├── Tailwind CSS  │      ├── shadcn/ui (recommended UI primitives)  │      ├── TanStack Query  │      ├── React Hook Form + Zod  │      ├── BlockNote  │      ├── Rough.js  │      └── Rough Notation  │  └── FastAPI API           ├── /api/v1/auth (login, register, me)           ├── verify JWT           ├── business/lifecycle rules           ├── SQLAlchemy           └── PostgreSQL (Docker / Local) |
|---|

| Concern | Decision |
|---|---|
| Frontend | Next.js + React. |
| Backend | FastAPI. All application data writes go through the API. |
| Database | PostgreSQL; server is the source of truth. |
| Authentication | Native FastAPI Auth (JWT + bcrypt); free & unlimited, self-hosted. |
| Client data fetching | TanStack Query for server state/cache; ordinary React state for local UI state. |
| Forms/validation | React Hook Form + Zod on the frontend; Pydantic validation on FastAPI. |
| Editor | BlockNote. |
| Autosave/local-first | Not in V1. Explicit save to the server; no IndexedDB/offline synchronization. |
| Global state | No Redux. Add a small state library only if a concrete need appears. |

# 8. Visual system for V1

| Visual thesis<br>A normal, reliable application underneath; a handcrafted sketchboard personality on top. Roughness is an accent, not the layout engine. |
|---|

**Layout first. **Use normal responsive CSS/Tailwind for spacing, sizing, grids, forms, and accessibility.

**Rough.js for structure accents. **Use selectively for hand-drawn card outlines, timeline lines, connectors, frames, and decorative geometry.

**Rough Notation for emphasis. **Use for underlines, circles, highlights, boxes, and strike-through effects around normal HTML.

**Do not sketch everything. **Inputs, body text, navigation, and high-frequency controls should remain crisp and readable.

**Variable card sizes are expected. **Notes and cards may grow vertically. The sketch treatment must wrap the actual DOM dimensions rather than assume square cards.

**Sticky colors are decorative. **No status or category meaning is attached to sticky-note color in V1.

**Handcrafted != random. **Use a small repeatable set of roughness/stroke parameters so the app feels designed rather than noisy.

## Recommended frontend library baseline

Tailwind CSS: layout, responsive behavior, spacing, tokens

shadcn/ui: accessible behavioral primitives that can be visually restyled

Lucide: crisp functional icons; do not roughen every icon

TanStack Query: API/server state

React Hook Form + Zod: forms and frontend validation

BlockNote: block-based Notes editor

Rough.js: hand-drawn structural accents

Rough Notation: hand-drawn annotations/emphasis

# 9. Explicit V1 non-goals

Sub-goals / hierarchical Goals.

Project deadlines or started-at dates.

Timeline date ranges.

Semantic relationship types such as belongs-to, depends-on, or references.

Automatic Timeline population.

Full activity feed/activity log (can be designed later as a separate system).

Tags unless a concrete retrieval/organization problem proves they are needed.

AI assistant, global AI context, recommendations, or agent features.

Autosave, IndexedDB, offline-first behavior, conflict resolution, or multi-device sync logic.

Images/embeds/rich media inside Notes or Sticky Notes.

Rich custom BlockNote cards for linked Projects/Goals/Library items.

Per-type Library metadata such as author, duration, pages, director, etc.

Progress/lifecycle on Library items.

Collaboration/shared workspaces.

A custom-built editor or drawing engine.

# 10. V1 acceptance criteria

A new user can register with email/password, verify the account, sign in, and complete the lightweight onboarding.

A signed-in user cannot access another user’s application data.

A user can create and update a Goal, set optional percentage progress, complete it, reopen it during the two-day grace period, and later see it in Archive.

A user can create and update a Project, move it among active/paused/completed/abandoned, reopen terminal states during the grace period, and later see it in Archive.

A user can create a Note, write/reorder supported BlockNote content, save it explicitly, link it to other entities, and manually archive it.

A user can create a Sticky Note on the Dashboard, link it, change its decorative color, convert it to a Note, and manually archive it.

A user can create Library items using default types and create reusable custom Library types.

A user can create a single-date Timeline entry, edit it, and link it to multiple entities.

Generic links can connect supported entities without requiring a semantic relationship type.

The Archive presents archived items in a coherent global view.

The UI is responsive and uses the agreed handcrafted visual language without sacrificing readability or basic accessibility.

The deployed V1 runs with Next.js + FastAPI on Vercel and Supabase Free for PostgreSQL/Auth.

# 11. Implementation roadmap

| Development method<br>Build vertical slices. Each milestone should leave a usable path from UI → API → database, rather than assigning separate agents to isolated frontend/backend layers with no integrated acceptance test. |
|---|

## M0 — Scaffold

Repo structure, Next.js app, FastAPI app, environment config, Supabase project, SQLAlchemy/Alembic, base CI/linting.

## M1 — Identity + shell

Landing page, email/password auth, verification, protected app shell, per-user identity, onboarding completion state.

## M2 — Goals + Projects

Database tables, API routes, UI screens/cards, lifecycle transitions, two-day grace logic, Archive integration.

## M3 — Generic links + Library

entity_links API, default/custom Library types, Library CRUD, link UI that can connect supported entities.

## M4 — Notes + Sticky Notes

BlockNote integration, explicit saving, reorderable V1 content, sticky dashboard behavior, sticky → note conversion, manual archive.

## M5 — Timeline

Single-date curated entries, editing, multi-link support, timeline visualization.

## M6 — Archive + lifecycle hardening

Global archive view, status-transition tests, delayed archive behavior, ownership/security tests.

## M7 — Visual identity + polish

Rough.js/Rough Notation pass, responsive QA, empty states, error states, onboarding tour, performance cleanup.

## M8 — Deploy + acceptance test

Vercel deployment(s), Supabase production config, tracker subdomain, end-to-end V1 acceptance checklist.

# 12. AI-assisted development guardrails

Every coding task must state: goal, allowed scope/files, acceptance criteria, and explicit non-goals.

Agents may not add dependencies simply because they are convenient; dependencies must fit the approved stack or be justified first.

Agents may not introduce V2 ideas while implementing a V1 slice.

Prefer migrations over speculative abstractions. A clear schema today is better than a generic “future-proof” schema that obscures the domain.

After each vertical slice, review whether the product is closer to the original V1 goal before starting the next feature.

New feature ideas go to a backlog/deferred list, not directly into implementation.

# 13. Deferred / still-open decisions

| Decision | Current status |
|---|---|
| Deletion | Hard delete vs soft delete/recycle behavior was not decided. |
| Restore from Archive | Reopening during the two-day grace period is defined; restoring an already archived item is not. |
| Library archive behavior | Library has no lifecycle/progress; whether Library items can be manually archived is not yet defined. |
| Timeline archive behavior | No archive rule was defined for Timeline entries. |
| Timeline colors | Color-coded timeline blocks were discussed conceptually but no semantic/decorative rule was chosen. |
| Sticky Note content format | V1 should remain lightweight, but the exact storage/editor format was not explicitly chosen. Plain text is the lowest-complexity default. |
| Future relationship semantics | If generic links become ambiguous, introduce typed edges later based on actual use cases. |

# 14. Definition of V1 complete

**V1 is complete when the acceptance criteria above are satisfied, the app is deployed at the Tracker subdomain, the main workflows are stable for multiple users with strict data isolation, and the product still feels intentionally small.**

| What comes next<br>After V1 is usable, evaluate it in real use before choosing V1.1/V2 features. Candidates already discussed include semantic links, tags, richer custom Note blocks, activity history, autosave/local drafts, sub-goals, richer Library metadata, and AI context — but none should be assumed necessary. |
|---|
