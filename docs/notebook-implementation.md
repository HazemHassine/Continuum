# Continuum notebook implementation

## Goal and scope

Bring the existing Next.js/FastAPI app to the handcrafted notebook experience
described by the V1 specification and the Stitch project
[Handcrafted Personal Life Tracker](https://stitch.withgoogle.com/projects/10518291288733707340).
Scope covers the frontend application, existing V1 entity tables, their API
routes, migrations, and verification. The existing authentication model is kept.

Acceptance for this implementation: real server-backed workflows across Today,
Goals, Projects, Notes, Library, Timeline, and Archive; explicit saves; per-user
ownership; optional generic connections; a responsive, accessible paper-and-ink
interface. This is a local implementation, not a production deployment.

## Design choices

Warm archival paper and restrained sage/yellow washes follow the Stitch reference.
Epilogue is used for crisp reading and headings, Courier Prime for records,
and Caveat for handwritten module titles and marginalia. Paper outlines use
Rough.js with a fixed seed and a ResizeObserver, so they fit variable-height cards.
Rough Notation adds emphasis to ordinary HTML headings. Decorative mountains,
ink strokes, tape, and a light paper grain are rendered locally as SVG/CSS.

Native modal dialogs provide focus containment and Escape handling. Unsaved edits
are confirmed before closing; unload protection also guards a dirty editor.
Animations respect reduced-motion preferences. Labels, errors, keyboard focus,
search (including Cmd/Ctrl+K), and mobile navigation remain ordinary controls.

## Workflows

- Goals and Projects keep the M2 lifecycle and two-day archive rules.
- Notes use the installed BlockNote editor, narrowed to paragraphs, headings,
  bullet/numbered lists, and checklists. Server validation rejects media and
  unsupported inline content. Saving is explicit; the editor supports reordering.
- Sticky notes live on Today, have decorative colors, and can be archived or
  promoted into a Note. Promotion copies text and connections atomically, then
  archives the original. A row lock prevents simultaneous duplicate promotions.
- Library includes six default types and reusable custom types owned by the user.
  All item types share title, optional URL, and optional description.
- Timeline entries store one date and are created by the user. Status changes
  never insert Timeline entries.
- Generic connections validate both owners/existence, canonicalize orientation,
  and are unique at the database level. Unlinking removes only the connection.
- Archive presents Goals, Projects, Notes, and sticky notes together, read-only.

All data writes go through FastAPI. React Query keys include the authenticated
user, and sign-out clears the client cache. No application records are stored
offline. The migration aligns `color_token`, `event_date`, and Library `slug`,
and adds uniqueness for custom types and generic links.

## Dependency compatibility

The installed BlockNote 0.22 imports ProseMirror's internal
`__serializeForClipboard` export. ProseMirror View 1.38+ removed it; the workspace
pins the already-transitive dependency to 1.37.2, which exports it. An editor
upgrade can remove this pin later. No new major product dependency was added.

## Verification

Backend regression tests cover ownership, explicit Note updates and reordering,
archive behavior, restricted Note blocks, sticky promotion and connection transfer,
custom Library types, canonical links, and manually curated single-date Timeline.
Run with `pnpm test:backend`; lint with `pnpm lint`; build with
`pnpm build:frontend`. `alembic check` verifies model/migration agreement.

Browser QA uses a disposable PostgreSQL schema and a separate API/Next.js server.
It checks navigation, goal creation and progress clearing, BlockNote saving,
connections, and mobile sticky creation. Desktop and 390px mobile screenshots
are visually reviewed, including mobile overflow. QA data never enters the
normal application's schema.

## Explicit boundaries and remaining acceptance work

The Stitch reference's habits, sub-goals, tags, semantic links, and activity feed
are excluded. No delete/restore behavior, Library/Timeline archiving, deadlines,
autosave, media blocks, AI, or collaboration is introduced.

The original auth slice still does not verify email accounts. Production email
verification/delivery and deployment to the target domain remain separate V1
acceptance work; this document does not claim deployed V1 completion.
