(function() {
  console.log('Running blocking elements fix...');

  // Wait for DOM to be ready
  document.addEventListener('DOMContentLoaded', function() {
    // Function to find and fix elements that might block the settings button
    function fixBlockingElements() {
      console.log('Scanning for elements that might block clicks...');
      
      // Get all elements that are positioned fixed or absolute
      const potentialBlockers = document.querySelectorAll('*');
      
      potentialBlockers.forEach(el => {
        const style = window.getComputedStyle(el);
        const position = style.getPropertyValue('position');
        const zIndex = parseInt(style.getPropertyValue('z-index'), 10);
        
        // Check if this element might be interfering with our settings button iframe
        if ((position === 'fixed' || position === 'absolute') && 
            !el.id.includes('settings-button') && 
            !el.id.includes('settings-modal') &&
            el.id !== 'settings-button-iframe') {
            
          // Force this element to not capture pointer events
          console.log(`Making element non-interactive: ${el.tagName}#${el.id}.${el.className}`);
          el.style.pointerEvents = 'auto';
          
          // Ensure element doesn't overlap with our settings button
          const rect = el.getBoundingClientRect();
          if (rect.right > window.innerWidth - 100 && rect.top < 100) {
            console.log(`Element might overlap with settings button, adjusting z-index: ${el.tagName}#${el.id}`);
            el.style.zIndex = '1000'; // Low enough to not interfere
          }
        }
      });
      
      console.log('Blocking elements fix complete');
    }
    
    // Run the fix initially
    fixBlockingElements();
    
    // Run again after a delay to catch dynamic elements
    setTimeout(fixBlockingElements, 2000);
    setTimeout(fixBlockingElements, 5000);
  });
})();
