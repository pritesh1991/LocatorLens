#!/bin/bash

# ====================================================================
# LocatorLens Native Host Installation Script - macOS/Linux
# Self-Contained Installer - Works from anywhere!
# ====================================================================

set -e  # Exit on error

echo ""
echo "========================================"
echo "LocatorLens Native Host Installer"
echo "========================================"
echo ""

HOST_NAME="com.locatorbuilder.host"

# Detect OS and set directories
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    CHROME_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
    EDGE_DIR="$HOME/Library/Application Support/Microsoft Edge/NativeMessagingHosts"
    CHROME_EXT_DIR="$HOME/Library/Application Support/Google/Chrome/Default/Extensions"
    OS_NAME="macOS"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    CHROME_DIR="$HOME/.config/google-chrome/NativeMessagingHosts"
    EDGE_DIR="$HOME/.config/microsoft-edge/NativeMessagingHosts"
    CHROME_EXT_DIR="$HOME/.config/google-chrome/Default/Extensions"
    OS_NAME="Linux"
else
    echo "❌ ERROR: Unsupported OS: $OSTYPE"
    echo "This script only supports macOS and Linux."
    exit 1
fi

echo "Detected OS: $OS_NAME"
echo ""

# Try to find the LocatorLens extension installation
echo "[1/5] Looking for LocatorLens extension..."
EXTENSION_ID="ajcdeghbgfonhphbnkmbmocekkmdeoke"
INSTALL_DIR=""

if [ -d "$CHROME_EXT_DIR/$EXTENSION_ID" ]; then
    # Find the latest version directory
    LATEST_VERSION=$(ls -1 "$CHROME_EXT_DIR/$EXTENSION_ID" | sort -V | tail -1)
    if [ -n "$LATEST_VERSION" ]; then
        INSTALL_DIR="$CHROME_EXT_DIR/$EXTENSION_ID/$LATEST_VERSION"
        echo "  ✓ Found extension at: $INSTALL_DIR"
    fi
fi

# If not found, create in a standard location
if [ -z "$INSTALL_DIR" ]; then
    echo "  ⊗ Extension not found in Chrome extensions directory"
    echo "  → Creating native host files in: $HOME/.locatorlens"
    INSTALL_DIR="$HOME/.locatorlens"
    mkdir -p "$INSTALL_DIR"
fi

#Create native-host directory
NATIVE_HOST_DIR="$INSTALL_DIR/native-host"
mkdir -p "$NATIVE_HOST_DIR"

echo "[2/5] Creating native host wrapper script..."
# Create host.sh with embedded logic
cat > "$NATIVE_HOST_DIR/host.sh" << 'EOF'
#!/bin/bash

# Ensure common paths are in PATH (Chrome environment can be restricted)
export PATH="/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

# Find node - use dynamic PATH lookup first (platform-agnostic)
NODE_PATH=$(which node 2>/dev/null)

# If 'which' doesn't find node, check common installation locations as fallback
if [ -z "$NODE_PATH" ] || [ ! -f "$NODE_PATH" ]; then
    # Check common locations
    for path in "/opt/homebrew/bin/node" "/usr/local/bin/node" "/usr/bin/node" "$HOME/.nvm/versions/node/*/bin/node"; do
        if [ -f "$path" ]; then
            NODE_PATH="$path"
            break
        fi
    done
fi

# Final check
if [ -z "$NODE_PATH" ] || [ ! -f "$NODE_PATH" ]; then
    echo "ERROR: Node.js not found! Please install Node.js" >&2
    exit 1
fi

# Run the launcher
"$NODE_PATH" "$(dirname "$0")/launcher.js"
EOF

chmod +x "$NATIVE_HOST_DIR/host.sh"

echo "[3/5] Creating launcher script..."
# Create a minimal launcher.js that works standalone
cat > "$NATIVE_HOST_DIR/launcher.js" << 'LAUNCHEREOF'
#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');

