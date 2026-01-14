#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');

// Configuration
const PROJECT_ROOT = path.resolve(__dirname, '..');
const BACKEND_SCRIPT = path.join(PROJECT_ROOT, 'backend', 'server.js');
const LOG_FILE = path.join(PROJECT_ROOT, 'native-host.log');

// Auto-detect paths
function findAndroidSDK() {
    const HOME = process.env.HOME || process.env.USERPROFILE || '';
    const possiblePaths = [
        process.env.ANDROID_SDK_ROOT,
        process.env.ANDROID_HOME,
        path.join(HOME, 'Library/Android/sdk'), // macOS
        path.join(HOME, 'Android/Sdk'), // Linux
        path.join(HOME, 'AppData/Local/Android/sdk') // Windows
    ];

    for (const p of possiblePaths) {
        if (p && fs.existsSync(p)) {
            return p;
        }
    }
    return null;
}

function findNodePath() {
    const possiblePaths = [
        '/usr/local/bin/node',
        '/opt/homebrew/bin/node',
        '/usr/bin/node'
    ];

    for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
            return p;
        }
    }

    // Fallback: try to find via which
    try {
        const result = execSync('which node', { encoding: 'utf-8' }).trim();
        if (result && fs.existsSync(result)) {
            return result;
        }
    } catch (e) { }

    return 'node'; // Last resort
}

// Build environment
const ANDROID_SDK = findAndroidSDK();
const NODE_PATH = findNodePath();
const HOME = process.env.HOME || process.env.USERPROFILE || '';

const COMMON_PATHS = [
    '/usr/local/bin',
    '/opt/homebrew/bin',
    '/usr/bin',
    '/bin',
    '/usr/sbin',
    '/sbin'
];

if (ANDROID_SDK) {
    COMMON_PATHS.push(
        path.join(ANDROID_SDK, 'platform-tools'),
        path.join(ANDROID_SDK, 'tools'),
        path.join(ANDROID_SDK, 'tools/bin')
    );
}

COMMON_PATHS.push('/Applications/Xcode.app/Contents/Developer/usr/bin');

const ENV_PATH = COMMON_PATHS.filter(p => fs.existsSync(p)).join(':');
const SPAWN_ENV = {
    ...process.env,
    PATH: ENV_PATH
};

if (ANDROID_SDK) {
    SPAWN_ENV.ANDROID_SDK_ROOT = ANDROID_SDK;
    SPAWN_ENV.ANDROID_HOME = ANDROID_SDK;
}

// State
let backendProcess = null;
let appiumProcess = null;

