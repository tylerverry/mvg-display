const express = require('express');
const path = require('path');
const fs = require('fs');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const CACHE_DURATION = 60 * 1000; // 60 seconds cache

// In-memory cache for departure data
const departureCache = {};

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Add a request logger middleware at the top
app.use((req, res, next) => {
  console.log(`[REQUEST] ${req.method} ${req.path}`);
  next();
});

// Load stations from JSON file (more efficient than parsing TXT every time)
let stations = [];
try {
  const stationsPath = path.join(__dirname, 'data', 'stations.json');
  const stationsData = fs.readFileSync(stationsPath, 'utf8');
  stations = JSON.parse(stationsData);
  console.log(`Loaded ${stations.length} stations from JSON file`);
} catch (error) {
  console.error('Error loading stations:', error);
}

// API Endpoints
app.get('/api/stations', (req, res) => {
  try {
    const query = req.query.query ? req.query.query.toLowerCase() : '';
    
    // If query provided, filter stations
    if (query && query.length >= 2) {
      const filteredStations = stations.filter(station => 
        station.name.toLowerCase().includes(query)
      );
      // Return up to 25 results max
      return res.json(filteredStations.slice(0, 25));
    }
    
    // If no query or too short, return error
    res.status(400).json({ error: 'Please provide a search query (min 2 characters)' });
  } catch (error) {
    console.error('Error serving stations data:', error);
    res.status(500).json({ error: 'Failed to load stations data' });
  }
});

// MVG API integration via Python bridge
async function fetchMVGData(stationId) {
  console.log(`[SERVER] Fetching MVG data for station ${stationId}`);
  
  return new Promise((resolve, reject) => {
    console.log(`[SERVER] Spawning Python bridge process`);
    const python = require('child_process').spawn('python3', [
      path.join(__dirname, 'utils', 'mvg_bridge.py'),
      stationId
    ]);
    
    let dataString = '';
    let errorString = '';
    
    python.stdout.on('data', (data) => {
      dataString += data.toString();
    });
    
    python.stderr.on('data', (data) => {
      const errorOutput = data.toString();
      errorString += errorOutput;
      console.error(`[PYTHON] ${errorOutput.trim()}`);
    });
    
    python.on('close', (code) => {
      console.log(`[SERVER] Python process exited with code ${code}`);
      
      if (code !== 0) {
        return reject(`Python process exited with code ${code}. Error: ${errorString}`);
      }
      
      try {
        const result = JSON.parse(dataString);
        console.log(`[SERVER] Successfully parsed JSON response with ${result.departures?.length || 0} departures`);
        resolve(result);
      } catch (error) {
        console.error(`[SERVER] Failed to parse Python output: ${error.message}`);
        console.error(`[SERVER] Python output was: ${dataString.substring(0, 200)}...`);
        reject(`Error parsing Python output: ${error.message}`);
      }
    });
  });
}

app.get('/api/departures/:stationId', async (req, res) => {
  try {
    const { stationId } = req.params;
    const { modes = 'all' } = req.query;
    
    // Check cache first
    const now = Date.now();
    const cached = departureCache[stationId];
    
    if (cached && (now - cached.timestamp < CACHE_DURATION)) {
      return res.json(filterByModes(cached.data, modes));
    }
    
    // Fetch fresh data using Python bridge
    const data = await fetchMVGData(stationId);
    
    // Save to cache
    departureCache[stationId] = {
      data,
      timestamp: now
    };
    
    // Apply transport mode filter and return
    res.json(filterByModes(data, modes));
    
  } catch (error) {
    console.error('Error fetching departures:', error);
    res.status(500).json({ error: 'Failed to fetch departures data' });
  }
});

// Helper function to filter departures by transportation modes
function filterByModes(data, modes) {
  if (!data || !data.departures || modes === 'all') {
    return data;
  }
  
  const modeArray = modes.toLowerCase().split(',');
  
  const filtered = {
    ...data,
    departures: data.departures.filter(dep => {
      // Map MVG product types to our mode filters
      const product = dep.product?.toLowerCase();
      if (modeArray.includes('tram') && product === 'tram') return true;
      if (modeArray.includes('bus') && product === 'bus') return true;
      if (modeArray.includes('ubahn') && product === 'u-bahn') return true;
      if (modeArray.includes('sbahn') && product === 's-bahn') return true;
      return false;
    })
  };
  
  return filtered;
}

