// Background service worker for the extension
importScripts('analytics.js');

console.log('LocatorLens background service initialized');

let nativePort = null;
let serverStatus = { backend: false, appium: false };
let logsTabId = null; // Track the logs tab
let logHistory = []; // Store recent logs for initial load
const MAX_LOG_HISTORY = 1000;
let nativeHostAvailable = false; // Track native host availability
let nativeRequestId = 0;
const pendingNativeRequests = new Map();

function configureUninstallFeedbackUrl() {
    const manifest = chrome.runtime.getManifest();
    const params = new URLSearchParams({
        source: 'chrome-extension-uninstall',
        extensionId: chrome.runtime.id,
        version: manifest.version
    });

    chrome.runtime.setUninstallURL(`https://locatorlens.com/uninstall-feedback?${params.toString()}`, () => {
        if (chrome.runtime.lastError) {
            console.warn('Failed to set uninstall feedback URL:', chrome.runtime.lastError.message);
        }
    });
}

configureUninstallFeedbackUrl();

// Connect to Native Host
function connectToNativeHost() {
    const hostName = "com.locatorlens.host";
    try {
        nativePort = chrome.runtime.connectNative(hostName);
        nativeHostAvailable = true;

        nativePort.onMessage.addListener((msg) => {
            console.log("Received from native host:", msg);
            if (msg.type === 'status') {
                serverStatus = { backend: msg.backend, appium: msg.appium };
                broadcastStatus();
            } else if (msg.requestId && pendingNativeRequests.has(msg.requestId)) {
                const { resolve, timeout } = pendingNativeRequests.get(msg.requestId);
                clearTimeout(timeout);
                pendingNativeRequests.delete(msg.requestId);
                resolve(msg);
            } else if (msg.type === 'start-result') {
                // Check for errors in the start result
                const hasBackendError = msg.backend && !msg.backend.success;
                const hasAppiumError = msg.appium && !msg.appium.success;

                if (hasBackendError || hasAppiumError) {
                    // Compile error messages
                    const errors = [];
                    if (hasBackendError) {
                        errors.push({
                            server: 'Backend',
                            error: msg.backend.error,
                            code: msg.backend.code
                        });
                    }
                    if (hasAppiumError) {
                        errors.push({
                            server: 'Appium',
                            error: msg.appium.error,
                            code: msg.appium.code
                        });
                    }

                    // Broadcast error to popup
                    chrome.runtime.sendMessage({
                        type: 'server-start-error',
                        errors: errors
                    }).catch(() => { });
                }

                // Handle start result
                checkStatus();
            } else if (msg.type === 'log') {
                const logMessage = {
                    type: 'server-log',
                    message: msg.message,
                    level: msg.level || 'info',
                    timestamp: Date.now()
                };

                // Store in history
                logHistory.push(logMessage);
                if (logHistory.length > MAX_LOG_HISTORY) {
                    logHistory.shift();
                }

                // Broadcast to popup
                chrome.runtime.sendMessage(logMessage).catch(() => { });

                // Send to logs tab if open
                if (logsTabId) {
                    chrome.tabs.sendMessage(logsTabId, logMessage).catch(() => {
                        // Tab might be closed
                        logsTabId = null;
                    });
                }
            }
        });

        nativePort.onDisconnect.addListener(() => {
            console.log("Native host disconnected:", chrome.runtime.lastError);

            nativeHostAvailable = false;
            nativePort = null;
            serverStatus = { backend: false, appium: false };
            broadcastStatus();

            // Notify popup of the specific error
            if (chrome.runtime.lastError) {
                const error = chrome.runtime.lastError.message;
                let userMessage = error;
                let helpNeeded = false;

                // Provide helpful messages for common errors
                if (error.includes('Specified native messaging host not found')) {
                    userMessage = 'Install the local companion once to start servers and connect your devices.';
                    helpNeeded = true;
                } else if (error.includes('Access to the specified native messaging host is forbidden')) {
                    userMessage = 'Open Settings, re-run the companion installer, then reload the extension.';
                    helpNeeded = true;
                } else if (error.includes('Native host has exited')) {
                    userMessage = 'Native host crashed. Check that Node.js is installed and in your PATH.';
                    helpNeeded = true;
                }

                chrome.runtime.sendMessage({
                    type: 'native-host-error',
                    error: userMessage,
                    needsHelp: helpNeeded
                }).catch(() => { });

                // If this happens during startup, also send as server-start-error
                chrome.runtime.sendMessage({
                    type: 'server-start-error',
                    errors: [{
                        server: 'Local Companion',
                        error: userMessage,
                        code: helpNeeded ? 'COMPANION_SETUP_REQUIRED' : 'NATIVE_HOST_ERROR'
                    }]
                }).catch(() => { });
            }
        });

        // Initial status check
        checkStatus();
    } catch (error) {
        console.error("Failed to connect to native host:", error);
        nativeHostAvailable = false;
        nativePort = null;

        chrome.runtime.sendMessage({
            type: 'native-host-unavailable',
            error: error.message
        }).catch(() => { });
    }
}

