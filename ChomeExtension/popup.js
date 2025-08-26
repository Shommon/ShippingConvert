document.addEventListener('DOMContentLoaded', function() {
  const modifyBtn = document.getElementById('modifyBtn');
  const status = document.getElementById('status');
  const oldWidthInput = document.getElementById('oldWidth');
  const newWidthInput = document.getElementById('newWidth');
  const oldHeightInput = document.getElementById('oldHeight');
  const newHeightInput = document.getElementById('newHeight');
  const enableHeightCheckbox = document.getElementById('enableHeight');
  const heightInputs = document.getElementById('heightInputs');

  // Handle height controls toggle
  enableHeightCheckbox.addEventListener('change', function() {
    const isEnabled = this.checked;
    heightInputs.classList.toggle('enabled', isEnabled);
    oldHeightInput.disabled = !isEnabled;
    newHeightInput.disabled = !isEnabled;
  });

  modifyBtn.addEventListener('click', async function() {
    try {
      const oldWidth = oldWidthInput.value.trim();
      const newWidth = newWidthInput.value.trim();
      const enableHeight = enableHeightCheckbox.checked;
      const oldHeight = enableHeight ? oldHeightInput.value.trim() : null;
      const newHeight = enableHeight ? newHeightInput.value.trim() : null;
      
      if (!oldWidth || !newWidth) {
        throw new Error('Please enter both old and new width values');
      }
      
      if (enableHeight && (!oldHeight || !newHeight)) {
        throw new Error('Please enter both old and new height values when height modification is enabled');
      }

      // Get the active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Execute script to modify HTML and open in new tab
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: modifyTableAndOpen,
        args: [oldWidth, newWidth, oldHeight, newHeight, enableHeight]
      });

      const result = results[0].result;
      
      if (result.success) {
        let message = `✅ Table modified! Width changed from ${oldWidth} to ${newWidth}`;
        if (enableHeight) {
          message += `<br>Height changed from ${oldHeight} to ${newHeight}`;
        }
        message += '<br>Opening in new tab...';
        
        status.innerHTML = message;
        status.className = 'status success';
        
        // Clear status after 4 seconds
        setTimeout(() => {
          status.textContent = '';
          status.className = 'status';
        }, 4000);
      } else {
        throw new Error(result.error || 'Failed to modify table');
      }
    } catch (error) {
      console.error('Error modifying HTML:', error);
      status.textContent = '❌ Error: ' + error.message;
      status.className = 'status error';
      
      // Clear status after 5 seconds
      setTimeout(() => {
        status.textContent = '';
        status.className = 'status';
      }, 5000);
    }
  });
});

