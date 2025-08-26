function modifyTableWidth() {
  const table = document.querySelector('table[style*="width: 784px"]');
  if (table) {
    table.style.width = "384px";
    console.log("✅ Table width changed to 384px");
  } else {
    console.error("❌ Target table not found.");
  }
}

function serializeDocument() {
  const doctype = new XMLSerializer().serializeToString(document.doctype);
  return doctype + "\n" + document.documentElement.outerHTML;
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "getModifiedHtml") {
    modifyTableWidth();
    sendResponse({ html: serializeDocument() });
  }
});
