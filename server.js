const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

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
    clients.set(clientId, { ws, position: { x: 0, y: 0.5, z: 0 }, rotation: 0 });

    // Send the client their ID
    ws.send(JSON.stringify({
        type: 'init',
        id: clientId,
        players: Array.from(clients.entries()).map(([id, data]) => ({
            id,
            position: data.position,
            rotation: data.rotation
        }))
    }));

    // Broadcast new player to all other clients
    broadcastToOthers(clientId, {
        type: 'player_joined',
        id: clientId,
        position: clients.get(clientId).position,
        rotation: clients.get(clientId).rotation
    });

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            if (data.type === 'update_position') {
                // Update this client's position
                const client = clients.get(clientId);
                client.position = data.position;
                client.rotation = data.rotation;

                // Broadcast position update to all other clients
                broadcastToOthers(clientId, {
                    type: 'position_update',
                    id: clientId,
                    position: data.position,
                    rotation: data.rotation
                });
            }
        } catch (error) {
            console.error('Error processing message:', error);
        }
    });

    ws.on('close', () => {
        // Remove client and notify others
        clients.delete(clientId);
        broadcastToAll({
            type: 'player_left',
            id: clientId
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

const PORT = 8080;
server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/`);
}); 