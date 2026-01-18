#!/bin/bash

# ====================================================================
# LocatorLens Native Host Installation Script - macOS/Linux
# ====================================================================

set -e  # Exit on error

echo ""
echo "========================================"
echo "LocatorLens Native Host Installer"
echo "========================================"
echo ""

HOST_NAME="com.locatorbuilder.host"
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
NATIVE_HOST_DIR="$PROJECT_DIR/native-host"
HOST_SCRIPT="$NATIVE_HOST_DIR/host.sh"

# Detect OS and set Chrome directory
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    CHROME_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
    EDGE_DIR="$HOME/Library/Application Support/Microsoft Edge/NativeMessagingHosts"
    OS_NAME="macOS"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    CHROME_DIR="$HOME/.config/google-chrome/NativeMessagingHosts"
    EDGE_DIR="$HOME/.config/microsoft-edge/NativeMessagingHosts"
    OS_NAME="Linux"
else
    echo "❌ ERROR: Unsupported OS: $OSTYPE"
    echo "This script only supports macOS and Linux."
    exit 1
fi

echo "Detected OS: $OS_NAME"
echo ""

# Check if native-host directory exists
if [ ! -d "$NATIVE_HOST_DIR" ]; then
    echo "❌ ERROR: native-host directory not found!"
    echo "Please run this script from the LocatorLens project root."
    exit 1
fi

echo "[1/4] Making scripts executable..."
chmod +x "$NATIVE_HOST_DIR/host.sh"
chmod +x "$NATIVE_HOST_DIR/launcher.js"

echo "[2/4] Creating manifest file..."
cat > "$NATIVE_HOST_DIR/$HOST_NAME.json" <<EOF
{
  "name": "$HOST_NAME",
  "description": "LocatorLens Native Messaging Host",
  "path": "$HOST_SCRIPT",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://ajcdeghbgfonhphbnkmbmocekkmdeoke/"
  ]
}
EOF

echo "[3/4] Installing native host..."

# Install for Chrome
if [ -d "$HOME/Library/Application Support/Google/Chrome" ] || [ -d "$HOME/.config/google-chrome" ]; then
    mkdir -p "$CHROME_DIR"
    cp "$NATIVE_HOST_DIR/$HOST_NAME.json" "$CHROME_DIR/"
    echo "  ✓ Chrome: Installed"
else
    echo "  ⊗ Chrome: Not found (skipped)"
fi

# Install for Edge (if available)
if [ -d "$HOME/Library/Application Support/Microsoft Edge" ] || [ -d "$HOME/.config/microsoft-edge" ]; then
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
echo "Manifest: $NATIVE_HOST_DIR/$HOST_NAME.json"
echo "Host script: $HOST_SCRIPT"
echo ""
echo "NEXT STEPS:"
echo "1. Reload the LocatorLens extension in Chrome/Edge"
echo "2. Click on the extension icon"
echo "3. Try starting the servers"
echo ""
