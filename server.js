import { createRequire } from 'module';
import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);

const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEBUG_STATIC = process.env.DEBUG === '1' || process.env.DEBUG === 'static';

// Import Redis connection for stats
const { client, redisHelpers, REDIS_KEYS } = require('./redis.js');
const crypto = require('crypto');

// Track Redis connection status
let isRedisConnected = false;

// Monitor Redis connection status
client.on('ready', () => {
    isRedisConnected = true;
    console.log('Redis connection established');
});

client.on('error', (err) => {
    isRedisConnected = false;
    console.error('Redis connection error:', err);
});

client.on('end', () => {
    isRedisConnected = false;
    console.log('Redis connection ended');
});

// Create HTTP server
const server = http.createServer(async (req, res) => {
    // Path without query string (load balancers often add ? to health checks)
    const pathname = (req.url || '/').split('?')[0];

    try {
        // Handle CORS preflight requests
        if (req.method === 'OPTIONS') {
            res.writeHead(200, {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Max-Age': '86400'
            });
            res.end();
            return;
        }

        // Handle health check endpoint
        if (pathname === '/health' && req.method === 'GET') {
            res.writeHead(200, { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify({ 
            status: 'ok', 
            timestamp: new Date().toISOString(),
            redis: isRedisConnected ? 'connected' : 'disconnected'
            }));
            return;
        }

        // Simple test endpoint that doesn't require Redis
        if (pathname === '/test' && req.method === 'GET') {
            res.writeHead(200, { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify({ 
            message: 'Server is responding',
            timestamp: new Date().toISOString()
            }));
            return;
        }

        // Root path: return 200 so GKE load balancer health checks pass
        if (pathname === '/' && req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('OK');
            return;
        }

    // Helper function to parse user endpoint
    function parseUserEndpoint(url, host) {
        try {
            const urlObj = new URL(url, `http://${host || 'localhost'}`);
            const pathMatch = urlObj.pathname.match(/^\/user\/([^\/]+)$/);
            
            if (!pathMatch) {
                return null;
            }
            
            return {
                username: decodeURIComponent(pathMatch[1]),
                query: urlObj.searchParams
            };
        } catch (error) {
            return null;
        }
    }

        // Handle user endpoint (replaces check-username, save-color, load-color)
        if (pathname.startsWith('/user/')) {
            const parsed = parseUserEndpoint(req.url || '', req.headers.host);

            if (!parsed) {
                res.writeHead(400, {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                });
                res.end(JSON.stringify({ error: 'Invalid user endpoint format' }));
                return;
            }

            const { username, query } = parsed;

            // GET /user/{username} - Check availability and get user profile
            if (req.method === 'GET') {
            try {
                console.log(`Checking username availability: ${username}`);
                
                // Add timeout for Redis operations
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('Redis timeout')), 5000);
                });
                
                try {
                    const existingUser = await Promise.race([
                        redisHelpers.getUser(username),
                        timeoutPromise
                    ]);
                    
                    const isAvailable = !existingUser;
                    const color = existingUser ? await redisHelpers.getPlayerColor(username) : null;
                    
                    console.log(`Username ${username} availability: ${isAvailable}`);
                    
                    res.writeHead(200, { 
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    });
                    res.end(JSON.stringify({
                        available: isAvailable,
                        exists: !isAvailable,
                        color: color || null,
                        message: isAvailable ? 'Username available' : 'Username already taken'
                    }));
                } catch (redisError) {
                    console.error('Redis error during user lookup:', redisError);
                    // Fallback: assume username is available if Redis is unavailable
                    res.writeHead(200, { 
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    });
                    res.end(JSON.stringify({
                        available: true,
                        exists: false,
                        color: null,
                        message: 'Username available (Redis unavailable)'
                    }));
                }
            } catch (error) {
                console.error('User lookup error:', error);
                res.writeHead(500, { 
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                });
                res.end(JSON.stringify({ error: 'Server error' }));
            }
                return;
            }

            // PUT /user/{username}?color=...&other=... - Create or update user profile
            if (req.method === 'PUT') {
                let body = '';
                req.on('data', chunk => {
                    body += chunk.toString();
                });
                req.on('end', async () => {
                try {
                    // Get color from query parameter or request body
                    let color = query.get('color');
                    if (!color && body) {
                        try {
                            const bodyData = JSON.parse(body);
                            color = bodyData.color;
                        } catch (e) {
                            // Body is not JSON, ignore
                        }
                    }
                    
                    // You can add more customization parameters here
                    // const otherParam = query.get('other');
                    
                    if (color) {
                        await redisHelpers.savePlayerColor(username, color);
                        console.log(`Color saved for ${username}: ${color}`);
                    }
                    
                    res.writeHead(200, { 
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
                        'Access-Control-Allow-Headers': 'Content-Type'
                    });
                    res.end(JSON.stringify({ 
                        success: true,
                        username: username,
                        color: color || null
                    }));
                } catch (error) {
                    console.error('User update error:', error);
                    res.writeHead(500, { 
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    });
                    res.end(JSON.stringify({ error: 'Server error' }));
                }
                });
                return;
            }

            // Handle unsupported methods
            res.writeHead(405, { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Allow': 'GET, PUT, OPTIONS'
            });
            res.end(JSON.stringify({ error: 'Method not allowed' }));
            return;
        }

        // Serve /game and /game/* from the game/ directory (relative to server.js, not cwd)
        const gameDir = path.join(__dirname, 'game');
        let filePath;
        if (pathname === '/game' || pathname === '/game/') {
            filePath = path.join(gameDir, 'index.html');
        } else if (pathname.startsWith('/game/')) {
            const subpath = pathname.slice('/game/'.length);
            if (subpath.includes('..')) {
                res.writeHead(404);
                res.end('File not found');
                return;
            }
            filePath = path.join(gameDir, subpath);
        } else {
            filePath = path.join(__dirname, pathname.slice(1) || '');
        }

        if (DEBUG_STATIC) {
            const exists = fs.existsSync(filePath);
            console.log('[static]', {
                pathname,
                filePath,
                gameDir,
                __dirname,
                exists
            });
        }

        const extname = path.extname(filePath);
        let contentType = 'text/html';

        switch (extname) {
            case '.js':
                contentType = 'text/javascript';
                break;
            case '.css':
                contentType = 'text/css';
                break;
        }

        const trySend = (p) => {
            fs.readFile(p, (error, content) => {
                if (error) {
                    if (error.code === 'ENOENT') {
                        if (DEBUG_STATIC) {
                            console.log('[static] 404 tried path:', p);
                        }
                        // Fallback: if path was not under /game/, try game dir (e.g. /cow.js → game/cow.js)
                        if (p !== path.join(gameDir, path.basename(p)) && pathname.match(/\.(js|css|html)$/)) {
                            const fallback = path.join(gameDir, path.basename(pathname));
                            if (DEBUG_STATIC) {
                                console.log('[static] fallback to:', fallback, 'exists:', fs.existsSync(fallback));
                            }
                            return trySend(fallback);
                        }
                        res.writeHead(404);
                        res.end('File not found');
                    } else {
                        res.writeHead(500);
                        res.end('Server Error: ' + error.code);
                    }
                } else {
                    res.writeHead(200, { 'Content-Type': contentType });
                    res.end(content, 'utf-8');
                }
            });
        };
        trySend(filePath);
    } catch (err) {
        console.error('Request handler error:', err);
        if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Server error' }));
        }
    }
});

