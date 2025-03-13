/**
 * Settings management for MVG Display
 */

class MVGSettings {
  constructor() {
    this.config = this.loadConfig() || this.getDefaultConfig();
    this.modal = null;
    this.availableLines = []; // Store available lines at the current station
    this.lineSelections = {}; // Track which lines are selected
    
    console.log('MVG Settings initialized');
  }
  
  loadConfig() {
    try {
      return JSON.parse(localStorage.getItem('mvgDisplayConfig'));
    } catch (e) {
      console.error('Failed to load config:', e);
      return null;
    }
  }
  
  saveConfig() {
    localStorage.setItem('mvgDisplayConfig', JSON.stringify(this.config));
    console.log('Config saved:', this.config);
    
    // Dispatch event to notify other modules
    window.dispatchEvent(new CustomEvent('mvg-settings-updated', {
      detail: { config: this.config }
    }));
  }
  
  getDefaultConfig() {
    return {
      station: {
        id: localStorage.getItem('selectedStationId') || 'de:09162:6',
        name: localStorage.getItem('selectedStationName') || 'Hauptbahnhof'
      },
      filters: {
        transportTypes: ['tram', 'bus', 'ubahn', 'sbahn'],
        lineNumbers: []
      },
      display: {
        language: 'DE',
        theme: 'default',
        refreshInterval: 15,
        directionLabels: {
          direction1: 'Direction 1',
          direction2: 'Direction 2'
        }
      }
    };
  }
  
  openSettings() {
    console.log('Opening settings modal');
    
    if (this.modal) {
      if (this.modalContainer) this.modalContainer.style.display = 'flex';
      return;
    }
    
    this.createModal();
  }
  
  createModal() {
    // Get the template
    const template = document.getElementById('settings-modal-template');
    if (!template) {
      console.error('Settings modal template not found');
      return this.createSimpleModal(); // Fallback to simple modal
    }

    // Create container div for the modal
    const modalContainer = document.createElement('div');
    modalContainer.className = 'settings-modal-container';
    
    // Clone template content
    const modalContent = template.content.cloneNode(true);
    modalContainer.appendChild(modalContent);
    document.body.appendChild(modalContainer);
    
    this.modalContainer = modalContainer;
    this.modal = modalContainer.querySelector('.settings-modal');
    
    console.log('Modal created:', this.modal);
    
    // Set up event handlers
    this.setupTabHandlers();
    this.setupStationSearch();
    this.setupTransportTypeHandlers();
    this.setupButtonHandlers();
    
    // Update the UI with current config
    this.populateSettingsFromConfig();
    
    // After creating the modal, fetch available lines
    this.fetchAvailableLinesAtStation();
  }
  
  createSimpleModal() {
    const modal = document.createElement('div');
    modal.className = 'settings-modal';
    modal.innerHTML = `
      <div class="settings-header">
        <h2>Display Settings</h2>
        <button class="close-button">&times;</button>
      </div>
      <div class="settings-content">
        <p>Settings interface will be available soon.</p>
        <p class="current-station">Current station: ${this.config.station.name}</p>
      </div>
      <div class="settings-footer">
        <button class="cancel-button">Close</button>
      </div>
    `;
    
    document.body.appendChild(modal);
    this.modal = modal;
    
    // Add event listeners
    modal.querySelector('.close-button').addEventListener('click', () => {
      modal.style.display = 'none';
    });
    
    modal.querySelector('.cancel-button').addEventListener('click', () => {
      modal.style.display = 'none';
    });
  }
  
