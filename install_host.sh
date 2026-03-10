#!/bin/bash
# LocatorLens - Quick installer (for repo users)
# Delegates to extension/installers/install_host.sh which handles auto-detection

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Running LocatorLens installer..."
bash "$SCRIPT_DIR/extension/installers/install_host.sh" "$@"