// Find extension directory
function findExtensionDir() {
    const HOME = process.env.HOME || process.env.USERPROFILE;
    const extId = 'ajcdeghbgfonhphbnkmbmocekkmdeoke';
    
    // Try common Chrome extension locations
    const possibleDirs = [
        path.join(HOME, 'Library/Application Support/Google/Chrome/Default/Extensions', extId),
        path.join(HOME, '.config/google-chrome/Default/Extensions', extId),
        path.join(process.env.LOCALAPPDATA || '', 'Google/Chrome/User Data/Default/Extensions', extId)
    ];
    
    for (const dir of possibleDirs) {
        if (fs.existsSync(dir)) {
            // Find latest version
            const versions = fs.readdirSync(dir).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
            if (versions.length > 0) {
                return path.join(dir, versions[0]);
            }
        }
    }
    return null;
}

const EXT_DIR = findExtensionDir();
const BACKEND_SCRIPT = EXT_DIR ? path.join(EXT_DIR, 'backend', 'server.js') : null;
const LOG_FILE = path.join(process.env.HOME || process.env.USERPROFILE, '.locatorlens.log');

let backendProcess = null;
let appiumProcess = null;

// Logging
function log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    
    try {
        fs.appendFileSync(LOG_FILE, `${logEntry}\n`);
    } catch (e) {}
    
    sendMessage({ type: 'log', message: logEntry, level });
}

// Send message to Chrome
function sendMessage(msg) {
    try {
        if (!process.stdout.writable) return;
        const buffer = Buffer.from(JSON.stringify(msg));
        const header = Buffer.alloc(4);
        header.writeUInt32LE(buffer.length, 0);
        process.stdout.write(header);
        process.stdout.write(buffer);
    } catch (e) {}
}