  setupTabHandlers() {
    const tabs = this.modal.querySelectorAll('.tab-button');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const targetId = tab.getAttribute('data-tab');
        
        // Update active tab button
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        // Update active tab content
        const contents = this.modal.querySelectorAll('.tab-content');
        contents.forEach(content => {
          content.classList.toggle('active', content.id === `${targetId}-tab`);
        });
      });
    });
  }
  
  setupStationSearch() {
    const searchInput = this.modal.querySelector('#settings-station-search');
    const resultsContainer = this.modal.querySelector('#settings-station-results');
    
    if (!searchInput || !resultsContainer) return;
    
    searchInput.addEventListener('input', this.debounce(() => {
      const query = searchInput.value.trim();
      
      if (query.length < 2) {
        resultsContainer.style.display = 'none';
        return;
      }
      
      // Perform search
      fetch(`/api/stations?query=${encodeURIComponent(query)}`)
        .then(response => response.json())
        .then(data => {
          resultsContainer.innerHTML = '';
          
          if (data.length === 0) {
            resultsContainer.innerHTML = '<div class="search-result-item">No stations found</div>';
          } else {
            data.forEach(station => {
              const item = document.createElement('div');
              item.className = 'search-result-item';
              item.dataset.id = station.id;
              item.dataset.name = station.name;
              item.textContent = station.name;
              resultsContainer.appendChild(item);
            });
          }
          
          resultsContainer.style.display = 'block';
        })
        .catch(error => {
          console.error('Error searching stations:', error);
          resultsContainer.innerHTML = '<div class="search-result-item">Error searching stations</div>';
          resultsContainer.style.display = 'block';
        });
    }, 300));
    
    // Handle station selection
    resultsContainer.addEventListener('click', e => {
      if (e.target.classList.contains('search-result-item')) {
        const id = e.target.dataset.id;
        const name = e.target.dataset.name;
        
        this.config.station.id = id;
        this.config.station.name = name;
        
        // Update display
        const stationName = this.modal.querySelector('#current-station-name');
        const stationId = this.modal.querySelector('#current-station-id');
        
        if (stationName) stationName.textContent = name;
        if (stationId) stationId.textContent = id;
        
        // Hide search results
        resultsContainer.style.display = 'none';
        searchInput.value = '';
        
        // Fetch available lines for the new station
        this.fetchAvailableLinesAtStation();
      }
    });
  }
  
  setupTransportTypeHandlers() {
    const typeContainer = this.modal.querySelector('#transport-types');
    if (!typeContainer) return;
    
    typeContainer.addEventListener('click', e => {
      const checkboxItem = e.target.closest('.checkbox-item');
      if (!checkboxItem) return;
      
      const checkbox = checkboxItem.querySelector('input');
      if (checkbox) {
        checkbox.checked = !checkbox.checked;
        checkboxItem.classList.toggle('active', checkbox.checked);
      }
    });
  }
  
  setupButtonHandlers() {
    // Close button
    const closeButton = this.modal.querySelector('.close-button');
    if (closeButton) {
      closeButton.addEventListener('click', () => {
        if (this.modalContainer) this.modalContainer.style.display = 'none';
      });
    }
    
    // Cancel button
    const cancelButton = this.modal.querySelector('.cancel-button');
    if (cancelButton) {
      cancelButton.addEventListener('click', () => {
        if (this.modalContainer) this.modalContainer.style.display = 'none';
      });
    }
    
    // Save button
    const saveButton = this.modal.querySelector('.save-button');
    if (saveButton) {
      saveButton.addEventListener('click', () => {
        this.saveSettings();
      });
    }
  }
  
  populateSettingsFromConfig() {
    // Set current station display
    const stationName = this.modal.querySelector('#current-station-name');
    const stationId = this.modal.querySelector('#current-station-id');
    
    if (stationName) stationName.textContent = this.config.station.name;
    if (stationId) stationId.textContent = this.config.station.id;
    
    // Set transport types
    const transportTypes = this.config.filters.transportTypes || [];
    this.modal.querySelectorAll('#transport-types .checkbox-item').forEach(item => {
      const type = item.dataset.value;
      const checkbox = item.querySelector('input');
      
      if (checkbox && transportTypes.includes(type)) {
        checkbox.checked = true;
        item.classList.add('active');
      }
    });
    
    // Set direction labels
    const dir1Label = this.modal.querySelector('#direction1-label');
    const dir2Label = this.modal.querySelector('#direction2-label');
    
    if (dir1Label) dir1Label.value = this.config.display.directionLabels.direction1;
    if (dir2Label) dir2Label.value = this.config.display.directionLabels.direction2;
    
    // Set other display options
    const langSelect = this.modal.querySelector('#language-select');
    if (langSelect) langSelect.value = this.config.display.language;
    
    const refreshInterval = this.modal.querySelector('#refresh-interval');
    if (refreshInterval) refreshInterval.value = this.config.display.refreshInterval;
    
    const themeSelect = this.modal.querySelector('#theme-select');
    if (themeSelect) themeSelect.value = this.config.display.theme;
    
    // Initialize line selections from config
    this.lineSelections = {};
    if (this.config.filters.lineNumbers && this.config.filters.lineNumbers.length > 0) {
      // If specific lines are filtered, those are the only ones selected
      this.config.filters.lineNumbers.forEach(line => {
        this.lineSelections[line] = true;
      });
    }
  }
  
  saveSettings() {
    // Collect values from form
    
    // Transport types
    const transportTypes = [];
    this.modal.querySelectorAll('#transport-types .checkbox-item input:checked').forEach(checkbox => {
      const type = checkbox.closest('.checkbox-item').dataset.value;
      if (type) transportTypes.push(type);
    });
    
    if (transportTypes.length > 0) {
      this.config.filters.transportTypes = transportTypes;
    }
    
    // Direction labels
    const dir1Label = this.modal.querySelector('#direction1-label');
    const dir2Label = this.modal.querySelector('#direction2-label');
    
    if (dir1Label && dir1Label.value) {
      this.config.display.directionLabels.direction1 = dir1Label.value;
    }
    
    if (dir2Label && dir2Label.value) {
      this.config.display.directionLabels.direction2 = dir2Label.value;
    }
    
    // Other display settings
    const langSelect = this.modal.querySelector('#language-select');
    if (langSelect) {
      this.config.display.language = langSelect.value;
    }
    
    const refreshInterval = this.modal.querySelector('#refresh-interval');
    if (refreshInterval) {
      this.config.display.refreshInterval = parseInt(refreshInterval.value) || 15;
    }
    
    const themeSelect = this.modal.querySelector('#theme-select');
    if (themeSelect) {
      this.config.display.theme = themeSelect.value;
    }
    
    // Before saving, update the line number filters from current selections
    this.updateLineNumberFilters();
    
    // Save to localStorage
    this.saveConfig();
    
    // Close modal
    if (this.modalContainer) this.modalContainer.style.display = 'none';
    
    // Reload page to apply settings
    window.location.reload();
  }
  
  debounce(func, delay) {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), delay);
    }
  }
  
  async fetchAvailableLinesAtStation() {
    // First, populate the Available Lines section with a loading message
    this.showAvailableLinesLoadingState();
    
    try {
      // Get the current station ID from config
      const stationId = this.config.station.id;
      
      // Use the debug endpoint to get raw data
      const response = await fetch(`/api/debug/${stationId}`);
      if (!response.ok) throw new Error('Failed to fetch station data');
      
      const data = await response.json();
      
      // Extract unique line numbers from departures
      const lines = new Set();
      if (data.allDepartures && Array.isArray(data.allDepartures)) {
        data.allDepartures.forEach(dep => {
          if (dep.line) lines.add(dep.line);
        });
      }
      
      this.availableLines = Array.from(lines).sort();
      console.log('Available lines:', this.availableLines);
      
      // Initialize line selections - if not already set, select all by default
      if (Object.keys(this.lineSelections).length === 0) {
        this.availableLines.forEach(line => {
          this.lineSelections[line] = true;
        });
      }
      
      // Populate the line filters UI
      this.populateLineFilters();
    } catch (error) {
      console.error('Error fetching available lines:', error);
      this.showAvailableLinesError();
    }
  }
  
  showAvailableLinesLoadingState() {
    // Find or create the available lines section
    let availableLinesSection = this.modal.querySelector('.available-lines-section');
    if (!availableLinesSection) {
      availableLinesSection = document.createElement('div');
      availableLinesSection.className = 'available-lines-section';
      
      const lineFiltersContainer = this.modal.querySelector('#active-line-filters');
      if (lineFiltersContainer && lineFiltersContainer.parentNode) {
        lineFiltersContainer.parentNode.insertBefore(availableLinesSection, lineFiltersContainer);
      }
    }
    
    // Create header with toggle all button
    availableLinesSection.innerHTML = `
      <h4>
        Available Lines
        <span class="toggle-all" id="toggle-all-lines">Toggle All</span>
      </h4>
      <div class="available-lines">
        <div class="available-lines-loading">Loading available lines...</div>
      </div>
    `;
  }
  
  showAvailableLinesError() {
    const availableLinesContainer = this.modal.querySelector('.available-lines');
    if (availableLinesContainer) {
      availableLinesContainer.innerHTML = `
        <div class="available-lines-loading">
          Unable to load lines. Please try again.
        </div>
      `;
    }
  }
  
  populateLineFilters() {
    const availableLinesSection = this.modal.querySelector('.available-lines-section');
    const availableLinesContainer = availableLinesSection.querySelector('.available-lines');
    
    if (!availableLinesContainer) return;
    
    // Clear loading state
    availableLinesContainer.innerHTML = '';
    
    if (this.availableLines.length === 0) {
      availableLinesContainer.innerHTML = '<div class="available-lines-loading">No lines available for this station</div>';
      return;
    }
    
    // Create clickable line filters
    this.availableLines.forEach(line => {
      const lineTag = document.createElement('div');
      lineTag.className = 'line-filter-tag available';
      lineTag.innerHTML = `<span>${line}</span>`;
      
      // Set initial selected state
      const isSelected = this.lineSelections[line] === true;
      if (isSelected) {
        lineTag.classList.add('selected');
      }
      
      // Click to add/remove the line filter
      lineTag.addEventListener('click', () => {
        const isCurrentlySelected = lineTag.classList.contains('selected');
        lineTag.classList.toggle('selected', !isCurrentlySelected);
        
        // Update line selections
        this.lineSelections[line] = !isCurrentlySelected;
        
        // Update config - if all are selected, clear filter (show all)
        // If some are deselected, only show selected ones
        this.updateLineNumberFilters();
      });
      
      availableLinesContainer.appendChild(lineTag);
    });
    
    // Set up toggle all handler
    const toggleAllBtn = this.modal.querySelector('#toggle-all-lines');
    if (toggleAllBtn) {
      toggleAllBtn.addEventListener('click', () => {
        // Check if all are selected
        const allSelected = this.availableLines.every(line => this.lineSelections[line] === true);
        
        // Toggle all lines
        this.availableLines.forEach(line => {
          this.lineSelections[line] = !allSelected;
          
          // Update UI
          const lineTag = availableLinesContainer.querySelector(`.line-filter-tag[data-line="${line}"]`);
          if (lineTag) {
            lineTag.classList.toggle('selected', !allSelected);
          }
        });
        
        // Update data model
        this.updateLineNumberFilters();
        
        // Update all tags
        availableLinesContainer.querySelectorAll('.line-filter-tag').forEach(tag => {
          tag.classList.toggle('selected', !allSelected);
        });
      });
    }
  }
  
  updateLineNumberFilters() {
    // Get all selected lines
    const selectedLines = Object.entries(this.lineSelections)
      .filter(([_, isSelected]) => isSelected)
      .map(([line, _]) => line);
    
    // If all lines are selected, clear filter to show all
    if (selectedLines.length === this.availableLines.length) {
      this.config.filters.lineNumbers = [];
    } else {
      // Otherwise only show selected lines
      this.config.filters.lineNumbers = selectedLines;
    }
  }
  
  async fetchAvailableLinesAtStation() {
    try {
      // Get the current station ID from config
      const stationId = this.config.station.id;
      
      // Use the debug endpoint to get raw data
      const response = await fetch(`/api/debug/${stationId}`);
      if (!response.ok) throw new Error('Failed to fetch station data');
      
      const data = await response.json();
      
      // Extract unique line numbers from departures
      const lines = new Set();
      if (data.allDepartures && Array.isArray(data.allDepartures)) {
        data.allDepartures.forEach(dep => {
          if (dep.line) lines.add(dep.line);
        });
      }
      
      this.availableLines = Array.from(lines).sort();
      console.log('Available lines:', this.availableLines);
      
      // Populate the line filters UI
      this.populateLineFilters();
    } catch (error) {
      console.error('Error fetching available lines:', error);
    }
  }
  
  populateLineFilters() {
    const lineFiltersContainer = document.getElementById('active-line-filters');
    if (!lineFiltersContainer) return;
    
    // Create an available lines section
    const availableLinesSection = document.createElement('div');
    availableLinesSection.className = 'available-lines-section';
    availableLinesSection.innerHTML = `
      <h4>Available Lines</h4>
      <div class="available-lines"></div>
    `;
    
    const availableLinesContainer = availableLinesSection.querySelector('.available-lines');
    
    // Create clickable line filters
    this.availableLines.forEach(line => {
      const lineTag = document.createElement('div');
      lineTag.className = 'line-filter-tag available';
      lineTag.innerHTML = `<span>${line}</span>`;
      
      // Click to add/remove the line filter
      lineTag.addEventListener('click', () => {
        const isSelected = this.config.filters.lineNumbers.includes(line);
        if (isSelected) {
          // Remove from filters
          this.removeLineFilter(line);
          lineTag.classList.remove('selected');
        } else {
          // Add to filters
          this.addLineFilter(line);
          lineTag.classList.add('selected');
        }
      });
      
      // Mark as selected if already in config
      if (this.config.filters.lineNumbers.includes(line)) {
        lineTag.classList.add('selected');
      }
      
      availableLinesContainer.appendChild(lineTag);
    });
    
    // Find the line filter input group
    const lineFilterInputGroup = document.querySelector('.form-group:has(#line-filter-input)');
    
    // Insert available lines section before the input group
    if (lineFilterInputGroup && lineFilterInputGroup.parentNode) {
      lineFilterInputGroup.parentNode.insertBefore(availableLinesSection, lineFilterInputGroup);
      
      // Change the label to match the new behavior
      const label = lineFilterInputGroup.querySelector('label');
      if (label) {
        label.textContent = 'Add Custom Line Number:';
      }
    } else if (lineFiltersContainer.parentNode) {
      // Fallback insertion
      lineFiltersContainer.parentNode.insertBefore(availableLinesSection, lineFiltersContainer);
    }
  }
  
  selectStation(id, name) {
    this.config.station.id = id;
    this.config.station.name = name;
    
    // Update the station info display
    document.getElementById('current-station-name').textContent = name;
    document.getElementById('current-station-id').textContent = id;
    
    console.log(`Station selected: ${name} (${id})`);
    
    // Fetch available lines for the new station
    this.fetchAvailableLinesAtStation();
  }
}

// Initialize and expose globally
window.mvgSettings = new MVGSettings();
