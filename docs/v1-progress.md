# V1 progress and release checklist

Status: local automated verification passed on 17 October 2026; not a release sign-off.

## Current slice

M7 notebook polish and usability. Source work covers section-specific load/error
states, accurate empty/search states, Timeline editing, discoverable search,
dialog/form accessibility, and bounded refresh/drawing work. Scope and the
unrun acceptance checklist are in [m7-acceptance.md](m7-acceptance.md).

## Previous slice: auth hardening

Goal: close reliability gaps in the existing authentication and notebook shell.
Scope: auth schemas/routes/JWT handling, session recovery, login redirects,
onboarding copy, search focus, regression-test source, and implementation docs.
Acceptance: invalid credentials fail safely; access tokens require expiration;
temporary API failures do not erase saved sessions; onboarding completion is
idempotent; the tour describes the current controls.
Non-goals: changing the authentication stack, adding dependencies or V2 features,
deploying, sending email, running builds/tests, or committing/pushing changes.

## Milestones

| Milestone | Implementation status | Remaining acceptance work |
|---|---|---|
| M0: Foundation | Next.js, FastAPI, PostgreSQL, migrations, lint/test scripts | No checked-in CI workflow yet. |
| M1: Identity and shell | Native JWT/bcrypt auth, isolation, protected shell, first-run tour; auth regression tests pass | Email verification/delivery and browser session-recovery acceptance. |
| M2: Goals and Projects | Editing, progress, lifecycle, two-day grace period, Archive | Repeat lifecycle acceptance on the final candidate. |
| M3: Links and Library | Generic links, default/custom types, create/edit | Final multi-user acceptance. |
| M4: Notes and Stickies | BlockNote, explicit save/reorder, promotion, manual archive | Confirm editor behavior after the Docker dependency repair. |
| M5: Timeline | Manual single-date entries, editing, connections | Final responsive/keyboard acceptance. |
| M6: Archive and hardening | Global read-only Archive and regression coverage | Final ownership and delayed-archive acceptance. |
| M7: Visual polish | Simplified notebook layout plus usability/accessibility/performance source pass | User design review and the unrun M7 acceptance checklist; responsive/accessibility/performance QA. |
| M8: Deployment | Not complete | Hosting decisions, secrets/email setup, migrations, target domain, acceptance. |

## Verification boundary

The latest decluttering, auth-hardening, and M7 source passed 57 backend tests,
backend/frontend lint, standalone TypeScript checking, a low-memory production
build, and Alembic schema agreement against the running PostgreSQL database.
These checks were authorized by the user and executed sequentially on the laptop.
See [M7 results](m7-acceptance.md) for commands, limitations and the dependency warning.

Earlier desktop/mobile browser checks covered the initial notebook version,
not these latest changes. The current browser/visual checklist remains unrun.
The backend regression suite uses SQLite; it does not replace final PostgreSQL
integration, multi-user browser, or deployed acceptance. No production-readiness
claim is made.

## Next decisions and work

1. Confirm the email sender/provider. Standard SMTP is the proposed minimal
   approach; a provider API is an alternative. Keep credentials out of chat/git.
2. Implement and verify the complete email-verification path, including token
   expiry, replay protection, resend limits, delivery failures, and existing-user
   handling. This is still pending, not covered by the auth-hardening work.
3. Review the simplified UI, then resolve any concrete visual/usability issues.
4. Complete remaining browser/visual and PostgreSQL integration acceptance;
   add remote CI before release. Local automated checks now pass.
5. Confirm deployment hosting for the approved native FastAPI auth/PostgreSQL
   stack. Older roadmap/acceptance text still mentions Supabase Auth; do not
   silently reintroduce it or treat that stale text as a hosting decision.
6. Complete the V1 acceptance checklist on the deployed target domain.

Deletion, Archive restore, Library/Timeline archiving, and backlog features stay
outside this work. Existing uncommitted UI/Docker changes remain preserved.
