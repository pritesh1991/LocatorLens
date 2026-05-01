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
HOST_NAME="com.locatorlens.host"
INSTALL_BASE="$HOME/.locatorlens"
NATIVE_HOST_DIR="$INSTALL_BASE/native-host"
BACKEND_INSTALL_DIR="$INSTALL_BASE/backend"
COMPANION_VERSION="__COMPANION_VERSION__"
COMPANION_URL="__COMPANION_URL__"
COMPANION_SHA256="__COMPANION_SHA256__"
COMPANION_EMBEDDED="0"

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

if [[ ! "$EXTENSION_ID" =~ ^[a-p]{32}$ ]]; then
    echo "ERROR: Invalid Chrome extension ID: $EXTENSION_ID"
    exit 1
fi

is_release_configured() {
    [[ -n "$COMPANION_URL" && -n "$COMPANION_SHA256" && \
       "$COMPANION_URL" != *"__"* && "$COMPANION_URL" != *"REPLACE_WITH"* && \
       "$COMPANION_SHA256" != *"__"* && "$COMPANION_SHA256" != *"REPLACE_WITH"* ]]
}

download_file() {
    local URL="$1"
    local DEST="$2"

    if command -v curl &>/dev/null; then
        curl -fL "$URL" -o "$DEST"
    elif command -v wget &>/dev/null; then
        wget -O "$DEST" "$URL"
    else
        echo "  ERROR: curl or wget is required to download the LocatorLens companion."
        exit 1
    fi
}

sha256_file() {
    local FILE="$1"

    if command -v shasum &>/dev/null; then
        shasum -a 256 "$FILE" | awk '{print $1}'
    elif command -v sha256sum &>/dev/null; then
        sha256sum "$FILE" | awk '{print $1}'
    else
        echo "  ERROR: shasum or sha256sum is required to verify the LocatorLens companion."
        exit 1
    fi
}

download_companion() {
    local WORK_DIR="$1"

    if [ "$COMPANION_EMBEDDED" != "1" ] && ! is_release_configured; then
        echo "  ERROR: Companion release metadata is not configured."
        echo "  Build the release artifact and update companion-release.json before publishing."
        exit 1
    fi

    if ! command -v unzip &>/dev/null; then
        echo "  ERROR: unzip is required to install the LocatorLens companion."
        exit 1
    fi

    local ZIP_PATH="$WORK_DIR/locatorlens-companion.zip"
    local EXTRACT_DIR="$WORK_DIR/extract"

    if [ "$COMPANION_EMBEDDED" = "1" ]; then
        echo "  Using LocatorLens companion $COMPANION_VERSION bundled in this installer..."
        write_embedded_companion "$ZIP_PATH"
    else
        echo "  Downloading LocatorLens companion $COMPANION_VERSION..."
        echo "  URL: $COMPANION_URL"
        download_file "$COMPANION_URL" "$ZIP_PATH"
    fi

    local ACTUAL_SHA
    local ACTUAL_SHA_LC
    local EXPECTED_SHA_LC
    ACTUAL_SHA="$(sha256_file "$ZIP_PATH")"
    ACTUAL_SHA_LC="$(printf '%s' "$ACTUAL_SHA" | tr '[:upper:]' '[:lower:]')"
    EXPECTED_SHA_LC="$(printf '%s' "$COMPANION_SHA256" | tr '[:upper:]' '[:lower:]')"
    if [ "$ACTUAL_SHA_LC" != "$EXPECTED_SHA_LC" ]; then
        echo "  ERROR: Checksum mismatch."
        echo "  Expected: $COMPANION_SHA256"
        echo "  Actual:   $ACTUAL_SHA"
        exit 1
    fi
    echo "  OK Checksum verified"

    mkdir -p "$EXTRACT_DIR"
    unzip -q "$ZIP_PATH" -d "$EXTRACT_DIR"

    COMPANION_EXTRACT_DIR="$EXTRACT_DIR"
}

find_extracted_backend() {
    find "$1" -path "*/backend/server.js" -type f -print -quit | sed 's#/server.js$##'
}

