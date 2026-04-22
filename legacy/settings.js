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

let containers = [];

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

async function getBookmarkTree() {
  if (api.bookmarks.getTree.length === 0) return api.bookmarks.getTree();
  return callbackToPromise(api.bookmarks.getTree, api.bookmarks);
}

async function queryContainers() {
  if (!api.contextualIdentities?.query) return [];
  if (api.contextualIdentities.query.length <= 1) return api.contextualIdentities.query({});
  return callbackToPromise(api.contextualIdentities.query, api.contextualIdentities, {});
}

function normalizeConfig(raw) {
  return { ...DEFAULT_CONTAINER_CONFIG, ...(raw || {}) };
}

function appendFolderOptions(node, folderSelect, depth = 0) {
  if (!node.children) return;
  for (const child of node.children) {
    if (child.url) continue;
    const option = document.createElement("option");
    option.value = child.id;
    option.textContent = `${"—".repeat(depth)} ${child.title || "(untitled folder)"}`.trim();
    folderSelect.appendChild(option);
    appendFolderOptions(child, folderSelect, depth + 1);
  }
}

async function populateFolderSelect() {
  const folderSelect = document.getElementById("folderSelect");
  folderSelect.innerHTML = "";
  const tree = await getBookmarkTree();
  for (const rootNode of tree) appendFolderOptions(rootNode, folderSelect);

  const { bookmarkFolderId } = await storageGet("bookmarkFolderId");
  if (bookmarkFolderId) folderSelect.value = bookmarkFolderId;

  folderSelect.addEventListener("change", async (event) => {
    await storageSet({ bookmarkFolderId: event.target.value });
  });
}

function createCheckbox(value, onChange) {
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = Boolean(value);
  input.addEventListener("change", onChange);
  return input;
}

function createNumber(value, min, onChange) {
  const input = document.createElement("input");
  input.type = "number";
  input.min = String(min);
  input.value = String(value);
  input.addEventListener("change", onChange);
  return input;
}

async function renderContainerSettings() {
  const { containerSettings = {} } = await storageGet("containerSettings");
  const tableBody = document.getElementById("containerTableBody");
  tableBody.innerHTML = "";

  for (const container of containers) {
    const cookieStoreId = container.cookieStoreId;
    const config = normalizeConfig(containerSettings[cookieStoreId]);

    const row = document.createElement("tr");
    const cells = Array.from({ length: 6 }, () => document.createElement("td"));

    cells[0].textContent = container.name;
    cells[1].appendChild(createCheckbox(config.enabled, async (event) => {
      config.enabled = event.target.checked;
      containerSettings[cookieStoreId] = config;
      await storageSet({ containerSettings });
    }));

    cells[2].appendChild(createNumber(config.unloadMinutes, 1, async (event) => {
      config.unloadMinutes = Math.max(1, Number(event.target.value || 1));
      event.target.value = String(config.unloadMinutes);
      containerSettings[cookieStoreId] = config;
      await storageSet({ containerSettings });
    }));

    cells[3].appendChild(createCheckbox(config.neverUnload, async (event) => {
      config.neverUnload = event.target.checked;
      containerSettings[cookieStoreId] = config;
      await storageSet({ containerSettings });
    }));

    cells[4].appendChild(createNumber(config.periodicReloadMinutes, 0, async (event) => {
      config.periodicReloadMinutes = Math.max(0, Number(event.target.value || 0));
      event.target.value = String(config.periodicReloadMinutes);
      containerSettings[cookieStoreId] = config;
      await storageSet({ containerSettings });
    }));

    const cleanupBox = document.createElement("div");
    cleanupBox.className = "checkbox-group";
    const clearCacheLabel = document.createElement("label");
    clearCacheLabel.textContent = "Cache ";
    clearCacheLabel.appendChild(createCheckbox(config.clearCacheOnReload, async (event) => {
      config.clearCacheOnReload = event.target.checked;
      containerSettings[cookieStoreId] = config;
      await storageSet({ containerSettings });
    }));

    const clearCookiesLabel = document.createElement("label");
    clearCookiesLabel.textContent = "Cookies ";
    clearCookiesLabel.appendChild(createCheckbox(config.clearCookiesOnReload, async (event) => {
      config.clearCookiesOnReload = event.target.checked;
      containerSettings[cookieStoreId] = config;
      await storageSet({ containerSettings });
    }));

    cleanupBox.append(clearCacheLabel, clearCookiesLabel);
    cells[5].appendChild(cleanupBox);

    row.append(...cells);
    tableBody.appendChild(row);

    containerSettings[cookieStoreId] = config;
  }

  await storageSet({ containerSettings });
}

