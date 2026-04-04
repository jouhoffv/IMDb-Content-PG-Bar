const api = typeof browser !== "undefined" ? browser : chrome;

const DEFAULT_CONTAINER_CONFIG = {
  enabled: false,
  unloadMinutes: 30,
  neverUnload: false,
  periodicReloadMinutes: 0,
  clearCacheOnReload: false,
  clearCookiesOnReload: false,
};

const DEFAULT_STALE_DATA_CLEANUP = {
  enabled: false,
  retentionDays: 30,
};

const tabReloadHistory = {};

function callbackToPromise(fn, ctx, ...args) {
  return new Promise((resolve, reject) => {
    fn.call(ctx, ...args, (result) => {
      const err = chrome.runtime?.lastError;
      if (err) reject(err);
      else resolve(result);
    });
  });
}

async function storageGet(keys) {
  if (api.storage.sync.get.length === 1) return api.storage.sync.get(keys);
  return callbackToPromise(api.storage.sync.get, api.storage.sync, keys);
}

async function storageSet(value) {
  if (api.storage.sync.set.length === 1) return api.storage.sync.set(value);
  return callbackToPromise(api.storage.sync.set, api.storage.sync, value);
}

async function getTabs(query) {
  if (api.tabs.query.length <= 1) return api.tabs.query(query);
  return callbackToPromise(api.tabs.query, api.tabs, query);
}

async function createTab(options) {
  if (api.tabs.create.length <= 1) return api.tabs.create(options);
  return callbackToPromise(api.tabs.create, api.tabs, options);
}

async function discardTab(tabId) {
  if (!api.tabs.discard) return;
  if (api.tabs.discard.length <= 1) return api.tabs.discard(tabId);
  return callbackToPromise(api.tabs.discard, api.tabs, tabId);
}

async function reloadTab(tabId, bypassCache) {
  if (api.tabs.reload.length <= 2) return api.tabs.reload(tabId, { bypassCache });
  return callbackToPromise(api.tabs.reload, api.tabs, tabId, { bypassCache });
}

async function getAllContainers() {
  if (!api.contextualIdentities?.query) return [];
  if (api.contextualIdentities.query.length <= 1) return api.contextualIdentities.query({});
  return callbackToPromise(api.contextualIdentities.query, api.contextualIdentities, {});
}

function normalizeConfig(raw) {
  return { ...DEFAULT_CONTAINER_CONFIG, ...(raw || {}) };
}

function normalizeCleanupConfig(raw) {
  return { ...DEFAULT_STALE_DATA_CLEANUP, ...(raw || {}) };
}

