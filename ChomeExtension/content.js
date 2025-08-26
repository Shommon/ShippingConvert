// Content script for HTML Storage extension
// This script runs on every webpage and can be used for additional functionality

// Optional: Add keyboard shortcut support
document.addEventListener('keydown', function(e) {
  // Ctrl+Shift+H (or Cmd+Shift+H on Mac) to store HTML
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'H') {
    e.preventDefault();
    storeHTMLInVariable();
  }
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
    
    // Store in global window object
    window.pageHTML = fullHTML;
    
    // Also store parsed DOM for easier manipulation
    window.pageDOM = document.documentElement.cloneNode(true);
    
    // Log to console
    console.log('📄 HTML stored in window.pageHTML');
    console.log('🌳 Cloned DOM stored in window.pageDOM');
    console.log('💡 Use window.pageHTML to access the full HTML string');
    console.log('💡 Use window.pageDOM to access the DOM element');
    
    // Show notification
    showNotification('HTML stored in console variables!');
  } catch (error) {
    console.error('Error storing HTML:', error);
    showNotification('Error storing HTML', true);
  }
}

function showNotification(message, isError = false) {
  // Create notification element
  const notification = document.createElement('div');
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
    z-index: 10000;
    opacity: 0;
    transform: translateX(100%);
    transition: all 0.3s ease;
  `;
  
  document.body.appendChild(notification);
  
  // Animate in
  setTimeout(() => {
    notification.style.opacity = '1';
    notification.style.transform = 'translateX(0)';
  }, 10);
  
  // Remove after 3 seconds
  setTimeout(() => {
    notification.style.opacity = '0';
    notification.style.transform = 'translateX(100%)';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, 3000);
}