# the_cow_game - [playthecowgame.com](https://www.playthecowgame.com)

[![Latest Commit is LIVE](https://github.com/BBBmau/the_cow_game/actions/workflows/deploy.yaml/badge.svg?branch=main&event=push)](https://github.com/BBBmau/the_cow_game/actions/workflows/deploy.yaml)

<img width="5120" height="2638" alt="image" src="https://github.com/user-attachments/assets/b2a04d7c-3948-481d-9d3e-de0cec510968" />


Screenshot taken on august 2nd, 2025

## An MMO game where you control a cow and do cow things - inspired by [fly.pieter.com](https://fly.pieter.com)

To run locally, use the steps below.

## Prerequisites

- **Node.js** (v16 or higher)
- **Docker** (for Redis and PostgreSQL), or install Redis and PostgreSQL locally

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start Redis and PostgreSQL (easiest with Docker):**
   ```bash
   docker-compose up -d
   ```
   This starts:
   - **Redis** on port 6379 (game stats)
   - **PostgreSQL** on port 5432 (user accounts, database `cow_game`, user `postgres`, password `postgres`)

   Or run each locally: Redis on 6379, PostgreSQL on 5432 with a database named `cow_game`.

3. **Point the app at PostgreSQL (only if not using docker-compose defaults):**
   ```bash
   export DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/cow_game"
   ```
   With the docker-compose above, these are the defaults; you can omit this.

4. **Test Redis (optional):**
   ```bash
   node test-redis.js
   ```

5. **Start the game server** from the repo root (folder that contains `server.js` and `game/`):
   ```bash
   cd /path/to/the_cow_game
   node server.js
   ```
   You should see:
   ```
   DB: Redis (game only). User store: PostgreSQL.
   Server running on port 6060
     Game:    http://localhost:6060/game
     Health:  http://localhost:6060/health
   ```

6. **Open in browser:** [http://localhost:6060/game](http://localhost:6060/game)

The server starts without waiting for Redis or PostgreSQL; `/` and `/health` respond immediately. Game stats need Redis; sign-up and user data need PostgreSQL.

## Debugging locally

To debug static file serving (e.g. `/game/cow.js` 404s), run with debug logging:

```bash
npm run dev
# or: DEBUG=1 node server.js
```

Then open the game and watch the terminal. Each request for a static file will log:
- `pathname` – URL path requested
- `filePath` – resolved filesystem path
- `gameDir` – path to the `game/` directory
- `__dirname` – directory containing `server.js`
- `exists` – whether the file was found

**Quick checks:**

1. **From repo root** (required so `game/` is next to `server.js`):
   ```bash
   cd /path/to/the_cow_game
   DEBUG=1 node server.js
   ```

2. **Test in browser:**  
   Open `http://localhost:6060/game` and check the terminal for `[static]` lines when the page loads scripts.

3. **Test with curl:**
   ```bash
   curl -I http://localhost:6060/game
   curl -I http://localhost:6060/game/cow.js
   curl -I http://localhost:6060/game/ui.js
   ```
   Expect `200 OK` for each.

4. **Match production (Docker):** With Redis and Postgres running (e.g. `docker-compose up -d`), run the app in a container:
   ```bash
   docker build -t cow-game .
   docker run -p 6060:6060 \
     -e REDIS_HOST=host.docker.internal \
     -e DATABASE_URL="postgresql://postgres:postgres@host.docker.internal:5432/cow_game" \
     cow-game
   ```
   On Linux you may need `--add-host=host.docker.internal:host-gateway` so the container can reach Redis and Postgres on the host.

## Redis Integration

The game uses Redis for items and stats management:
- **Player Items**: Collectible items with metadata (WIP)
- **Player Stats**: Experience, level and Hay Eaten
- **Global Stats**: Server-wide statistics

### Redis Data Structure
- `cow_game:stats:{playerId}` - Player's statistics
- `cow_game:global_stats` - Global server statistics

### Available Commands
- `collect_hay` - Collect hay for experience and stats
- `get_stats` - Retrieve player and global statistics

### Game Features
- **Hay Collection**: Walk near hay bales to collect them
- **Experience System**: Gain XP for collecting hay
- **Real-time Stats**: Track hay eaten and play time
- **Global Statistics**: Server-wide hay collection tracking
