document.addEventListener('DOMContentLoaded', () => {
  // Get settings
  const settings = window.mvgSettings ? window.mvgSettings.config : {
    station: { id: 'de:09162:6', name: 'Hauptbahnhof' },
    filters: { transportTypes: ['tram', 'bus', 'ubahn', 'sbahn'], lineNumbers: [] },
    display: { 
      language: 'DE',
      refreshInterval: 15,
      directionLabels: { direction1: 'Direction 1', direction2: 'Direction 2' }
    }
  };
  
  // Use settings to define constants and state
  const REFRESH_INTERVAL = settings.display.refreshInterval * 1000 || 15000;
  let refreshTime = null;
  
  // Elements
  const stationNameEl = document.querySelector('.station-name');
  const direction1El = document.getElementById('dep-outward');
  const direction2El = document.getElementById('dep-inward');
  const direction1Title = document.querySelector('.direction-title:first-of-type');
  const direction2Title = document.querySelector('.direction-title:last-of-type');
  
  // Set direction labels from settings
  if (direction1Title) direction1Title.textContent = settings.display.directionLabels.direction1;
  if (direction2Title) direction2Title.textContent = settings.display.directionLabels.direction2;
  
  // Get station info from settings
  let stationId = settings.station.id;
  let stationName = settings.station.name;
  
  // Update station name in the UI
  updateStationName();
  
  // Listen for settings updates
  window.addEventListener('mvg-settings-updated', (event) => {
    const newSettings = event.detail.config;
    
    // Update station info if changed
    if (newSettings.station.id !== stationId) {
      stationId = newSettings.station.id;
      stationName = newSettings.station.name;
      updateStationName();
      fetchDepartures(); // Refresh departures immediately
    }
    
    // Update direction labels
    if (direction1Title) direction1Title.textContent = newSettings.display.directionLabels.direction1;
    if (direction2Title) direction2Title.textContent = newSettings.display.directionLabels.direction2;
  });
  
  // Functions
  function updateStationName() {
    if (stationNameEl) stationNameEl.textContent = stationName;
    console.log(`Station set to: ${stationName} (${stationId})`);
  }
  
  async function fetchDepartures() {
    console.log(`Fetching departures for station ID: ${stationId}`);
    try {
      // Build query params with transport types
      const transportTypes = settings.filters.transportTypes.join(',');
      const url = `/api/departures/${stationId}/grouped?modes=${transportTypes}`;
      console.log(`Fetching from URL: ${url}`);
      
      const response = await fetch(url);
      
      if (!response.ok) {
        console.error(`API error: ${response.status}`);
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Fetched departures data:', data);
      
      renderDepartureGroup(direction1El, data.direction1);
      renderDepartureGroup(direction2El, data.direction2);
      
      refreshTime = Date.now();
      updateLastUpdated();
    } catch (error) {
      console.error('Failed to fetch departures:', error);
      if (direction1El) direction1El.innerHTML = '<div class="placeholder">Error loading departures</div>';
      if (direction2El) direction2El.innerHTML = '<div class="placeholder">Error loading departures</div>';
    }
  }
  
  function renderDepartureGroup(container, departures) {
    if (!container) {
      console.error('Container element not found');
      return;
    }
    
    if (!departures || departures.length === 0) {
      container.innerHTML = '<div class="placeholder">No departures available</div>';
      return;
    }
    
    console.log(`Rendering ${departures.length} departures`);
    container.innerHTML = '';
    
    // Filter departures by line number if set
    let filteredDepartures = departures;
    if (settings.filters.lineNumbers && settings.filters.lineNumbers.length > 0) {
      filteredDepartures = departures.filter(dep => 
        settings.filters.lineNumbers.includes(dep.line.toString())
      );
    }
    
    // Show either filtered departures or original if filter yields no results
    const departuresToShow = filteredDepartures.length > 0 ? filteredDepartures : departures;
    
    departuresToShow.forEach(departure => {
      container.appendChild(createDepartureCard(departure));
    });
  }
  
  function createDepartureCard(departure) {
    const card = document.createElement('div');
    card.className = 'departure-card';
    
    const lineDisplay = departure.line || "?";
    const minutesDisplay = departure.minutes === null || departure.minutes === undefined 
                         ? "?" : departure.minutes;
    
    card.innerHTML = `
      <div class="line-box">${lineDisplay}</div>
      <div class="destination">${departure.destination || "Unknown"}</div>
      <div class="minutes">${minutesDisplay}</div>
    `;
    return card;
  }
  
  function updateLastUpdated() {
    if (!refreshTime) return;
    
    const now = Date.now();
    const secondsAgo = Math.floor((now - refreshTime) / 1000);
    const lastUpdatedEl = document.querySelector('.last-updated');
    
    if (lastUpdatedEl) {
      lastUpdatedEl.textContent = `Last updated ${secondsAgo} seconds ago`;
      lastUpdatedEl.classList.toggle('stale', secondsAgo > 45);
    }
  }
  
  // Fetch departures immediately and set refresh interval
  console.log('Initializing MVG Display app...');
  fetchDepartures();
  setInterval(fetchDepartures, REFRESH_INTERVAL);
  
  // Update last refreshed time every second
  setInterval(updateLastUpdated, 1000);
});
