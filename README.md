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

4. **Start the game server:**
   ```bash
   node server.js
   ```
   
   The game will be available at `http://localhost:6060`

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
