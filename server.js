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
      // Transform departures in cache before filtering
      cached.data.departures = cached.data.departures.map(dep => transformDeparture(dep));
      return res.json(filterByModes(cached.data, modes));
    }
    
    // Fetch fresh data using Python bridge
    const data = await fetchMVGData(stationId);
    // Transform departures so each departure gets a computed "minutes" property.
    data.departures = data.departures.map(dep => transformDeparture(dep));
    
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

// Endpoint to get departures grouped by direction
app.get('/api/departures/:stationId/grouped', async (req, res) => {
  try {
    const { stationId } = req.params;
    const { modes = 'all', limit = 4 } = req.query;
    
    console.log(`[SERVER] Fetching departures for station ${stationId} with modes ${modes}`);
    
    // Get data directly from MVG
    const data = await fetchMVGData(stationId);
    
    // Apply filters for transport modes
    const filteredData = filterByModes(data, modes);
    
    console.log(`[SERVER] Received ${filteredData.departures?.length || 0} departures`);
    
    if (!filteredData || !filteredData.departures || !Array.isArray(filteredData.departures)) {
      console.log('[SERVER] No departures found or data in unexpected format');
      return res.json({ direction1: [], direction2: [] });
    }
    
    // Debug the raw data structure
    if (filteredData.departures.length > 0) {
      console.log(`[SERVER] First departure structure: ${JSON.stringify(filteredData.departures[0])}`);
    }
    
    // Transform departures and filter out invalid ones
    const departures = filteredData.departures
      .map(dep => transformDeparture(dep))
      .filter(dep => dep !== null); // Filter out invalid departures
    
    console.log(`[SERVER] Transformed ${departures.length} valid departures`);
    
    const grouped = groupDeparturesByDirection(departures, stationId);
    
    console.log(`[SERVER] Direction 1: ${grouped.direction1.length} departures`);
    console.log(`[SERVER] Direction 2: ${grouped.direction2.length} departures`);
    
    // Limit the number of results per direction
    const result = {
      direction1: grouped.direction1.slice(0, parseInt(limit)),
      direction2: grouped.direction2.slice(0, parseInt(limit))
    };
    
    res.json(result);
    
  } catch (error) {
    console.error('[SERVER] Error fetching grouped departures:', error);
    res.status(500).json({ 
      error: 'Failed to fetch grouped departures', 
      message: error.message,
      direction1: [],
      direction2: []
    });
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
      // Use dep.product or fallback to dep.type for filtering
      const product = (dep.product || dep.type)?.toLowerCase();
      if (modeArray.includes('tram') && product === 'tram') return true;
      if (modeArray.includes('bus') && product === 'bus') return true;
      if (modeArray.includes('ubahn') && product === 'u-bahn') return true;
      if (modeArray.includes('sbahn') && product === 's-bahn') return true;
      return false;
    })
  };
  
  return filtered;
}

// Transform MVG API departure to our format with improved error handling
function transformDeparture(dep) {
  try {
    if (!dep) {
      console.log('[SERVER] Empty departure object received');
      return null;
    }
    
    console.log('[SERVER] Transforming departure:', JSON.stringify(dep).slice(0, 200));
    
    const currentTimeSec = Math.floor(Date.now() / 1000); // current time in seconds
    let timeSec = (dep.realtimeDepartureTime !== undefined && dep.realtimeDepartureTime !== null) 
      ? dep.realtimeDepartureTime 
      : dep.time || dep.planned;
    if (typeof timeSec !== 'number') {
      timeSec = parseInt(timeSec, 10);
    }
    if (isNaN(timeSec) || timeSec === 0) {
      timeSec = currentTimeSec;
    }
    const minutesUntil = Math.max(0, Math.floor((timeSec - currentTimeSec) / 60));
    
    const transformed = {
      line: String(dep.line || dep.label || dep.product || "?"),
      destination: String(dep.destination || "Unknown"),
      minutes: minutesUntil,  // computed minutes based on the "time" field
      departureTime: timeSec * 1000, // convert to milliseconds for client JS
      delayMinutes: (dep.planned && timeSec > dep.planned) ? Math.round((timeSec - dep.planned) / 60) : 0,
      isLive: Boolean(dep.realtime),
      platform: String(dep.platform || ''),
      type: String(dep.type || '')   // ...changed code: add type field for filtering...
    };
    
    console.log('[SERVER] Successfully transformed departure:', transformed.line, 'to', transformed.destination, 'with minutes:', transformed.minutes);
    return transformed;
  } catch (e) {
    console.error("[SERVER] Error transforming departure:", e);
    console.error("[SERVER] Original data:", dep);
    try {
      return {
        line: String(dep.line || dep.label || "?"),
        destination: String(dep.destination || "Unknown"),
        minutes: 0,
        departureTime: Date.now(),
        delayMinutes: 0,
        isLive: false,
        platform: "",
        type: String(dep.type || '')  // ...changed code: include type field...
      };
    } catch {
      return null;
    }
  }
}

