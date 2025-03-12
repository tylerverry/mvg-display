# MVG Display Roadmap

This document outlines the development plan for MVG Display, focusing first on achieving a Minimum Viable Product (MVP) before adding more advanced features.

## MVP Goals

1. **Clean Up & Public Release Preparation**
   - [x] Update license to reflect non-commercial use
   - [x] Remove personal information from codebase
   - [x] Create proper .env.example file
   - [x] Convert stations list to usable JSON format
   - [ ] Add basic error handling

2. **Simplify Architecture**
   - [ ] Consolidate frontend and backend into single application
   - [ ] Create unified server that handles both API and static file serving
   - [ ] Simplify deployment to single process/container
   - [ ] Reduce configuration complexity

3. **Station Selection Feature**
   - [ ] Implement station search component
   - [ ] Create station selection UI
   - [ ] Store selected station in localStorage
   - [ ] Add station search functionality

4. **Basic Configuration Options**
   - [ ] Create simple settings interface
   - [ ] Add language selection (EN/DE)
   - [ ] Add refresh interval configuration
   - [ ] Add OpenWeather API key input
   - [ ] Add theme selector

5. **Documentation & Deployment**
   - [ ] Complete README with clear setup instructions
   - [ ] Update Docker configuration for easy deployment
   - [ ] Add contributor guidelines

## Research & Verification Tasks

1. **API Integration**
   - [ ] Verify MVG API endpoint structure and parameters
   - [ ] Document rate limits and usage restrictions
   - [ ] Test API response format with actual stations

2. **Data Management**
   - [ ] Analyze stations data size and structure
   - [ ] Determine appropriate search implementation based on data size
   - [ ] Develop strategy for efficient departure direction sorting

3. **MVP Implementation**
   - [ ] Select and validate default station ID
   - [ ] Implement verified API integration
   - [ ] Create search functionality based on actual data constraints

## Future Enhancements

Once the MVP is complete, these features could be considered for future releases:

### User Experience
- Favorites list for quick station access
- Geolocation-based station suggestions
- Customizable display layout
- Additional language support
- Offline capabilities using service workers

### Technical Improvements
- Improved station search with fuzzy matching
- Caching layer for frequent API requests
- PWA support for mobile installation
- Automatic testing suite
- CI/CD pipeline integration

### Integration Options
- Support for additional transit agencies
- Connection with other services (e.g., bike sharing)
- Calendar integration for commute planning
- Real-time disruption alerts

## Priority Guidelines

When considering new features, the following priorities should be maintained:

1. **User-focused**: Features should address actual user needs
2. **Simplicity**: Maintain a clean and intuitive interface
3. **Performance**: Ensure the application remains responsive and efficient
4. **Accessibility**: Make the app usable for everyone
