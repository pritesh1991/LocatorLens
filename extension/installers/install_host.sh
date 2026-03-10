#!/bin/bash

# ====================================================================
# LocatorLens Native Host Installer - macOS / Linux
#
# Usage:
#   bash install_host.sh                          # auto-detect
#   bash install_host.sh --extension-id <id>      # specify CWS extension ID
# ====================================================================

set -e

EXTENSION_ID="ajcdeghbgfonhphbnkmbmocekkmdeoke"
HOST_NAME="com.locatorbuilder.host"
INSTALL_BASE="$HOME/.locatorlens"
NATIVE_HOST_DIR="$INSTALL_BASE/native-host"
BACKEND_INSTALL_DIR="$INSTALL_BASE/backend"

# Parse arguments
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --extension-id) EXTENSION_ID="$2"; shift ;;
    esac
    shift
done

echo ""
echo "========================================"
echo " LocatorLens Native Host Installer"
echo "========================================"
echo ""

# Detect OS
if [[ "$OSTYPE" == "darwin"* ]]; then
    CHROME_NMH_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
    CHROMIUM_NMH_DIR="$HOME/Library/Application Support/Chromium/NativeMessagingHosts"
    EDGE_NMH_DIR="$HOME/Library/Application Support/Microsoft Edge/NativeMessagingHosts"
    BRAVE_NMH_DIR="$HOME/Library/Application Support/BraveSoftware/Brave-Browser/NativeMessagingHosts"
    OS_NAME="macOS"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    CHROME_NMH_DIR="$HOME/.config/google-chrome/NativeMessagingHosts"
    CHROMIUM_NMH_DIR="$HOME/.config/chromium/NativeMessagingHosts"
    EDGE_NMH_DIR="$HOME/.config/microsoft-edge/NativeMessagingHosts"
    BRAVE_NMH_DIR="$HOME/.config/BraveSoftware/Brave-Browser/NativeMessagingHosts"
    OS_NAME="Linux"
else
    echo "ERROR: Unsupported OS: $OSTYPE (only macOS and Linux are supported by this script)"
    echo "For Windows, please use install_host.bat"
    exit 1
fi

echo "OS: $OS_NAME"
echo "Extension ID: $EXTENSION_ID"
echo "Install directory: $INSTALL_BASE"
echo ""

# --- Step 1: Check Node.js ---
echo "[1/6] Checking Node.js..."
if ! command -v node &>/dev/null; then
    echo "  ERROR: Node.js not found. Please install Node.js v18+ from https://nodejs.org"
    exit 1
fi
NODE_VERSION=$(node --version)
echo "  OK Node.js $NODE_VERSION"

# --- Step 2: Check npm ---
echo "[2/6] Checking npm..."
if ! command -v npm &>/dev/null; then
    echo "  ERROR: npm not found. Please install Node.js from https://nodejs.org"
    exit 1
fi
echo "  OK npm found"

# --- Step 3: Locate or download backend ---
echo "[3/6] Setting up backend..."

# Try to find if we're running from inside the repo
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_BACKEND="$SCRIPT_DIR/../../backend"

if [ -f "$REPO_BACKEND/server.js" ] && [ -f "$REPO_BACKEND/package.json" ]; then
    echo "  Found backend in repository at: $(realpath $REPO_BACKEND)"
    BACKEND_SRC="$(realpath $REPO_BACKEND)"

    mkdir -p "$BACKEND_INSTALL_DIR"
    cp -R "$BACKEND_SRC/." "$BACKEND_INSTALL_DIR/"
    echo "  OK Copied backend to $BACKEND_INSTALL_DIR"
else
    echo "  ! Backend not found in repository location."
    echo "  Checking if backend is already installed..."

    if [ -f "$BACKEND_INSTALL_DIR/server.js" ]; then
        echo "  OK Backend already installed at $BACKEND_INSTALL_DIR"
    else
        echo ""
        echo "  ERROR: Backend files not found."
        echo "  Please download the full release package from GitHub:"
        echo "  https://github.com/YOUR_USERNAME/locatorlens/releases/latest"
        echo ""
        echo "  Extract it and run this installer from inside the extracted folder."
        exit 1
    fi
