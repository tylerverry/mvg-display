document.addEventListener('DOMContentLoaded', () => {
  // Constants and state
  const REFRESH_INTERVAL = 15000; // 15 seconds
  let refreshTime = null;
  
  // Elements
  const stationSearch = document.getElementById('station-search');
  const searchResults = document.getElementById('search-results');
  const stationNameEl = document.querySelector('.station-name');
  const direction1El = document.getElementById('dep-outward');
  const direction2El = document.getElementById('dep-inward');
  
  // Get station ID from localStorage or use default
  let stationId = localStorage.getItem('selectedStationId') || 'de:09162:6'; // Default to Hauptbahnhof
  let stationName = localStorage.getItem('selectedStationName') || 'Loading station...';
  
  // Update station name in the UI
  updateStationName();

  // Add event listeners for station search
  stationSearch.addEventListener('input', debounce(handleStationSearch, 300));
  searchResults.addEventListener('click', handleStationSelect);

  // Fetch data immediately and then set interval
  fetchDepartures();
  setInterval(fetchDepartures, REFRESH_INTERVAL);
  
  // Update "last updated" time every second
  setInterval(updateLastUpdated, 1000);
  
  // Functions
  function updateStationName() {
    stationNameEl.textContent = stationName;
  }
  
  async function fetchDepartures() {
    try {
      // Use the new grouped endpoint
      const response = await fetch(`/api/departures/${stationId}/grouped`);
      if (!response.ok) throw new Error(`Error: ${response.status}`);
      
      const data = await response.json();
      
      // Update the UI with the two direction groups
      renderDepartureGroup(direction1El, data.direction1);
      renderDepartureGroup(direction2El, data.direction2);
      
      refreshTime = Date.now();
      updateLastUpdated();
    } catch (error) {
      console.error('Failed to fetch departures:', error);
      direction1El.innerHTML = '<div class="placeholder">Error loading departures. Will retry soon.</div>';
      direction2El.innerHTML = '<div class="placeholder">Error loading departures. Will retry soon.</div>';
    }
  }
  
  function renderDepartureGroup(container, departures) {
    // Clear container if no departures
    if (!departures || departures.length === 0) {
      container.innerHTML = '<div class="placeholder">No departures available</div>';
      return;
    }
    
    // Clear previous content
    container.innerHTML = '';
    
    // Add each departure card
    departures.forEach(departure => {
      container.appendChild(createDepartureCard(departure));
    });
  }
  
  function createDepartureCard(departure) {
    const card = document.createElement('div');
    card.className = 'departure-card';
    
    // Add fallback values for both line and minutes
    const lineDisplay = departure.line || "?";
    const minutesDisplay = departure.minutes === null || departure.minutes === undefined ? "?" : departure.minutes;
    
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
    
    lastUpdatedEl.textContent = `Last updated ${secondsAgo} seconds ago`;
    lastUpdatedEl.classList.toggle('stale', secondsAgo > 45);
  }

  // Station search and selection
  async function handleStationSearch() {
    const query = stationSearch.value.trim();
    
    if (query.length < 2) {
      searchResults.style.display = 'none';
      return;
    }
    
    try {
      const response = await fetch(`/api/stations?query=${encodeURIComponent(query)}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch stations');
      }
      
      const stations = await response.json();
      
      if (stations.length === 0) {
        searchResults.innerHTML = '<div class="search-result">No stations found</div>';
      } else {
        searchResults.innerHTML = stations
          .map(station => 
            `<div class="search-result" data-id="${station.id}" data-name="${station.name}">${station.name}</div>`
          )
          .join('');
      }
      
      searchResults.style.display = 'block';
    } catch (error) {
      console.error('Error searching stations:', error);
      searchResults.innerHTML = '<div class="search-result">Error searching stations</div>';
      searchResults.style.display = 'block';
    }
  }
  
  function handleStationSelect(e) {
    if (!e.target.classList.contains('search-result')) return;
    
    const id = e.target.dataset.id;
    const name = e.target.dataset.name;
    
    if (!id) return;
    
    stationId = id;
    stationName = name;
    
    // Save to localStorage
    localStorage.setItem('selectedStationId', stationId);
    localStorage.setItem('selectedStationName', stationName);
    
    // Update UI
    updateStationName();
    fetchDepartures();
    
    // Hide search results
    searchResults.style.display = 'none';
    stationSearch.value = '';
  }

  // Utility function for debouncing
  function debounce(fn, delay) {
    let timer;
    return function(...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    }
  }
});