// Check native host connection on startup
function checkNativeHostConnection() {
    if (!nativePort) {
        connectToNativeHost();
    }

    // Wait a bit and check if connection succeeded
    setTimeout(() => {
        if (!nativeHostAvailable) {
            console.warn('Native host not available');
            chrome.runtime.sendMessage({
                type: 'native-host-unavailable'
            }).catch(() => { });
        }
    }, 1000);
}

function checkStatus() {
    if (nativePort) {
        nativePort.postMessage({ command: 'status' });
    }
}

function broadcastStatus() {
    chrome.runtime.sendMessage({
        type: 'server-status',
        status: serverStatus
    }).catch(() => {
        // Popup might be closed, ignore error
    });
}

function sendNativeRequest(message, timeoutMs = 3000) {
    return new Promise((resolve, reject) => {
        if (!nativePort) {
            reject(new Error('Native host is not connected'));
            return;
        }

        const requestId = ++nativeRequestId;
        const timeout = setTimeout(() => {
            pendingNativeRequests.delete(requestId);
            reject(new Error('Native host did not respond'));
        }, timeoutMs);

        pendingNativeRequests.set(requestId, { resolve, reject, timeout });
        nativePort.postMessage({ ...message, requestId });
    });
}

// Listen for messages from Popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('[Background] Received message:', request.type);

    if (request.type === 'get-status') {
        sendResponse(serverStatus);
        // Also trigger a fresh check
        checkStatus();
    } else if (request.type === 'check-setup') {
        if (!nativePort) {
            connectToNativeHost();
        }

        setTimeout(() => {
            if (!nativePort) {
                sendResponse({
                    success: false,
                    nativeHost: false,
                    error: 'Native host not found. Run the LocatorLens auto setup installer, then reload the extension.'
                });
                return;
            }

            sendNativeRequest({ command: 'diagnose', extensionId: chrome.runtime.id })
                .then((msg) => {
                    sendResponse({
                        success: true,
                        nativeHost: true,
                        diagnostics: msg.data
                    });
                })
                .catch((error) => {
                    sendResponse({
                        success: false,
                        nativeHost: true,
                        error: error.message
                    });
                });
        }, 100);
        return true;
    } else if (request.type === 'start-server') {
        console.log('[Background] Start server requested, nativePort:', nativePort ? 'connected' : 'not connected');

        // Read settings then send start command
        chrome.storage.sync.get({ backendPort: 8765, appiumUrl: 'http://localhost:4723', fpsLimit: 3 }, (settings) => {
            let appiumPort = 4723;
            try { appiumPort = parseInt(new URL(settings.appiumUrl).port) || 4723; } catch (e) {}
            const startCmd = {
                command: 'start',
                backendPort: settings.backendPort,
                appiumPort,
                fpsLimit: normalizeFpsLimit(settings.fpsLimit)
            };

            if (!nativePort) {
                console.log('[Background] Attempting to connect to native host...');
                connectToNativeHost();

                setTimeout(() => {
                    if (nativePort) {
                        console.log('[Background] Sending start command to native host');
                        nativePort.postMessage(startCmd);
                        sendResponse({ success: true });
                    } else {
                        console.error('[Background] Could not connect to native host after waiting');
                        sendResponse({
                            success: false,
                            code: 'COMPANION_SETUP_REQUIRED',
                            error: 'Install the local companion once to start servers and connect your devices.'
                        });
                    }
                }, 100);
            } else {
                console.log('[Background] Sending start command to native host');
                nativePort.postMessage(startCmd);
                sendResponse({ success: true });
            }
        });
        return true; // Will respond asynchronously
    } else if (request.type === 'stop-server') {
        if (nativePort) {
            nativePort.postMessage({ command: 'stop' });
            sendResponse({ success: true });
        }
    } else if (request.type === 'connect-device') {
        // Handle device connection in background (persistent)
        handleDeviceConnection(request.deviceInfo);
        sendResponse({ started: true });
    } else if (request.type === 'open-logs-tab') {
        // Open or focus logs tab
        handleOpenLogsTab();
        sendResponse({ success: true });
    } else if (request.type === 'request-logs') {
        // Return logs directly in response (works for both popup and logs tab)
        sendResponse({ success: true, logs: logHistory });
        // Also send to logs tab if it's a tab (not popup)
        if (sender.tab && sender.tab.id) {
            chrome.tabs.sendMessage(sender.tab.id, {
                type: 'initial-logs',
                logs: logHistory
            }).catch(() => { });
        }
    }
    return true; // Keep channel open for async response
});