// Create WebSocket server attached to the HTTP server
const wss = new WebSocket.Server({ 
    server,
    maxConnections: 100, // Limit concurrent connections for stability
    perMessageDeflate: false, // Disable compression to save memory
    clientTracking: true // Enable connection tracking
});

// Store connected clients and their cow positions
const clients = new Map();

// Add connection monitoring
let connectionCount = 0;
const MAX_CONNECTIONS = 100; // Adjust based on your server capacity

// Add periodic cleanup of dead connections
setInterval(() => {
    let cleaned = 0;
    clients.forEach((client, id) => {
        if (client.ws.readyState !== WebSocket.OPEN) {
            clients.delete(id);
            cleaned++;
        }
    });
    if (cleaned > 0) {
        console.log(`Cleaned up ${cleaned} dead connections. Active: ${clients.size}`);
    }
}, 30000); // Check every 30 seconds

// Authentication functions
function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

async function authenticateUser(username, password) {
    try {
        const user = await redisHelpers.getUser(username);
        const passwordHash = hashPassword(password);
        
        if (user) {
            // Existing user - check password
            if (user.passwordHash === passwordHash) {
                await redisHelpers.updateUserLogin(username);
                return { success: true, message: 'Login successful', user: user };
            } else {
                return { success: false, message: 'Invalid password' };
            }
        } else {
            // New user - create account
            const newUser = await redisHelpers.createUser(username, passwordHash);
            return { success: true, message: 'Account created successfully', user: newUser, isNewUser: true };
        }
    } catch (error) {
        console.error('Authentication error:', error);
        return { success: false, message: 'Server error during authentication' };
    }
}

