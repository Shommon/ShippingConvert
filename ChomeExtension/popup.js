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
            console.log('Checking stored variables...');
            console.log('window.pageHTML exists:', !!window.pageHTML);
            console.log('window.originalHTML exists:', !!window.originalHTML);
            console.log('window.storedHTML exists:', !!window.storedHTML);
            
            if (window.pageHTML) {
              console.log('Using window.pageHTML, length:', window.pageHTML.length);
              return { success: true, html: window.pageHTML, method: 'stored-pageHTML' };
            }
            if (window.originalHTML) {
              console.log('Using window.originalHTML, length:', window.originalHTML.length);
              return { success: true, html: window.originalHTML, method: 'stored-originalHTML' };
            }
            if (window.storedHTML) {
              console.log('Using window.storedHTML, length:', window.storedHTML.length);
              return { success: true, html: window.storedHTML, method: 'stored-storedHTML' };
            }
            
            // Try session storage
            try {
              const sessionHTML = sessionStorage.getItem('extensionHTML');
              if (sessionHTML) {
                console.log('Using sessionStorage HTML, length:', sessionHTML.length);
                return { success: true, html: sessionHTML, method: 'sessionStorage' };
              }
            } catch (e) {
              console.log('Session storage check failed:', e);
            }
            
            return { success: false, message: 'No stored HTML found' };
          }
        });

        if (storedResults[0].result.success) {
          htmlContent = storedResults[0].result.html;
          extractionMethod = storedResults[0].result.method;
          console.log('HTML extracted via:', extractionMethod);
        } else {
          console.log('Stored HTML failed:', storedResults[0].result.message);
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
                console.log('Attempting direct HTML extraction...');
                const doctype = document.doctype ? 
                  '<!DOCTYPE ' + document.doctype.name +
                  (document.doctype.publicId ? ' PUBLIC "' + document.doctype.publicId + '"' : '') +
                  (document.doctype.systemId ? ' "' + document.doctype.systemId + '"' : '') + 
                  '>' : '';
                
                const htmlElement = document.documentElement.outerHTML;
                const fullHTML = doctype + '\n' + htmlElement;
                
                console.log('Direct extraction successful, HTML length:', fullHTML.length);
                return { success: true, html: fullHTML, method: 'direct' };
              } catch (error) {
                console.error('Direct extraction error:', error);
                return { success: false, error: error.message };
              }
            }
          });

          if (directResults[0].result.success) {
            htmlContent = directResults[0].result.html;
            extractionMethod = directResults[0].result.method;
            console.log('HTML extracted via direct method');
          } else {
            console.log('Direct extraction failed:', directResults[0].result.error);
          }
        } catch (e) {
          console.log('Direct extraction method failed:', e);
        }
      }

      if (!htmlContent) {
        throw new Error('Could not extract HTML from page. Please try:\n1. Press Ctrl+Shift+H on the page to store HTML\n2. Refresh the page and try again\n3. Make sure the page is fully loaded');
      }

      status.innerHTML = `🔄 Modifying HTML (${extractionMethod})...`;
      console.log('Starting HTML modification...');
      
      // Debug: Check what we're looking for in the HTML
      const hasTargetWidth = htmlContent.includes(oldWidth);
      console.log(`HTML contains "${oldWidth}":`, hasTargetWidth);
      
      if (!hasTargetWidth) {
        // Try to find what widths are actually in the HTML
        const widthMatches = htmlContent.match(/width:\s*\d+px/gi) || [];
        const uniqueWidths = [...new Set(widthMatches)];
        console.log('Found widths in HTML:', uniqueWidths);
        
        throw new Error(`Target width "${oldWidth}" not found in HTML.\nFound these widths instead: ${uniqueWidths.join(', ')}\n\nTip: Inspect the table element to find the exact width value.`);
      }
      
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
      status.innerHTML = `❌ Error: ${error.message.replace(/\n/g, '<br>')}`;
      status.className = 'status error';
      
      // Clear status after 10 seconds for longer error messages
      setTimeout(() => {
        status.textContent = '';
        status.className = 'status';
      }, 10000);
    }
  });

  // Function to open HTML in new tab
  async function openHTMLInNewTab(htmlContent) {
    try {
      console.log('Opening HTML in new tab, content length:', htmlContent.length);
      
      // Create a blob URL (better than data URL for large content)
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const blobUrl = URL.createObjectURL(blob);
      
      // Open in new tab
      const newTab = await chrome.tabs.create({
        url: blobUrl,
        active: true
      });
      
      console.log('New tab created:', newTab.id);
      
      // Clean up the blob URL after a delay
      setTimeout(() => {
        URL.revokeObjectURL(blobUrl);
      }, 10000); // Increased delay
      
      return newTab;
    } catch (error) {
      console.error('Error opening new tab with blob:', error);
      
      // Fallback to data URL (with size limit check)
      try {
        if (htmlContent.length > 2000000) { // ~2MB limit
          throw new Error('HTML content too large for data URL fallback');
        }
        
        const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent);
        console.log('Using data URL fallback');
        
        return await chrome.tabs.create({
          url: dataUrl,
          active: true
        });
      } catch (fallbackError) {
        console.error('Data URL fallback also failed:', fallbackError);
        throw new Error('Failed to open modified HTML in new tab. The content might be too large.');
      }
    }
  }

  // Function to modify HTML offline - Enhanced version
  function modifyHTMLOffline(htmlString, oldWidth, newWidth, oldHeight, newHeight, enableHeight) {
    try {
      let modifiedHTML = htmlString;
      let widthModified = false;
      let heightModified = false;
      
      console.log('Starting HTML modification...');
      console.log('Looking for width:', oldWidth);
      console.log('Replacing with width:', newWidth);
      
      // Remove auto-print scripts
      const printScriptRemovals = [
        /window\.print\s*\(\s*\);?/gi,
        /(?<![a-zA-Z])print\s*\(\s*\);?/gi,
        /setTimeout\s*\(\s*function\s*\(\s*\)\s*\{\s*window\.print\s*\(\s*\)\s*;\s*\}\s*,\s*\d+\s*\)/gi,
        /setTimeout\s*\(\s*window\.print\s*,\s*\d+\s*\)/gi
      ];
      
      printScriptRemovals.forEach(pattern => {
        modifiedHTML = modifiedHTML.replace(pattern, '// auto-print removed');
      });
      
      // Enhanced width replacement - multiple strategies
      
      // Strategy 1: Direct width replacement in any context
      const widthPattern = new RegExp(`width:\\s*${oldWidth.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^\\d]|$)`, 'gi');
      const widthMatches = modifiedHTML.match(widthPattern);
      
      if (widthMatches) {
        console.log('Found width matches:', widthMatches.length);
        modifiedHTML = modifiedHTML.replace(widthPattern, `width: ${newWidth}$1`);
        widthModified = true;
      }
      
      // Strategy 2: Look for width attribute (not just CSS)
      const widthAttrPattern = new RegExp(`width=["']${oldWidth.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`, 'gi');
      const widthAttrMatches = modifiedHTML.match(widthAttrPattern);
      
      if (widthAttrMatches) {
        console.log('Found width attribute matches:', widthAttrMatches.length);
        modifiedHTML = modifiedHTML.replace(widthAttrPattern, `width="${newWidth}"`);
        widthModified = true;
      }
      
      // Strategy 3: Look in inline styles more broadly
      const stylePattern = /style=["']([^"']*?)["']/gi;
      modifiedHTML = modifiedHTML.replace(stylePattern, function(match, styleContent) {
        if (styleContent.includes(oldWidth)) {
          console.log('Found width in style attribute');
          const newStyleContent = styleContent.replace(
            new RegExp(`width:\\s*${oldWidth.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gi'),
            `width: ${newWidth}`
          );
          widthModified = true;
          return `style="${newStyleContent}"`;
        }
        return match;
      });
      
      // Handle height modifications
      if (enableHeight && oldHeight && newHeight) {
        console.log('Looking for height:', oldHeight);
        
        // Height in CSS
        const heightPattern = new RegExp(`height:\\s*${oldHeight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^\\d]|$)`, 'gi');
        const heightMatches = modifiedHTML.match(heightPattern);
        
        if (heightMatches) {
          console.log('Found height matches:', heightMatches.length);
          modifiedHTML = modifiedHTML.replace(heightPattern, `height: ${newHeight}$1`);
          heightModified = true;
        }
        
        // Height attribute
        const heightAttrPattern = new RegExp(`height=["']${oldHeight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`, 'gi');
        const heightAttrMatches = modifiedHTML.match(heightAttrPattern);
        
        if (heightAttrMatches) {
          console.log('Found height attribute matches:', heightAttrMatches.length);
          modifiedHTML = modifiedHTML.replace(heightAttrPattern, `height="${newHeight}"`);
          heightModified = true;
        }
      }
      
      console.log('Width modified:', widthModified);
      console.log('Height modified:', heightModified);
      
      if (!widthModified) {
        // Last resort: show what's actually in the HTML for debugging
        const allWidths = modifiedHTML.match(/width[:\s=]["']?[^"'\s;>]+/gi) || [];
        const uniqueWidths = [...new Set(allWidths)].slice(0, 10); // First 10 unique matches
        
        return { 
          success: false, 
          error: `Could not find and modify width "${oldWidth}". Found these width declarations: ${uniqueWidths.join(', ')}. Please check the exact width value in the page source.` 
        };
      }
      
      // Add enhanced CSS for better table rendering
      const enhancementCSS = `
<style>
/* Extension enhancements for table modification */
table { 
  box-sizing: border-box !important; 
  page-break-inside: avoid !important; 
}
table td, table th { 
  box-sizing: border-box !important; 
  word-wrap: break-word !important; 
}
${enableHeight ? `
/* Height-specific enhancements */
table[style*="height"] {
  table-layout: fixed !important;
  border-collapse: collapse !important;
}
table[style*="height"] td {
  vertical-align: top !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
}` : ''}
/* Prevent auto-print */
@media print {
  body { display: block !important; }
}
</style>`;
      
      // Insert CSS enhancements
      if (modifiedHTML.includes('</head>')) {
        modifiedHTML = modifiedHTML.replace('</head>', enhancementCSS + '\n</head>');
      } else if (modifiedHTML.includes('<body')) {
        modifiedHTML = modifiedHTML.replace('<body', enhancementCSS + '\n<body');
      } else {
        modifiedHTML = enhancementCSS + '\n' + modifiedHTML;
      }
      
      return { 
        success: true, 
        html: modifiedHTML,
        widthModified: widthModified,
        heightModified: enableHeight ? heightModified : null
      };
      
    } catch (error) {
      console.error('HTML modification error:', error);
      return { success: false, error: error.message };
    }
  }
});