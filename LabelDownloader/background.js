chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type === "downloadHtml") {
    const blob = new Blob([msg.html], { type: "text/html" });
    const url = URL.createObjectURL(blob);

    chrome.downloads.download({
      url: url,
      filename: (sender.tab?.title || "page") + ".html"
    });
  }
});
