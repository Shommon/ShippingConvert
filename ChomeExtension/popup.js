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

      status.innerHTML = '🔄 Getting page HTML...';
      status.className = 'status';

      // Get the active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Try multiple approaches to get the HTML
      let htmlContent = null;
      let extractionMethod = '';

      // Method 1: Try to get from stored variable first
      try {
        status.innerHTML = '🔄 Checking stored HTML...';
        const storedResults = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          function: () => {
            if (window.pageHTML) {
              return { success: true, html: window.pageHTML, method: 'stored' };
            }
            if (window.modifiedHTML) {
              return { success: true, html: window.modifiedHTML, method: 'previous' };
            }
            return { success: false };
          }
        });

        if (storedResults[0].result.success) {
          htmlContent = storedResults[0].result.html;
          extractionMethod = storedResults[0].result.method;
        }
      } catch (e) {
        console.log('Stored HTML method failed:', e);
      }

      // Method 2: Try direct extraction if no stored HTML
      if (!htmlContent) {
        try {
          status.innerHTML = '🔄 Extracting HTML directly...';
          const directResults = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            function: () => {
              try {
                const doctype = document.doctype ? 
                  '<!DOCTYPE ' + document.doctype.name +
                  (document.doctype.publicId ? ' PUBLIC "' + document.doctype.publicId + '"' : '') +
                  (document.doctype.systemId ? ' "' + document.doctype.systemId + '"' : '') + 
                  '>' : '';
                
                const htmlElement = document.documentElement.outerHTML;
                const fullHTML = doctype + '\n' + htmlElement;
                
                return { success: true, html: fullHTML, method: 'direct' };
              } catch (error) {
                return { success: false, error: error.message };
              }
            }
          });

          if (directResults[0].result.success) {
            htmlContent = directResults[0].result.html;
            extractionMethod = directResults[0].result.method;
          }
        } catch (e) {
          console.log('Direct extraction failed:', e);
        }
      }

      // Method 3: Fallback - use chrome.tabs to get the page content
      if (!htmlContent) {
        throw new Error('Could not extract HTML from page. Try pressing Ctrl+Shift+H on the page first to store HTML, then try again.');
      }

      status.innerHTML = `🔄 Modifying HTML (${extractionMethod})...`;
      
      // Now modify the HTML
      const modifiedResult = modifyHTMLOffline(htmlContent, oldWidth, newWidth, oldHeight, newHeight, enableHeight);
      
      if (!modifiedResult.success) {
        throw new Error(modifiedResult.error);
      }

      status.innerHTML = '🔄 Opening in new tab...';

      // Open the modified HTML in a new tab
      await openHTMLInNewTab(modifiedResult.html);
      
      let message = `✅ Success! Width: ${oldWidth} → ${newWidth}`;
      if (enableHeight) {
        message += `<br>Height: ${oldHeight} → ${newHeight}`;
      }
      message += `<br>New tab opened! (Source: ${extractionMethod})`;
      
      status.innerHTML = message;
      status.className = 'status success';
      
      // Clear status after 5 seconds
      setTimeout(() => {
        status.textContent = '';
        status.className = 'status';
      }, 5000);
      
    } catch (error) {
      console.error('Error:', error);
      status.innerHTML = `❌ Error: ${error.message}<br><br>💡 <strong>Try this:</strong><br>1. Press Ctrl+Shift+H on the page<br>2. Then use this extension`;
      status.className = 'status error';
      
      // Clear status after 8 seconds
      setTimeout(() => {
        status.textContent = '';
        status.className = 'status';
      }, 8000);
    }
  });

  // Function to open HTML in new tab
  async function openHTMLInNewTab(htmlContent) {
    try {
      // Create a blob URL (better than data URL for large content)
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const blobUrl = URL.createObjectURL(blob);
      
      // Open in new tab
      const newTab = await chrome.tabs.create({
        url: blobUrl,
        active: true
      });
      
      // Clean up the blob URL after a delay
      setTimeout(() => {
        URL.revokeObjectURL(blobUrl);
      }, 5000);
      
      return newTab;
    } catch (error) {
      console.error('Error opening new tab:', error);
      
      // Fallback to data URL
      try {
        const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent);
        return await chrome.tabs.create({
          url: dataUrl,
          active: true
        });
      } catch (fallbackError) {
        throw new Error('Failed to open modified HTML in new tab');
      }
    }
  }

  // Function to modify HTML offline
  function modifyHTMLOffline(htmlString, oldWidth, newWidth, oldHeight, newHeight, enableHeight) {
    try {
      let modifiedHTML = htmlString;
      let tableFound = false;
      let heightModified = false;
      
      // Remove auto-print scripts
      modifiedHTML = modifiedHTML.replace(/window\.print\s*\(\s*\);?/gi, '// window.print() removed');
      modifiedHTML = modifiedHTML.replace(/(?<![a-zA-Z])print\s*\(\s*\);?/gi, '// print() removed');
      
      // Multiple approaches to find and modify the table
      
      // Approach 1: Look for table with specific attributes and style containing target width
      const tablePattern1 = new RegExp(
        `(<table[^>]*cellpadding=["']0["'][^>]*cellspacing=["']0["'][^>]*border=["']1["'][^>]*style=["'][^"]*width:\\s*${oldWidth.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^"]*["'][^>]*>)`,
        'gi'
      );
      
      modifiedHTML = modifiedHTML.replace(tablePattern1, function(match) {
        let result = match.replace(
          new RegExp(`width:\\s*${oldWidth.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gi'),
          `width: ${newWidth}`
        );
        
        if (enableHeight) {
          if (result.includes(`height: ${oldHeight}`) || result.includes(`height:${oldHeight}`)) {
            result = result.replace(
              new RegExp(`height:\\s*${oldHeight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gi'),
              `height: ${newHeight}`
            );
            heightModified = true;
          } else {
            // Add height to style
            const styleMatch = result.match(/style=["']([^"']*)["']/i);
            if (styleMatch) {
              const currentStyle = styleMatch[1].trim();
              const separator = currentStyle.endsWith(';') ? ' ' : '; ';
              const newStyle = currentStyle + separator + `height: ${newHeight}`;
              result = result.replace(styleMatch[0], `style="${newStyle}"`);
              heightModified = true;
            }
          }
        }
        
        tableFound = true;
        return result;
      });
      
      // Approach 2: Look for any table with the target width
      if (!tableFound) {
        const widthPattern = new RegExp(`width:\\s*${oldWidth.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gi');
        const matches = modifiedHTML.match(widthPattern);
        if (matches) {
          modifiedHTML = modifiedHTML.replace(widthPattern, `width: ${newWidth}`);
          tableFound = true;
          
          // Try to add height if enabled
          if (enableHeight) {
            const heightPattern = new RegExp(`height:\\s*${oldHeight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gi');
            if (modifiedHTML.match(heightPattern)) {
              modifiedHTML = modifiedHTML.replace(heightPattern, `height: ${newHeight}`);
              heightModified = true;
            }
          }
        }
      }
      
      // Approach 3: Look specifically in style attributes
      if (!tableFound) {
        const styleRegex = /style=["']([^"']*width:\s*784px[^"']*)["']/gi;
        modifiedHTML = modifiedHTML.replace(styleRegex, function(match, styleContent) {
          let newStyleContent = styleContent.replace(
            new RegExp(`width:\\s*${oldWidth.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gi'),
            `width: ${newWidth}`
          );
          
          if (enableHeight && !newStyleContent.includes('height:')) {
            const separator = newStyleContent.trim().endsWith(';') ? ' ' : '; ';
            newStyleContent += separator + `height: ${newHeight}`;
            heightModified = true;
          }
          
          tableFound = true;
          return `style="${newStyleContent}"`;
        });
      }
      
      if (!tableFound) {
        return { success: false, error: `No table found with width "${oldWidth}". Check if the width value is correct.` };
      }
      
      // Add CSS improvements for height control
      if (enableHeight) {
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
/* Proportional row heights for better scaling */
table[style*="height"] tbody tr:nth-child(1) { height: 8% !important; }
table[style*="height"] tbody tr:nth-child(2) { height: 12% !important; }
table[style*="height"] tbody tr:nth-child(3) { height: 12% !important; }
table[style*="height"] tbody tr:nth-child(4) { height: 10% !important; }
table[style*="height"] tbody tr:nth-child(5) { height: 40% !important; }
table[style*="height"] tbody tr:nth-child(6) { height: 8% !important; }
table[style*="height"] tbody tr:nth-child(7) { height: 10% !important; }
</style>`;
        
        if (modifiedHTML.includes('</head>')) {
          modifiedHTML = modifiedHTML.replace('</head>', cssImprovements + '\n</head>');
        } else if (modifiedHTML.includes('<body')) {
          modifiedHTML = modifiedHTML.replace('<body', cssImprovements + '\n<body');
        } else {
          modifiedHTML = cssImprovements + '\n' + modifiedHTML;
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