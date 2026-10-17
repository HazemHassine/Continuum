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

The workspace uses a numbered notebook index, plain section names, serif
headings, and a flat off-white page. Goals and Projects appear as numbered entries
on a ruled ledger with a faint margin line, rather than separate dashboard cards.
Rough.js outlines remain on Notes, sticky notes, and dialogs. Tape and handwriting
are confined to sticky notes; the workspace has no decorative mountains, quotes,
motivational banners, breadcrumbs, or repeated global add controls. Landing-page
illustrations remain separate from the working notebook.

Each section has one primary add action. Search appears for six or more entries
or when invoked with Cmd/Ctrl+K; filters appear when there are multiple entries.
An empty Today page has a simple explanation and one blank sticky-note surface.
Other overview sections appear only when they have content. Project status is
shown once, with its control in the entry row and its archive date below.

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

The later decluttering and hardening revisions were initially source-only at
the user's request. On 17 October 2026 the user authorized local builds/tests.
The current source passed 57 backend tests, backend/frontend lint, standalone
TypeScript checking, a low-memory production build, and `alembic check` against
the running PostgreSQL database. Checks ran sequentially, with only the frontend
dev container temporarily stopped for the production build and restored afterward.
The backend suite uses SQLite. Latest-version browser/visual QA is still pending.

The subsequent auth-hardening pass adds server-side
email/password validation (including bcrypt's UTF-8 byte limit), required JWT
expiry/issued-at/subject claims, safe handling of malformed credentials, and
idempotent onboarding completion. The browser retains a saved session during
temporary API/network failures and offers retry instead of silently signing out.
Auth pages remain reachable with stale cookies, login redirects stay within
the dashboard, and auth cookies use Secure on HTTPS. This does not change the
existing localStorage-based token architecture or introduce email verification.
Its regression tests now pass. Search shortcut focus and onboarding
instructions were corrected to match the simplified workspace.

The following M7 usability pass is compiled/type-checked but not browser-validated: section-specific loading
and error handling, discoverable search, accurate empty/filter states, Timeline
editing, connection-loading guards, dialog focus and pending-save behavior,
field-level error descriptions, explicit keyboard saves, safer custom-type entry,
larger mobile controls, and bounded polling/rough-outline redraws. See
[M7 acceptance](m7-acceptance.md) for the changes and the **unrun** review checklist.

## Explicit boundaries and remaining acceptance work

The Stitch reference's habits, sub-goals, tags, semantic links, and activity feed
are excluded. No delete/restore behavior, Library/Timeline archiving, deadlines,
autosave, media blocks, AI, or collaboration is introduced.

The original auth slice still does not verify email accounts. Production email
verification/delivery and deployment to the target domain remain separate V1
acceptance work; this document does not claim deployed V1 completion.