// Function that will be injected into the page
function modifyTableAndOpen(oldWidth, newWidth, oldHeight, newHeight, enableHeight) {
  try {
    // Work silently in the background - don't interfere with print dialog
    
    // Get the complete HTML including DOCTYPE
    const doctype = document.doctype ? 
      '<!DOCTYPE ' + document.doctype.name +
      (document.doctype.publicId ? ' PUBLIC "' + document.doctype.publicId + '"' : '') +
      (document.doctype.systemId ? ' "' + document.doctype.systemId + '"' : '') + 
      '>' : '';
    
    // Get the full HTML element
    const htmlElement = document.documentElement.outerHTML;
    let fullHTML = doctype + '\n' + htmlElement;
    
    // Remove auto-print scripts ONLY from the modified HTML (not the current page)
    fullHTML = fullHTML.replace(/window\.print\s*\(\s*\)/gi, '// window.print() removed');
    fullHTML = fullHTML.replace(/print\s*\(\s*\)/gi, '// print() removed');
    fullHTML = fullHTML.replace(/<script[^>]*>[\s\S]*?window\.print[\s\S]*?<\/script>/gi, '<!-- Auto-print script removed -->');
    
    let tableFound = false;
    let heightModified = false;
    
    // Function to modify table dimensions in a string
    function modifyTableDimensions(htmlString) {
      // Find and modify the specific table with multiple approaches
      
      // Approach 1: Find table with specific attributes
      const tableRegex = /<table[^>]*cellpadding="0"[^>]*cellspacing="0"[^>]*border="1"[^>]*style="[^"]*"[^>]*>/gi;
      
      htmlString = htmlString.replace(tableRegex, function(match) {
        let modifiedMatch = match;
        let foundWidth = false;
        let foundHeight = false;
        
        // Modify width
        if (modifiedMatch.includes(`width: ${oldWidth}`) || modifiedMatch.includes(`width:${oldWidth}`)) {
          modifiedMatch = modifiedMatch.replace(new RegExp(`width:\\s*${oldWidth.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gi'), `width: ${newWidth}`);
          foundWidth = true;
        }
        
        // Modify height if enabled
        if (enableHeight) {
          if (modifiedMatch.includes(`height: ${oldHeight}`) || modifiedMatch.includes(`height:${oldHeight}`)) {
            modifiedMatch = modifiedMatch.replace(new RegExp(`height:\\s*${oldHeight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gi'), `height: ${newHeight}`);
            foundHeight = true;
          } else {
            // If height not found, add it to the style
            const styleMatch = modifiedMatch.match(/style="([^"]*)"/i);
            if (styleMatch && foundWidth) {
              const newStyle = styleMatch[1] + `; height: ${newHeight}`;
              modifiedMatch = modifiedMatch.replace(styleMatch[0], `style="${newStyle}"`);
              foundHeight = true;
            }
          }
        }
        
        if (foundWidth) {
          tableFound = true;
        }
        if (enableHeight && foundHeight) {
          heightModified = true;
        }
        
        return modifiedMatch;
      });
      
      // Approach 2: More general width replacement if not found
      if (!tableFound) {
        const widthRegex = new RegExp(`width:\\s*${oldWidth.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gi');
        if (htmlString.match(widthRegex)) {
          htmlString = htmlString.replace(widthRegex, `width: ${newWidth}`);
          tableFound = true;
        }
      }
      
      // Approach 3: Height replacement if enabled and not found
      if (enableHeight && !heightModified) {
        const heightRegex = new RegExp(`height:\\s*${oldHeight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gi');
        if (htmlString.match(heightRegex)) {
          htmlString = htmlString.replace(heightRegex, `height: ${newHeight}`);
          heightModified = true;
        }
      }
      
      return htmlString;
    }
    
    // Apply the modifications
    fullHTML = modifyTableDimensions(fullHTML);
    
    // Add CSS improvements for better height control
    if (enableHeight && heightModified) {
      const cssImprovements = `
        <style>
        /* Table height control improvements */
        table[style*="height"] {
          table-layout: fixed !important;
        }
        table[style*="height"] td {
          vertical-align: top !important;
          overflow: hidden;
        }
        /* Distribute row heights proportionally */
        table[style*="height"] tr:nth-child(1) { height: 8% !important; }
        table[style*="height"] tr:nth-child(2) { height: 12% !important; }
        table[style*="height"] tr:nth-child(3) { height: 12% !important; }
        table[style*="height"] tr:nth-child(4) { height: 10% !important; }
        table[style*="height"] tr:nth-child(5) { height: 40% !important; }
        table[style*="height"] tr:nth-child(6) { height: 8% !important; }
        table[style*="height"] tr:nth-child(7) { height: 10% !important; }
        </style>
      `;
      
      // Insert before closing </head> tag
      fullHTML = fullHTML.replace('</head>', cssImprovements + '</head>');
    }
    
    if (!tableFound) {
      return { success: false, error: `Table with width ${oldWidth} not found` };
    }
    
    if (enableHeight && !heightModified) {
      console.warn(`Height ${oldHeight} not found, but width was modified successfully`);
    }
    
    // Store modified HTML in global variable for reference
    window.modifiedHTML = fullHTML;
    
    // Open new tab silently in the background
    // Use setTimeout to ensure it doesn't interfere with print dialog focus
    setTimeout(() => {
      try {
        // Create blob URL
        const blob = new Blob([fullHTML], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        
        // Open in new tab without stealing focus from print dialog
        const newWindow = window.open(url, '_blank', 'noopener,noreferrer');
        
        if (newWindow) {
          // Clean up the blob URL after it's loaded
          setTimeout(() => URL.revokeObjectURL(url), 5000);
        } else {
          // Fallback: try data URL method
          const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(fullHTML);
          window.open(dataUrl, '_blank', 'noopener,noreferrer');
        }
      } catch (e) {
        console.error('Error opening new tab:', e);
      }
    }, 100); // Small delay to avoid interfering with print dialog
    
    // Log quietly to console (won't interfere with print dialog)
    console.log('📄 Modified HTML stored in window.modifiedHTML');
    console.log(`🔧 Table width changed from ${oldWidth} to ${newWidth}`);
    if (enableHeight) {
      console.log(`📏 Table height ${heightModified ? 'changed' : 'attempted to change'} from ${oldHeight} to ${newHeight}`);
    }
    console.log('🖨️ Print dialog left undisturbed');
    
    return { 
      success: true, 
      widthModified: tableFound,
      heightModified: enableHeight ? heightModified : null
    };
  } catch (error) {
    console.error('Error modifying HTML:', error);
    return { success: false, error: error.message };
  }
}