// Logging
function log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${level.toUpperCase()}] ${message}`;

    try {
        fs.appendFileSync(LOG_FILE, `${logEntry}\n`);
    } catch (e) {
        // Ignore file write errors
    }

    // Send to extension
    sendMessage({ type: 'log', message: logEntry, level });
}

// Send message to Chrome (Length-prefixed JSON)
function sendMessage(msg) {
    try {
        if (!process.stdout.writable) return;
        const buffer = Buffer.from(JSON.stringify(msg));
        const header = Buffer.alloc(4);
        header.writeUInt32LE(buffer.length, 0);
        process.stdout.write(header);
        process.stdout.write(buffer);
    } catch (e) {
        // Chrome disconnected, ignore
    }
}

// Start Backend Server
function startBackend() {
    if (backendProcess) {
        return { success: true, message: 'Backend already running', pid: backendProcess.pid };
    }

    try {
        // Check if something is already on port 8765
        try {
            const pid = execSync('lsof -ti:8765', { encoding: 'utf-8' }).trim();
            if (pid) {
                log(`Found existing process on port 8765 (PID: ${pid}), killing it...`, 'warning');
                execSync(`kill -9 ${pid}`);
                // Give it a moment to release the port
                execSync('sleep 0.5');
            }
        } catch (e) {
            // No process on port, that's fine
        }

        log('Starting Backend Server...');
        backendProcess = spawn(NODE_PATH, [BACKEND_SCRIPT], {
            cwd: PROJECT_ROOT,
            detached: false,
            env: SPAWN_ENV
        });

        backendProcess.stdout.on('data', (data) => {
            log(`[Backend] ${data.toString().trim()}`, 'info');
        });

        backendProcess.stderr.on('data', (data) => {
            log(`[Backend] ${data.toString().trim()}`, 'error');
        });

        backendProcess.on('close', (code) => {
            log(`Backend process exited with code ${code}`, 'warning');
            backendProcess = null;
            sendMessage({ type: 'status', backend: false, appium: !!appiumProcess });
        });

        log(`Backend started with PID ${backendProcess.pid}`);
        return { success: true, pid: backendProcess.pid };
    } catch (error) {
        log(`Error starting backend: ${error.message}`, 'error');
        return { success: false, error: error.message };
    }
}

// Start Appium Server
function startAppium() {
    if (appiumProcess) {
        return { success: true, message: 'Appium already running', pid: appiumProcess.pid };
    }

    try {
        // Check if something is already on port 4723
        try {
            const pid = execSync('lsof -ti:4723', { encoding: 'utf-8' }).trim();
            if (pid) {
                log(`Found existing process on port 4723 (PID: ${pid}), killing it...`, 'warning');
                execSync(`kill -9 ${pid}`);
                // Give it a moment to release the port
                execSync('sleep 0.5');
            }
        } catch (e) {
            // No process on port, that's fine
        }

        log('Starting Appium Server...');
        appiumProcess = spawn('appium', [], {
            detached: false,
            shell: true,
            env: SPAWN_ENV
        });

        appiumProcess.stdout.on('data', (data) => {
            log(`[Appium] ${data.toString().trim()}`, 'info');
        });

        appiumProcess.stderr.on('data', (data) => {
            log(`[Appium] ${data.toString().trim()}`, 'error');
        });

        appiumProcess.on('close', (code) => {
            log(`Appium process exited with code ${code}`, 'warning');
            appiumProcess = null;
            sendMessage({ type: 'status', backend: !!backendProcess, appium: false });
        });

        log(`Appium started with PID ${appiumProcess.pid}`);
        return { success: true, pid: appiumProcess.pid };
    } catch (error) {
        log(`Error starting appium: ${error.message}`, 'error');
        return { success: false, error: error.message };
    }
}

// Stop Servers
function stopServers() {
    let backendStopped = false;
    let appiumStopped = false;

    if (backendProcess) {
        process.kill(backendProcess.pid);
        backendProcess = null;
        backendStopped = true;
    }

    if (appiumProcess) {
        process.kill(appiumProcess.pid);
        appiumProcess = null;
        appiumStopped = true;
    }

    return { success: true, backendStopped, appiumStopped };
}

// Handle Input
let inputBuffer = Buffer.alloc(0);

process.stdin.on('readable', () => {
    let chunk;
    while ((chunk = process.stdin.read()) !== null) {
        inputBuffer = Buffer.concat([inputBuffer, chunk]);

        // Process complete messages
        while (inputBuffer.length >= 4) {
            const length = inputBuffer.readUInt32LE(0);

            // Sanity check
            if (length > 10000000) {
                log('Invalid message length, resetting buffer', 'error');
                inputBuffer = Buffer.alloc(0);
                break;
            }

            if (inputBuffer.length >= 4 + length) {
                const payload = inputBuffer.slice(4, 4 + length);
                inputBuffer = inputBuffer.slice(4 + length);

                try {
                    const msg = JSON.parse(payload.toString());
                    log(`Received message: ${msg.command}`);

                    switch (msg.command) {
                        case 'start':
                            const backendRes = startBackend();
                            const appiumRes = startAppium();
                            sendMessage({
                                type: 'start-result',
                                backend: backendRes,
                                appium: appiumRes
                            });
                            break;

                        case 'stop':
                            const stopRes = stopServers();
                            sendMessage({ type: 'stop-result', data: stopRes });
                            break;

                        case 'status':
                            // Check external appium too
                            let appiumRunning = !!appiumProcess;
                            if (!appiumRunning) {
                                try {
                                    execSync('pgrep -x appium');
                                    appiumRunning = true;
                                } catch (e) { }
                            }

                            sendMessage({
                                type: 'status',
                                backend: !!backendProcess,
                                appium: appiumRunning
                            });
                            break;
                    }
                } catch (error) {
                    log(`Error processing message: ${error.message}`, 'error');
                }
            } else {
                break; // Wait for more data
            }
        }
    }
});

// Cleanup on exit
process.on('exit', () => {
    stopServers();
});

process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));

// Handle stdout errors (EPIPE when Chrome disconnects)
process.stdout.on('error', () => {
    process.exit(0);
});

log('Native host launcher started');
