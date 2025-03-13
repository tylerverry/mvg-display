// extract-icons.js
const fs = require('fs');
const path = require('path');

// Correct path to the HTML file containing icons
const iconFilePath = path.join(__dirname, 'mvg-icons.html');

// Read the mvg-icons.html file
try {
  console.log(`Reading file: ${iconFilePath}`);
  const iconFile = fs.readFileSync(iconFilePath, 'utf8');
  console.log(`Successfully read file (${iconFile.length} bytes)`);

  // Regular expression to find SVG data - using multiple patterns
  const patterns = [
    /data: '(<\?xml version="1\.0".*?<\/svg>)'/gs,
    /data: "(<\?xml version=\"1\.0\".*?<\/svg>)"/gs,
    /<svg.*?<\/svg>/gs
  ];

  let totalFound = 0;

  // Try each pattern
  for (const svgRegex of patterns) {
    let match;
    while ((match = svgRegex.exec(iconFile)) !== null) {
      totalFound++;
      let svgData = match[1] || match[0]; // Use captured group if exists, otherwise use whole match
      
      // Try to determine icon type from context
      let iconContext = iconFile.substring(Math.max(0, match.index - 100), match.index);
      let iconName = "unknown" + totalFound;
      
      if (iconContext.includes("TransportTram")) {
        iconName = "tram";
      } else if (iconContext.includes("TransportUbahn")) {
        iconName = "ubahn";
      } else if (iconContext.includes("TransportXbus")) {
        iconName = "bus";
      } else if (iconContext.includes("TransportZug")) {
        iconName = "train";
      }
      
      // Generate a unique name if duplicate
      let counter = 1;
      let fileName = `${iconName}.svg`;
      while (fs.existsSync(path.join(__dirname, fileName))) {
        fileName = `${iconName}-${counter}.svg`;
        counter++;
      }
      
      // Ensure SVG data has XML declaration
      if (!svgData.startsWith('<?xml')) {
        svgData = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n${svgData}`;
      }
      
      // Write the SVG file
      fs.writeFileSync(path.join(__dirname, fileName), svgData);
      console.log(`Extracted: ${fileName}`);
    }
  }
  
  console.log(`Total icons extracted: ${totalFound}`);
} catch (error) {
  console.error(`Error: ${error.message}`);
  console.log(`Current directory: ${process.cwd()}`);
  console.log(`Files in the directory:`);
  console.log(fs.readdirSync(__dirname).join(', '));
}