fi

# Install npm dependencies
echo "  Installing backend dependencies..."
cd "$BACKEND_INSTALL_DIR"
npm install --omit=dev --silent
cd - > /dev/null
echo "  OK Backend dependencies installed"

# --- Step 4: Create native host files ---
echo "[4/6] Creating native host files..."
mkdir -p "$NATIVE_HOST_DIR"

# Create host.sh wrapper
cat > "$NATIVE_HOST_DIR/host.sh" << HOSTEOF
#!/bin/bash
# LocatorLens Native Messaging Host Wrapper
# Ensures correct PATH is set when Chrome launches this

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:\$PATH"

# Find node
NODE="\$(command -v node 2>/dev/null)"
if [ -z "\$NODE" ]; then
    for p in "/opt/homebrew/bin/node" "/usr/local/bin/node" "$HOME/.nvm/versions/node/"*/bin/node; do
        [ -f "\$p" ] && NODE="\$p" && break
    done
fi

if [ -z "\$NODE" ]; then
    echo "ERROR: Node.js not found" >&2
    exit 1
fi

exec "\$NODE" "$(realpath $NATIVE_HOST_DIR)/launcher.js"
HOSTEOF
chmod +x "$NATIVE_HOST_DIR/host.sh"

# Copy launcher.js from native-host directory if available
REPO_LAUNCHER="$SCRIPT_DIR/../../native-host/launcher.js"
if [ -f "$REPO_LAUNCHER" ]; then
    cp "$(realpath $REPO_LAUNCHER)" "$NATIVE_HOST_DIR/launcher.js"
    chmod +x "$NATIVE_HOST_DIR/launcher.js"
    echo "  OK Native host files created"
else
    echo "  ERROR: launcher.js not found at $REPO_LAUNCHER"
    exit 1
fi

# --- Step 5: Create native messaging manifest ---
echo "[5/6] Creating native messaging manifest..."

MANIFEST_CONTENT="{
  \"name\": \"$HOST_NAME\",
  \"description\": \"LocatorLens Native Messaging Host\",
  \"path\": \"$NATIVE_HOST_DIR/host.sh\",
  \"type\": \"stdio\",
  \"allowed_origins\": [
    \"chrome-extension://$EXTENSION_ID/\"
  ]
}"

echo "$MANIFEST_CONTENT" > "$NATIVE_HOST_DIR/$HOST_NAME.json"

# --- Step 6: Install manifest for each browser ---
echo "[6/6] Installing for browsers..."

install_for_browser() {
    local BROWSER_NAME="$1"
    local NMH_DIR="$2"
    local PARENT_DIR="$(dirname "$NMH_DIR")"

    if [ -d "$PARENT_DIR" ]; then
        mkdir -p "$NMH_DIR"
        cp "$NATIVE_HOST_DIR/$HOST_NAME.json" "$NMH_DIR/"
        echo "  OK $BROWSER_NAME"
    else
        echo "  - $BROWSER_NAME (not installed, skipped)"
    fi
}

install_for_browser "Google Chrome" "$CHROME_NMH_DIR"
install_for_browser "Chromium" "$CHROMIUM_NMH_DIR"
install_for_browser "Microsoft Edge" "$EDGE_NMH_DIR"
install_for_browser "Brave Browser" "$BRAVE_NMH_DIR"

echo ""
echo "========================================"
echo " Installation Complete!"
echo "========================================"
echo ""
echo "Installed to: $INSTALL_BASE"
echo ""
echo "NEXT STEPS:"
echo "  1. Install Appium (if not already):"
echo "     npm install -g appium"
echo "     appium driver install uiautomator2   # for Android"
echo "     appium driver install xcuitest        # for iOS"
echo ""
echo "  2. Go to chrome://extensions"
echo "  3. Find LocatorLens and click the reload icon"
echo "  4. Click the LocatorLens extension icon"
echo "  5. Click 'Start Servers' and connect your device"
echo ""
echo "Logs: $HOME/.locatorlens/native-host.log"
echo ""
