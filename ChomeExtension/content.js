// Content script for HTML Table Modifier extension
// This script runs on every webpage and stores HTML for modification

// Store HTML immediately when page loads
document.addEventListener('DOMContentLoaded', storeHTMLInVariable);

// Also store when page is fully loaded
window.addEventListener('load', storeHTMLInVariable);

// Store HTML when user presses Ctrl+Shift+H (or Cmd+Shift+H on Mac)
document.addEventListener('keydown', function(e) {
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'H') {
    e.preventDefault();
    storeHTMLInVariable();
    showNotification('📄 HTML stored! You can now use the extension.', false);
  }
});

// Store HTML before print dialog opens
window.addEventListener('beforeprint', function() {
  storeHTMLInVariable();
  console.log('📄 HTML automatically stored before print');
});

function storeHTMLInVariable() {
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
    
    // Store in multiple global variables for redundancy
    window.pageHTML = fullHTML;
    window.originalHTML = fullHTML;
    window.storedHTML = fullHTML;
    
    // Also store parsed DOM for easier manipulation
    window.pageDOM = document.documentElement.cloneNode(true);
    
    // Store timestamp
    window.htmlStoredAt = new Date().toISOString();
    
    // Store in session storage as backup (if available)
    try {
      if (typeof Storage !== 'undefined' && sessionStorage) {
        sessionStorage.setItem('extensionHTML', fullHTML);
        sessionStorage.setItem('extensionHTMLTime', window.htmlStoredAt);
      }
    } catch (storageError) {
      console.log('Session storage not available:', storageError);
    }
    
    console.log('📄 HTML stored successfully at', window.htmlStoredAt);
    console.log('💾 Available in: window.pageHTML, window.originalHTML, window.storedHTML');
    
    return true;
  } catch (error) {
    console.error('Error storing HTML:', error);
    return false;
  }
}

function showNotification(message, isError = false) {
  // Remove any existing notifications first
  const existingNotifications = document.querySelectorAll('.extension-notification');
  existingNotifications.forEach(n => n.remove());
  
  // Create notification element
  const notification = document.createElement('div');
  notification.className = 'extension-notification';
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${isError ? '#ef4444' : '#10b981'};
    color: white;
    padding: 12px 16px;
    border-radius: 8px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    font-weight: 500;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 99999;
    opacity: 0;
    transform: translateX(100%);
    transition: all 0.3s ease;
    max-width: 300px;
    line-height: 1.4;
  `;
  
  document.body.appendChild(notification);
  
  // Animate in
  setTimeout(() => {
    notification.style.opacity = '1';
    notification.style.transform = 'translateX(0)';
  }, 10);
  
  // Remove after 4 seconds
  setTimeout(() => {
    notification.style.opacity = '0';
    notification.style.transform = 'translateX(100%)';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, 4000);
}

// Expose functions globally for debugging
window.storeHTML = storeHTMLInVariable;
window.showExtensionNotification = showNotification;