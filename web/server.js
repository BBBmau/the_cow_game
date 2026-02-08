import { createRequire } from 'module';
import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);

const http = require('http');
const fs = require('fs');
const path = require('path');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEBUG_STATIC = process.env.DEBUG === '1' || process.env.DEBUG === 'static';

// Web server: PostgreSQL only (no Redis). User and leaderboard from db/user-postgres.js.
const userStore = require('../db/user-postgres.js');
const crypto = require('crypto');

async function getLeaderboardEntries() {
    return userStore.getLeaderboard ? await userStore.getLeaderboard(100) : [];
}

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
            timestamp: new Date().toISOString()
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

        // Root path: serve welcome page (use /health for load balancer health checks)
        if (pathname === '/' && req.method === 'GET') {
            const welcomePath = path.join(__dirname, 'index.html');
            fs.readFile(welcomePath, (err, data) => {
                if (err) {
                    res.writeHead(200, { 'Content-Type': 'text/plain' });
                    res.end('OK');
                    return;
                }
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(data);
            });
            return;
        }

        // Leaderboard API (for leaderboard page)
        if (pathname === '/api/leaderboard' && req.method === 'GET') {
            try {
                const entries = await getLeaderboardEntries();
                res.writeHead(200, {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                });
                res.end(JSON.stringify({ entries }));
            } catch (err) {
                console.error('Leaderboard error:', err);
                res.writeHead(500, {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                });
                res.end(JSON.stringify({ entries: [] }));
            }
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
                
                // Add timeout for Database operations
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('Database timeout')), 5000);
                });
                
                try {
                    const existingUser = await Promise.race([
                        userStore.getUser(username),
                        timeoutPromise
                    ]);
                    
                    const isAvailable = !existingUser;
                    const color = await userStore.getPlayerColor(username);
                    
                    console.log(`Username ${username} availability: ${isAvailable}`);
                    
                    res.writeHead(200, { 
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    });
                    res.end(JSON.stringify({
                        available: isAvailable,
                        exists: !isAvailable,
                        color: color,
                        message: isAvailable ? 'Username available' : 'Username already taken'
                    }));
                } catch (databaseError) {
                    console.error('Database error during user lookup:', databaseError);
                    // Fallback: assume username is available if Database is unavailable
                    res.writeHead(200, { 
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    });
                    res.end(JSON.stringify({
                        available: true,
                        exists: false,
                        color: null,
                        message: 'Username available (Database unavailable)'
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
                    let color = query.get('color');
                    let password = '';
                    if (body) {
                        try {
                            const bodyData = JSON.parse(body);
                            color = color || bodyData.color;
                            password = bodyData.password || '';
                        } catch (e) {
                            // Body is not JSON, ignore
                        }
                    }
                    if (!color) color = query.get('color');

                    const existingUser = await userStore.getUser(username);
                    if (!existingUser && (password || true)) {
                        const passwordHash = password
                            ? crypto.createHash('sha256').update(password).digest('hex')
                            : '';
                        await userStore.createUser(username, passwordHash, color || '#ffffff');
                    } else if (color) {
                        await userStore.savePlayerColor(username, color);
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

        // Serve web pages and assets only (no /game — that is served by game server)
        if (pathname === '/game' || pathname.startsWith('/game/')) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not found');
            return;
        }
        const rawPath = pathname.slice(1) || 'index.html';
        if (rawPath.includes('..')) {
            res.writeHead(404);
            res.end('File not found');
            return;
        }
        const filePath = path.join(__dirname, rawPath);
        const extname = path.extname(filePath);
        let contentType = 'text/html';
        switch (extname) {
            case '.js': contentType = 'text/javascript'; break;
            case '.css': contentType = 'text/css'; break;
        }
        fs.readFile(filePath, (error, content) => {
            if (error) {
                if (error.code === 'ENOENT') {
                    res.writeHead(404);
                    res.end('File not found');
                } else {
                    res.writeHead(500);
                    res.end('Server Error');
                }
                return;
            }
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        });
    } catch (err) {
        console.error('Request handler error:', err);
        if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Server error' }));
        }
    }
});

// Game/WebSocket/Redis live in game/gameServer.js

server.on('error', (err) => {
    console.error('Server error:', err);
});

const PORT = 6060;

async function startServer() {
    try {
        server.listen(PORT, () => {
            console.log(`Web server running on port ${PORT}`);
            console.log(`  Welcome: http://localhost:${PORT}/`);
            console.log(`  Login:   http://localhost:${PORT}/login.html`);
            console.log(`  Leaderboard: http://localhost:${PORT}/leaderboard.html`);
            console.log(`  Health:  http://localhost:${PORT}/health`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();

// --- Graceful Shutdown ---
function gracefulShutdown(signal) {
    console.log(`Received ${signal}. Shutting down gracefully...`);
    server.close(() => {
        console.log('Web server closed.');
        process.exit(0);
    });
    setTimeout(() => {
        console.error('Graceful shutdown timed out. Forcing exit.');
        process.exit(1);
    }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
