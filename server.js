import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Import Redis connection for stats
const { client, redisHelpers, REDIS_KEYS } = require('./redis.js');

// Create HTTP server
const server = http.createServer((req, res) => {
    let filePath = '.' + req.url;
    if (filePath === './') {
        filePath = './index.html';
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

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if(error.code === 'ENOENT') {
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
});

// Create WebSocket server attached to the HTTP server
const wss = new WebSocket.Server({ server });

// Store connected clients and their cow positions
const clients = new Map();

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
        // Wait for Redis connection
        await client.connect();
        console.log('Redis connected successfully for stats');
        
        // Initialize global stats if they don't exist
        const globalStats = await redisHelpers.getGlobalStats();
        if (!globalStats.serverStartTime) {
            await redisHelpers.updateGlobalStats({ serverStartTime: Date.now() });
        }
    } catch (error) {
        console.error('Failed to connect to Redis:', error);
    }
}

wss.on('connection', async (ws) => {
    // Generate a unique ID for this client
    const clientId = Math.random().toString(36).substr(2, 9);
    
    // Initialize client with default values
    clients.set(clientId, { 
        ws, 
        position: { x: 0, y: 0.5, z: 0 }, 
        rotation: 0,
        username: 'Anonymous',
        color: '#ffffff'
    });

    try {
        const playerStats = await redisHelpers.getPlayerStats(clientId);
        
        // Send initial data to client
        ws.send(JSON.stringify({
            type: 'init',
            id: clientId,
            stats: playerStats,
            players: Array.from(clients.entries()).map(([id, data]) => ({
                id,
                username: data.username,
                position: data.position,
                rotation: data.rotation,
                color: data.color
            })),
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

    // Broadcast new player to all other clients
    broadcastToOthers(clientId, {
        type: 'player_joined',
        id: clientId,
        username: clients.get(clientId).username,
        position: clients.get(clientId).position,
        rotation: clients.get(clientId).rotation,
        color: clients.get(clientId).color
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
            console.log('Received message:', data);

            switch (data.type) {
                case 'set_username':
                    // Update username and color
                    const client = clients.get(clientId);
                    if (client) {
                        const oldUsername = client.username;
                        client.username = data.username;
                        // Always update color when provided
                        if (data.color) {
                            client.color = data.color;
                            console.log(`Color updated for ${clientId}: ${data.color}`);
                        }
                        console.log(`Username updated for ${clientId}: ${data.username}, color: ${client.color}`);
                        
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

                case 'chat_message':
                    // Handle chat messages
                    const chatClient = clients.get(clientId);
                    if (chatClient) {
                        // Broadcast chat message to all clients
                        broadcastToAll({
                            type: 'chat_message',
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
                        
                        // Update player stats
                        await redisHelpers.incrementPlayerStat(clientId, 'hayEaten');
                        await redisHelpers.incrementGlobalStat('totalHayEaten');
                        await redisHelpers.incrementPlayerStat(clientId, 'experience', 5);
                        
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
                        
                        // Broadcast hay collection to all players
                        const player = clients.get(clientId);
                        if (player) {
                            broadcastToAll({
                                type: 'hay_collected',
                                playerId: clientId,
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

    ws.on('close', () => {
        // Get username before removing client
        const leavingClient = clients.get(clientId);
        const leavingUsername = leavingClient ? leavingClient.username : 'Anonymous';
        
        // Remove client and notify others
        clients.delete(clientId);
        
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
            console.log(`Server running at http://localhost:${PORT}/`);
            console.log('Redis integration enabled');
            
            // Start hay spawning system
            hayManager.startSpawning();
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();
