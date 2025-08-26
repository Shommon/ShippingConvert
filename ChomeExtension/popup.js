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
    console.log('🖨️ Print dialog left undisturbed');
    
    return { success: true };
  } catch (error) {
    console.error('Error modifying HTML:', error);
    return { success: false, error: error.message };
  }
}