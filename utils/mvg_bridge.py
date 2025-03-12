#!/usr/bin/env python3

import sys
import json
import traceback
import os
from datetime import datetime
from mvg import MvgApi

# Use a relative path that works in both environments
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
LOG_DIR = os.path.join(os.path.dirname(SCRIPT_DIR), "data")
LOG_FILE = os.path.join(LOG_DIR, "mvg_debug.log")

# Helper to write directly to log file
def log_debug(message):
    try:
        # Make sure the directory exists
        os.makedirs(LOG_DIR, exist_ok=True)
        
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")
        with open(LOG_FILE, "a") as f:
            f.write(f"[{timestamp}] {message}\n")
            f.flush()  # Force write to disk immediately
    except Exception as e:
        print(f"[ERROR] Failed to write to log file: {e}", file=sys.stderr)

def get_departures(station_id):
    try:
        log_debug(f"PYTHON BRIDGE START - Station ID: {station_id}")
        
        # Create API instance
        mvg = MvgApi(station_id)
        
        # Get departures data
        departures = mvg.departures()
        
        # Log success and sample
        log_debug(f"SUCCESS - Found {len(departures)} departures")
        
        if departures and len(departures) > 0:
            first_dep = departures[0]
            log_debug(f"SAMPLE DEPARTURE: {json.dumps(first_dep, indent=2)}")
            log_debug(f"AVAILABLE FIELDS: {', '.join(first_dep.keys())}")
        
        # Return as JSON
        return json.dumps({"departures": departures})
        
    except Exception as e:
        log_debug(f"ERROR: {str(e)}")
        log_debug(f"TRACEBACK: {traceback.format_exc()}")
        return json.dumps({"error": str(e), "departures": []})

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(json.dumps({"error": "Station ID required"}))
        sys.exit(1)
    
    # Create log directory if needed
    os.makedirs(os.path.dirname(LOG_FILE), exist_ok=True)
    
    # Log script invocation
    log_debug("===== MVG BRIDGE CALLED =====")
    
    station_id = sys.argv[1]
    result = get_departures(station_id)
    
    # Always log but keep the actual output clean
    log_debug(f"RETURNING JSON: {result[:200]}...")
    print(result)
    
    log_debug("===== MVG BRIDGE FINISHED =====")
    sys.exit(0)
