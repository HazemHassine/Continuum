# Tracker Development Rules

Read docs/v1-spec.md before making architectural decisions.

V1 scope must not be expanded without explicit approval.

Do not implement features from docs/backlog.md.

Prefer simple explicit architecture over generic abstractions.

Before making a significant architectural decision:
1. Explain the decision.
2. Give alternatives.
3. Wait for approval if it changes the V1 specification.

Stack:
- Next.js
- FastAPI
- PostgreSQL / Supabase
- Supabase Auth
- SQLAlchemy
- BlockNote
- Tailwind
- shadcn/ui
- Rough.js
- Rough Notation

Do not introduce new major dependencies without justification.