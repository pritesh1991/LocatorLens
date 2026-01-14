// Background service worker for the extension
console.log('Locator Builder background service initialized');

let nativePort = null;
let serverStatus = { backend: false, appium: false };

// Connect to Native Host
function connectToNativeHost() {
    const hostName = "com.locatorbuilder.host";
    nativePort = chrome.runtime.connectNative(hostName);

    nativePort.onMessage.addListener((msg) => {
        console.log("Received from native host:", msg);
        if (msg.type === 'status') {
            serverStatus = { backend: msg.backend, appium: msg.appium };
            broadcastStatus();
        } else if (msg.type === 'start-result') {
            // Handle start result
            checkStatus();
        } else if (msg.type === 'log') {
            chrome.runtime.sendMessage({
                type: 'server-log',
                message: msg.message,
                level: msg.level
            }).catch(() => { });
        }
    });

    nativePort.onDisconnect.addListener(() => {
        console.log("Native host disconnected");
        nativePort = null;
        serverStatus = { backend: false, appium: false };
        broadcastStatus();
    });

    // Initial status check
    checkStatus();
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

// Listen for messages from Popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'get-status') {
        sendResponse(serverStatus);
        // Also trigger a fresh check
        checkStatus();
    } else if (request.type === 'start-server') {
        if (!nativePort) connectToNativeHost();
        if (nativePort) {
            nativePort.postMessage({ command: 'start' });
            sendResponse({ success: true });
        } else {
            sendResponse({ success: false, error: 'Could not connect to native host' });
        }
    } else if (request.type === 'stop-server') {
        if (nativePort) {
            nativePort.postMessage({ command: 'stop' });
            sendResponse({ success: true });
        }
    } else if (request.type === 'connect-device') {
        // Handle device connection in background (persistent)
        handleDeviceConnection(request.deviceInfo);
        sendResponse({ started: true });
    }
    return true; // Keep channel open for async response
});

const BACKEND_URL = 'http://localhost:8765';

// Handle device connection in background - runs even if popup closes
async function handleDeviceConnection(deviceInfo) {
    console.log('Background: connecting to device', deviceInfo.name);

    try {
        // Create Appium session
        const response = await fetch(`${BACKEND_URL}/api/session/create`, {
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
        } else {
            console.error('Background: session creation failed', data.error);
            // Could show a notification here if desired
        }
    } catch (error) {
        console.error('Background: connection error', error.message);
    }
}

// Connect on startup
connectToNativeHost();

// Listen for extension installation
chrome.runtime.onInstalled.addListener(() => {
    console.log('Locator Builder installed');
    connectToNativeHost();
});
