#!/bin/bash

# Run the Python bridge with a station ID
STATION_ID=${1:-"de:09162:6"}  # Default to Hauptbahnhof if no arg provided
echo "Testing bridge with station ID: $STATION_ID"
python3 utils/mvg_bridge.py "$STATION_ID" | jq .