// ** DIAGNOSTIC ENDPOINTS - MUST BE DEFINED EARLY IN THE ROUTE CHAIN **
app.get('/api/debug/:stationId', async (req, res) => {
  console.log(`[DEBUG ENDPOINT] Handling request for stationId: ${req.params.stationId}`);
  
  // Force no caching & explicit content type
  res.set({
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  
  try {
    // Step 1: Get raw data from Python bridge
    const rawData = await fetchMVGData(req.params.stationId);
    console.log(`[DEBUG ENDPOINT] Fetched raw data: ${rawData.departures?.length || 0} departures`);
    
    // Step 2: Select first departure for detailed inspection
    const sampleDeparture = rawData.departures?.[0] || null;
    
    // Step 3: Transform this departure with our function (if available)
    const transformedSample = sampleDeparture ? transformDeparture(sampleDeparture) : null;
    
    // Return all data for debugging
    const debugData = {
      rawApiResponseStructure: sampleDeparture,
      transformedStructure: transformedSample,
      allDepartures: rawData.departures?.slice(0, 3) || [],
      availableFields: sampleDeparture ? Object.keys(sampleDeparture) : []
    };
    
    console.log(`[DEBUG ENDPOINT] Sending response with ${debugData.availableFields.length} fields`);
    return res.status(200).json(debugData);
  } catch (error) {
    console.error('[DEBUG ENDPOINT] Error:', error);
    return res.status(500).json({ error: String(error) });
  }
});

// Emergency debug endpoint - also move it up
app.get('/api/emergency-debug/:stationId', async (req, res) => {
  const { stationId } = req.params;
  
  console.log(`[EMERGENCY DEBUG] Testing station ID: ${stationId}`);
  
  // Set appropriate headers for plain text response
  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Cache-Control', 'no-cache, no-store');
  
  try {
    // Create a child process with direct output streaming
    const python = require('child_process').spawn('python3', [
      path.join(__dirname, 'utils', 'mvg_direct_debug.py'),
      stationId
    ]);
    
    // Send output directly to response as it comes in
    python.stdout.pipe(res);
    
    // Also capture stderr and send it to the response
    python.stderr.on('data', (data) => {
      res.write(`\n[ERROR] ${data.toString()}\n`);
    });
    
    // Handle process exit
    python.on('close', (code) => {
      res.write(`\n\n[PROCESS EXITED WITH CODE ${code}]`);
      res.end();
    });
    
    // Handle errors
    python.on('error', (err) => {
      res.write(`\n\n[PROCESS ERROR: ${err.message}]`);
      res.end();
    });
    
  } catch (error) {
    res.write(`CRITICAL ERROR: ${error.stack || error}`);
    res.end();
  }
});

// Keep API endpoints together before the catch-all
app.get('/api/debug-logs', (req, res) => {
  try {
    // Use consistent path with the Python script
    const logFilePath = path.join(__dirname, 'data', 'mvg_debug.log');
    
    if (!fs.existsSync(logFilePath)) {
      return res.status(404).json({ 
        error: 'Log file not found. Run a query first to generate logs.',
        path: logFilePath  // Show the path for debugging
      });
    }
    
    // Get the last 100 lines (or all if less)
    const fileContent = fs.readFileSync(logFilePath, 'utf8');
    const lines = fileContent.split('\n').filter(line => line.trim());
    const lastLines = lines.slice(Math.max(0, lines.length - 100));
    
    return res.json({ 
      logLines: lastLines,
      totalLines: lines.length,
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error reading debug logs:', error);
    return res.status(500).json({ error: 'Failed to read debug logs: ' + error.message });
  }
});

// Add new endpoint to view logs in HTML format
app.get('/debug-logs', (req, res) => {
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>MVG Debug Logs</title>
      <style>
        body { font-family: monospace; background: #1e1e1e; color: #ddd; padding: 20px; }
        .log-container { background: #252525; border: 1px solid #444; border-radius: 4px; padding: 10px; overflow-x: auto; }
        .log-line { padding: 3px 0; border-bottom: 1px solid #333; }
        .refresh-btn { padding: 10px; background: #0078d7; color: white; border: none; border-radius: 4px; cursor: pointer; margin-bottom: 10px; }
        .timestamp { color: #569cd6; }
        .python { color: #4ec9b0; }
        .error { color: #f14c4c; }
        .success { color: #4cd464; }
        h1 { color: #ddd; }
      </style>
    </head>
    <body>
      <h1>MVG Debug Logs</h1>
      <button class="refresh-btn" onclick="refreshLogs()">Refresh Logs</button>
      <div class="log-container" id="logContent">Loading logs...</div>
      
      <script>
        function refreshLogs() {
          fetch('/api/debug-logs')
            .then(response => response.json())
            .then(data => {
              const logContent = document.getElementById('logContent');
              
              if (data.error) {
                logContent.innerHTML = '<div class="log-line error">' + data.error + '</div>';
                return;
              }
              
              const logLines = data.logLines.map(line => {
                // Highlight timestamps
                line = line.replace(/\\[(.*?)\\]/, '<span class="timestamp">[$1]</span>');
                
                // Highlight Python bridge messages
                if (line.includes('PYTHON BRIDGE')) {
                  return '<div class="log-line python">' + line + '</div>';
                }
                
                // Highlight errors
                if (line.includes('ERROR')) {
                  return '<div class="log-line error">' + line + '</div>';
                }
                
                // Highlight success
                if (line.includes('SUCCESS')) {
                  return '<div class="log-line success">' + line + '</div>';
                }
                
                return '<div class="log-line">' + line + '</div>';
              }).join('');
              
              logContent.innerHTML = logLines;
            })
            .catch(error => {
              document.getElementById('logContent').innerHTML = 
                '<div class="log-line error">Error loading logs: ' + error.message + '</div>';
            });
        }
        
        // Load logs on page load
        refreshLogs();
        
        // Auto-refresh every 5 seconds
        setInterval(refreshLogs, 5000);
      </script>
    </body>
    </html>
  `;
  
  res.send(htmlContent);
});

// Endpoint to get departures grouped by direction
app.get('/api/departures/:stationId/grouped', async (req, res) => {
  try {
    const { stationId } = req.params;
    const { modes = 'all', limit = 4 } = req.query;
    
    console.log(`[DEBUG] Fetching departures for station ${stationId} with modes ${modes}`);
    
    // Fetch departure data (uses caching internally)
    const response = await fetch(`http://localhost:${PORT}/api/departures/${stationId}?modes=${modes}`);
    
    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }
    
    const data = await response.json();
    
    console.log(`[DEBUG] Received ${data.departures?.length || 0} departures`);
    if (data.departures && data.departures.length > 0) {
      console.log(`[DEBUG] First departure: ${JSON.stringify(data.departures[0])}`);
    }
    
    if (!data || !data.departures) {
      return res.json({ direction1: [], direction2: [] });
    }
    
    // Group departures by direction
    const grouped = groupDeparturesByDirection(data.departures);
    
    console.log(`[DEBUG] Direction 1: ${grouped.direction1.length} departures`);
    console.log(`[DEBUG] Direction 2: ${grouped.direction2.length} departures`);
    
    if (grouped.direction1.length > 0) {
      console.log(`[DEBUG] First direction1 item: ${JSON.stringify(grouped.direction1[0])}`);
    }
    
    // Limit the number of results per direction
    const result = {
      direction1: grouped.direction1.slice(0, parseInt(limit)),
      direction2: grouped.direction2.slice(0, parseInt(limit))
    };
    
    res.json(result);
    
  } catch (error) {
    console.error('Error fetching grouped departures:', error);
    res.status(500).json({ error: 'Failed to fetch grouped departures' });
  }
});

// Helper function to group departures by direction
function groupDeparturesByDirection(departures) {
  if (!departures || !Array.isArray(departures)) {
    return { direction1: [], direction2: [] };
  }
  
  // First, sort by departure time
  const sorted = [...departures].sort((a, b) => {
    return (a.time || 0) - (b.time || 0);
  });
  
  // Group by destination to find common patterns
  const destinationGroups = {};
  
  sorted.forEach(dep => {
    if (!destinationGroups[dep.destination]) {
      destinationGroups[dep.destination] = [];
    }
    destinationGroups[dep.destination].push(dep);
  });
  
  // Find the two most common destinations (likely representing two directions)
  const destinations = Object.keys(destinationGroups);
  
  // If we only have one destination or none, handle that case
  if (destinations.length <= 1) {
    return {
      direction1: sorted.map(transformDeparture),
      direction2: []
    };
  }
  
  // Find the two most common destinations by counting occurrences
  const destinationPairs = Object.entries(destinationGroups)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 2);
  
  const direction1Ref = destinationPairs[0][0];
  const direction2Ref = destinationPairs.length > 1 ? destinationPairs[1][0] : '';
  
  const direction1 = [];
  const direction2 = [];
  
  // Group by destination similarity without filtering duplicates
  for (const dep of sorted) {
    if (!dep.destination) continue;
    
    const sim1 = calculateSimilarity(dep.destination, direction1Ref);
    const sim2 = calculateSimilarity(dep.destination, direction2Ref);
    
    if (sim1 >= sim2) {
      direction1.push(transformDeparture(dep));
    } else {
      direction2.push(transformDeparture(dep));
    }
  }
  
  return { direction1, direction2 };
}

// Helper function to calculate text similarity (very simple)
function calculateSimilarity(str1, str2) {
  str1 = str1.toLowerCase();
  str2 = str2.toLowerCase();
  
  // Count matching characters
  let matches = 0;
  for (let i = 0; i < Math.min(str1.length, str2.length); i++) {
    if (str1[i] === str2[i]) matches++;
  }
  
  return matches / Math.max(str1.length, str2.length);
}

// Transform MVG API departure to our format - with detailed logging
function transformDeparture(dep) {
  try {
    console.log(`[DEBUG] Transforming departure: ${JSON.stringify(dep)}`);
    
    const currentTime = Math.floor(Date.now() / 1000); // Current time in seconds
    
    // Extract fields carefully with fallbacks
    const line = dep.line || dep.label || "?";
    const destination = dep.destination || "Unknown";
    const planned = dep.planned || 0;
    const time = dep.time || planned;
    const minutesUntil = Math.max(0, Math.round((time - currentTime) / 60));
    
    const transformed = {
      line: line,
      destination: destination,
      minutes: minutesUntil < 1 ? 'Now' : minutesUntil,
      departureTime: time * 1000, // Convert to milliseconds for JS
      delayMinutes: time > planned ? Math.round((time - planned) / 60) : 0,
      isLive: Boolean(dep.realtime),
      platform: dep.platform || ''
    };
    
    console.log(`[DEBUG] Transformed to: ${JSON.stringify(transformed)}`);
    return transformed;
  } catch (e) {
    console.error("Error transforming departure:", e);
    console.error("Original data:", dep);
    return {
      line: "ERROR",
      destination: "Error processing data",
      minutes: "?",
      departureTime: Date.now()
    };
  }
}

// 🚨 THIS MUST BE THE LAST ROUTE 🚨
// Serve the frontend app for all non-API routes
app.get('*', (req, res) => {
  // Skip API routes that weren't matched (results in 404 instead of serving index.html)
  if (req.path.startsWith('/api/')) {
    console.log(`[SERVER] Unmatched API route: ${req.path}`);
    return res.status(404).json({ error: `API endpoint not found: ${req.path}` });
  }
  
  console.log(`[SERVER] Serving frontend for path: ${req.path}`);
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server
app.listen(PORT, () => {
  console.log(`MVG Display server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser`);
  console.log(`Debug endpoint available at: http://localhost:${PORT}/api/debug/{stationId}`);
});
