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

      status.innerHTML = '🔄 Extracting HTML and modifying...';
      status.className = 'status';

      // Get the active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // First, extract the HTML without interfering with the page
      const htmlResults = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: extractHTMLSilently
      });

      if (!htmlResults[0].result.success) {
        throw new Error(htmlResults[0].result.error);
      }

      const originalHTML = htmlResults[0].result.html;
      
      // Now modify the HTML in the background without touching the original page
      const modifiedHTML = modifyHTMLOffline(originalHTML, oldWidth, newWidth, oldHeight, newHeight, enableHeight);
      
      if (!modifiedHTML.success) {
        throw new Error(modifiedHTML.error);
      }

      // Open the modified HTML in a new tab
      await openHTMLInNewTab(modifiedHTML.html);
      
      let message = `✅ Table modified! Width changed from ${oldWidth} to ${newWidth}`;
      if (enableHeight) {
        message += `<br>Height changed from ${oldHeight} to ${newHeight}`;
      }
      message += '<br>Opened in new tab!';
      
      status.innerHTML = message;
      status.className = 'status success';
      
      // Clear status after 4 seconds
      setTimeout(() => {
        status.textContent = '';
        status.className = 'status';
      }, 4000);
      
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

  // Function to open HTML in new tab using chrome.tabs API
  async function openHTMLInNewTab(htmlContent) {
    try {
      // Create a data URL
      const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent);
      
      // Open in new tab using chrome.tabs API
      await chrome.tabs.create({
        url: dataUrl,
        active: false // Don't steal focus from current tab
      });
    } catch (error) {
      console.error('Error opening new tab:', error);
      throw new Error('Failed to open modified HTML in new tab');
    }
  }

  // Function to modify HTML completely offline (no page interaction)
  function modifyHTMLOffline(htmlString, oldWidth, newWidth, oldHeight, newHeight, enableHeight) {
    try {
      let modifiedHTML = htmlString;
      let tableFound = false;
      let heightModified = false;
      
      // Remove auto-print scripts
      modifiedHTML = modifiedHTML.replace(/window\.print\s*\(\s*\)/gi, '// window.print() removed');
      modifiedHTML = modifiedHTML.replace(/print\s*\(\s*\)/gi, '// print() removed');
      modifiedHTML = modifiedHTML.replace(/<script[^>]*>[\s\S]*?window\.print[\s\S]*?<\/script>/gi, '<!-- Auto-print script removed -->');
      
      // Approach 1: Find table with cellpadding, cellspacing, border attributes
      const tableRegex = /<table[^>]*cellpadding="0"[^>]*cellspacing="0"[^>]*border="1"[^>]*>/gi;
      modifiedHTML = modifiedHTML.replace(tableRegex, function(match) {
        let modifiedMatch = match;
        
        // Check if this table has the width we're looking for
        const hasTargetWidth = modifiedMatch.includes(`width: ${oldWidth}`) || 
                              modifiedMatch.includes(`width:${oldWidth}`) ||
                              modifiedMatch.includes(`width=${oldWidth}`);
        
        if (hasTargetWidth) {
          // Modify width
          modifiedMatch = modifiedMatch.replace(
            new RegExp(`width:\\s*${oldWidth.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gi'), 
            `width: ${newWidth}`
          );
          tableFound = true;
          
          // Modify height if enabled
          if (enableHeight) {
            if (modifiedMatch.includes(`height: ${oldHeight}`) || modifiedMatch.includes(`height:${oldHeight}`)) {
              modifiedMatch = modifiedMatch.replace(
                new RegExp(`height:\\s*${oldHeight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gi'), 
                `height: ${newHeight}`
              );
              heightModified = true;
            } else {
              // Add height to existing style attribute
              const styleMatch = modifiedMatch.match(/style="([^"]*)"/i);
              if (styleMatch) {
                const currentStyle = styleMatch[1].trim();
                const separator = currentStyle.endsWith(';') ? ' ' : '; ';
                const newStyle = currentStyle + separator + `height: ${newHeight}`;
                modifiedMatch = modifiedMatch.replace(styleMatch[0], `style="${newStyle}"`);
                heightModified = true;
              }
            }
          }
        }
        
        return modifiedMatch;
      });
      
      // Approach 2: Fallback - look for any width occurrence
      if (!tableFound) {
        const widthRegex = new RegExp(`width:\\s*${oldWidth.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gi');
        if (modifiedHTML.match(widthRegex)) {
          modifiedHTML = modifiedHTML.replace(widthRegex, `width: ${newWidth}`);
          tableFound = true;
        }
      }
      
      // Approach 3: Look for height if enabled and not found yet
      if (enableHeight && !heightModified && tableFound) {
        const heightRegex = new RegExp(`height:\\s*${oldHeight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gi');
        if (modifiedHTML.match(heightRegex)) {
          modifiedHTML = modifiedHTML.replace(heightRegex, `height: ${newHeight}`);
          heightModified = true;
        }
      }
      
      if (!tableFound) {
        return { success: false, error: `Table with width ${oldWidth} not found in HTML` };
      }
      
      // Add CSS improvements for height control if height was modified
      if (enableHeight && heightModified) {
        const cssImprovements = `
<style>
/* Enhanced table height control */
table[style*="height"] {
  table-layout: fixed !important;
  border-collapse: collapse !important;
}
table[style*="height"] td {
  vertical-align: top !important;
  overflow: hidden;
  box-sizing: border-box;
}
/* Proportional row heights */
table[style*="height"] tbody tr:nth-child(1) { height: 8% !important; }
table[style*="height"] tbody tr:nth-child(2) { height: 12% !important; }
table[style*="height"] tbody tr:nth-child(3) { height: 12% !important; }
table[style*="height"] tbody tr:nth-child(4) { height: 10% !important; }
table[style*="height"] tbody tr:nth-child(5) { height: 40% !important; }
table[style*="height"] tbody tr:nth-child(6) { height: 8% !important; }
table[style*="height"] tbody tr:nth-child(7) { height: 10% !important; }
</style>`;
        
        // Insert before closing </head> tag or at the beginning of <body> if no head
        if (modifiedHTML.includes('</head>')) {
          modifiedHTML = modifiedHTML.replace('</head>', cssImprovements + '\n</head>');
        } else if (modifiedHTML.includes('<body')) {
          modifiedHTML = modifiedHTML.replace('<body', cssImprovements + '\n<body');
        }
      }
      
      return { 
        success: true, 
        html: modifiedHTML,
        widthModified: tableFound,
        heightModified: enableHeight ? heightModified : null
      };
      
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
});

// Function to extract HTML without interfering with the page
function extractHTMLSilently() {
  try {
    // Get the complete HTML including DOCTYPE
    const doctype = document.doctype ? 
      '<!DOCTYPE ' + document.doctype.name +
      (document.doctype.publicId ? ' PUBLIC "' + document.doctype.publicId + '"' : '') +
      (document.doctype.systemId ? ' "' + document.doctype.systemId + '"' : '') + 
      '>' : '';
    
    // Get the full HTML element
    const htmlElement = document.documentElement.outerHTML;
    const fullHTML = doctype + '\n' + htmlElement;
    
    return { success: true, html: fullHTML };
  } catch (error) {
    return { success: false, error: error.message };
  }
}