document.addEventListener('DOMContentLoaded', function() {
  const modifyBtn = document.getElementById('modifyBtn');
  const status = document.getElementById('status');
  const oldWidthInput = document.getElementById('oldWidth');
  const newWidthInput = document.getElementById('newWidth');

  modifyBtn.addEventListener('click', async function() {
    try {
      const oldWidth = oldWidthInput.value.trim();
      const newWidth = newWidthInput.value.trim();
      
      if (!oldWidth || !newWidth) {
        throw new Error('Please enter both old and new width values');
      }

      // Get the active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Execute script to modify HTML and open in new tab
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: modifyTableAndOpen,
        args: [oldWidth, newWidth]
      });

      const result = results[0].result;
      
      if (result.success) {
        status.innerHTML = `✅ Table modified! Width changed from ${oldWidth} to ${newWidth}<br>Opening in new tab...`;
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
function modifyTableAndOpen(oldWidth, newWidth) {
  try {
    // First, try to close any print dialogs
    try {
      if (window.print) {
        // Override print function temporarily to prevent automatic printing
        const originalPrint = window.print;
        window.print = function() {
          console.log('Print dialog blocked during HTML modification');
        };
        
        // Restore after a delay
        setTimeout(() => {
          window.print = originalPrint;
        }, 2000);
      }
    } catch (e) {
      console.log('Could not override print function:', e);
    }
    
    // Get the complete HTML including DOCTYPE
    const doctype = document.doctype ? 
      '<!DOCTYPE ' + document.doctype.name +
      (document.doctype.publicId ? ' PUBLIC "' + document.doctype.publicId + '"' : '') +
      (document.doctype.systemId ? ' "' + document.doctype.systemId + '"' : '') + 
      '>' : '';
    
    // Get the full HTML element
    const htmlElement = document.documentElement.outerHTML;
    let fullHTML = doctype + '\n' + htmlElement;
    
    // Remove any auto-print scripts from the HTML
    fullHTML = fullHTML.replace(/window\.print\s*\(\s*\)/gi, '// window.print() removed');
    fullHTML = fullHTML.replace(/print\s*\(\s*\)/gi, '// print() removed');
    fullHTML = fullHTML.replace(/<script[^>]*>[\s\S]*?window\.print[\s\S]*?<\/script>/gi, '<!-- Auto-print script removed -->');
    
    // Find and modify the specific table
    const tableRegex = /<table[^>]*cellpadding="0"[^>]*cellspacing="0"[^>]*border="1"[^>]*style="[^"]*width:\s*784px[^"]*"[^>]*>/gi;
    
    let tableFound = false;
    fullHTML = fullHTML.replace(tableRegex, function(match) {
      tableFound = true;
      return match.replace(/width:\s*784px/gi, `width: ${newWidth}`);
    });
    
    // If the regex approach didn't work, try a more general approach
    if (!tableFound) {
      const generalTableRegex = /<table([^>]*style="[^"]*width:\s*784px[^"]*"[^>]*>)/gi;
      fullHTML = fullHTML.replace(generalTableRegex, function(match, group1) {
        tableFound = true;
        return match.replace(/width:\s*784px/gi, `width: ${newWidth}`);
      });
    }
    
    // If still not found, try replacing any occurrence of width: 784px
    if (!tableFound) {
      const widthRegex = /width:\s*784px/gi;
      if (fullHTML.match(widthRegex)) {
        fullHTML = fullHTML.replace(widthRegex, `width: ${newWidth}`);
        tableFound = true;
      }
    }
    
    if (!tableFound) {
      return { success: false, error: 'Table with width 784px not found' };
    }
    
    // Store modified HTML in global variable for reference
    window.modifiedHTML = fullHTML;
    
    // Create the new tab with modified HTML using a more robust method
    const openModifiedPage = () => {
      try {
        // Method 1: Try using blob URL
        const blob = new Blob([fullHTML], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const newWindow = window.open(url, '_blank', 'noopener,noreferrer');
        
        if (!newWindow || newWindow.closed) {
          throw new Error('Popup blocked or failed');
        }
        
        // Clean up the blob URL after a delay
        setTimeout(() => URL.revokeObjectURL(url), 10000);
        
        return true;
      } catch (e) {
        console.log('Blob method failed, trying data URL:', e);
        
        // Method 2: Try using data URL (fallback)
        try {
          const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(fullHTML);
          const newWindow = window.open(dataUrl, '_blank', 'noopener,noreferrer');
          
          if (!newWindow || newWindow.closed) {
            throw new Error('Data URL method also failed');
          }
          
          return true;
        } catch (e2) {
          console.error('Both methods failed:', e2);
          return false;
        }
      }
    };
    
    // Try to open immediately, if that fails, try after a delay
    let opened = openModifiedPage();
    
    if (!opened) {
      setTimeout(() => {
        opened = openModifiedPage();
        if (!opened) {
          console.error('Failed to open new tab - popup blocker may be active');
        }
      }, 1000);
    }
    
    // Log to console
    console.log('📄 Modified HTML stored in window.modifiedHTML');
    console.log(`🔧 Table width changed from ${oldWidth} to ${newWidth}`);
    console.log('🚫 Auto-print scripts removed from modified HTML');
    
    return { success: true };
  } catch (error) {
    console.error('Error modifying HTML:', error);
    return { success: false, error: error.message };
  }
}