function getBackendUrl(port) {
    return `http://localhost:${port || 8765}`;
}

function normalizeFpsLimit(value, fallback = 3) {
    const parsed = value === '' || value == null ? NaN : Number(value);
    if (Number.isFinite(parsed)) {
        return Math.min(30, Math.max(1, Math.round(parsed)));
    }

    const parsedFallback = fallback === '' || fallback == null ? NaN : Number(fallback);
    return Number.isFinite(parsedFallback)
        ? Math.min(30, Math.max(1, Math.round(parsedFallback)))
        : 3;
}

// Handle device connection in background - runs even if popup closes
async function handleDeviceConnection(deviceInfo) {
    console.log('Background: connecting to device', deviceInfo.name);
    LocatorLensAnalytics.trackEvent('device_connect_started', {
        surface: 'background',
        platform: deviceInfo.platform || 'unknown'
    });

    // Read backend port from settings
    const settings = await new Promise(resolve =>
        chrome.storage.sync.get({ backendPort: 8765 }, resolve)
    );
    const backendUrl = getBackendUrl(settings.backendPort);

    try {
        // Create Appium session
        const response = await fetch(`${backendUrl}/api/session/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deviceInfo })
        });

        const data = await response.json();

        if (data.success) {
            // Store session info
            await chrome.storage.local.set({
                activeSession: {
                    device: deviceInfo,
                    sessionId: data.sessionId,
                    timestamp: Date.now()
                }
            });

            console.log('Background: session created, opening inspector tab');

            // Open inspector in new tab
            const inspectorUrl = chrome.runtime.getURL('inspector/inspector.html');
            chrome.tabs.create({ url: inspectorUrl });

            // Notify popup of success
            chrome.runtime.sendMessage({
                type: 'device-connection-result',
                success: true,
                device: deviceInfo.name
            }).catch(() => {});
            LocatorLensAnalytics.trackEvent('device_connect_succeeded', {
                surface: 'background',
                platform: deviceInfo.platform || 'unknown'
            });
        } else {
            console.error('Background: session creation failed', data.error);
            chrome.runtime.sendMessage({
                type: 'device-connection-result',
                success: false,
                error: data.error || 'Session creation failed'
            }).catch(() => {});
            LocatorLensAnalytics.trackEvent('device_connect_failed', {
                surface: 'background',
                platform: deviceInfo.platform || 'unknown',
                error_code: 'session_create_failed'
            });
        }
    } catch (error) {
        console.error('Background: connection error', error.message);
        chrome.runtime.sendMessage({
            type: 'device-connection-result',
            success: false,
            error: error.message || 'Connection failed'
        }).catch(() => {});
        LocatorLensAnalytics.trackEvent('device_connect_failed', {
            surface: 'background',
            platform: deviceInfo.platform || 'unknown',
            error_code: 'network_error'
        });
    }
}

// Handle opening logs tab - create new or focus existing
async function handleOpenLogsTab() {
    console.log('Background: opening logs tab');

    // Check if logs tab is already open
    if (logsTabId) {
        try {
            await chrome.tabs.get(logsTabId);
            // Tab exists, focus it
            chrome.tabs.update(logsTabId, { active: true });
            chrome.windows.update((await chrome.tabs.get(logsTabId)).windowId, { focused: true });
            return;
        } catch (error) {
            // Tab no longer exists
            logsTabId = null;
        }
    }

    // Create new logs tab
    const logsUrl = chrome.runtime.getURL('logs.html');
    const tab = await chrome.tabs.create({ url: logsUrl });
    logsTabId = tab.id;
}

// Listen for tab closure to clear logsTabId
chrome.tabs.onRemoved.addListener((tabId) => {
    if (tabId === logsTabId) {
        logsTabId = null;
        console.log('Background: logs tab closed');
    }
});

// Initialize native host connection on startup
checkNativeHostConnection();

// Listen for extension installation
chrome.runtime.onInstalled.addListener((details) => {
    console.log('LocatorLens installed');
    LocatorLensAnalytics.trackEvent(details.reason === 'update' ? 'extension_updated' : 'extension_installed', {
        surface: 'background'
    });
    connectToNativeHost();
});

// Periodically check if native host is still connected, reconnect if needed
setInterval(() => {
    if (!nativePort && nativeHostAvailable) {
        console.log('Native host lost, attempting reconnect...');
        connectToNativeHost();
    }
}, 30000);
