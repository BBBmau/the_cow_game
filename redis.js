const redis = require('redis');

// Create Redis client with connection options
const client = redis.createClient({ 
    host: '127.0.0.1', 
    port: 6379,
    retry_strategy: function(options) {
        if (options.error && options.error.code === 'ECONNREFUSED') {
            return new Error('The server refused the connection');
        }
        if (options.total_retry_time > 1000 * 60 * 60) {
            return new Error('Retry time exhausted');
        }
        if (options.attempt > 10) {
            return undefined;
        }
        return Math.min(options.attempt * 100, 3000);
    }
});

// Connection event handlers
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

// Connect to Redis
client.connect().catch(console.error);

// Redis keys for stats
const REDIS_KEYS = {
    PLAYER_STATS: 'cow_game:stats:',
    GLOBAL_STATS: 'cow_game:global_stats',
    USER_ACCOUNTS: 'cow_game:users:'
};

// Helper functions for stats
const redisHelpers = {
    // Set a key with optional expiration
    async set(key, value, expireSeconds = null) {
        try {

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

    // Get a key
    async get(key) {
        try {
            const value = await client.get(key);
            return value ? JSON.parse(value) : null;
        } catch (error) {
            console.error('Redis GET error:', error);
            return null;
        }
    },

    // Delete a key
    async del(key) {
        try {
            await client.del(key);
            return true;
        } catch (error) {
            console.error('Redis DEL error:', error);
            return false;
        }
    },

    // Check if key exists
    async exists(key) {
        try {
            const result = await client.exists(key);
            return result === 1;
        } catch (error) {
            console.error('Redis EXISTS error:', error);
            return false;
        }
    },

    // Set expiration on existing key
    async expire(key, seconds) {
        try {
            await client.expire(key, seconds);
            return true;
        } catch (error) {
            console.error('Redis EXPIRE error:', error);
            return false;
        }
    },

    // Get all keys matching pattern
    async keys(pattern) {
        try {
            return await client.keys(pattern);
        } catch (error) {
            console.error('Redis KEYS error:', error);
            return [];
        }
    },

    // STATS FUNCTIONS
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
        await this.set(key, updatedStats, 86400 * 365); // 1 year
        return updatedStats;
    },

    async incrementPlayerStat(playerId, statName, amount = 1) {
        const key = REDIS_KEYS.PLAYER_STATS + playerId;
        const currentStats = await this.get(key) || {};
        const currentValue = currentStats[statName] || 0;
        const updatedStats = { ...currentStats, [statName]: currentValue + amount };
        await this.set(key, updatedStats, 86400 * 365); // 1 year
        return updatedStats;
    },

    // GLOBAL STATS FUNCTIONS
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
        await this.set(REDIS_KEYS.GLOBAL_STATS, updatedStats, 0); // No expiration
        return updatedStats;
    },

    async incrementGlobalStat(statName, amount = 1) {
        const currentStats = await this.get(REDIS_KEYS.GLOBAL_STATS) || {};
        const currentValue = currentStats[statName] || 0;
        let newValue = currentValue + amount;
        
        // Prevent negative values for certain stats
        if (statName === 'totalPlayers' && newValue < 0) {
            newValue = 0;
        }
        
        const updatedStats = { ...currentStats, [statName]: newValue };
        await this.set(REDIS_KEYS.GLOBAL_STATS, updatedStats, 0); // No expiration
        return updatedStats;
    },

    // USER AUTHENTICATION FUNCTIONS
    async createUser(username, passwordHash) {
        const key = REDIS_KEYS.USER_ACCOUNTS + username.toLowerCase();
        const userData = {
            username: username,
            passwordHash: passwordHash,
            createdAt: Date.now(),
            lastLogin: Date.now()
        };
        await this.set(key, userData, 0); // No expiration
        return userData;
    },

    async getUser(username) {
        const key = REDIS_KEYS.USER_ACCOUNTS + username.toLowerCase();
        return await this.get(key);
    },

    async updateUserLogin(username) {
        const key = REDIS_KEYS.USER_ACCOUNTS + username.toLowerCase();
        const userData = await this.get(key);
        if (userData) {
            userData.lastLogin = Date.now();
            await this.set(key, userData, 0);
        }
        return userData;
    },

    async getUserStats(username) {
        // Use username as the key for stats instead of random clientId
        const key = REDIS_KEYS.PLAYER_STATS + username.toLowerCase();
        const stats = await this.get(key) || {
            level: 1,
            experience: 0,
            coins: 0,
            timePlayed: 0,
            hayEaten: 0
        };
        
        // Always recalculate level based on experience to ensure consistency
        const calculatedLevel = Math.floor(stats.experience / 100) + 1;
        if (stats.level !== calculatedLevel) {
            console.log(`Level mismatch for ${username}: stored=${stats.level}, calculated=${calculatedLevel}, fixing...`);
            stats.level = calculatedLevel;
            // Update the stored stats with correct level
            await this.set(key, stats, 86400 * 365);
        }
        
        return stats;
    },

    async updateUserStats(username, updates) {
        const key = REDIS_KEYS.PLAYER_STATS + username.toLowerCase();
        const currentStats = await this.get(key) || {};
        const updatedStats = { ...currentStats, ...updates };
        await this.set(key, updatedStats, 86400 * 365); // 1 year
        return updatedStats;
    },

    async incrementUserStat(username, statName, amount = 1) {
        const key = REDIS_KEYS.PLAYER_STATS + username.toLowerCase();
        const currentStats = await this.get(key) || {};
        const currentValue = currentStats[statName] || 0;
        const updatedStats = { ...currentStats, [statName]: currentValue + amount };
        
        // Always recalculate level when experience changes
        if (statName === 'experience') {
            const newLevel = Math.floor(updatedStats.experience / 100) + 1;
            updatedStats.level = newLevel;
            console.log(`Experience updated for ${username}: ${updatedStats.experience} XP, Level: ${newLevel}`);
        }
        
        await this.set(key, updatedStats, 86400 * 365); // 1 year
        return updatedStats;
    }
};

module.exports = {
    client,
    redisHelpers,
    REDIS_KEYS
};
