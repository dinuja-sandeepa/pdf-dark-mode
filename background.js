// PDF Dark Mode - Background Service Worker

const DEFAULT_SETTINGS = {
  mode: "light",          // "light" | "dark" | "sepia"
  darkness: 70,           // 0-100 (intensity of dark mode)
  brightness: 100,        // 0-100
  followSystem: false,
  rated: false            // whether user has already rated
};

// Initialize defaults on install
chrome.runtime.onInstalled.addListener(async () => {
  const stored = await chrome.storage.sync.get(null);
  if (Object.keys(stored).length === 0) {
    await chrome.storage.sync.set(DEFAULT_SETTINGS);
  }
});

// Apply settings to a specific tab
// async function applyToTab(tabId) {
//   try {
//     const settings = await chrome.storage.sync.get(DEFAULT_SETTINGS);
//     await chrome.scripting.executeScript({
//       target: { tabId, allFrames: true },
//       func: (settings) => {
//         // This runs in the page context via content script messaging preference
//         window.postMessage({ type: "PDF_DARK_MODE_UPDATE", settings }, "*");
//       },
//       args: [settings]
//     });
//   } catch (e) {
//     // Tab may not allow injection (chrome:// pages etc.)
//   }
// }

async function applyToTab(tabId) {
  try {
    const settings = await chrome.storage.sync.get(DEFAULT_SETTINGS);

    chrome.tabs.sendMessage(
      tabId,
      {
        type: "PDF_DARK_MODE_UPDATE",
        settings
      },
      () => {
        void chrome.runtime.lastError;
      }
    );
  } catch (e) {
    // Tab may not be accessible
  }
}

// Listen for settings changes and broadcast to all tabs
// chrome.storage.onChanged.addListener((changes, area) => {
//   if (area !== "sync") return;
//   chrome.tabs.query({}, (tabs) => {
//     for (const tab of tabs) {
//       if (tab.id) applyToTab(tab.id);
//     }
//   });
// });

// Keyboard shortcut
chrome.commands.onCommand.addListener(async (command) => {
  if (command === "toggle-dark-mode") {
    const settings = await chrome.storage.sync.get(DEFAULT_SETTINGS);
    let next;
    if (settings.mode === "light") next = "dark";
    else if (settings.mode === "dark") next = "light";
    else next = "dark"; // from sepia go to dark
    await chrome.storage.sync.set({ mode: next, followSystem: false });
  }
});

// When a tab finishes loading, try to apply (helps with navigation)
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "complete") {
    applyToTab(tabId);
  }
});

// Message handler from popup / content
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "GET_SETTINGS") {
    chrome.storage.sync.get(DEFAULT_SETTINGS).then(sendResponse);
    return true;
  }
  if (msg.type === "SET_SETTINGS") {
    chrome.storage.sync.set(msg.settings).then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg.type === "OPEN_REVIEW") {
    const extensionId = chrome.runtime.id;
    const reviewUrl = `https://chromewebstore.google.com/detail/${extensionId}/reviews`;
    chrome.tabs.create({ url: reviewUrl });
    sendResponse({ ok: true });
    return true;
  }
});
