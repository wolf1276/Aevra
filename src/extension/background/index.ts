// Aevra background service worker (Manifest V3).
// Placeholder — wallet logic (keyring, RPC proxy, message routing) lands here.

chrome.runtime.onInstalled.addListener(() => {
  console.log("Aevra service worker installed");
});

export {};
