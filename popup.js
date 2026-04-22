const DEFAULT_SETTINGS = {
  enabled: true,
  useKeywordFallback: false,
  categories: {
    nudity: true,
    violence: true,
    profanity: true,
    alcohol: false,
    frightening: false
  }
};

const ids = ["enabled", "useKeywordFallback", "nudity", "violence", "profanity", "alcohol", "frightening"];
const pageStatus = document.getElementById("page-status");
const form = document.getElementById("popup-form");
const openOptionsButton = document.getElementById("open-options");
const copyDebugLogButton = document.getElementById("copy-debug-log");
const clearDebugLogButton = document.getElementById("clear-debug-log");

init().catch(() => {
  pageStatus.textContent = "Unable to read extension state.";
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const settings = readFormSettings();
  await browser.runtime.sendMessage({
    type: "set-settings",
    settings
  });
  await renderPageState();
  window.close();
});

openOptionsButton.addEventListener("click", () => {
  browser.runtime.openOptionsPage();
});

copyDebugLogButton.addEventListener("click", async () => {
  const logs = await browser.runtime.sendMessage({
    type: "get-debug-logs"
  });
  const text = JSON.stringify(logs, null, 2);

  await navigator.clipboard.writeText(text);
  pageStatus.textContent = "Debug log copied to clipboard.";
});

clearDebugLogButton.addEventListener("click", async () => {
  await browser.runtime.sendMessage({
    type: "clear-debug-logs"
  });
  pageStatus.textContent = "Debug log cleared.";
});

async function init() {
  const { settings } = await browser.storage.local.get("settings");
  applySettings(settings || DEFAULT_SETTINGS);
  await renderPageState();
}

function applySettings(settings) {
  for (const id of ids) {
    const input = document.getElementById(id);
    if (id === "enabled") {
      input.checked = settings.enabled;
    } else if (id === "useKeywordFallback") {
      input.checked = Boolean(settings.useKeywordFallback);
    } else {
      input.checked = Boolean(settings.categories?.[id]);
    }
  }
}

function readFormSettings() {
  return {
    enabled: document.getElementById("enabled").checked,
    useKeywordFallback: document.getElementById("useKeywordFallback").checked,
    categories: {
      nudity: document.getElementById("nudity").checked,
      violence: document.getElementById("violence").checked,
      profanity: document.getElementById("profanity").checked,
      alcohol: document.getElementById("alcohol").checked,
      frightening: document.getElementById("frightening").checked
    }
  };
}

async function renderPageState() {
  const [tab] = await browser.tabs.query({
    active: true,
    currentWindow: true
  });

  if (!tab?.id || !/https?:\/\/(www|m)\.imdb\.com\/(?:[a-z]{2}(?:-[A-Z]{2})?\/)?title\//i.test(tab.url || "")) {
    pageStatus.textContent = "Open an IMDb movie or TV show page to evaluate it.";
    return;
  }

  try {
    const state = await browser.tabs.sendMessage(tab.id, {
      type: "get-page-state"
    });

    if (!state?.titleId) {
      pageStatus.textContent = "This IMDb page is not a title page the extension can read.";
      return;
    }

    if (state.shouldShow) {
      const activeSettings = readFormSettings();
      const selectedCategories = Object.entries(activeSettings.categories)
        .filter(([, enabled]) => enabled)
        .map(([category]) => category);
      const summary = selectedCategories
        .map((category) => {
          return `${formatCategory(category)}: ${formatSeverity(
            state.ratings?.[category],
            state.ratingSources?.[category]
          )}`;
        })
        .join(" | ");

      pageStatus.textContent = `Bar is ${state.indicatorColor || "hidden"} for this title. ${summary}`;
    } else {
      pageStatus.textContent = "Bar is hidden for this title. Reload the IMDb tab if the guide has not been read yet.";
    }
  } catch (error) {
    pageStatus.textContent = "Reload the IMDb tab once so the extension can inspect it.";
  }
}

function formatCategory(category) {
  switch (category) {
    case "nudity":
      return "Nudity";
    case "violence":
      return "Violence";
    case "profanity":
      return "Profanity";
    case "alcohol":
      return "Alcohol";
    case "frightening":
      return "Frightening";
    default:
      return category;
  }
}

function formatSeverity(severity, source) {
  if (!severity) {
    return "unknown";
  }

  const label = severity.charAt(0).toUpperCase() + severity.slice(1);
  return source === "keyword" ? `${label} (keyword)` : label;
}
