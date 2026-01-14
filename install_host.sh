#!/bin/bash

# Configuration
HOST_NAME="com.locatorbuilder.host"
HOST_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
PROJECT_DIR="$(pwd)"
HOST_SCRIPT="$PROJECT_DIR/native-host/host.sh"

# Ensure native-host directory exists and scripts are executable
chmod +x "$PROJECT_DIR/native-host/host.sh"
chmod +x "$PROJECT_DIR/native-host/launcher.js"

# Create manifest JSON
cat <<EOF > "$PROJECT_DIR/native-host/com.locatorbuilder.host.json"
{
  "name": "$HOST_NAME",
  "description": "Locator Builder Native Host",
  "path": "$HOST_SCRIPT",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://$(grep -o '"id": "[^"]*"' extension/manifest.json | cut -d'"' -f4)/",
    "chrome-extension://*/" 
  ]
}
EOF

# Note: The allowed_origins wildcard is for development. 
# In production, you should use the specific extension ID.
# Since we don't know the ID until it's loaded, we allow all for now or user has to update it.
# Actually, let's just use the wildcard pattern which works for unpacked extensions locally.

cat <<EOF > "$PROJECT_DIR/native-host/com.locatorbuilder.host.json"
{
  "name": "$HOST_NAME",
  "description": "Locator Builder Native Host",
  "path": "$HOST_SCRIPT",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://ajcdeghbgfonhphbnkmbmocekkmdeoke/"
  ]
}
EOF

# Create NativeMessagingHosts directory if it doesn't exist
mkdir -p "$HOST_DIR"

# Copy manifest to Chrome's NativeMessagingHosts directory
cp "$PROJECT_DIR/native-host/com.locatorbuilder.host.json" "$HOST_DIR/"

echo "Native Messaging Host installed successfully!"
echo "Manifest copied to: $HOST_DIR/$HOST_NAME.json"
echo "Host script: $HOST_SCRIPT"
echo ""
echo "Please reload your extension in Chrome."
