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

The frontend reads the root workspace manifests and lockfile on startup and
synchronizes its dependency volumes using a frozen install. This keeps editor
dependencies aligned even when an existing Docker image predates a lockfile change.
Installation concurrency is limited for smaller machines.

To pick up frontend dependency or Compose changes without rebuilding images:

```bash
docker compose up -d --no-deps --no-build frontend
```

This restarts only the frontend. It does not build the app or run tests; Next.js
will compile development pages when you open them.

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
- Frontend types: `pnpm --filter tracker-frontend exec tsc --noEmit --incremental false`
- Production build: `pnpm build:frontend`

For a lower-concurrency production build on a constrained laptop:

```bash
CONTINUUM_LOW_MEMORY_BUILD=1 NODE_OPTIONS=--max-old-space-size=2048 RAYON_NUM_THREADS=1 UV_THREADPOOL_SIZE=2 pnpm build:frontend
```

This opts into one Next.js page-generation worker and a 2 GB Node heap limit
per process, not a total-machine memory cap. Run checks sequentially. If the
Docker frontend is running, temporarily stop only that service before building
(`docker compose stop frontend`) and restore it afterward (`docker compose start frontend`).
