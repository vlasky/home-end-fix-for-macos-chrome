function updateBadge(enabled) {
  if (enabled) {
    chrome.action.setBadgeText({ text: "" });
  } else {
    chrome.action.setBadgeText({ text: "OFF" });
    chrome.action.setBadgeBackgroundColor({ color: "#888" });
  }
}

function syncStateAndBadge(defaultOnInstall) {
  chrome.storage.local.get("enabled", function (data) {
    if (data.enabled === undefined && defaultOnInstall) {
      chrome.storage.local.set({ enabled: true });
      updateBadge(true);
      return;
    }
    updateBadge(data.enabled !== false);
  });
}

chrome.runtime.onInstalled.addListener(function (details) {
  syncStateAndBadge(details.reason === "install");
});

chrome.runtime.onStartup.addListener(function () {
  syncStateAndBadge(false);
});

syncStateAndBadge(false);

chrome.action.onClicked.addListener(function () {
  chrome.storage.local.get("enabled", function (data) {
    const currentState = data.enabled !== false;
    const newState = !currentState;
    chrome.storage.local.set({ enabled: newState });
    updateBadge(newState);
  });
});
