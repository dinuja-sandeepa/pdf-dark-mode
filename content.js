// PDF Dark Mode - Content Script
// Applies CSS filters to Chrome's built-in PDF viewer and embedded PDFs

(function () {
  "use strict";

  const STYLE_ID = "pdf-dark-mode-style";
  let currentSettings = {
    mode: "light",
    darkness: 70,
    brightness: 100,
    followSystem: false
  };

  function isPdfPage() {
    // Top-level PDF
    if (document.contentType === "application/pdf") return true;
    // Chrome internal viewer
    if (location.protocol === "chrome-extension:" &&
        location.hostname === "mhjfbmdgcfjbbpaeojofohoefgiehjai") return true;
    // URL ends with .pdf
    if (/\.pdf($|\?|#)/i.test(location.href)) return true;
    // Has PDF embed/object
    if (document.querySelector('embed[type="application/pdf"], embed[type="application/x-google-chrome-pdf"], object[type="application/pdf"]')) {
      return true;
    }
    return false;
  }

  function buildFilter(settings) {
  const mode = settings.mode;
  const bright = (settings.brightness / 100).toFixed(2);

  if (mode === "light") {
    return `brightness(${bright})`;
  }

  if (mode === "sepia") {
    // Warm paper look (Kindle-style)
    // darkness slider controls how strong the sepia tone is (0–100 → 0.25–0.7)
    const sepiaAmount = (0.25 + (settings.darkness / 100) * 0.45).toFixed(2);
    return `sepia(${sepiaAmount}) brightness(${bright}) contrast(0.92)`;
  }

  // Dark mode
  const invertAmount = (0.55 + (settings.darkness / 100) * 0.45).toFixed(2);
  return `invert(${invertAmount}) hue-rotate(180deg) brightness(${bright})`;
}

  function applyStyles(settings) {
    currentSettings = settings;

    // Resolve system theme if requested
    let effectiveMode = settings.mode;
    if (settings.followSystem) {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      effectiveMode = prefersDark ? "dark" : "light";
    }

    const filterValue = buildFilter({ ...settings, mode: effectiveMode });

    let styleEl = document.getElementById(STYLE_ID);
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = STYLE_ID;
      (document.head || document.documentElement).appendChild(styleEl);
    }

    // Different targets depending on how the PDF is shown
    const topLevelPdf = document.contentType === "application/pdf" ||
      (location.protocol === "chrome-extension:" &&
       location.hostname === "mhjfbmdgcfjbbpaeojofohoefgiehjai");

    if (effectiveMode === "light" && settings.brightness >= 99) {
      // Reset completely
      styleEl.textContent = "";
      return;
    }

    if (topLevelPdf) {
      // Direct PDF or Chrome PDF viewer page
      styleEl.textContent = `
        html {
          filter: ${filterValue} !important;
          background-color: ${
  effectiveMode === "light"  ? "#ffffff" :
  effectiveMode === "sepia"  ? "#f4ecd8" :   // warm paper background
                               "#17171a"
} !important;
        }
        body {
          background-color: ${
  effectiveMode === "light"  ? "#ffffff" :
  effectiveMode === "sepia"  ? "#f4ecd8" :   // warm paper background
                               "#17171a"
} !important;
        }
      `;
    } else {
      // Embedded PDF
      styleEl.textContent = `
        embed[type="application/pdf"],
        embed[type="application/x-google-chrome-pdf"],
        object[type="application/pdf"] {
          filter: ${filterValue} !important;
        }
      `;
    }
  }

  function loadAndApply() {
    try {
      if (!chrome.runtime?.id) return;
      chrome.runtime.sendMessage({ type: "GET_SETTINGS" }, (settings) => {
        try {
          if (chrome.runtime?.lastError) return;
          if (settings) applyStyles(settings);
        } catch (err) {
          // Context invalidated during callback
        }
      });
    } catch (e) {
      // Extension context invalidated
    }
  }

  // Listen for updates from background / popup
  // window.addEventListener("message", (event) => {
  //   if (event.data && event.data.type === "PDF_DARK_MODE_UPDATE") {
  //     applyStyles(event.data.settings);
  //   }
  // });

  try {
    if (chrome.runtime?.id) {
      chrome.runtime.onMessage.addListener((msg) => {
        if (msg.type === "PDF_DARK_MODE_UPDATE" && msg.settings) {
          applyStyles(msg.settings);
        }
      });
    }
  } catch (e) {
    // Extension context invalidated
  }

  // System theme change
  try {
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
      if (currentSettings.followSystem) {
        applyStyles(currentSettings);
      }
    });
  } catch (e) {}

  // Only run logic on PDF-related pages
  if (isPdfPage()) {
    loadAndApply();

    // Re-apply after a short delay (viewer may rewrite DOM)
    setTimeout(loadAndApply, 800);
  }

  // // Also observe for dynamic embeds
  // const observer = new MutationObserver(() => {
  //   if (isPdfPage()) {
  //     loadAndApply();
  //   }
  // });
  // observer.observe(document.documentElement, { childList: true, subtree: true });
})();
