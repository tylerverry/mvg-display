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
  
  // Replace directional elements with a single departures container.
  const stationNameEl = document.querySelector('.station-name');
  const departuresContainer = document.getElementById('departures'); // new container id in your HTML
  
  // Remove direction title selectors and related code (direction1Title/direction2Title)
  
  // Get station info from settings
  let stationId = settings.station.id;
  let stationName = settings.station.name;
  
  // Update station name in the UI
  updateStationName();
  
  // Listen for settings updates
  window.addEventListener('mvg-settings-updated', (event) => {
    const newSettings = event.detail.config;
    if (newSettings.station.id !== stationId) {
      stationId = newSettings.station.id;
      stationName = newSettings.station.name;
      updateStationName();
      fetchDepartures(); // Refresh departures immediately
    }
    // Direction labels removed – single feed used.
  });
  
  function updateStationName() {
    if (stationNameEl) stationNameEl.textContent = stationName;
    console.log(`Station set to: ${stationName} (${stationId})`);
  }
  
  async function fetchDepartures() {
    console.log(`Fetching departures for station ID: ${stationId}`);
    try {
      // Show a loading indicator:
      if (departuresContainer) {
        departuresContainer.innerHTML = '<div class="placeholder">Loading departures…</div>';
      }
      
      const transportTypes = settings.filters.transportTypes.join(',');
      const url = `/api/departures/${stationId}?modes=${transportTypes}`;
      console.log(`Fetching from URL: ${url}`);
      
      const response = await fetch(url);
      if (!response.ok) {
        console.error(`API error: ${response.status}`);
        throw new Error(`API error: ${response.status}`);
      }
      const data = await response.json();
      console.log('API response:', data);
      
      const departures = (data && data.departures) ? 
        data.departures.map(dep => dep ? dep : null).filter(dep => dep !== null) : [];
      renderDepartures(departures);
      
      refreshTime = Date.now();
      updateLastUpdated();
    } catch (error) {
      console.error('Failed to fetch departures:', error);
      if (departuresContainer)
        departuresContainer.innerHTML = '<div class="placeholder">Error loading departures: ' + error.message + '</div>';
    }
  }
  
  // New render function for the single departures feed.
  function renderDepartures(departures) {
    if (!departuresContainer) {
      console.error('Departures container not found');
      return;
    }
    if (!departures || departures.length === 0) {
      console.log('No departures available');
      departuresContainer.innerHTML = '<div class="placeholder">No departures available</div>';
      return;
    }
    console.log(`Rendering ${departures.length} departures`);
    departuresContainer.innerHTML = '';
    departures.forEach(departure => {
      departuresContainer.appendChild(createDepartureCard(departure));
    });
  }
  
  // Updated card creator to include the transport icon.
  function createDepartureCard(departure) {
    if (!departure || typeof departure !== 'object') {
      console.error('Invalid departure object:', departure);
      return document.createElement('div');
    }
    console.log('Creating card for departure:', departure);
    const card = document.createElement('div');
    card.className = 'departure-card';
    
    const lineDisplay = departure.line || "?";
    const minutesDisplay = departure.minutes;  // use the server-computed minutes value
    const destination = departure.destination || "Unknown";
    
    // Convert icon value from e.g. "mdi:subway" to "mdi mdi-subway"
    let iconHtml = '';
    if (departure.icon) {
      let iconClass = departure.icon;
      if (iconClass.includes(':')) {
        iconClass = iconClass.replace(':', ' mdi-');
        if (!iconClass.startsWith("mdi")) {
          iconClass = "mdi " + iconClass;
        }
      }
      iconHtml = `<i class="${iconClass} departure-icon"></i>`;
    }
    
    card.innerHTML = `
      <div class="icon-box">${iconHtml}</div>
      <div class="line-box">${lineDisplay}</div>
      <div class="destination">${destination}</div>
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
  
  console.log('Initializing MVG Display app...');
  fetchDepartures();
  setInterval(fetchDepartures, REFRESH_INTERVAL);
  setInterval(updateLastUpdated, 1000);
});
