#!/usr/bin/env python3

import sys
import os
import json
import traceback
import subprocess
import platform

# DIRECT DEBUG SCRIPT - Outputs directly to console, no file logging

def print_system_info():
    print("===== SYSTEM INFORMATION =====")
    print(f"Python version: {sys.version}")
    print(f"Platform: {platform.platform()}")
    print(f"Current directory: {os.getcwd()}")
    print(f"Directory contents: {os.listdir('.')}")
    print(f"Current user: {subprocess.check_output('whoami', text=True).strip()}")
    print(f"Environment variables: {dict(os.environ)}")
    print("=============================\n")

def print_module_info():
    print("===== IMPORT TEST =====")
    try:
        from mvg import MvgApi
        print("✅ Successfully imported MvgApi class")
    except ImportError as e:
        print(f"❌ Failed to import MvgApi: {e}")
        print("\nInstalled packages:")
        try:
            pip_list = subprocess.check_output([sys.executable, "-m", "pip", "list"], text=True)
            print(pip_list)
        except Exception as e:
            print(f"Could not list packages: {e}")
    print("======================\n")

def test_api_call(station_id):
    print(f"===== TESTING API CALL WITH STATION ID: {station_id} =====")
    
    try:
        from mvg import MvgApi
        
        print("1. Creating API instance...")
        mvg = MvgApi(station_id)
        print("✅ API instance created")
        
        print("2. Fetching departures...")
        departures = mvg.departures()
        print(f"✅ Received {len(departures)} departures")
        
        print("\n3. First departure data:")
        if departures:
            first = departures[0]
            print(json.dumps(first, indent=2, ensure_ascii=False))
            print(f"\nAvailable fields: {', '.join(first.keys())}")
        else:
            print("No departures available to display")
            
        print("\n4. Raw departures array (first 3 items):")
        print(json.dumps(departures[:3], indent=2, ensure_ascii=False))
        
    except Exception as e:
        print(f"❌ ERROR: {e}")
        print("\nTraceback:")
        traceback.print_exc()
    
    print("===============================================")

if __name__ == "__main__":
    print("\n=== MVG DIRECT DEBUG OUTPUT ===\n")
    
    # Show system information
    print_system_info()
    
    # Test module imports
    print_module_info()
    
    # Check arguments
    if len(sys.argv) != 2:
        print("ERROR: Station ID required as argument")
        print("Usage: python mvg_direct_debug.py STATION_ID")
        sys.exit(1)
    
    station_id = sys.argv[1]
    test_api_call(station_id)
    
    print("\n=== DEBUG PROCESS COMPLETE ===")
