# Data layer (db)

- **Redis** – game-related only (stats, global stats, player stats). No user data in Redis.
- **PostgreSQL** – all user-related data (/user endpoint): profile, color, auth.

## Layout

- **db/redis.js** – Redis client and helpers for game data only (`PLAYER_STATS`, `GLOBAL_STATS`).
- **db/index.js** – Entry point. Exports `client`, `redisHelpers`, `REDIS_KEYS`, `userStore`.
- **db/user-postgres.js** – User store using PostgreSQL. Creates `users` table on first use.

## Usage

```js
const { client, redisHelpers, userStore } = require('./db');
```

## User store (PostgreSQL)

User data lives in the database only. PostgreSQL is required for the `/user` endpoint and auth.

### Env

- **Single URL:** `DATABASE_URL=postgresql://user:password@host:5432/dbname`
- **Or individual:** `POSTGRES_HOST`, `POSTGRES_PORT` (5432), `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` (default `cow_game`). Optional: `POSTGRES_SSL=true`, `POSTGRES_USERS_TABLE` (default `users`).

### Local development setup

1. **Install PostgreSQL** (pick one):
   - **macOS (Homebrew):** `brew install postgresql@16` then `brew services start postgresql@16`.
   - **Docker:** `docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=cow_game --name postgres postgres:16-alpine`.

2. **Use defaults** – With Docker above, set `POSTGRES_PASSWORD=postgres` or use `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/cow_game`. The app creates the `users` table on first use.

3. **Run the app** – `npm start` (or `npm run dev`). User store connects on first `/user` or auth request.

### Viewing the database

- **CLI (psql):** `psql -h 127.0.0.1 -U postgres -d cow_game -c "SELECT * FROM users;"`
- **GUI:** [pgAdmin](https://www.pgadmin.org/), [TablePlus](https://tableplus.com/), or any PostgreSQL client. Connect with the same host/port/user/db as the app.

## User store API

- `getUser(username)` → user or null
- `createUser(username, passwordHash, color?)` → user
- `updateUserLogin(username)` → user or null
- `getPlayerColor(username)` → hex string
- `savePlayerColor(username, color)` → { color, updatedAt }