find_extracted_launcher() {
    find "$1" -path "*/native-host/launcher.js" -type f -print -quit
}

write_embedded_companion() {
    echo "  ERROR: This installer does not contain an embedded companion archive."
    exit 1
}

# __EMBEDDED_COMPANION_ZIP__

abs_path() {
    local TARGET="$1"
    if command -v realpath &>/dev/null; then
        realpath "$TARGET"
    elif [ -d "$TARGET" ]; then
        (cd "$TARGET" && pwd -P)
    else
        local TARGET_DIR
        local TARGET_BASE
        TARGET_DIR="$(dirname "$TARGET")"
        TARGET_BASE="$(basename "$TARGET")"
        printf '%s/%s\n' "$(cd "$TARGET_DIR" && pwd -P)" "$TARGET_BASE"
    fi
}

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
REPO_LAUNCHER="$SCRIPT_DIR/../../native-host/launcher.js"
TMP_DIR=""
COMPANION_EXTRACT_DIR=""
BACKEND_SRC=""
LAUNCHER_SRC=""

if [ -f "$REPO_BACKEND/server.js" ] && [ -f "$REPO_BACKEND/package.json" ] && [ -f "$REPO_LAUNCHER" ]; then
    echo "  Found backend in repository at: $(abs_path "$REPO_BACKEND")"
    BACKEND_SRC="$(abs_path "$REPO_BACKEND")"
    LAUNCHER_SRC="$(abs_path "$REPO_LAUNCHER")"
else
    echo "  Backend not found in repository location."
    TMP_DIR="$(mktemp -d)"
    trap 'if [ -n "$TMP_DIR" ] && [ -d "$TMP_DIR" ]; then rm -rf "$TMP_DIR"; fi' EXIT
    download_companion "$TMP_DIR"
    BACKEND_SRC="$(find_extracted_backend "$COMPANION_EXTRACT_DIR")"
    LAUNCHER_SRC="$(find_extracted_launcher "$COMPANION_EXTRACT_DIR")"
fi

if [ -n "$BACKEND_SRC" ] && [ -f "$BACKEND_SRC/server.js" ] && [ -f "$BACKEND_SRC/package.json" ]; then
    mkdir -p "$BACKEND_INSTALL_DIR"
    rm -rf "$BACKEND_INSTALL_DIR"
    mkdir -p "$BACKEND_INSTALL_DIR"
    cp -R "$BACKEND_SRC/." "$BACKEND_INSTALL_DIR/"
    echo "  OK Copied backend to $BACKEND_INSTALL_DIR"
else
    if [ -f "$BACKEND_INSTALL_DIR/server.js" ]; then
        echo "  OK Backend already installed at $BACKEND_INSTALL_DIR"
    else
        echo "  ERROR: Backend files not found."
        exit 1
    fi
fi

# Install npm dependencies
echo "  Installing backend dependencies..."
cd "$BACKEND_INSTALL_DIR"
NPM_LOG="$INSTALL_BASE/npm-install.log"
if ! npm install --omit=dev --no-audit --no-fund > "$NPM_LOG" 2>&1; then
    echo "  ERROR: npm install failed. Last log lines:"
    tail -n 40 "$NPM_LOG" 2>/dev/null || true
    echo "  Full npm log: $NPM_LOG"
    exit 1
fi
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

exec "\$NODE" "$(abs_path "$NATIVE_HOST_DIR")/launcher.js"
HOSTEOF
chmod +x "$NATIVE_HOST_DIR/host.sh"

if [ -n "$LAUNCHER_SRC" ] && [ -f "$LAUNCHER_SRC" ]; then
    cp "$LAUNCHER_SRC" "$NATIVE_HOST_DIR/launcher.js"
    chmod +x "$NATIVE_HOST_DIR/launcher.js"
fi

# __EMBEDDED_LAUNCHER_JS__
if [ ! -f "$NATIVE_HOST_DIR/launcher.js" ]; then
    echo "  ERROR: launcher.js not found."
    exit 1
fi
echo "  OK launcher.js installed"

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
