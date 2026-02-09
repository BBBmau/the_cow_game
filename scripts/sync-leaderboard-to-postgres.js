#!/usr/bin/env node
// /**
//  * One-shot sync: Redis player stats (cow_game:stats:*) → Postgres leaderboard table.
//  * Intended for a K8s CronJob running every minute (e.g. "*/1 * * * *").
//  *
//  * Env: same as db/redis.js (REDIS_HOST, REDIS_PORT) and db/user-postgres.js
//  *      (DATABASE_URL or POSTGRES_HOST, POSTGRES_PORT, POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB).
//  *\

const { Pool } = require('pg');
const { client, redisHelpers, REDIS_KEYS } = require('../db/redis.js');

const LEADERBOARD_TABLE = 'leaderboard';
const PLAYER_STATS_PREFIX = REDIS_KEYS.PLAYER_STATS;

const poolConfig = process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
          host: process.env.POSTGRES_HOST || '127.0.0.1',
          port: parseInt(process.env.POSTGRES_PORT, 10) || 5432,
          user: process.env.POSTGRES_USER || 'postgres',
          password: process.env.POSTGRES_PASSWORD || '',
          database: process.env.POSTGRES_DB || 'cow_game',
          ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false,
      };

const pool = new Pool(poolConfig);

async function ensureLeaderboardTable() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS ${LEADERBOARD_TABLE} (
            username TEXT PRIMARY KEY,
            level INTEGER NOT NULL DEFAULT 1,
            experience INTEGER NOT NULL DEFAULT 0,
            hay_eaten INTEGER NOT NULL DEFAULT 0,
            updated_at BIGINT NOT NULL DEFAULT 0
        )
    `);
}

async function runSync() {
    if (!redisHelpers.isConnected()) {
        console.warn('[sync-leaderboard] Redis not connected, skipping run');
        return;
    }

    const keys = await redisHelpers.keys(PLAYER_STATS_PREFIX + '*');
    if (keys.length === 0) {
        return;
    }

    const now = Date.now();
    let upserted = 0;

    for (const key of keys) {
        const username = key.startsWith(PLAYER_STATS_PREFIX)
            ? key.slice(PLAYER_STATS_PREFIX.length)
            : key;
        if (!username) continue;

        const raw = await redisHelpers.get(key);
        if (!raw || typeof raw !== 'object') continue;

        const level = Math.max(0, parseInt(raw.level, 10) || 1);
        const experience = Math.max(0, parseInt(raw.experience, 10) || 0);
        const hayEaten = Math.max(0, parseInt(raw.hayEaten, 10) || 0);

        await pool.query(
            `INSERT INTO ${LEADERBOARD_TABLE} (username, level, experience, hay_eaten, updated_at)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (username) DO UPDATE SET
               level = EXCLUDED.level,
               experience = EXCLUDED.experience,
               hay_eaten = EXCLUDED.hay_eaten,
               updated_at = EXCLUDED.updated_at`,
            [username, level, experience, hayEaten, now]
        );
        upserted++;
    }

    if (upserted > 0) {
        console.log(`[sync-leaderboard] synced ${upserted} entries to Postgres`);
    }
}

async function waitForRedis(maxMs = 5000) {
    const start = Date.now();
    while (!redisHelpers.isConnected() && Date.now() - start < maxMs) {
        await new Promise((r) => setTimeout(r, 200));
    }
}

async function main() {
    await waitForRedis();
    if (!redisHelpers.isConnected()) {
        console.error('[sync-leaderboard] Redis not connected after wait');
        process.exit(1);
    }
    await ensureLeaderboardTable();
    await runSync();
    await pool.end();
    if (client.isOpen) await client.quit();
}

main().catch((err) => {
    console.error('[sync-leaderboard] fatal:', err);
    process.exit(1);
});
