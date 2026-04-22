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
const DEBUG_LOG_KEY = "debugLogs";
const MAX_DEBUG_LOGS = 250;

browser.runtime.onInstalled.addListener(async () => {
  const stored = await browser.storage.local.get("settings");
  if (!stored.settings) {
    await browser.storage.local.set({ settings: DEFAULT_SETTINGS });
  }
});

browser.runtime.onMessage.addListener(async (message) => {
  if (message?.type === "get-settings") {
    const stored = await browser.storage.local.get("settings");
    return stored.settings || DEFAULT_SETTINGS;
  }

  if (message?.type === "set-settings") {
    const settings = normalizeSettings(message.settings);
    await browser.storage.local.set({ settings });
    await notifyAllImdbTabs(settings);
    return { ok: true };
  }

  if (message?.type === "append-debug-log") {
    await appendDebugLog(message.entry);
    return { ok: true };
  }

  if (message?.type === "get-debug-logs") {
    const stored = await browser.storage.local.get(DEBUG_LOG_KEY);
    return stored[DEBUG_LOG_KEY] || [];
  }

  if (message?.type === "clear-debug-logs") {
    await browser.storage.local.set({ [DEBUG_LOG_KEY]: [] });
    return { ok: true };
  }

  return undefined;
});

browser.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local" || !changes.settings?.newValue) {
    return;
  }

  notifyAllImdbTabs(changes.settings.newValue);
});

async function notifyAllImdbTabs(settings) {
  const tabs = await browser.tabs.query({
    url: [
      "*://www.imdb.com/title/*",
      "*://www.imdb.com/*/title/*",
      "*://m.imdb.com/title/*"
    ]
  });

  await Promise.all(
    tabs.map(async (tab) => {
      try {
        await browser.tabs.sendMessage(tab.id, {
          type: "settings-updated",
          settings
        });
      } catch (error) {
        // Ignore tabs that do not have the content script active yet.
      }
    })
  );
}

function normalizeSettings(settings) {
  return {
    enabled: typeof settings?.enabled === "boolean" ? settings.enabled : DEFAULT_SETTINGS.enabled,
    useKeywordFallback:
      typeof settings?.useKeywordFallback === "boolean"
        ? settings.useKeywordFallback
        : DEFAULT_SETTINGS.useKeywordFallback,
    categories: {
      nudity: Boolean(settings?.categories?.nudity),
      violence: Boolean(settings?.categories?.violence),
      profanity: Boolean(settings?.categories?.profanity),
      alcohol: Boolean(settings?.categories?.alcohol),
      frightening: Boolean(settings?.categories?.frightening)
    }
  };
}

async function appendDebugLog(entry) {
  if (!entry || typeof entry !== "object") {
    return;
  }

  const stored = await browser.storage.local.get(DEBUG_LOG_KEY);
  const next = Array.isArray(stored[DEBUG_LOG_KEY]) ? stored[DEBUG_LOG_KEY] : [];
  next.push({
    ts: new Date().toISOString(),
    ...entry
  });

  if (next.length > MAX_DEBUG_LOGS) {
    next.splice(0, next.length - MAX_DEBUG_LOGS);
  }

  await browser.storage.local.set({ [DEBUG_LOG_KEY]: next });
}
