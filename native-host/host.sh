#!/bin/bash
# Wrapper script for Chrome Native Messaging

# Debug logging
LOG_FILE="/tmp/native_host_debug.log"
echo "$(date): Host script started" >> "$LOG_FILE"

# Get the directory where this script is located
DIR="$( cd "$( dirname "$0" )" && pwd )"
echo "$(date): Script directory: $DIR" >> "$LOG_FILE"

# Use absolute path to node
NODE_PATH="/usr/local/bin/node"

if [ ! -f "$NODE_PATH" ]; then
    echo "$(date): Node not found at $NODE_PATH" >> "$LOG_FILE"
    # Fallback to PATH lookup
    NODE_PATH=$(which node)
fi

echo "$(date): Using node at: $NODE_PATH" >> "$LOG_FILE"

# Export Apple Team ID for WebDriverAgent signing
export APPLE_TEAM_ID="39Y2GMFXHB"
echo "$(date): Set APPLE_TEAM_ID=$APPLE_TEAM_ID" >> "$LOG_FILE"

# Run the launcher
"$NODE_PATH" "$DIR/launcher.js" 2>> "$LOG_FILE"
