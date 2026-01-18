#!/bin/bash
# Wrapper script for Chrome Native Messaging

# Ensure common paths are in PATH (Chrome environment can be restricted)
export PATH="/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

# Debug logging
LOG_FILE="/tmp/native_host_debug.log"
echo "$(date): Host script started" >> "$LOG_FILE"

# Get the directory where this script is located
DIR="$( cd "$( dirname "$0" )" && pwd )"
echo "$(date): Script directory: $DIR" >> "$LOG_FILE"

# Find node - use dynamic PATH lookup first (platform-agnostic)
NODE_PATH=$(which node 2>/dev/null)

# If 'which' doesn't find node, check common installation locations as fallback
if [ -z "$NODE_PATH" ] || [ ! -f "$NODE_PATH" ]; then
    echo "$(date): Node not found in PATH, checking common locations..." >> "$LOG_FILE"
    
    # Check common locations (order: Homebrew Apple Silicon, Homebrew Intel, standard macOS, Linux)
    for path in "/opt/homebrew/bin/node" "/usr/local/bin/node" "/usr/bin/node" "$HOME/.nvm/versions/node/*/bin/node"; do
        if [ -f "$path" ]; then
            NODE_PATH="$path"
            break
        fi
    done
fi

# Final check - if still not found, exit with error
if [ -z "$NODE_PATH" ] || [ ! -f "$NODE_PATH" ]; then
    echo "$(date): ERROR - Node.js not found! Please install Node.js and ensure it's in your PATH" >> "$LOG_FILE"
    exit 1
fi

echo "$(date): Using node at: $NODE_PATH" >> "$LOG_FILE"

# Export Apple Team ID for WebDriverAgent signing
export APPLE_TEAM_ID="39Y2GMFXHB"
echo "$(date): Set APPLE_TEAM_ID=$APPLE_TEAM_ID" >> "$LOG_FILE"

# Run the launcher
"$NODE_PATH" "$DIR/launcher.js" 2>> "$LOG_FILE"
