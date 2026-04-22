document.addEventListener("click", function (event) {
    if (event.ctrlKey && event.altKey && event.target.tagName === "A") {
      chrome.runtime.sendMessage({
        action: "saveUrl",
        url: event.target.href
      });
    }
  });
  