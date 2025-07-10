import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

// agones.js SDK init
const AgonesSDK = require('@google-cloud/agones-sdk');

let agonesSDK = new AgonesSDK();

await agonesSDK.connect();

agonesSDK.health((error) => {
	console.error('error', error);
});

await agonesSDK.ready();

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

wss.on('connection', (ws) => {
    // Generate a unique ID for this client
    const clientId = Math.random().toString(36).substr(2, 9);
    clients.set(clientId, { 
        ws, 
        position: { x: 0, y: 0.5, z: 0 }, 
        rotation: 0,
        username: 'Anonymous', // Default username
        color: '#ffffff' // Default color
    });

    // Send the client their ID
    ws.send(JSON.stringify({
        type: 'init',
        id: clientId,
        players: Array.from(clients.entries()).map(([id, data]) => ({
            id,
            username: data.username,
            position: data.position,
            rotation: data.rotation,
            color: data.color
        }))
    }));

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

    ws.on('message', (message) => {
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
server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/`);
}); 
