# M2 — Goals and Projects

The dashboard provides a Workspace/Archive switch for Goals and Projects.
Users can create and explicitly save edits to titles, optional goal progress,
and optional project descriptions. Status actions are explicit API writes.
The Archive is read-only; deletion and restoration remain undecided in V1.

Goals support active/completed. Projects support
active/paused/completed/abandoned, including reopening into active or paused.
The first terminal transition starts a 48-hour grace period. Repeating or
switching terminal states does not extend it. Reopening during grace clears
the terminal timestamp; status changes after expiry are rejected.

Archive eligibility is derived from `completed_at + 48 hours`, so it remains
correct even when the app is closed. Reads of lists or individual items persist
the derived event in `archived_at` after expiry. This requires no background
worker. Open dashboard sections refresh every 30 seconds. Queries are scoped
to the authenticated user on the server and keyed by user identity on the client.

The M2 migration renames the earlier schema fields. Old `archive_at` values
were scheduled deadlines: expired deadlines remain archive events, while future
deadlines are cleared and derived from the preserved terminal timestamp.
Apply with `pnpm db:migrate` before serving the new API against an older database.
An additional repair revision also handles databases that applied the original
rename before its data correction was added.

Scope excludes generic links, Notes, Sticky Notes, Library, Timeline, delete,
archive restoration, and the later visual-polish milestone. M6 will extend the
Archive to the remaining archivable entities.
