// PDF Dark Mode - Popup Script

const DEFAULTS = {
  mode: "light",
  darkness: 70,
  brightness: 100,
  followSystem: false,
  rated: false
};

const els = {
  btnLight: document.getElementById("btn-light"),
  btnDark: document.getElementById("btn-dark"),
  btnSepia: document.getElementById("btn-sepia"),
  darkness: document.getElementById("darkness"),
  brightness: document.getElementById("brightness"),
  darknessValue: document.getElementById("darkness-value"),
  brightnessValue: document.getElementById("brightness-value"),
  followSystem: document.getElementById("follow-system"),
  rateSection: document.getElementById("rate-section"),
  stars: document.getElementById("stars"),
  rateThanks: document.getElementById("rate-thanks")
};

let settings = { ...DEFAULTS };

function setActiveMode(mode) {
  [els.btnLight, els.btnDark, els.btnSepia].forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.mode === mode);
  });
}

function updateUI() {
  setActiveMode(settings.mode);
  els.darkness.value = settings.darkness;
  els.brightness.value = settings.brightness;
  els.darknessValue.textContent = settings.darkness + "%";
  els.brightnessValue.textContent = settings.brightness + "%";
  els.followSystem.checked = !!settings.followSystem;

  // Disable darkness slider in pure light mode (still allow brightness)
  const darknessDisabled = settings.mode === "light" && !settings.followSystem;
  els.darkness.disabled = darknessDisabled;
  els.darkness.style.opacity = darknessDisabled ? "0.4" : "1";

  if (settings.rated && els.rateThanks.classList.contains("hidden")) {
    els.rateSection.classList.add("hidden");
  }
}

let saveTimer = null;

function save(partial) {
  settings = { ...settings, ...partial };

  // Update popup UI immediately
  updateUI();

  // Immediately update the active tab
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tabId = tabs[0]?.id;

    if (!tabId) return;

    chrome.tabs.sendMessage(
      tabId,
      {
        type: "PDF_DARK_MODE_UPDATE",
        settings
      },
      () => {
        // Ignore tabs where content scripts cannot be reached
        void chrome.runtime.lastError;
      }
    );
  });

  // Debounce storage.sync writes
  clearTimeout(saveTimer);

  saveTimer = setTimeout(() => {
    chrome.runtime.sendMessage(
      {
        type: "SET_SETTINGS",
        settings
      },
      () => {
        void chrome.runtime.lastError;
      }
    );
  }, 500);
}

// Mode buttons
[els.btnLight, els.btnDark, els.btnSepia].forEach((btn) => {
  btn.addEventListener("click", () => {
    save({ mode: btn.dataset.mode, followSystem: false });
  });
});

// Sliders
els.darkness.addEventListener("input", () => {
  els.darknessValue.textContent = els.darkness.value + "%";
  save({ darkness: Number(els.darkness.value) });
});

els.brightness.addEventListener("input", () => {
  els.brightnessValue.textContent = els.brightness.value + "%";
  save({ brightness: Number(els.brightness.value) });
});

// Follow system
els.followSystem.addEventListener("change", () => {
  save({ followSystem: els.followSystem.checked });
});

// Star rating logic
const starButtons = els.stars.querySelectorAll(".star");

starButtons.forEach((star) => {
  star.addEventListener("mouseenter", () => {
    const val = Number(star.dataset.value);
    starButtons.forEach((s) => {
      s.classList.toggle("hover", Number(s.dataset.value) <= val);
    });
  });

  star.addEventListener("mouseleave", () => {
    starButtons.forEach((s) => s.classList.remove("hover"));
  });

  star.addEventListener("click", () => {
    const rating = Number(star.dataset.value);

    // Visual feedback
    starButtons.forEach((s) => {
      s.classList.toggle("selected", Number(s.dataset.value) <= rating);
    });

    if (rating === 5) {
      // Open Chrome Web Store review page
      chrome.runtime.sendMessage({ type: "OPEN_REVIEW" });
      // Mark as rated so we don't show again
      save({ rated: true });
      els.rateSection.classList.add("hidden");
    } else {
      // 1-4 stars: just thank and hide
      els.stars.classList.add("hidden");
      els.rateThanks.classList.remove("hidden");
      save({ rated: true });
      // Auto-hide the whole section after a moment
      setTimeout(() => {
        els.rateSection.classList.add("hidden");
      }, 1800);
    }
  });
});

// Load current settings
chrome.runtime.sendMessage({ type: "GET_SETTINGS" }, (stored) => {
  if (stored) {
    settings = { ...DEFAULTS, ...stored };
  }
  updateUI();
});
