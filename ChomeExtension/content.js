// Content script for HTML Table Modifier extension
// Enhanced version with better HTML storage and debugging

console.log('🔧 HTML Table Modifier: Content script loaded');

// Store HTML immediately when page loads
document.addEventListener('DOMContentLoaded', function() {
  console.log('📄 DOMContentLoaded event fired');
  setTimeout(storeHTMLInVariable, 100); // Small delay to ensure DOM is ready
});

// Also store when page is fully loaded
window.addEventListener('load', function() {
  console.log('📄 Window load event fired');
  setTimeout(storeHTMLInVariable, 500); // Longer delay for dynamic content
});

// Store HTML when user presses Ctrl+Shift+H (or Cmd+Shift+H on Mac)
document.addEventListener('keydown', function(e) {
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'H') {
    e.preventDefault();
    console.log('⌨️ Manual HTML storage triggered via Ctrl+Shift+H');
    storeHTMLInVariable();
    showNotification('📄 HTML stored! You can now use the extension.', false);
  }
});

// Store HTML before print dialog opens
window.addEventListener('beforeprint', function() {
  console.log('🖨️ Before print event - storing HTML');
  storeHTMLInVariable();
  showNotification('📄 HTML automatically stored before print', false);
});

// Additional triggers for dynamic content
// Store HTML when hash changes (for SPA navigation)
window.addEventListener('hashchange', function() {
  console.log('🔗 Hash change detected - storing HTML');
  setTimeout(storeHTMLInVariable, 1000);
});

// Store HTML when visibility changes (tab becomes visible)
document.addEventListener('visibilitychange', function() {
  if (!document.hidden) {
    console.log('👁️ Tab became visible - storing HTML');
    setTimeout(storeHTMLInVariable, 500);
  }
});

// Store HTML on focus (when user clicks on page)
window.addEventListener('focus', function() {
  console.log('🎯 Window focused - storing HTML');
  setTimeout(storeHTMLInVariable, 200);
}, { once: false });

function storeHTMLInVariable() {
  try {
    console.log('🔄 Starting HTML storage process...');
    
    // Wait a bit more if the page seems to still be loading
    if (document.readyState === 'loading') {
      console.log('⏳ Page still loading, waiting...');
      setTimeout(storeHTMLInVariable, 1000);
      return false;
    }
    
    // Get the complete HTML including DOCTYPE
    const doctype = document.doctype ? 
      '<!DOCTYPE ' + document.doctype.name +
      (document.doctype.publicId ? ' PUBLIC "' + document.doctype.publicId + '"' : '') +
      (document.doctype.systemId ? ' "' + document.doctype.systemId + '"' : '') + 
      '>' : '<!DOCTYPE html>';
    
    // Get the full HTML element
    const htmlElement = document.documentElement.outerHTML;
    const fullHTML = doctype + '\n' + htmlElement;
    
    console.log('📏 HTML length:', fullHTML.length);
    console.log('🏷️ Page title:', document.title);
    console.log('🌐 Page URL:', window.location.href);
    
    // Store in multiple global variables for redundancy
    window.pageHTML = fullHTML;
    window.originalHTML = fullHTML;
    window.storedHTML = fullHTML;
    
    // Also store parsed DOM for easier manipulation
    window.pageDOM = document.documentElement.cloneNode(true);
    
    // Store timestamp and page info
    window.htmlStoredAt = new Date().toISOString();
    window.htmlStoredURL = window.location.href;
    window.htmlStoredTitle = document.title;
    
    // Store in session storage as backup (if available)
    try {
      if (typeof Storage !== 'undefined' && sessionStorage) {
        sessionStorage.setItem('extensionHTML', fullHTML);
        sessionStorage.setItem('extensionHTMLTime', window.htmlStoredAt);
        sessionStorage.setItem('extensionHTMLURL', window.location.href);
        console.log('💾 HTML also stored in sessionStorage');
      }
    } catch (storageError) {
      console.log('❌ Session storage not available:', storageError);
    }
    
    // Check for common table patterns to help with debugging
    const tableCount = (fullHTML.match(/<table/gi) || []).length;
    const widthMatches = (fullHTML.match(/width:\s*\d+px/gi) || []).length;
    const heightMatches = (fullHTML.match(/height:\s*\d+px/gi) || []).length;
    
    console.log('📊 Found in HTML:');
    console.log('  - Tables:', tableCount);
    console.log('  - Width styles:', widthMatches);
    console.log('  - Height styles:', heightMatches);
    
    // Look for common shipping label dimensions
    const commonDimensions = ['784px', '580px', '555px', '600px', '800px'];
    const foundDimensions = commonDimensions.filter(dim => fullHTML.includes(dim));
    if (foundDimensions.length > 0) {
      console.log('📦 Possible shipping label dimensions found:', foundDimensions);
    }
    
    console.log('✅ HTML stored successfully at', window.htmlStoredAt);
    console.log('📋 Available in: window.pageHTML, window.originalHTML, window.storedHTML');
    
    return true;
  } catch (error) {
    console.error('❌ Error storing HTML:', error);
    showNotification('Error storing HTML: ' + error.message, true);
    return false;
  }
}

function showNotification(message, isError = false) {
  console.log(isError ? '❌' : '✅', message);
  
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

// Debug function to inspect current page
function debugCurrentPage() {
  console.log('🔍 DEBUG: Current page analysis');
  console.log('📍 URL:', window.location.href);
  console.log('📄 Title:', document.title);
  console.log('📊 Ready state:', document.readyState);
  
  // Look for tables
  const tables = document.querySelectorAll('table');
  console.log('📋 Tables found:', tables.length);
  
  tables.forEach((table, index) => {
    const style = window.getComputedStyle(table);
    console.log(`  Table ${index + 1}:`);
    console.log('    Width:', style.width);
    console.log('    Height:', style.height);
    console.log('    Display:', style.display);
  });
  
  // Look for elements with specific dimensions
  const elementsWithWidth = document.querySelectorAll('[style*="width"]');
  console.log('🔍 Elements with inline width:', elementsWithWidth.length);
  
  // Check if HTML is stored
  console.log('💾 HTML Storage Status:');
  console.log('  window.pageHTML exists:', !!window.pageHTML);
  console.log('  window.originalHTML exists:', !!window.originalHTML);
  console.log('  window.storedHTML exists:', !!window.storedHTML);
  console.log('  sessionStorage exists:', !!sessionStorage?.getItem('extensionHTML'));
}

// Expose functions globally for debugging
window.storeHTML = storeHTMLInVariable;
window.showExtensionNotification = showNotification;
window.debugPage = debugCurrentPage;

// Auto-store HTML periodically (every 30 seconds) as backup
setInterval(function() {
  if (!window.pageHTML || window.pageHTML.length < 1000) {
    console.log('🔄 Periodic HTML storage check...');
    storeHTMLInVariable();
  }
}, 30000);

console.log('🚀 HTML Table Modifier: Content script fully initialized');