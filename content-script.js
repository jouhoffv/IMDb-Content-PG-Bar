(async function init() {
  const BAR_ID = "imdb-content-warning-bar";
  const SESSION_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const CATEGORY_PATTERNS = {
    nudity: /sex\s*(?:&|and)\s*nudity(?:\s*:)?\s*(none|mild|moderate|severe)/i,
    violence: /violence\s*(?:&|and)\s*gore(?:\s*:)?\s*(none|mild|moderate|severe)/i,
    profanity: /profanity(?:\s*:)?\s*(none|mild|moderate|severe)/i,
    alcohol: /alcohol,\s*drugs\s*(?:&|and)\s*smoking(?:\s*:)?\s*(none|mild|moderate|severe)/i,
    frightening: /frightening\s*(?:&|and)\s*intense\s*scenes(?:\s*:)?\s*(none|mild|moderate|severe)/i
  };
  const SEVERITY_META = {
    none: { rank: 0, color: "#2ea043", label: "green" },
    mild: { rank: 1, color: "#2ea043", label: "green" },
    moderate: { rank: 2, color: "#e0a100", label: "yellow" },
    severe: { rank: 3, color: "#cf222e", label: "red" }
  };
  const KEYWORD_PATTERNS = {
    nudity: /\b(sex\s*&\s*nudity|sexual content|sexual scenes|nudity|sex)\b/i,
    violence: /\b(violence\s*&\s*gore|violence|gore)\b/i,
    profanity: /\b(profanity|language|cursing)\b/i,
    alcohol: /\b(alcohol|drugs|smoking)\b/i,
    frightening: /\b(frightening|intense scenes)\b/i
  };

  const settingsPromise = getSettings();
  logDebug("init", {
    url: window.location.href,
    readyState: document.readyState
  });

  let currentSettings = await settingsPromise;
  let observer = null;
  let refreshTimer = null;
  let lastEvaluation = {
    titleId: extractTitleId(window.location.pathname),
    shouldShow: false,
    indicatorColor: null,
    ratings: {},
    ratingSources: {}
  };

  browser.runtime.onMessage.addListener((message) => {
    if (message?.type === "settings-updated") {
      currentSettings = message.settings;
      scheduleRefresh();
    }

    if (message?.type === "get-page-state") {
      return Promise.resolve({
        ...lastEvaluation,
        url: window.location.href
      });
    }
  });

  ensureBar();
  attachObserver();
  await refreshIndicator();

  function ensureBar() {
    if (document.getElementById(BAR_ID)) {
      return;
    }

    const bar = document.createElement("div");
    bar.id = BAR_ID;
    bar.setAttribute("aria-hidden", "true");
    Object.assign(bar.style, {
      position: "fixed",
      top: "0",
      left: "0",
      width: "100%",
      height: "4px",
      background: "#cf222e",
      zIndex: "2147483647",
      pointerEvents: "none",
      display: "none",
      boxShadow: "0 0 0 1px rgba(0, 0, 0, 0.08)"
    });
    document.documentElement.appendChild(bar);
    logDebug("bar-created");
  }

  function attachObserver() {
    if (observer) {
      observer.disconnect();
    }

    observer = new MutationObserver(() => {
      scheduleRefresh();
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });

    logDebug("observer-attached");

    window.addEventListener("popstate", scheduleRefresh);
    window.addEventListener("hashchange", scheduleRefresh);
  }

  function scheduleRefresh() {
    window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(() => {
      refreshIndicator().catch(() => {
        setBarVisible(false);
      });
    }, 350);
  }

  async function refreshIndicator() {
    logDebug("refresh-start", {
      enabled: currentSettings?.enabled,
      categories: currentSettings?.categories,
      useKeywordFallback: currentSettings?.useKeywordFallback,
      titleId: extractTitleId(window.location.pathname),
      adNodes: countAdNodes()
    });

    if (!currentSettings?.enabled) {
      setBarVisible(false);
      logDebug("refresh-disabled");
      return;
    }

    const activeCategories = Object.entries(currentSettings.categories || {})
      .filter(([, enabled]) => enabled)
      .map(([name]) => name);

    if (!activeCategories.length) {
      lastEvaluation = {
        titleId: extractTitleId(window.location.pathname),
        shouldShow: false,
        indicatorColor: null,
        ratings: {},
        ratingSources: {}
      };
      setBarVisible(false);
      logDebug("refresh-no-active-categories");
      return;
    }

    const titleId = extractTitleId(window.location.pathname);
    if (!titleId) {
      lastEvaluation = {
        titleId: null,
        shouldShow: false,
        indicatorColor: null,
        ratings: {},
        ratingSources: {}
      };
      setBarVisible(false);
      logDebug("refresh-no-title-id", {
        pathname: window.location.pathname
      });
      return;
    }

    const guideText = await loadGuideText(titleId);
    const ratings = extractRatings(guideText);
    const ratingSources = {};

    for (const category of Object.keys(ratings)) {
      ratingSources[category] = "imdb";
    }

    if (currentSettings?.useKeywordFallback) {
      for (const category of activeCategories) {
        if (!ratings[category] && keywordMatches(guideText, category)) {
          ratings[category] = "moderate";
          ratingSources[category] = "keyword";
        }
      }
    }

    const selectedRatings = activeCategories
      .map((category) => ({
        category,
        severity: ratings[category]
      }))
      .filter((item) => Boolean(item.severity));

    if (!selectedRatings.length) {
      lastEvaluation = {
        titleId,
        shouldShow: false,
        indicatorColor: null,
        ratings,
        ratingSources
      };
      setBarVisible(false);
      logDebug("refresh-no-ratings", {
        titleId,
        ratings,
        ratingSources
      });
      return;
    }

    const highest = selectedRatings.reduce((best, current) => {
      if (!best) {
        return current;
      }

      return SEVERITY_META[current.severity].rank > SEVERITY_META[best.severity].rank
        ? current
        : best;
    }, null);

    const shouldShow = true;
    lastEvaluation = {
      titleId,
      shouldShow,
      indicatorColor: highest ? SEVERITY_META[highest.severity].label : null,
      ratings,
      ratingSources
    };
    setBarVisible(shouldShow, highest ? SEVERITY_META[highest.severity].color : null);
    logDebug("refresh-complete", {
      titleId,
      shouldShow,
      indicatorColor: lastEvaluation.indicatorColor,
      ratings,
      ratingSources
    });
  }

  async function loadGuideText(titleId) {
    const url = `https://www.imdb.com/title/${titleId}/parentalguide/`;
    logDebug("guide-fetch-start", {
      titleId,
      url
    });
    const response = await fetch(url, {
      credentials: "same-origin"
    });

    if (!response.ok) {
      logDebug("guide-fetch-failed", {
        titleId,
        status: response.status
      });
      throw new Error(`Unable to fetch parental guide: ${response.status}`);
    }

    const html = await response.text();
    const challengeDetected =
      /verify that you'?re not a robot/i.test(html) ||
      /javascript is disabled/i.test(html);
    logDebug("guide-fetch-success", {
      titleId,
      status: response.status,
      htmlLength: html.length,
      challengeDetected
    });
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    return normalizeText(doc.body?.innerText || "");
  }

  function extractRatings(guideText) {
    const ratings = {};

    for (const [category, pattern] of Object.entries(CATEGORY_PATTERNS)) {
      const match = guideText.match(pattern);
      if (match?.[1]) {
        ratings[category] = match[1].toLowerCase();
      }
    }

    return ratings;
  }

  function keywordMatches(guideText, category) {
    const pattern = KEYWORD_PATTERNS[category];
    return pattern ? pattern.test(guideText) : false;
  }

  function setBarVisible(visible, color) {
    const bar = document.getElementById(BAR_ID);
    if (bar) {
      if (color) {
        bar.style.background = color;
      }
      bar.style.setProperty("display", visible ? "block" : "none", "important");
      logDebug("bar-visibility", {
        visible,
        color: color || null
      });
    }
  }

  function extractTitleId(pathname) {
    const match = pathname.match(/\/title\/(tt\d+)\b/i);
    return match ? match[1] : null;
  }

  function normalizeText(text) {
    return text.replace(/\s+/g, " ").trim().toLowerCase();
  }

  async function getSettings() {
    try {
      const settings = await browser.runtime.sendMessage({ type: "get-settings" });
      logDebug("settings-loaded", settings);
      return settings;
    } catch (error) {
      logDebug("settings-fallback", {
        error: String(error)
      });
      return {
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
    }
  }

  function countAdNodes() {
    return document.querySelectorAll(
      '[class*="inline20"], [class*="responsive_wrapper"], [data-testid*="inline20"], [data-testid*="responsive-wrapper"], [id*="inline20"], .ipc-ad-slot, .advertisement, [aria-label="advertisement"]'
    ).length;
  }

  function logDebug(step, details = {}) {
    try {
      browser.runtime.sendMessage({
        type: "append-debug-log",
        entry: {
          sessionId: SESSION_ID,
          step,
          details
        }
      });
    } catch (error) {
      // Ignore logging failures.
    }
  }
})();
