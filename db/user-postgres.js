/**
 * User store backed by PostgreSQL. Used by /user endpoint only.
 * All user-related data (profile, color) lives in the database, not Redis.
 *
 * Env: DATABASE_URL (e.g. postgresql://user:pass@host:5432/dbname), or
 *      POSTGRES_HOST, POSTGRES_PORT, POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB.
 *      Optional: POSTGRES_SSL=true for TLS.
 */
const { Pool } = require('pg');

const poolConfig = process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
          host: process.env.POSTGRES_HOST || '127.0.0.1',
          port: parseInt(process.env.POSTGRES_PORT, 10) || 57,
          user: process.env.POSTGRES_USER || 'postgres',
          password: process.env.POSTGRES_PASSWORD || '',
          database: process.env.POSTGRES_DB || 'cow_game',
          ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false,
      };

const pool = new Pool(poolConfig);

// Table name: allow only alphanumeric and underscore (no SQL injection from env)
const TABLE = (process.env.POSTGRES_USERS_TABLE || 'users').replace(/[^a-zA-Z0-9_]/g, '') || 'users';

async function ensureTable() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS ${TABLE} (
            id SERIAL PRIMARY KEY,
            username TEXT NOT NULL,
            username_lower TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            created_at BIGINT NOT NULL,
            last_login BIGINT NOT NULL,
            color TEXT NOT NULL DEFAULT '#ffffff',
            color_updated_at BIGINT
        )
    `);
}

let tableReady = false;
async function getPool() {
    if (!tableReady) {
        await ensureTable();
        tableReady = true;
    }
    return pool;
}

function norm(username) {
    return (username || '').toLowerCase();
}

module.exports = {
    async getUser(username) {
        const p = await getPool();
        const res = await p.query(
            `SELECT username, password_hash, created_at, last_login FROM ${TABLE} WHERE username_lower = $1`,
            [norm(username)]
        );
        const row = res.rows[0];
        if (!row) return null;
        return {
            username: row.username,
            passwordHash: row.password_hash,
            createdAt: row.created_at,
            lastLogin: row.last_login,
        };
    },

    async createUser(username, passwordHash, color = '#ffffff') {
        const p = await getPool();
        const now = Date.now();
        await p.query(
            `INSERT INTO ${TABLE} (username, username_lower, password_hash, created_at, last_login, color, color_updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [username, norm(username), passwordHash, now, now, color, now]
        );
        return {
            username,
            passwordHash,
            createdAt: now,
            lastLogin: now,
        };
    },

    async updateUserLogin(username) {
        const p = await getPool();
        const now = Date.now();
        const res = await p.query(
            `UPDATE ${TABLE} SET last_login = $1 WHERE username_lower = $2
             RETURNING username, password_hash, created_at, last_login`,
            [now, norm(username)]
        );
        const row = res.rows[0];
        if (!row) return null;
        return {
            username: row.username,
            passwordHash: row.password_hash,
            createdAt: row.created_at,
            lastLogin: row.last_login,
        };
    },

    async getPlayerColor(username) {
        const p = await getPool();
        const res = await p.query(
            `SELECT color FROM ${TABLE} WHERE username_lower = $1`,
            [norm(username)]
        );
        const row = res.rows[0];
        return (row && row.color) ? row.color : '#ffffff';
    },

    async savePlayerColor(username, color) {
        const p = await getPool();
        const now = Date.now();
        await p.query(
            `UPDATE ${TABLE} SET color = $1, color_updated_at = $2 WHERE username_lower = $3`,
            [color, now, norm(username)]
        );
        return { color, updatedAt: now };
    },
};