// New function: Calculate similarity based on matching prefix characters ratio
function calculateSimilarity(s1, s2) {
  s1 = s1.toLowerCase();
  s2 = s2.toLowerCase();
  let matchCount = 0;
  const len = Math.min(s1.length, s2.length);
  for (let i = 0; i < len; i++) {
    if (s1[i] === s2[i]) {
      matchCount++;
    } else {
      break;
    }
  }
  return matchCount / Math.max(s1.length, s2.length);
}

// NEW: Add manual grouping configuration (users can add more stations as needed)
const manualDirectionConfig = {
  "de:09162:632": {
    direction1: ["Laimer Platz", "Emdenstraße", "Neuperlach Süd", "Grünwald", "Berg am Laim", "Effnerplatz"],
    direction2: ["Willibaldplatz", "Westendstraße", "Westfriedhof"]
  }
  // ...add more station-specific rules if needed...
};

// UPDATED: Change groupDeparturesByDirection to accept stationId and use manual config when available
function groupDeparturesByDirection(departures, stationId) {
  console.log('[SERVER] Grouping departures, received:', departures ? departures.length : 0);
  
  if (!departures || !Array.isArray(departures) || departures.length === 0) {
    console.log('[SERVER] No valid departures to group');
    return { direction1: [], direction2: [] };
  }
  
  // If a manual grouping configuration exists, use it.
  if (manualDirectionConfig[stationId]) {
    console.log('[SERVER] Using manual grouping for station:', stationId);
    const config = manualDirectionConfig[stationId];
    const group1 = [];
    const group2 = [];
    departures.forEach(dep => {
      const dest = dep.destination || 'Unknown';
      const inGroup1 = config.direction1.some(keyword => dest.includes(keyword));
      const inGroup2 = config.direction2.some(keyword => dest.includes(keyword));
      if (inGroup1 && !inGroup2) {
        group1.push(dep);
      } else if (inGroup2 && !inGroup1) {
        group2.push(dep);
      } else {
        // If ambiguous or no match, default to group1.
        group1.push(dep);
      }
    });
    console.log('[SERVER] Manual grouping results:', group1.length, 'and', group2.length);
    return { direction1: group1, direction2: group2 };
  }
  
  // Fallback: previous destination heuristic grouping.
  const destCount = {};
  departures.forEach(dep => {
    const dest = dep.destination || 'Unknown';
    destCount[dest] = (destCount[dest] || 0) + 1;
  });
  
  const sortedDests = Object.entries(destCount)
    .sort((a, b) => b[1] - a[1])
    .map(entry => entry[0]);
  
  let rep1, rep2;
  if (sortedDests.length >= 2) {
    rep1 = sortedDests[0];
    rep2 = sortedDests[1];
  } else {
    return { direction1: departures, direction2: [] };
  }
  
  console.log('[SERVER] Representative destinations (fallback):', rep1, rep2);
  const group1 = [];
  const group2 = [];
  
  departures.forEach(dep => {
    const dest = dep.destination || 'Unknown';
    const sim1 = calculateSimilarity(dest, rep1);
    const sim2 = calculateSimilarity(dest, rep2);
    if (sim1 >= sim2) {
      group1.push(dep);
    } else {
      group2.push(dep);
    }
  });
  
  console.log('[SERVER] Fallback grouping results:', group1.length, 'and', group2.length);
  return { direction1: group1, direction2: group2 };
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

// Add diagnostic endpoint to see raw departure data - FIXED VERSION
app.get('/api/debug-departures/:stationId', async (req, res) => {
  try {
    const { stationId } = req.params;
    console.log(`[SERVER] Debug departures for station ${stationId}`);
    
    // Cache busting and debug headers
    res.set({
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    
    // Get raw departure data directly
    const mvgData = await fetchMVGData(stationId);
    
    // Create consistent data structure for debugging
    const debugData = {
      rawDepartures: mvgData.departures?.slice(0, 10) || [],
      totalRawDepartures: mvgData.departures?.length || 0,
      transformedDepartures: mvgData.departures?.map(d => transformDeparture(d)) || [],
      groupedData: groupDeparturesByDirection(
        mvgData.departures?.map(d => transformDeparture(d)).filter(d => d !== null) || []
      ),
      timestamp: new Date().toISOString()
    };
    
    return res.status(200).json(debugData);
  } catch (error) {
    console.error('[SERVER] Debug endpoint error:', error);
    return res.status(500).json({ error: String(error) });
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
        
        // Initial load
        refreshLogs();
      </script>
    </body>
    </html>
  `;
  
  res.send(htmlContent);
});

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
