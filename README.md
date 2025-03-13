# MVG Display

## Overview
The MVG Display project is an open-source application designed to provide real-time information about public transport stations. Users can customize their experience by selecting specific stations, choosing different themes, and configuring various display options.

## Features
- Real-time public transport information display
- Customizable station selection
- Multiple language support (EN/DE)
- Weather integration with OpenWeather API
- Customizable refresh intervals
- Responsive design for various display sizes
- Customizable themes and backgrounds

## Getting Started

### Prerequisites
- Node.js and npm installed
- Docker (optional, for containerized deployment)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/mvg-display.git
   cd mvg-display
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Variables**
   - Copy the `.env.example` file to `.env` and fill in the necessary environment variables.
   ```bash
   cp .env.example .env
   ```
   - Edit the `.env` file with your preferred text editor to configure your settings.
   - Important settings include:
     - `DEFAULT_STATION_ID`: The ID of your default transit station
     - `OPENWEATHER_API_KEY`: Your API key for weather integration
     - `DEFAULT_LANGUAGE`: Your preferred language (en/de)

### Running the Application

- **Backend**
  ```bash
  cd backend
  python -m api.main
  ```

- **Frontend**
  ```bash
  cd frontend
  npm start
  ```

- **Using Docker**
  ```bash
  docker-compose up -d
  ```

## Configuration

### Available Settings
- **Station Selection**: Search and select your preferred public transport station
- **Language**: Choose between English (EN) and German (DE)
- **Weather Integration**: Add your OpenWeather API key to display local weather
- **Refresh Interval**: Customize how frequently the display updates
- **Display Theme**: Select from various visual themes or create your own

### Accessing the Settings
1. From the main dashboard, click the gear icon in the top right corner
2. Configure your preferences in the settings panel
3. Save your changes - they will be stored in your browser's localStorage

## API Documentation

### Endpoints
- `GET /api/stations/search?query={query}` - Search for stations
- `GET /api/departures/{stationId}` - Get departures for a specific station
- `GET /api/weather?lat={latitude}&lon={longitude}` - Get weather data for a location

For detailed API documentation, see [API_DOCS.md](./API_DOCS.md)

## Contributing
Contributions are welcome! Please see our [Contributing Guidelines](./CONTRIBUTING.md) for details on how to submit pull requests, report issues, and suggest features.

## License
This project is licensed under the MIT License. See the [LICENSE](./LICENSE) file for more details.

## Acknowledgments
- Thanks to the contributors and the open-source community for their support and inspiration.
- MVG for providing the public transport data API
- OpenWeather for their weather API services