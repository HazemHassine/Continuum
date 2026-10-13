# Continuum

A handcrafted personal tracking app for goals, projects, notes, library, and timeline.

## Quick Start (One Command)

To run everything (PostgreSQL database, FastAPI backend, and Next.js frontend) in Docker:

```bash
docker compose up
```

- **Frontend:** [http://localhost:3100](http://localhost:3100)
- **FastAPI API & Docs:** [http://localhost:8100/docs](http://localhost:8100/docs)
- **PostgreSQL:** port `5434` (mapped to avoid collisions with local Postgres services)

---

## Local Development (Without full Docker)

If you prefer to run services directly on your host machine:

1. **Start database container:**
   ```bash
   docker compose up db -d
   ```

2. **Run migrations:**
   ```bash
   pnpm db:migrate
   ```

3. **Run backend & frontend concurrently:**
   ```bash
   pnpm dev:local
   ```
   Or run individually:
   - Backend: `pnpm dev:backend`
   - Frontend: `pnpm dev:frontend`

---

## Testing & Quality

- Backend tests: `pnpm test` (or `pytest` in `backend/`)
- Backend lint: `pnpm lint:backend` (Ruff)
- Frontend lint: `pnpm lint:frontend` (ESLint)