// Hay management system
const hayManager = {
    hayPositions: new Map(), // Track all hay on the map
    maxHay: 20, // Maximum hay allowed on the map
    spawnInterval: 2000, // Spawn new hay every 2 seconds
    spawnTimer: null,
    
    // Initialize hay spawning
    startSpawning() {
        this.spawnTimer = setInterval(() => {
            this.spawnHay();
        }, this.spawnInterval);
        console.log('Hay spawning system started');
    },
    
    // Stop hay spawning
    stopSpawning() {
        if (this.spawnTimer) {
            clearInterval(this.spawnTimer);
            this.spawnTimer = null;
        }
    },
    
    // Spawn new hay if under the limit
    spawnHay() {
        if (this.hayPositions.size >= this.maxHay) {
            return; // Don't spawn if at max
        }
        
        // Generate random position
        const x = Math.random() * 40 - 20;
        const z = Math.random() * 40 - 20;
        const hayId = `hay_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        
        // Add to tracking
        this.hayPositions.set(hayId, { x, z, id: hayId });
        
        // Broadcast to all clients
        broadcastToAll({
            type: 'hay_spawned',
            hayId: hayId,
            position: { x, z }
        });
        
        console.log(`Hay spawned: ${hayId} at (${x.toFixed(2)}, ${z.toFixed(2)})`);
    },
    
    // Remove hay when collected
    removeHay(hayId) {
        if (this.hayPositions.has(hayId)) {
            this.hayPositions.delete(hayId);
            console.log(`Hay removed: ${hayId}`);
        }
    },
    
    // Get current hay count
    getHayCount() {
        return this.hayPositions.size;
    },
    
    // Get all hay positions for new players
    getAllHay() {
        return Array.from(this.hayPositions.values());
    }
};

// Initialize Redis connection
async function initializeRedis() {
    try {
        // Wait for Redis to be ready (connection handled in redis.js)
        // Check if Redis is connected, if not wait a bit
        let retries = 0;
        while (!client.isOpen && retries < 10) {
            console.log('Waiting for Redis connection...');
            await new Promise(resolve => setTimeout(resolve, 1000));
            retries++;
        }
        
        if (!client.isOpen) {
            console.error('Redis connection timeout after 10 seconds');
            return;
        }
        
        console.log('Redis connected successfully for stats');
        
        // Initialize global stats if they don't exist
        const globalStats = await redisHelpers.getGlobalStats();
        if (!globalStats.serverStartTime) {
            await redisHelpers.updateGlobalStats({ 
                serverStartTime: Date.now(),
                totalPlayers: 0,
                totalHayEaten: 0,
                totalTimePlayed: 0
            });
        }
    } catch (error) {
        console.error('Failed to initialize Redis:', error);
    }
}

wss.on('connection', async (ws) => {
    // Temporarily disable connection limit for debugging
    // if (clients.size >= MAX_CONNECTIONS) {
    //     console.log(`Connection rejected: limit of ${MAX_CONNECTIONS} reached`);
    //     ws.close(1008, 'Server at capacity');
    //     return;
    // }

    // Generate a unique ID for this client
    const clientId = Math.random().toString(36).substr(2, 9);
    connectionCount++;
    console.log(`=== NEW CONNECTION ===`);
    console.log(`Client ID: ${clientId}`);
    console.log(`Total connections: ${clients.size + 1}`);
    console.log(`WebSocket ready state: ${ws.readyState}`);
    
    // Initialize client with default values
    clients.set(clientId, { 
        ws, 
        position: { x: 0, y: 0.5, z: 0 }, 
        rotation: 0,
        username: 'Anonymous',
        color: '#ffffff',
        isGuest: true, // Default to guest mode
        authenticatedUsername: null
    });

    try {
        // Default stats for guest users (will be overridden for authenticated users)
        let playerStats = {
            level: 1,
            experience: 0,
            coins: 0,
            timePlayed: 0,
            hayEaten: 0
        };
        
        // Get global stats
        const globalStats = await redisHelpers.getGlobalStats();
        
        // Get stats for all existing players
        const playersWithStats = await Promise.all(
            Array.from(clients.entries()).map(async ([id, data]) => {
                let existingPlayerStats = {
                    level: 1,
                    experience: 0,
                    hayEaten: 0
                };
                
                // Load persistent stats only for authenticated users
                if (!data.isGuest && data.authenticatedUsername) {
                    existingPlayerStats = await redisHelpers.getUserStats(data.authenticatedUsername);
                }
                
                return {
                    id,
                    username: data.username,
                    position: data.position,
                    rotation: data.rotation,
                    color: data.color,
                    isGuest: data.isGuest,
                    stats: {
                        level: existingPlayerStats.level,
                        hayEaten: existingPlayerStats.hayEaten,
                        experience: existingPlayerStats.experience
                    }
                };
            })
        );
        
        // Send initial data to client
        ws.send(JSON.stringify({
            type: 'init',
            id: clientId,
            stats: playerStats,
            globalStats: globalStats,
            players: playersWithStats,
            hay: hayManager.getAllHay() // Send existing hay to new player
        }));
    } catch (error) {
        console.error('Error loading player data from Redis:', error);
        // Send basic init without Redis data
        ws.send(JSON.stringify({
            type: 'init',
            id: clientId,
            stats: { level: 1, experience: 0, coins: 0, timePlayed: 0, cowsFed: 0 },
            players: Array.from(clients.entries()).map(([id, data]) => ({
                id,
                username: data.username,
                position: data.position,
                rotation: data.rotation,
                color: data.color
            }))
        }));
    }

    // Update global stats when player joins
    console.log('Player joining, incrementing totalPlayers');
    await redisHelpers.incrementGlobalStat('totalPlayers');
    
    // Broadcast new player to all other clients
    broadcastToOthers(clientId, {
        type: 'player_joined',
        id: clientId,
        username: clients.get(clientId).username,
        position: clients.get(clientId).position,
        rotation: clients.get(clientId).rotation,
        color: clients.get(clientId).color
    });
    
    // Broadcast updated global stats to all clients
    const updatedGlobalStats = await redisHelpers.getGlobalStats();
    broadcastToAll({
        type: 'global_stats_updated',
        globalStats: updatedGlobalStats
    });

    // Send existing players' colors to the new player
    const existingPlayers = Array.from(clients.entries())
        .filter(([id]) => id !== clientId)
        .map(([id, data]) => ({
            id,
            color: data.color
        }));

    if (existingPlayers.length > 0) {
        ws.send(JSON.stringify({
            type: 'color_update',
            players: existingPlayers
        }));
    }

    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);
            console.log(`=== MESSAGE FROM ${clientId} ===`);
            console.log('Message type:', data.type);
            console.log('Full message:', data);

            switch (data.type) {
                case 'authenticate':
                    // Handle user authentication
                    const authResult = await authenticateUser(data.username, data.password);
                    ws.send(JSON.stringify({
                        type: 'auth_result',
                        success: authResult.success,
                        message: authResult.message,
                        isNewUser: authResult.isNewUser || false
                    }));
                    
                    if (authResult.success) {
                        // Store the authenticated username with the client
                        const clientData = clients.get(clientId);
                        if (clientData) {
                            clientData.authenticatedUsername = data.username;
                            clientData.isGuest = false;
                            clientData.isNewUser = authResult.isNewUser || false;
                            clients.set(clientId, clientData);
                        }
                    }
                    break;



                case 'set_username':
                    // Update username and color
                    const client = clients.get(clientId);
                    if (client) {
                        console.log(`Processing set_username for: ${data.username}, isGuest: ${client.isGuest}`);
                        
                        // Check if this username already exists in Redis
                        const existingUser = await redisHelpers.getUser(data.username);
                        console.log(`Existing user check for ${data.username}:`, existingUser ? 'EXISTS' : 'NOT FOUND');
                        
                        // For guest users, check if username is already registered
                        if (client.isGuest) {
                            console.log(`Processing guest user: ${data.username}`);
                            if (existingUser) {
                                console.log(`Guest tried to use existing username: ${data.username}`);
                                ws.send(JSON.stringify({
                                    type: 'username_error',
                                    message: 'This username is already registered. Please choose a different name or log in with your password.'
                                }));
                                return;
                            }
                            
                            // This is a new user registration - create the user in Redis
                            console.log(`Creating new guest user: ${data.username}`);
                            await redisHelpers.createUser(data.username, ''); // Empty password for guest
                            client.isNewUser = true;
                            console.log(`Set isNewUser = true for guest: ${data.username}`);
                        } else {
                            // For authenticated users, use the isNewUser flag from authentication
                            console.log(`Processing authenticated user: ${data.username}, isNewUser: ${client.isNewUser}`);
                            // Don't override the isNewUser flag that was set during authentication
                        }

                        const oldUsername = client.username;
                        client.username = data.username;
                        // Always update color when provided
                        if (data.color) {
                            client.color = data.color;
                            console.log(`Color updated for ${clientId}: ${data.color}`);
                        }
                        console.log(`Username updated for ${clientId}: ${data.username}, color: ${client.color}`);
                        
                        // Load stats for authenticated users
                        let userStats = {
                            level: 1,
                            experience: 0,
                            coins: 0,
                            timePlayed: 0,
                            hayEaten: 0
                        };
                        
                        if (!client.isGuest && client.authenticatedUsername) {
                            console.log('Loading stats for authenticated user:', client.authenticatedUsername);
                            userStats = await redisHelpers.getUserStats(client.authenticatedUsername);
                        }
                        
                        // Send updated stats to the user
                        const statsMessage = {
                            type: 'stats_updated',
                            stats: userStats,
                            isNewUser: client.isNewUser || false
                        };
                        console.log(`Sending stats_updated message:`, statsMessage);
                        ws.send(JSON.stringify(statsMessage));
                        
                        // Broadcast username and color update to all clients
                        broadcastToAll({
                            type: 'username_update',
                            id: clientId,
                            oldUsername: oldUsername,
                            username: data.username,
                            color: client.color
                        });

                        // Also send a color update to ensure all clients have the correct color
                        broadcastToAll({
                            type: 'color_update',
                            players: [{
                                id: clientId,
                                color: client.color
                            }]
                        });
                    }
                    break;

                case 'update_position':
                    // Update this client's position
                    const clientPos = clients.get(clientId);
                    if (clientPos) {
                        clientPos.position = data.position;
                        clientPos.rotation = data.rotation;

                        // Broadcast position update to all other clients
                        broadcastToOthers(clientId, {
                            type: 'position_update',
                            id: clientId,
                            username: clientPos.username,
                            position: data.position,
                            rotation: data.rotation,
                            color: clientPos.color
                        });
                    }
                    break;

                case 'update_color':
                    if (clients.has(clientId)) {
                        const player = clients.get(clientId);
                        player.color = data.color;
                        clients.set(clientId, player);
                        
                        // Broadcast the color change to all other players
                        broadcastToAll({
                            type: 'color_update',
                            players: [{
                                id: clientId,
                                color: data.color
                            }]
                        }, clientId); // Exclude the sender
                    }
                    break;

                case 'chat_message':
                    // Handle chat messages
                    const chatClient = clients.get(clientId);
                    if (chatClient) {
                        // Broadcast chat message to all clients
                        broadcastToAll({
                            type: 'chat_message',
                            playerId: clientId,
                            username: chatClient.username,
                            text: data.text
                        });
                    }
                    break;

                case 'eat_hay':
                    try {
                        await redisHelpers.incrementPlayerStat(clientId, 'hayEaten', 1);
                        ws.send(JSON.stringify({
                            type: 'item_collected',
                            item: data.item
                        }));

                        // increment experience
                        redisHelpers.incrementPlayerStat(clientId, 'experience', 10);
                        // Check for level up
                        const stats = await redisHelpers.getPlayerStats(clientId);
                        const newLevel = Math.floor(stats.experience / 100) + 1;
                        if (newLevel > stats.level) {
                            await redisHelpers.updatePlayerStats(clientId, { level: newLevel });
                            ws.send(JSON.stringify({
                                type: 'level_up',
                                newLevel: newLevel
                            }));
                        }
                        
                        // Send updated stats to the player
                        const updatedStats = await redisHelpers.getPlayerStats(clientId);
                        ws.send(JSON.stringify({
                            type: 'stats_updated',
                            stats: updatedStats
                        }));
                    } catch (error) {
                        console.error('Error feeding cow:', error);
                    }
                    break;

                case 'get_stats':
                    // Send current stats to player
                    try {
                        const stats = await redisHelpers.getPlayerStats(clientId);
                        const globalStats = await redisHelpers.getGlobalStats();
                        ws.send(JSON.stringify({
                            type: 'stats_response',
                            playerStats: stats,
                            globalStats: globalStats
                        }));
                    } catch (error) {
                        console.error('Error getting stats:', error);
                    }
                    break;

                case 'collect_hay':
                    // Handle hay collection
                    try {
                        const hayId = data.hayId; // Get the hay ID from the client
                        
                        // Remove hay from the map
                        hayManager.removeHay(hayId);
                        
                        const clientData = clients.get(clientId);
                        let updatedStats = {
                            level: 1,
                            experience: 0,
                            coins: 0,
                            timePlayed: 0,
                            hayEaten: 0
                        };
                        
                        if (clientData && !clientData.isGuest && clientData.authenticatedUsername) {
                            // Authenticated user - save to database
                            await redisHelpers.incrementUserStat(clientData.authenticatedUsername, 'hayEaten');
                            await redisHelpers.incrementUserStat(clientData.authenticatedUsername, 'experience', 5);
                            
                            // Get updated stats (this will auto-calculate and fix level)
                            const stats = await redisHelpers.getUserStats(clientData.authenticatedUsername);
                            const oldLevel = stats.level;
                            const newLevel = Math.floor(stats.experience / 100) + 1;
                            
                            // Check for level up
                            if (newLevel > oldLevel) {
                                console.log(`Level up for ${clientData.authenticatedUsername}: ${oldLevel} -> ${newLevel}`);
                                // The level is already updated by getUserStats, but let's make sure
                                await redisHelpers.updateUserStats(clientData.authenticatedUsername, { level: newLevel });
                                ws.send(JSON.stringify({
                                    type: 'level_up',
                                    newLevel: newLevel
                                }));
                            }
                            
                            // Get final stats (should have correct level)
                            updatedStats = await redisHelpers.getUserStats(clientData.authenticatedUsername);
                        } else {
                            // Guest user - update in memory only (no persistence)
                            if (!clientData.guestStats) {
                                clientData.guestStats = { level: 1, experience: 0, hayEaten: 0 };
                            }
                            clientData.guestStats.hayEaten++;
                            clientData.guestStats.experience += 5;
                            
                            // Check for level up
                            const newLevel = Math.floor(clientData.guestStats.experience / 100) + 1;
                            if (newLevel > clientData.guestStats.level) {
                                clientData.guestStats.level = newLevel;
                                ws.send(JSON.stringify({
                                    type: 'level_up',
                                    newLevel: newLevel
                                }));
                            }
                            
                            updatedStats = {
                                level: clientData.guestStats.level,
                                experience: clientData.guestStats.experience,
                                hayEaten: clientData.guestStats.hayEaten,
                                coins: 0,
                                timePlayed: 0
                            };
                            clients.set(clientId, clientData);
                        }
                        
                        // Update global stats
                        await redisHelpers.incrementGlobalStat('totalHayEaten');
                        
                        // Send updated stats to the player
                        ws.send(JSON.stringify({
                            type: 'stats_updated',
                            stats: updatedStats
                        }));
                        
                        // Broadcast player stats update to all other players
                        const playerData = clients.get(clientId);
                        if (playerData) {
                            broadcastToOthers(clientId, {
                                type: 'player_stats_updated',
                                playerId: clientId,
                                username: playerData.username,
                                stats: {
                                    level: updatedStats.level,
                                    hayEaten: updatedStats.hayEaten,
                                    experience: updatedStats.experience
                                }
                            });
                        }
                        
                        // Get and broadcast updated global stats
                        const updatedGlobalStats = await redisHelpers.getGlobalStats();
                        broadcastToAll({
                            type: 'global_stats_updated',
                            globalStats: updatedGlobalStats
                        });
                        
                        // Broadcast hay collection to all players
                        const player = clients.get(clientId);
                        if (player) {
                            broadcastToAll({
                                type: 'hay_collected',
                                playerId: clientId, // Use clientId to identify the player
                                username: player.username,
                                hayId: hayId,
                                position: data.position
                            });
                        }
                        
                    } catch (error) {
                        console.error('Error collecting hay:', error);
                    }
                    break;
            }
        } catch (error) {
            console.error('Error processing message:', error);
        }
    });

    // Handle WebSocket errors
    ws.on('error', (error) => {
        console.error(`WebSocket error for client ${clientId}:`, error);
        // Clean up client if error occurs
        if (clients.has(clientId)) {
            clients.delete(clientId);
            console.log(`Cleaned up client ${clientId} due to error`);
        }
    });

    ws.on('close', async () => {
        // Get username before removing client
        const leavingClient = clients.get(clientId);
        const leavingUsername = leavingClient ? leavingClient.username : 'Anonymous';
        
        // Remove client and notify others
        clients.delete(clientId);
        console.log(`Connection closed: ${clientId} (${clients.size}/${MAX_CONNECTIONS})`);
        
        // Update global stats when player leaves
        console.log('Player leaving, decrementing totalPlayers');
        await redisHelpers.incrementGlobalStat('totalPlayers', -1);
        
        // Broadcast updated global stats to all clients
        const updatedGlobalStats = await redisHelpers.getGlobalStats();
        broadcastToAll({
            type: 'global_stats_updated',
            globalStats: updatedGlobalStats
        });
        
        broadcastToAll({
            type: 'player_left',
            id: clientId,
            username: leavingUsername
        });
    });
});

function broadcastToOthers(senderId, message) {
    clients.forEach((client, id) => {
        if (id !== senderId && client.ws.readyState === WebSocket.OPEN) {
            client.ws.send(JSON.stringify(message));
        }
    });
}

function broadcastToAll(message) {
    clients.forEach((client) => {
        if (client.ws.readyState === WebSocket.OPEN) {
            client.ws.send(JSON.stringify(message));
        }
    });
}

const PORT = 6060;

// Initialize Redis and start server
async function startServer() {
    try {
        await initializeRedis();
    
        
        server.listen(PORT, () => {
            const gameDir = path.join(__dirname, 'game');
            const gameIndexExists = fs.existsSync(path.join(gameDir, 'index.html'));
            const gameCowExists = fs.existsSync(path.join(gameDir, 'cow.js'));
            console.log(`Server running on port ${PORT}`);
            console.log(`  Game:    http://localhost:${PORT}/game`);
            console.log(`  Health:  http://localhost:${PORT}/health`);
            if (!gameIndexExists || !gameCowExists) {
                console.warn(`  WARN: game/ files missing (index.html: ${gameIndexExists}, cow.js: ${gameCowExists})`);
                console.warn(`  __dirname: ${__dirname}`);
                console.warn(`  Run the server from the repo root (directory containing server.js and game/)`);
            } else {
                console.log(`  game/ resolved: ${gameDir}`);
            }
        });
        
        // Start hay spawning system
        hayManager.startSpawning();
        
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();

// --- Graceful Shutdown ---
function gracefulShutdown(signal) {
    console.log(`Received ${signal}. Shutting down gracefully...`);

    // 1. Stop accepting new connections
    server.close(async () => {
        console.log('HTTP server closed. No longer accepting new connections.');

        // 2. Disconnect WebSocket clients
        console.log(`Closing ${wss.clients.size} WebSocket connections...`);
        wss.clients.forEach(ws => {
            ws.close(1012, 'Server is shutting down');
        });

        // 3. Stop background tasks
        hayManager.stopSpawning();
        console.log('Background tasks stopped.');

        // 4. Close Redis connection
        try {
            await client.quit();
            console.log('Redis connection closed.');
        } catch (err) {
            console.error('Error closing Redis connection:', err);
        }

        // 5. Exit the process
        console.log('Shutdown complete.');
        process.exit(0);
    });

    // Force shutdown if graceful shutdown fails after a timeout
    setTimeout(() => {
        console.error('Graceful shutdown timed out. Forcing exit.');
        process.exit(1);
    }, 10000); // 10 seconds
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
