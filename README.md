# the_cow_game

![image](https://github.com/user-attachments/assets/cae50c8d-9bb0-4927-8897-f93cb11267bb)
Screenshot taken on June 14th, 2025

This game is a field full of cows

to run locally simply do the following:

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
- **Player Items**: Collectible items with metadata (expires after 30 days)
- **Player Stats**: Experience, level, coins, achievements (expires after 1 year)
- **Global Stats**: Server-wide statistics (no expiration)

### Redis Data Structure
- `cow_game:stats:{playerId}` - Player's statistics and achievements
- `cow_game:global_stats` - Global server statistics

### Available Commands
- `collect_hay` - Collect hay for experience and stats
- `get_stats` - Retrieve player and global statistics

### Game Features
- **Hay Collection**: Walk near hay bales to collect them
- **Experience System**: Gain XP for collecting hay
- **Real-time Stats**: Track hay eaten and play time
- **Global Statistics**: Server-wide hay collection tracking

# Streams where this was built
