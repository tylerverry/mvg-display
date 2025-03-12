const fs = require('fs');
const path = require('path');

// Read stations.txt
const stationsPath = path.join(__dirname, '..', 'data', 'stations.txt');
const stationsTxt = fs.readFileSync(stationsPath, 'utf8');

// Parse into structured JSON
const stations = [];
const lines = stationsTxt.split('\n');

for (const line of lines) {
  if (!line.trim() || line.startsWith('Total stations') || line.startsWith('Available stations')) {
    continue;
  }
  
  const match = line.match(/Name: (.*), ID: (.*)/);
  if (match && match.length === 3) {
    stations.push({
      name: match[1].trim(),
      id: match[2].trim()
    });
  }
}

// Remove duplicates based on station ID
const uniqueStations = Array.from(
  new Map(stations.map(station => [station.id, station])).values()
);

// Write to JSON file
const outputPath = path.join(__dirname, '..', 'data', 'stations.json');
fs.writeFileSync(outputPath, JSON.stringify(uniqueStations, null, 2), 'utf8');

console.log(`Converted ${stations.length} stations to JSON (${uniqueStations.length} unique)`);
