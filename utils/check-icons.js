const fs = require('fs');
const path = require('path');

// Directory where icons should be located
const iconsDir = path.join(__dirname, '..', 'public', 'icons');

// List of icons that should exist based on API responses
const requiredIcons = [
  'tram.svg',
  'bus.svg',
  'subway.svg',
  'subway-variant.svg',
  'default.svg'
];

// Check if the icons directory exists
if (!fs.existsSync(iconsDir)) {
  console.error(`❌ Icons directory not found: ${iconsDir}`);
  console.log(`📁 Creating icons directory...`);
  fs.mkdirSync(iconsDir, { recursive: true });
} else {
  console.log(`✅ Icons directory exists: ${iconsDir}`);
}

// Check if each required icon exists
for (const iconFile of requiredIcons) {
  const iconPath = path.join(iconsDir, iconFile);
  if (fs.existsSync(iconPath)) {
    const stats = fs.statSync(iconPath);
    console.log(`✅ Icon exists: ${iconFile} (${stats.size} bytes)`);
  } else {
    console.error(`❌ Icon missing: ${iconFile}`);
    
    // Create a simple placeholder SVG for missing icons
    const placeholderSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
      <rect width="24" height="24" fill="#ccc"/>
      <text x="12" y="16" font-size="8" text-anchor="middle" fill="#666">Icon</text>
    </svg>`;
    
    console.log(`📝 Creating placeholder for ${iconFile}...`);
    fs.writeFileSync(iconPath, placeholderSvg);
  }
}

console.log('Icon check complete. Run this script again to verify all icons are present.');
