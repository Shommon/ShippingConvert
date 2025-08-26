document.getElementById("downloadBtn").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  const [result] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      const doctype = document.doctype ? new XMLSerializer().serializeToString(document.doctype) : '';
      return doctype + "\n" + document.documentElement.outerHTML;
    }
  });

  if (result?.result) {
    chrome.runtime.sendMessage({ type: "downloadHtml", html: result.result });
  }
});
