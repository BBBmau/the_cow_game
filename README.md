# the_cow_game - [playthecowgame.com](https://www.playthecowgame.com)

[![Latest Commit is LIVE](https://github.com/BBBmau/the_cow_game/actions/workflows/deploy.yaml/badge.svg?branch=main&event=push)](https://github.com/BBBmau/the_cow_game/actions/workflows/deploy.yaml)

<img width="5120" height="2638" alt="image" src="https://github.com/user-attachments/assets/b2a04d7c-3948-481d-9d3e-de0cec510968" />


Screenshot taken on august 2nd, 2025

## An MMO game where you control a cow and do cow things - inspired by [fly.pieter.com](https://fly.pieter.com)

To run locally simply do the following:

## Prerequisites
- Node.js (v16 or higher)
- Docker (for Redis)

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start Redis (using Docker):**
   ```bash
   docker-compose up -d redis
   ```
   
   Or if you have Redis installed locally, make sure it's running on port 6379.

3. **Test Redis connection (optional):**
   ```bash
   node test-redis.js
   ```

4. **Start the game server from the repo root** (the folder that contains both `server.js` and the `game/` folder):
   ```bash
   cd /path/to/the_cow_game
   node server.js
   ```
   
   You should see:
   ```
   Server running on port 6060
     Game:    http://localhost:6060/game
     Health:  http://localhost:6060/health
   ```

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

4. **Match production (Docker):**
   ```bash
   docker build -t cow-game .
   docker run -p 6060:6060 -e REDIS_HOST=host.docker.internal cow-game
   ```
   Then test `http://localhost:6060/game` and `http://localhost:6060/game/cow.js` again. On Linux you may need `--add-host=host.docker.internal:host-gateway` for Redis.

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
