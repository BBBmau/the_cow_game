# Cow Game API (Go)

HTTP API for database-backed data (e.g. leaderboard). Written in Go.

## Endpoints

- **GET /health** – Liveness/readiness (JSON: `status`, `timestamp`).
- **GET /api/leaderboard** – Leaderboard entries from Postgres. Query: `?limit=100` (default 100, max 500). Response: `{ "entries": [ { "username", "level", "experience", "hayEaten" }, ... ] }`.

## Database

Uses the same Postgres as the rest of the app. On first run it creates a `leaderboard` table if missing:

- `username` (TEXT, PK)
- `level`, `experience`, `hay_eaten` (INTEGER)
- `updated_at` (BIGINT)

Populate it from the game server (e.g. sync Redis stats) or another job.

## Config (env)

Same as the Node services:

- **DATABASE_URL** – Full Postgres URL, or:
- **POSTGRES_HOST** (default `127.0.0.1`)
- **POSTGRES_PORT** (default `5432`)
- **POSTGRES_USER** / **POSTGRES_PASSWORD** / **POSTGRES_DB** (default `cow_game`)
- **POSTGRES_SSL** – `true` for TLS.
- **PORT** – HTTP port (default `8080`).

## Run locally

```bash
cd api
go run .
```

With Postgres env set (or `.env`), then open `http://localhost:8080/api/leaderboard` and `http://localhost:8080/health`.

## Build

```bash
go build -o api .
```

## Docker

From repo root:

```bash
docker build -f Dockerfile.api -t cow-game-api .
```

Or use the multi-stage `Dockerfile.api` in the repo root (builds from `api/` context).
