/**
 * Single data layer.
 * - Redis: game-related only (stats, global stats). No user data in Redis.
 * - User info (/user endpoint): PostgreSQL only.
 */
const { client, redisHelpers, REDIS_KEYS } = require('./redis.js');

const userStore = require('./user-postgres.js');

console.log('DB: Redis (game only). User store: PostgreSQL.');

module.exports = {
    client,
    redisHelpers,
    REDIS_KEYS,
    userStore,
};