// Start Backend
function startBackend() {
    if (backendProcess) {
        return { success: true, message: 'Backend already running' };
    }
    
    if (!BACKEND_SCRIPT || !fs.existsSync(BACKEND_SCRIPT)) {
        const errorMsg = 'Backend server not found. Please ensure LocatorLens extension is properly installed.';
        log(errorMsg, 'error');
        return { success: false, error: errorMsg, code: 'BACKEND_NOT_FOUND' };
    }
    
    try {
        log('Starting Backend Server...');
        backendProcess = spawn('node', [BACKEND_SCRIPT], { detached: false });
        
        backendProcess.stdout.on('data', (data) => log(`[Backend] ${data.toString().trim()}`, 'info'));
        backendProcess.stderr.on('data', (data) => {
            const msg = data.toString().trim();
            log(`[Backend] ${msg}`, 'error');
            if (msg.includes("Cannot find module") || msg.includes("MODULE_NOT_FOUND")) {
                log("ACTION REQUIRED: Backend dependencies missing. Please run 'npm install' in the 'backend' directory.", 'error');
            }
        });
        backendProcess.on('close', (code) => {
            log(`Backend exited with code ${code}`, 'warning');
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

// Find Appium Path
function findAppiumPath() {
    // 1. Try which command
    try {
        const result = execSync('which appium', { encoding: 'utf-8' }).trim();
        if (result && fs.existsSync(result)) return result;
    } catch (e) {}

    // 2. Check common locations
    const commonPaths = [
        '/usr/local/bin/appium',
        '/opt/homebrew/bin/appium',
        path.join(process.env.HOME || '', '.npm-global/bin/appium'),
        path.join(process.env.HOME || '', 'npm/bin/appium')
    ];

    for (const p of commonPaths) {
        if (fs.existsSync(p)) return p;
    }
    
    return null;
}

// Start Appium
function startAppium() {
    if (appiumProcess) {
        return { success: true, message: 'Appium already running' };
    }
    
    const appiumPath = findAppiumPath();
    if (!appiumPath) {
        const errorMsg = 'Appium is not installed. Please install it using: npm install -g appium';
        log(errorMsg, 'error');
        return { success: false, error: errorMsg, code: 'APPIUM_NOT_FOUND' };
    }
    
    try {
        log(`Starting Appium Server from: ${appiumPath}`);
        appiumProcess = spawn(appiumPath, [], { detached: false, shell: true });
        
        appiumProcess.stdout.on('data', (data) => log(`[Appium] ${data.toString().trim()}`, 'info'));
        appiumProcess.stderr.on('data', (data) => log(`[Appium] ${data.toString().trim()}`, 'error'));
        appiumProcess.on('close', (code) => {
            log(`Appium exited with code ${code}`, 'warning');
            appiumProcess = null;
            sendMessage({ type: 'status', backend: !!backendProcess, appium: false });
        });
        
        log(`Appium started with PID ${appiumProcess.pid}`);
        return { success: true, pid: appiumProcess.pid };
    } catch (error) {
        const errorMsg = `Error starting Appium: ${error.message}`;
        log(errorMsg, 'error');
        return { success: false, error: errorMsg, code: 'APPIUM_START_ERROR' };
    }
}

// Stop servers
function stopServers() {
    if (backendProcess) process.kill(backendProcess.pid);
    if (appiumProcess) process.kill(appiumProcess.pid);
    backendProcess = null;
    appiumProcess = null;
    return { success: true };
}

// Handle input
let inputBuffer = Buffer.alloc(0);

process.stdin.on('readable', () => {
    let chunk;
    while ((chunk = process.stdin.read()) !== null) {
        inputBuffer = Buffer.concat([inputBuffer, chunk]);
        
        while (inputBuffer.length >= 4) {
            const length = inputBuffer.readUInt32LE(0);
            if (length > 10000000) {
                log('Invalid message length', 'error');
                inputBuffer = Buffer.alloc(0);
                break;
            }
            
            if (inputBuffer.length >= 4 + length) {
                const payload = inputBuffer.slice(4, 4 + length);
                inputBuffer = inputBuffer.slice(4 + length);
                
                try {
                    const msg = JSON.parse(payload.toString());
                    log(`Received: ${msg.command}`);
                    
                    switch (msg.command) {
                        case 'start':
                            const backendRes = startBackend();
                            const appiumRes = startAppium();
                            sendMessage({ type: 'start-result', backend: backendRes, appium: appiumRes });
                            break;
                        case 'stop':
                            stopServers();
                            sendMessage({ type: 'stop-result', data: { success: true } });
                            break;
                        case 'status':
                            sendMessage({ type: 'status', backend: !!backendProcess, appium: !!appiumProcess });
                            break;
                    }
                } catch (error) {
                    log(`Error: ${error.message}`, 'error');
                }
            } else {
                break;
            }
        }
    }
});

process.on('exit', () => stopServers());
process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));
process.stdout.on('error', () => process.exit(0));

log('Native host launcher started');
LAUNCHEREOF

chmod +x "$NATIVE_HOST_DIR/launcher.js"

echo "[4/5] Creating manifest file..."
cat > "$NATIVE_HOST_DIR/$HOST_NAME.json" <<EOF
{
  "name": "$HOST_NAME",
  "description": "LocatorLens Native Messaging Host",
  "path": "$NATIVE_HOST_DIR/host.sh",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://$EXTENSION_ID/"
  ]
}
EOF

echo "[5/5] Installing native host..."

# Install for Chrome
if [[ "$OSTYPE" == "darwin"* ]]; then
    CHROME_PARENT="$HOME/Library/Application Support/Google/Chrome"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    CHROME_PARENT="$HOME/.config/google-chrome"
fi

if [ -n "$CHROME_PARENT" ] && [ -d "$CHROME_PARENT" ]; then
    mkdir -p "$CHROME_DIR"
    cp "$NATIVE_HOST_DIR/$HOST_NAME.json" "$CHROME_DIR/"
    echo "  ✓ Chrome: Installed"
else
    echo "  ⊗ Chrome: Not found (skipped)"
fi

# Install for Edge
if [[ "$OSTYPE" == "darwin"* ]]; then
    EDGE_PARENT="$HOME/Library/Application Support/Microsoft Edge"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    EDGE_PARENT="$HOME/.config/microsoft-edge"
fi

if [ -n "$EDGE_PARENT" ] && [ -d "$EDGE_PARENT" ]; then
    mkdir -p "$EDGE_DIR"
    cp "$NATIVE_HOST_DIR/$HOST_NAME.json" "$EDGE_DIR/"
    echo "  ✓ Edge: Installed"
else
    echo "  ⊗ Edge: Not found (skipped)"
fi

echo ""
echo "========================================"
echo "Installation Complete!"
echo "========================================"
echo ""
echo "Files installed to: $NATIVE_HOST_DIR"
echo "Manifest: $CHROME_DIR/$HOST_NAME.json"
echo ""
echo "NEXT STEPS:"
echo "1. Go to chrome://extensions"
echo "2. Find LocatorLens and click the reload icon"
echo "3. Click the extension icon and try 'Start Servers'"
echo ""
