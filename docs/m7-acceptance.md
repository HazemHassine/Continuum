# M7: notebook polish and acceptance

Status: local automated checks passed on 17 October 2026 after the user authorized
verification. Browser/visual acceptance below is still unrun; this is not a
completed M7 acceptance run or a visual sign-off.

## Slice contract

Goal: make the existing V1 notebook quieter and more reliable to use, including
when it has no entries, a request fails, or someone uses a keyboard or phone.

Allowed scope: existing notebook components, workspace CSS, and progress/docs.
Acceptance: loading/failure/empty states are distinct; existing entries remain
editable; search and explicit saves are keyboard-accessible; dialogs preserve
focus and unsaved changes; decorative drawing and refresh work stay bounded.

Non-goals: new entities, deletion/restore, autosave/offline storage, dependencies,
email delivery, deployment, or commits/pushes. Local verification was initially
deferred and subsequently authorized by the user.

## Source changes

- Each section waits only for its required collections. A first-load failure
  shows an error/retry state rather than an empty notebook. A failed refresh
  retains the last loaded entries and explains that they may be stale.
  Expired sessions have an explicit sign-in-again action rather than an endless
  retry; a background auth error does not forcibly dismiss unsaved editing.
- Only Goals and Projects retain 30-second polling for lifecycle/archive timing.
  Other collections refresh after writes, on stale window focus/reconnection,
  or by explicit retry. Archived Notes/Stickies load when Archive or Connections
  needs them. Client errors are not repeatedly retried.
- Small nonempty collections have a visible search button. Cmd/Ctrl+K opens
  search without stealing focus from a modal; Escape clears it and returns focus
  to the section heading.
- Notes, Library, Timeline, and Archive distinguish a search/filter with no
  matches from a genuinely empty collection. Timeline and Archive empty states
  no longer add decorative cards.
- Timeline has a secondary Edit action. Generic connection loading/failure
  states prevent incomplete data from being mistaken for no connections.
- Native dialogs use unique title IDs, focus their initial input after opening,
  restore the invoking control when still present, and block closure during
  saves/mutations. No replacement modal dependency was added.
- Form validation errors are associated with their fields. API save errors get
  focus without discarding writing. Cmd/Ctrl+Enter explicitly saves; it does not
  introduce autosave. Custom-type Enter adds the type instead of accidentally
  saving the whole Library item; Escape/Cancel type dismisses that sub-form.
- Custom Library types refresh their shared cache immediately after creation.
  Optional URLs/progress trim whitespace; Timeline dates are validated against
  actual calendar dates, not just a string pattern.
- Mobile controls have larger hit areas, form inputs avoid small text, headers
  wrap, and sticky-note columns leave enough room for their action controls.
  Long titles/connection labels wrap rather than forcing page width.
- Rough paper outlines measure unrotated dimensions and redraw at most once per
  animation frame, only when dimensions change. Reduced-motion support remains.

Implementation references: [TanStack Query](https://tanstack.com/query/v5/docs/framework/react/reference/useQuery)
for pending/error/cached-data and refresh behavior; [native dialog documentation](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog)
for modal focus, inert backgrounds, and cancel events.

## Local automated results — 17 October 2026

| Check | Result |
|---|---|
| `pnpm test:backend` | 57 passed, including 28 auth tests; SQLite-backed suite, not PostgreSQL integration acceptance. |
| `pnpm lint:backend` | Passed. |
| `pnpm lint:frontend` | Passed with no warnings/errors. |
| `pnpm --filter tracker-frontend exec tsc --noEmit --incremental false` | Passed. |
| Low-memory `pnpm build:frontend` | Passed compilation, lint/types, static generation (7/7), optimization and tracing. Dashboard first-load JS: 161 kB. |
| `docker compose exec -T backend alembic check` | Passed against the running PostgreSQL database; no new upgrade operations detected. |

Checks ran sequentially. The Docker frontend was temporarily stopped for the
production build and restarted afterward; API and database stayed running.
Build settings: `CONTINUUM_LOW_MEMORY_BUILD=1`, 2048 MB Node heap limit per process,
one Rayon thread, two libuv threads, telemetry disabled. The opt-in build flag
is documented in the README and does not affect normal/CI build concurrency.

No application fix was needed. Pytest emitted one nonblocking dependency warning:
Starlette deprecates its current httpx TestClient integration. No dependency
changes were made in response.

## Remaining browser/visual acceptance checks

All checks below are **not run in this validation pass**. Use disposable
accounts/data and schedule browser QA separately, keeping laptop resource use low.

| Check | Expected result |
|---|---|
| Empty account, all seven sections | One section heading and primary action; no repeated banner/quote/illustration; empty text accurately describes that section. |
| Uncached Notes request fails | Error and retry appear; "No notes yet" does not appear. Retrying restores the collection. |
| Timeline fails while Goals succeeds | Goals remains usable; unrelated collections do not hold its loading state open. |
| Refresh fails after entries loaded | Entries remain visible with a stale-data notice; a retry updates them. |
| Session expires with the workspace open | A sign-in-again action appears; no forced navigation discards a currently open editor. |
| Unavailable connection data | The dialog explains loading/failure and disables connection writes until the complete data is available. |
| Polling/network inspection | Goals/Projects still refresh while visible; other collections have no periodic timer; Archive collections load on demand. |
| One to five entries | Search button is discoverable by mouse/touch/Tab. Cmd/Ctrl+K focuses search; repeated invocation refocuses it. |
| Search/filter has no matches | Notes/Library/Timeline/Archive show "no matching" rather than implying records do not exist. Clear search/filter restores entries. |
| Search shortcut while editing | An open dialog retains focus; the background search is not activated. |
| Timeline editing | Secondary Edit opens the saved entry; title/date/description changes persist after explicit save. |
| Keyboard-only dialogs | Title is announced; initial field is focused; Tab stays inside; Escape closes safely; focus returns to the invoker when present. |
| Pending save or connection mutation | Close/Cancel/Escape cannot dismiss a still-pending write. Controls recover after failure; edits remain. |
| Invalid form | First invalid field receives focus and has an associated error description. Invalid calendar dates/unsafe URLs are rejected. |
| Custom Library type | Enter creates just the type; cancel/escape does not save the item; successful type creation is available in subsequent editors. |
| Explicit save shortcut | Cmd/Ctrl+Enter saves once with normal validation; errors retain writing; no background autosave occurs. |
| Unsaved writing | Closing/backdrop/Escape asks before discarding; a browser unload warns; a successful explicit save does not warn. |
| 320px/390px/640px widths and 200% zoom | No page-level horizontal overflow, clipped status controls, overlapping headings, or inaccessible sticky actions. The section index may scroll horizontally. |
| Long titles/URLs/connection labels | Text wraps or truncates locally without widening the page or pushing actions offscreen. |
| Reduced motion | No entrance/progress/hover motion is required to use the workspace. |
| Rotated/resized sticky and editor | Paper outline follows the actual dimensions; no resize-observer loop or excess redraws. |

Keep M7 acceptance open until the remaining browser/visual checks and design
review are complete. Passing automated checks does not establish visual quality,
keyboard behavior, responsive layout, or deployed V1 acceptance.