function getOrigin(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

async function getContainerConfig() {
  const { containerSettings = {} } = await storageGet("containerSettings");
  return containerSettings;
}

async function ensureContainerDefaults() {
  const containers = await getAllContainers();
  const containerSettings = await getContainerConfig();
  let changed = false;

  for (const container of containers) {
    if (!containerSettings[container.cookieStoreId]) {
      containerSettings[container.cookieStoreId] = { ...DEFAULT_CONTAINER_CONFIG };
      changed = true;
    }
  }

  if (changed) await storageSet({ containerSettings });
}

async function clearCookiesForStore(cookieStoreId) {
  if (!api.cookies?.getAll || !api.cookies?.remove) return;
  const cookies = await api.cookies.getAll({ storeId: cookieStoreId });

  await Promise.all(
    cookies.map((cookie) => {
      const protocol = cookie.secure ? "https:" : "http:";
      const host = cookie.domain.startsWith(".") ? cookie.domain.slice(1) : cookie.domain;
      const path = cookie.path || "/";

      return api.cookies.remove({
        url: `${protocol}//${host}${path}`,
        name: cookie.name,
        storeId: cookie.storeId,
      });
    })
  );
}

async function runContainerAutomation() {
  const containerSettings = await getContainerConfig();
  const tabs = await getTabs({});
  const now = Date.now();

  for (const tab of tabs) {
    if (!tab.cookieStoreId || tab.active || tab.pinned || tab.discarded) continue;

    const config = normalizeConfig(containerSettings[tab.cookieStoreId]);
    if (!config.enabled || config.neverUnload) continue;

    const inactiveForMs = now - (tab.lastAccessed || now);
    const unloadAfterMs = Math.max(1, Number(config.unloadMinutes || 1)) * 60 * 1000;

    if (inactiveForMs >= unloadAfterMs) await discardTab(tab.id);
  }
}

async function runPeriodicReload() {
  const containerSettings = await getContainerConfig();
  const tabs = await getTabs({});
  const now = Date.now();

  for (const tab of tabs) {
    if (!tab.cookieStoreId || tab.discarded || tab.active) continue;

    const config = normalizeConfig(containerSettings[tab.cookieStoreId]);
    if (!config.enabled || config.periodicReloadMinutes <= 0) continue;

    const reloadIntervalMs = Number(config.periodicReloadMinutes) * 60 * 1000;
    const baseline = Math.max(tab.lastAccessed || 0, tabReloadHistory[tab.id] || 0);
    if (now - baseline < reloadIntervalMs) continue;

    if (config.clearCookiesOnReload) await clearCookiesForStore(tab.cookieStoreId);
    if (config.clearCacheOnReload && api.browsingData?.removeCache) {
      await api.browsingData.removeCache({ since: 0 });
    }

    await reloadTab(tab.id, Boolean(config.clearCacheOnReload));
    tabReloadHistory[tab.id] = now;
  }
}

async function runScheduledVisits() {
  const { scheduledVisitRules = [] } = await storageGet("scheduledVisitRules");
  const tabs = await getTabs({});
  const now = Date.now();
  let changed = false;

  for (const rule of scheduledVisitRules) {
    if (!rule.enabled || !rule.url) continue;

    const intervalMinutes = Math.max(1, Number(rule.intervalMinutes || 60));
    const dueAt = Number(rule.lastVisitedAt || 0) + intervalMinutes * 60 * 1000;
    if (dueAt > now) continue;

    const createOptions = {
      url: rule.url,
      active: !rule.openInBackground,
    };

    if (rule.cookieStoreId) createOptions.cookieStoreId = rule.cookieStoreId;

    const matchingTab = tabs.find(
      (tab) => tab.url === rule.url && (rule.cookieStoreId ? tab.cookieStoreId === rule.cookieStoreId : true)
    );

    if (matchingTab) {
      await reloadTab(matchingTab.id, false);
    } else {
      await createTab(createOptions);
    }

    rule.lastVisitedAt = now;
    changed = true;
  }

  if (changed) await storageSet({ scheduledVisitRules });
}

async function runStaleDataCleanup() {
  if (!api.browsingData?.remove) return;

  const { staleDataCleanup = DEFAULT_STALE_DATA_CLEANUP, siteActivity = {} } = await storageGet([
    "staleDataCleanup",
    "siteActivity",
  ]);

  const config = normalizeCleanupConfig(staleDataCleanup);
  if (!config.enabled) return;

  const cutoff = Date.now() - Number(config.retentionDays || 30) * 24 * 60 * 60 * 1000;
  const updatedActivity = { ...siteActivity };

  for (const [origin, lastEngagedAt] of Object.entries(siteActivity)) {
    if (Number(lastEngagedAt || 0) > cutoff) continue;

    let hostname = null;
    try {
      hostname = new URL(origin).hostname;
    } catch {
      delete updatedActivity[origin];
      continue;
    }

    await api.browsingData.remove(
      { hostnames: [hostname], since: 0 },
      {
        cache: true,
        cookies: true,
        indexedDB: true,
        localStorage: true,
        serviceWorkers: true,
      }
    );

    delete updatedActivity[origin];
  }

  await storageSet({ siteActivity: updatedActivity, staleDataCleanup: config });
}

async function runMaintenance() {
  await ensureContainerDefaults();
  await runContainerAutomation();
  await runPeriodicReload();
  await runScheduledVisits();
  await runStaleDataCleanup();
}

async function trackSiteEngagement(url) {
  const origin = getOrigin(url);
  if (!origin) return;

  const { siteActivity = {} } = await storageGet("siteActivity");
  siteActivity[origin] = Date.now();
  await storageSet({ siteActivity });
}

async function saveUrl(url) {
  const { bookmarkFolderId } = await storageGet("bookmarkFolderId");
  if (!bookmarkFolderId) return;

  if (api.bookmarks.create.length <= 1) {
    await api.bookmarks.create({ parentId: bookmarkFolderId, title: url, url });
  } else {
    await callbackToPromise(api.bookmarks.create, api.bookmarks, { parentId: bookmarkFolderId, title: url, url });
  }
}

api.runtime.onInstalled.addListener(() => {
  runMaintenance().catch(console.error);
  api.alarms?.create("container-maintenance", { periodInMinutes: 1 });
});

api.runtime.onStartup?.addListener(() => {
  runMaintenance().catch(console.error);
});

api.alarms?.onAlarm.addListener((alarm) => {
  if (alarm.name === "container-maintenance") runMaintenance().catch(console.error);
});

api.tabs.onActivated?.addListener(async ({ tabId }) => {
  try {
    const tabs = await getTabs({ active: true, currentWindow: true });
    const activeTab = tabs.find((tab) => tab.id === tabId);
    if (activeTab?.url) await trackSiteEngagement(activeTab.url);
  } catch (error) {
    console.error(error);
  }
});

api.tabs.onUpdated?.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.active && tab.url) {
    trackSiteEngagement(tab.url).catch(console.error);
  }
});

api.tabs.onRemoved?.addListener((tabId) => {
  delete tabReloadHistory[tabId];
});

api.runtime.onMessage.addListener((request) => {
  if (request.action === "saveUrl") {
    saveUrl(request.url).catch(console.error);
  }

  if (request.action === "runMaintenanceNow") {
    runMaintenance().catch(console.error);
  }
});
