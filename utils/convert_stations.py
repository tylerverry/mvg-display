#!/usr/bin/env python3

import json
import os
import re

# Define file paths
current_dir = os.path.dirname(os.path.abspath(__file__))
stations_txt_path = os.path.join(current_dir, '..', 'data', 'stations.txt')
stations_json_path = os.path.join(current_dir, '..', 'data', 'stations.json')

# Parse the stations text file
stations = []
station_pattern = re.compile(r'Name: (.*), ID: (.*)')

try:
    with open(stations_txt_path, 'r', encoding='utf-8') as file:
        for line in file:
            line = line.strip()
            if not line or line.startswith('Total stations') or line.startswith('Available stations'):
                continue
                
            match = station_pattern.match(line)
            if match:
                stations.append({
                    'name': match.group(1).strip(),
                    'id': match.group(2).strip()
                })
    
    # Remove duplicates based on station ID
    unique_stations = []
    seen_ids = set()
    for station in stations:
        if station['id'] not in seen_ids:
            unique_stations.append(station)
            seen_ids.add(station['id'])
    
    # Write JSON file
    with open(stations_json_path, 'w', encoding='utf-8') as file:
        json.dump(unique_stations, file, ensure_ascii=False, indent=2)
    
    print(f"Converted {len(stations)} stations to JSON ({len(unique_stations)} unique)")
    
except Exception as e:
    print(f"Error: {e}")
