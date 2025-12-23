#!/bin/bash
set -e

if [ $# -lt 2 ]; then
    echo "Usage: $0 <url> <branch>"
    exit 1
fi

URL=$1
BRANCH=$2

echo "Updating submodule 'ckb-light-client' configuration..."
echo "  URL: $URL"
echo "  Branch: $BRANCH"

# Ensure we are in the script's directory
cd "$(dirname "$0")"

# Update .gitmodules
git config -f .gitmodules submodule.ckb-light-client.url "$URL"
git config -f .gitmodules submodule.ckb-light-client.branch "$BRANCH"

# Sync configuration to .git/config
git submodule sync ckb-light-client

# Initialize and update the submodule
git submodule update --init --recursive --remote ckb-light-client

# Checkout the specific branch
cd ckb-light-client
git fetch origin
git checkout "$BRANCH"
git pull origin "$BRANCH"

echo "Submodule 'ckb-light-client' updated successfully."