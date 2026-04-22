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

const form = document.getElementById("settings-form");
const status = document.getElementById("status");
const ids = ["enabled", "useKeywordFallback", "nudity", "violence", "profanity", "alcohol", "frightening"];

init().catch((error) => {
  status.textContent = "Unable to load settings.";
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const settings = {
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

  await browser.runtime.sendMessage({
    type: "set-settings",
    settings
  });

  status.textContent = "Settings saved.";
  window.setTimeout(() => {
    status.textContent = "";
  }, 1800);
});

async function init() {
  const result = await browser.storage.local.get("settings");
  const settings = result.settings || DEFAULT_SETTINGS;

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
