const express = require('express');
const WebSocket = require('ws');
const cors = require('cors');
const http = require('http');
const deviceManager = require('./device-manager');
const appiumClient = require('./appium-client');
const screenMirror = require('./screen-mirror');
const { SERVER_PORT, SCREEN_CAPTURE_FPS, WS_HEARTBEAT_INTERVAL } = require('./config');
const { normalizeScreenFps } = require('./fps');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Middleware
app.use(cors());
app.use(express.json());

// Store active connections
const clients = new Map();

// REST API Routes

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        adbAvailable: deviceManager.isAdbAvailable(),
        iosToolsAvailable: deviceManager.isIOSToolsAvailable()
    });
});

/**
 * Get all available devices
 */
app.get('/api/devices', async (req, res) => {
    try {
        const devices = await deviceManager.getAllDevices();
        res.json({ success: true, devices });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get devices filtered by platform
 */
app.get('/api/devices/:platform', async (req, res) => {
    try {
        const { platform } = req.params;
        let devices;

        if (platform === 'android') {
            devices = await deviceManager.listAndroidDevices();
        } else if (platform === 'ios') {
            devices = await deviceManager.listIOSSimulators();
        } else {
            return res.status(400).json({ success: false, error: 'Invalid platform' });
        }

        res.json({ success: true, devices });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Create Appium session
 */
app.post('/api/session/create', async (req, res) => {
    try {
        const { deviceInfo } = req.body;

        if (!deviceInfo) {
            return res.status(400).json({ success: false, error: 'Device info required' });
        }

        const result = await appiumClient.createSession(deviceInfo);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Close Appium session
 * If deviceId is provided, closes that specific session.
 * Otherwise, closes all sessions (legacy behavior).
 */
app.post('/api/session/close', async (req, res) => {
    try {
        const { deviceId } = req.body;

        if (deviceId) {
            await appiumClient.closeSession(deviceId);
            screenMirror.stopStreamingForDevice(deviceId);
        } else {
            await appiumClient.closeAllSessions();
            screenMirror.stopStreaming();
        }

        res.json({ success: true, deviceId: deviceId || 'all' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get page source
 */
app.get('/api/page-source', async (req, res) => {
    try {
        const deviceId = req.query.deviceId;
        if (!deviceId) {
            return res.status(400).json({ success: false, error: 'deviceId query parameter required' });
        }
        const source = await appiumClient.getPageSource(deviceId);
        res.json({ success: true, source, deviceId });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get screenshot
 */
app.get('/api/screenshot', async (req, res) => {
    try {
        const deviceId = req.query.deviceId;
        if (!deviceId) {
            return res.status(400).json({ success: false, error: 'deviceId query parameter required' });
        }
        const screenshot = await appiumClient.getScreenshot(deviceId);
        res.json({ success: true, screenshot, deviceId });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Tap at coordinates
 */
app.post('/api/tap', async (req, res) => {
    try {
        const { deviceId, x, y } = req.body;
        if (!deviceId) {
            return res.status(400).json({ success: false, error: 'deviceId required in request body' });
        }
        await appiumClient.tap(deviceId, x, y);
        res.json({ success: true, deviceId });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// WebSocket Connection Handling
wss.on('connection', (ws, req) => {
    const clientId = Date.now();
    console.log(`Client ${clientId} connected`);

    clients.set(clientId, { ws, isAlive: true });

    // Heartbeat
    ws.on('pong', () => {
        const client = clients.get(clientId);
        if (client) client.isAlive = true;
    });

    // Safe send helper
    function safeSend(data) {
        if (ws.readyState === WebSocket.OPEN) {
            try {
                ws.send(JSON.stringify(data));
            } catch (e) {
                console.error(`Failed to send to client ${clientId}:`, e.message);
            }
        }
    }

    // Handle messages from client
    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);

            switch (data.type) {
                case 'start-streaming':
                    handleStartStreaming(ws, data);
                    break;

                case 'stop-streaming':
                    if (ws.deviceId) {
                        screenMirror.stopStreamingForDevice(ws.deviceId);
                    } else {
                        screenMirror.stopStreaming();
                    }
                    safeSend({ type: 'streaming-stopped' });
                    break;

                case 'get-page-source':
                    handleGetPageSource(ws);
                    break;

                case 'find-element':
                    handleFindElement(ws, data);
                    break;

                default:
                    safeSend({ type: 'error', message: 'Unknown message type' });
            }
        } catch (error) {
            safeSend({ type: 'error', message: error.message });
        }
    });

    ws.on('error', (error) => {
        console.error(`WebSocket error for client ${clientId}:`, error.message);
    });

    // Handle disconnection
    ws.on('close', () => {
        console.log(`Client ${clientId} disconnected`);
        clients.delete(clientId);

        // Only stop streaming for this specific device
        if (ws.deviceId) {
            screenMirror.stopStreamingForDevice(ws.deviceId);
        }
    });

    // Send welcome message
    ws.send(JSON.stringify({
        type: 'connected',
        message: 'Connected to LocatorLens backend',
        clientId
    }));
});

// WebSocket Handlers

async function handleStartStreaming(ws, data) {
    const { platform, deviceId, fps } = data;
    const streamFps = normalizeScreenFps(fps, SCREEN_CAPTURE_FPS);

    if (!platform || !deviceId) {
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Platform and deviceId required'
        }));
        return;
    }

    // Store deviceId on the websocket connection for reference
    ws.deviceId = deviceId;

    try {
        screenMirror.startStreaming(
            platform,
            deviceId,
            (update) => {
                if (ws.readyState === WebSocket.OPEN) {
                    // Inject deviceId into the update message
                    ws.send(JSON.stringify({ ...update, deviceId }));
                }
            },
            streamFps
        );

        ws.send(JSON.stringify({
            type: 'streaming-started',
            fps: streamFps,
            deviceId
        }));
    } catch (error) {
        ws.send(JSON.stringify({
            type: 'error',
            message: `Failed to start streaming: ${error.message}`
        }));
    }
}

async function handleGetPageSource(ws) {
    try {
        // Use the deviceId associated with this WebSocket connection
        const deviceId = ws.deviceId;
        if (!deviceId) {
            throw new Error('No deviceId associated with this connection. Start streaming first.');
        }

        let source;
        try {
            source = await appiumClient.getPageSource(deviceId);
        } catch (firstError) {
            // If session is dead, attempt auto-recovery
            if (!appiumClient.isSessionActive(deviceId)) {
                console.log(`Session dead for ${deviceId}, attempting auto-recovery...`);
                ws.send(JSON.stringify({
                    type: 'info',
                    message: 'Session lost — reconnecting automatically...'
                }));

                const result = await appiumClient.recreateSession(deviceId);
                if (!result.success) {
                    throw new Error(`Auto-recovery failed: ${result.error}`);
                }

                console.log(`Session recovered for ${deviceId}, retrying page source...`);
                source = await appiumClient.getPageSource(deviceId);
            } else {
                throw firstError;
            }
        }

        ws.send(JSON.stringify({
            type: 'page-source',
            data: source,
            deviceId
        }));
    } catch (error) {
        ws.send(JSON.stringify({
            type: 'error',
            message: `Failed to get page source: ${error.message}`
        }));
    }
}

async function handleFindElement(ws, data) {
    const { x, y } = data;
    const deviceId = ws.deviceId;

    try {
        if (!deviceId) {
            throw new Error('No deviceId associated with this connection');
        }
        const result = await appiumClient.findElementAtCoordinates(deviceId, x, y);
        ws.send(JSON.stringify({
            type: 'element-found',
            data: result,
            deviceId
        }));
    } catch (error) {
        ws.send(JSON.stringify({
            type: 'error',
            message: `Failed to find element: ${error.message}`
        }));
    }
}

// Heartbeat interval to keep connections alive
const heartbeatInterval = setInterval(() => {
    clients.forEach((client, clientId) => {
        if (!client.isAlive) {
            client.ws.terminate();
            clients.delete(clientId);
            return;
        }

        client.isAlive = false;
        try {
            client.ws.ping();
        } catch (e) {
            console.error(`Ping failed for client ${clientId}:`, e.message);
            clients.delete(clientId);
        }
    });
}, WS_HEARTBEAT_INTERVAL);

// Cleanup on server close
wss.on('close', () => {
    clearInterval(heartbeatInterval);
});

// Start server
server.listen(SERVER_PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════╗
║   LocatorLens Backend Server                         ║
╠═══════════════════════════════════════════════════════╣
║   HTTP Server: http://localhost:${SERVER_PORT}              ║
║   WebSocket:   ws://localhost:${SERVER_PORT}                ║
║                                                       ║
║   ADB Available: ${deviceManager.isAdbAvailable() ? '✓' : '✗'}                              ║
║   iOS Tools:     ${deviceManager.isIOSToolsAvailable() ? '✓' : '✗'}                              ║
╚═══════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
async function gracefulShutdown(signal) {
    console.log(`${signal} received, closing server...`);
    try {
        await appiumClient.closeAllSessions();
    } catch (e) {
        console.error('Error closing sessions:', e.message);
    }
    screenMirror.stopStreaming();
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
    // Force exit if graceful shutdown takes too long
    setTimeout(() => {
        console.error('Forced shutdown after timeout');
        process.exit(1);
    }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Prevent crashes from unhandled errors
process.on('uncaughtException', (err) => {
    console.error('Uncaught exception:', err);
});

process.on('unhandledRejection', (reason) => {
    console.error('Unhandled rejection:', reason);
});