function renderRuleContainerOptions(select) {
  select.innerHTML = "";
  const noContainer = document.createElement("option");
  noContainer.value = "";
  noContainer.textContent = "No container";
  select.appendChild(noContainer);

  for (const container of containers) {
    const option = document.createElement("option");
    option.value = container.cookieStoreId;
    option.textContent = container.name;
    select.appendChild(option);
  }
}

function formatTimestamp(value) {
  return value ? new Date(value).toLocaleString() : "Never";
}

async function renderVisitRules() {
  const body = document.getElementById("visitRulesBody");
  const { scheduledVisitRules = [] } = await storageGet("scheduledVisitRules");
  body.innerHTML = "";

  for (const rule of scheduledVisitRules) {
    const row = document.createElement("tr");

    const enabledCell = document.createElement("td");
    enabledCell.appendChild(createCheckbox(rule.enabled, async (event) => {
      rule.enabled = event.target.checked;
      await storageSet({ scheduledVisitRules });
    }));

    const urlCell = document.createElement("td");
    urlCell.textContent = rule.url;

    const intervalCell = document.createElement("td");
    intervalCell.appendChild(createNumber(rule.intervalMinutes, 1, async (event) => {
      rule.intervalMinutes = Math.max(1, Number(event.target.value || 1));
      event.target.value = String(rule.intervalMinutes);
      await storageSet({ scheduledVisitRules });
    }));

    const containerCell = document.createElement("td");
    containerCell.textContent = containers.find((c) => c.cookieStoreId === rule.cookieStoreId)?.name || "No container";

    const lastVisitCell = document.createElement("td");
    lastVisitCell.textContent = formatTimestamp(rule.lastVisitedAt);

    const actionCell = document.createElement("td");
    const removeButton = document.createElement("button");
    removeButton.textContent = "Delete";
    removeButton.addEventListener("click", async () => {
      const nextRules = scheduledVisitRules.filter((entry) => entry.id !== rule.id);
      await storageSet({ scheduledVisitRules: nextRules });
      await renderVisitRules();
    });
    actionCell.appendChild(removeButton);

    row.append(enabledCell, urlCell, intervalCell, containerCell, lastVisitCell, actionCell);
    body.appendChild(row);
  }
}

async function wireRuleAddForm() {
  const containerSelect = document.getElementById("ruleContainer");
  renderRuleContainerOptions(containerSelect);

  document.getElementById("addRuleButton").addEventListener("click", async () => {
    const urlInput = document.getElementById("ruleUrl");
    const intervalInput = document.getElementById("ruleInterval");
    const backgroundInput = document.getElementById("ruleBackground");

    const url = urlInput.value.trim();
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      alert("Rule URL must start with http:// or https://");
      return;
    }

    const { scheduledVisitRules = [] } = await storageGet("scheduledVisitRules");
    scheduledVisitRules.push({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      url,
      intervalMinutes: Math.max(1, Number(intervalInput.value || 60)),
      cookieStoreId: containerSelect.value || null,
      openInBackground: backgroundInput.checked,
      enabled: true,
      lastVisitedAt: 0,
    });

    await storageSet({ scheduledVisitRules });
    urlInput.value = "";
    intervalInput.value = "60";
    await renderVisitRules();
  });
}

async function initCleanupSettings() {
  const enabledInput = document.getElementById("cleanupEnabled");
  const retentionInput = document.getElementById("cleanupRetentionDays");

  const { staleDataCleanup = DEFAULT_STALE_DATA_CLEANUP } = await storageGet("staleDataCleanup");
  const config = { ...DEFAULT_STALE_DATA_CLEANUP, ...staleDataCleanup };

  enabledInput.checked = config.enabled;
  retentionInput.value = String(config.retentionDays);

  async function save() {
    await storageSet({
      staleDataCleanup: {
        enabled: enabledInput.checked,
        retentionDays: Number(retentionInput.value),
      },
    });
  }

  enabledInput.addEventListener("change", save);
  retentionInput.addEventListener("change", save);
  document.getElementById("runCleanupNow").addEventListener("click", async () => {
    await api.runtime.sendMessage({ action: "runMaintenanceNow" });
  });
}

async function init() {
  containers = await queryContainers();
  await populateFolderSelect();
  await renderContainerSettings();
  await wireRuleAddForm();
  await renderVisitRules();
  await initCleanupSettings();
}

init().catch(console.error);
