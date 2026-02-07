const redis = require('redis');

// Create Redis client with connection options
const redisHost = process.env.REDIS_HOST || '127.0.0.1';
const redisPort = parseInt(process.env.REDIS_PORT) || 6379;

console.log(`Connecting to Redis at ${redisHost}:${redisPort}`);

const client = redis.createClient({
    pingInterval: 5000,
    socket: {
        host: redisHost,
        port: redisPort,
        connectTimeout: 5000
    }
});

client.on('connect', () => {
    console.log('Redis client connected');
});

client.on('ready', () => {
    console.log('Redis client ready');
});

client.on('error', (err) => {
    console.error('Redis Client Error:', err);
});

client.on('end', () => {
    console.log('Redis client disconnected');
});

async function connectRedis() {
    try {
        await client.connect();
        console.log('Redis connection established successfully');
    } catch (error) {
        console.error('Failed to connect to Redis:', error);
    }
}

connectRedis();

// Redis: game-related keys only (stats, global stats). User data lives in the database.
const REDIS_KEYS = {
    PLAYER_STATS: 'cow_game:stats:',
    GLOBAL_STATS: 'cow_game:global_stats',
};

const redisHelpers = {
    isConnected() {
        return client.isOpen && client.isReady;
    },

    async set(key, value, expireSeconds = null) {
        try {
            if (!this.isConnected()) {
                console.warn('Redis not connected, skipping SET operation');
                return false;
            }
            if (value === null || value === undefined) {
                return true;
            }
            if (expireSeconds) {
                await client.setEx(key, expireSeconds, JSON.stringify(value));
            } else {
                await client.set(key, JSON.stringify(value));
            }
            return true;
        } catch (error) {
            console.error('Redis SET error:', error);
            return false;
        }
    },

    async get(key) {
        try {
            if (!this.isConnected()) {
                console.warn('Redis not connected, skipping GET operation');
                return null;
            }
            const value = await client.get(key);
            return value ? JSON.parse(value) : null;
        } catch (error) {
            console.error('Redis GET error:', error);
            return null;
        }
    },

    async del(key) {
        try {
            await client.del(key);
            return true;
        } catch (error) {
            console.error('Redis DEL error:', error);
            return false;
        }
    },

    async exists(key) {
        try {
            const result = await client.exists(key);
            return result === 1;
        } catch (error) {
            console.error('Redis EXISTS error:', error);
            return false;
        }
    },

    async expire(key, seconds) {
        try {
            await client.expire(key, seconds);
            return true;
        } catch (error) {
            console.error('Redis EXPIRE error:', error);
            return false;
        }
    },

    async keys(pattern) {
        try {
            return await client.keys(pattern);
        } catch (error) {
            console.error('Redis KEYS error:', error);
            return [];
        }
    },

    async getPlayerStats(playerId) {
        const key = REDIS_KEYS.PLAYER_STATS + playerId;
        return await this.get(key) || {
            level: 1,
            experience: 0,
            coins: 0,
            timePlayed: 0,
            hayEaten: 0
        };
    },

    async updatePlayerStats(playerId, updates) {
        const key = REDIS_KEYS.PLAYER_STATS + playerId;
        const currentStats = await this.get(key) || {};
        const updatedStats = { ...currentStats, ...updates };
        await this.set(key, updatedStats, 86400 * 365);
        return updatedStats;
    },

    async incrementPlayerStat(playerId, statName, amount = 1) {
        const key = REDIS_KEYS.PLAYER_STATS + playerId;
        const currentStats = await this.get(key) || {};
        const currentValue = currentStats[statName] || 0;
        const updatedStats = { ...currentStats, [statName]: currentValue + amount };
        await this.set(key, updatedStats, 86400 * 365);
        return updatedStats;
    },

    // GLOBAL STATS (Redis only — no DB; constantly pinged)
    async getGlobalStats() {
        return await this.get(REDIS_KEYS.GLOBAL_STATS) || {
            totalPlayers: 0,
            totalHayEaten: 0,
            totalTimePlayed: 0,
            serverStartTime: Date.now()
        };
    },

    async updateGlobalStats(updates) {
        const currentStats = await this.get(REDIS_KEYS.GLOBAL_STATS) || {};
        const updatedStats = { ...currentStats, ...updates };
        await this.set(REDIS_KEYS.GLOBAL_STATS, updatedStats, 0);
        return updatedStats;
    },

    async incrementGlobalStat(statName, amount = 1) {
        const currentStats = await this.get(REDIS_KEYS.GLOBAL_STATS) || {};
        const currentValue = currentStats[statName] || 0;
        let newValue = currentValue + amount;
        if (statName === 'totalPlayers' && newValue < 0) {
            newValue = 0;
        }
        const updatedStats = { ...currentStats, [statName]: newValue };
        await this.set(REDIS_KEYS.GLOBAL_STATS, updatedStats, 0);
        return updatedStats;
    },

    async getUserStats(username) {
        const key = REDIS_KEYS.PLAYER_STATS + username.toLowerCase();
        const stats = await this.get(key) || {
            level: 1,
            experience: 0,
            coins: 0,
            timePlayed: 0,
            hayEaten: 0
        };
        const calculatedLevel = Math.floor(stats.experience / 100) + 1;
        if (stats.level !== calculatedLevel) {
            stats.level = calculatedLevel;
            await this.set(key, stats, 86400 * 365);
        }
        return stats;
    },

    async updateUserStats(username, updates) {
        const key = REDIS_KEYS.PLAYER_STATS + username.toLowerCase();
        const currentStats = await this.get(key) || {};
        const updatedStats = { ...currentStats, ...updates };
        await this.set(key, updatedStats, 86400 * 365);
        return updatedStats;
    },

    async incrementUserStat(username, statName, amount = 1) {
        const key = REDIS_KEYS.PLAYER_STATS + username.toLowerCase();
        const currentStats = await this.get(key) || {};
        const currentValue = currentStats[statName] || 0;
        const updatedStats = { ...currentStats, [statName]: currentValue + amount };
        if (statName === 'experience') {
            updatedStats.level = Math.floor(updatedStats.experience / 100) + 1;
        }
        await this.set(key, updatedStats, 86400 * 365);
        return updatedStats;
    },
};

module.exports = {
    client,
    redisHelpers,
    REDIS_KEYS
};
