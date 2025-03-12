#!/bin/bash

# This script directly tests the MVG bridge outside of Docker
# to confirm that the core functionality works

echo "=== MVG Bridge Direct Test ==="

# Create test log directory
mkdir -p ./data

# Run the Python bridge with a station ID
STATION_ID=${1:-"de:09162:6"}  # Default to Hauptbahnhof if no arg provided
echo "Testing bridge with station ID: $STATION_ID"
python3 utils/mvg_bridge.py "$STATION_ID"

echo ""
echo "=== Debug Log File Contents ==="
cat ./data/mvg_debug.log | tail -n 20

echo ""
echo "=== Test Complete ==="
echo "To see full logs, visit: http://localhost:3000/debug-logs"
