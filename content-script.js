(async function init() {
  const BAR_ID = "imdb-content-warning-bar";
  const SESSION_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const TITLE_CACHE_KEY = "titleRatingCache";
  const MAX_CACHED_TITLES = 300;
  const LOGO_STYLE_ID = "imdb-logo-replacement-style";
  const LOGO_URLS = {
    green: browser.runtime.getURL("assets/logos/Green.svg"),
    yellow: browser.runtime.getURL("assets/logos/Yellow.svg"),
    red: browser.runtime.getURL("assets/logos/Red.svg")
  };
  const CATEGORY_ALIASES = {
    nudity: [
      "sex & nudity",
      "sex and nudity",
      "sex und nacktheit",
      "sexe et nudité",
      "sexo y desnudez",
      "sesso e nudità",
      "sexo e nudez",
      "seks en naaktheid",
      "seks i nagość",
      "sex och nakenhet",
      "sex og nøgenhed",
      "sex og nakenhet",
      "seksi ja alastomuus",
      "sex a nahota",
      "sex și nuditate",
      "szex és meztelenség"
    ],
    violence: [
      "violence & gore",
      "violence and gore",
      "gewalt und blut",
      "violence et scènes difficiles",
      "violencia y gore",
      "violenza e sangue",
      "violência e gore",
      "geweld en gore",
      "przemoc i drastyczne sceny",
      "våld och blod",
      "vold og blod",
      "väkivalta ja veri",
      "násilí a krev",
      "violență și scene sângeroase",
      "erőszak és vér"
    ],
    profanity: [
      "profanity",
      "vulgäre ausdrücke",
      "vulgare ausdrucke",
      "grossièretés",
      "palabrotas",
      "turpiloquio",
      "linguagem imprópria",
      "grof taalgebruik",
      "wulgarny język",
      "svordomar",
      "bandeord",
      "kirosanat",
      "vulgarity",
      "vulgarități",
      "trágár beszéd"
    ],
    alcohol: [
      "alcohol, drugs & smoking",
      "alcohol, drugs and smoking",
      "alkohol, drogen und rauchen",
      "alcool, drogues et tabac",
      "alcohol, drogas y tabaco",
      "alcol, droghe e fumo",
      "álcool, drogas e tabaco",
      "alcohol, drugs en roken",
      "alkohol, narkotyki i palenie",
      "alkohol, droger och rökning",
      "alkohol, stoffer og rygning",
      "alkoholi, huumeet ja tupakointi",
      "alkohol, drogy a kouření",
      "alcool, droguri și fumat",
      "alkohol, drogok és dohányzás"
    ],
    frightening: [
      "frightening & intense scenes",
      "frightening and intense scenes",
      "erschreckende und heftige szenen",
      "scènes effrayantes et intenses",
      "escenas aterradoras e intensas",
      "scene intense e spaventose",
      "cenas assustadoras e intensas",
      "enge of intense scènes",
      "sceny przerażające i intensywne",
      "skrämmande och intensiva scener",
      "skræmmende og intense scener",
      "skremmende og intense scener",
      "pelottavat ja intensiiviset kohtaukset",
      "děsivé a intenzivní scény",
      "scene înfricoșătoare și intense",
      "ijesztő és intenzív jelenetek"
    ]
  };
  const SEVERITY_ALIASES = {
    none: [
      "none",
      "keine",
      "aucune",
      "ninguno",
      "nessuno",
      "nenhum",
      "geen",
      "brak",
      "ingen",
      "intet",
      "ei mitään",
      "žádné",
      "niciuna",
      "nincs"
    ],
    mild: [
      "mild",
      "leicht",
      "léger",
      "leve",
      "ligero",
      "lieve",
      "légère",
      "lieve",
      "łagodne",
      "lindrig",
      "mildt",
      "lievä",
      "mírné",
      "ușoară",
      "enyhe"
    ],
    moderate: [
      "moderate",
      "moderat",
      "modérée",
      "moderado",
      "moderata",
      "moderado",
      "matig",
      "umiarkowane",
      "måttlig",
      "moderat",
      "kohtalainen",
      "střední",
      "moderată",
      "közepes"
    ],
    severe: [
      "severe",
      "stark",
      "sévère",
      "grave",
      "severo",
      "forte",
      "ernstig",
      "poważne",
      "stark",
      "alvorlig",
      "vakava",
      "závažné",
      "severă",
      "súlyos"
    ]
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
  ensureLogoReplacementStyles();
  updateSiteLogo("red");
  attachObserver();
  await refreshIndicator();

  function ensureBar() {
    let bar = document.getElementById(BAR_ID);
    if (bar) {
      return bar;
    }

    bar = document.createElement("div");
    bar.id = BAR_ID;
    bar.setAttribute("aria-hidden", "true");
    const parent = document.body || document.documentElement;
    parent.appendChild(bar);
    logDebug("bar-created", {
      parentTag: parent.tagName
    });
    return bar;
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

    const cachedRatings = await getCachedRatings(titleId);
    if (cachedRatings) {
      const cachedEvaluation = buildEvaluation(titleId, activeCategories, cachedRatings.ratings, cachedRatings.ratingSources);
      if (cachedEvaluation) {
        applyEvaluation(cachedEvaluation, true);
        logDebug("cache-hit", {
          titleId,
          indicatorColor: cachedEvaluation.indicatorColor,
          ratings: cachedEvaluation.ratings
        });
      } else {
        logDebug("cache-hit-no-visible-match", { titleId });
      }
    } else {
      logDebug("cache-miss", { titleId });
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

    const evaluation = buildEvaluation(titleId, activeCategories, ratings, ratingSources);
    await saveCachedRatings(titleId, ratings, ratingSources);

    if (!evaluation) {
      lastEvaluation = {
        titleId,
        shouldShow: false,
        indicatorColor: null,
        ratings,
        ratingSources
      };
      setBarVisible(false, null, false);
      logDebug("refresh-no-ratings", {
        titleId,
        ratings,
        ratingSources
      });
      return;
    }

    applyEvaluation(evaluation, false);
    logDebug("refresh-complete", {
      titleId: evaluation.titleId,
      shouldShow: evaluation.shouldShow,
      indicatorColor: evaluation.indicatorColor,
      ratings: evaluation.ratings,
      ratingSources: evaluation.ratingSources
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
    const severityPattern = Object.values(SEVERITY_ALIASES)
      .flat()
      .map((value) => escapeRegex(value))
      .join("|");

    for (const [category, aliases] of Object.entries(CATEGORY_ALIASES)) {
      for (const alias of aliases) {
        const pattern = new RegExp(`${escapeRegex(alias)}(?:\\s*:)?\\s*(${severityPattern})`, "i");
        const match = guideText.match(pattern);

        if (match?.[1]) {
          ratings[category] = normalizeSeverity(match[1]);
          break;
        }
      }
    }

    const orderedFallback = extractRatingsByOrder(guideText);
    for (const [category, severity] of Object.entries(orderedFallback)) {
      if (!ratings[category]) {
        ratings[category] = severity;
      }
    }

    return ratings;
  }

  function extractRatingsByOrder(guideText) {
    const labelsInOrder = [
      "nudity",
      "violence",
      "profanity",
      "alcohol",
      "frightening"
    ];
    const allSeverityAliases = Object.values(SEVERITY_ALIASES).flat();
    const severityPattern = allSeverityAliases.map((value) => escapeRegex(value)).join("|");
    const regex = new RegExp(`(${severityPattern})`, "gi");
    const matches = Array.from(guideText.matchAll(regex))
      .map((match) => normalizeSeverity(match[1]))
      .filter((value) => value in SEVERITY_META);

    if (matches.length < 5) {
      return {};
    }

    const ratings = {};
    for (let index = 0; index < labelsInOrder.length; index += 1) {
      ratings[labelsInOrder[index]] = matches[index];
    }
    return ratings;
  }

  function keywordMatches(guideText, category) {
    const pattern = KEYWORD_PATTERNS[category];
    return pattern ? pattern.test(guideText) : false;
  }

  function setBarVisible(visible, color, immediate) {
    const bar = ensureBar();
    if (bar) {
      if (color) {
        bar.style.setProperty("background", color, "important");
      }

      if (immediate) {
        bar.style.setProperty("transition", "none", "important");
      } else {
        bar.style.removeProperty("transition");
      }

      bar.style.setProperty("visibility", visible ? "visible" : "hidden", "important");
      bar.style.setProperty("opacity", visible ? "1" : "0", "important");

      if (immediate) {
        requestAnimationFrame(() => {
          bar.style.removeProperty("transition");
        });
      }

      if (visible && color) {
        updateSiteLogo(colorToLogoKey(color));
      }

      logDebug("bar-visibility", {
        visible,
        color: color || null,
        immediate: Boolean(immediate),
        connected: bar.isConnected
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

  function normalizeSeverity(rawSeverity) {
    const normalized = normalizeText(rawSeverity);

    for (const [severity, aliases] of Object.entries(SEVERITY_ALIASES)) {
      if (aliases.some((alias) => normalizeText(alias) === normalized)) {
        return severity;
      }
    }

    return normalized;
  }

  function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function buildEvaluation(titleId, activeCategories, ratings, ratingSources) {
    const selectedRatings = activeCategories
      .map((category) => ({
        category,
        severity: ratings[category]
      }))
      .filter((item) => Boolean(item.severity));

    if (!selectedRatings.length) {
      return null;
    }

    const highest = selectedRatings.reduce((best, current) => {
      if (!best) {
        return current;
      }

      return SEVERITY_META[current.severity].rank > SEVERITY_META[best.severity].rank
        ? current
        : best;
    }, null);

    return {
      titleId,
      shouldShow: true,
      indicatorColor: highest ? SEVERITY_META[highest.severity].label : null,
      ratings,
      ratingSources,
      color: highest ? SEVERITY_META[highest.severity].color : null
    };
  }

  function applyEvaluation(evaluation, immediate) {
    lastEvaluation = {
      titleId: evaluation.titleId,
      shouldShow: evaluation.shouldShow,
      indicatorColor: evaluation.indicatorColor,
      ratings: evaluation.ratings,
      ratingSources: evaluation.ratingSources
    };
    setBarVisible(evaluation.shouldShow, evaluation.color, immediate);
  }

  function ensureLogoReplacementStyles() {
    let style = document.getElementById(LOGO_STYLE_ID);
    if (!style) {
      style = document.createElement("style");
      style.id = LOGO_STYLE_ID;
      (document.head || document.documentElement).appendChild(style);
    }

    style.textContent = `
      #home_img_holder {
        position: relative !important;
        background-image: var(--imdb-custom-logo-url) !important;
        background-repeat: no-repeat !important;
        background-position: center !important;
        background-size: contain !important;
      }

      #home_img_holder #home_img,
      #home_img_holder img,
      #home_img_holder svg,
      #home_img_holder picture {
        opacity: 0 !important;
      }

      #home_img_holder .alt_logo {
        display: none !important;
      }
    `;
  }

  function updateSiteLogo(colorKey) {
    const logoKey = LOGO_URLS[colorKey] ? colorKey : "red";
    const holder = document.getElementById("home_img_holder");
    if (!holder) {
      logDebug("logo-holder-missing", {
        colorKey: logoKey
      });
      return;
    }

    holder.style.setProperty("--imdb-custom-logo-url", `url("${LOGO_URLS[logoKey]}")`);
    holder.style.setProperty("background-image", `url("${LOGO_URLS[logoKey]}")`, "important");
    logDebug("logo-updated", {
      colorKey: logoKey,
      url: LOGO_URLS[logoKey]
    });
  }

  function colorToLogoKey(color) {
    switch ((color || "").toLowerCase()) {
      case "#2ea043":
        return "green";
      case "#e0a100":
        return "yellow";
      case "#cf222e":
      default:
        return "red";
    }
  }

  async function getCachedRatings(titleId) {
    try {
      const stored = await browser.storage.local.get(TITLE_CACHE_KEY);
      const cache = stored[TITLE_CACHE_KEY] || {};
      return cache[titleId] || null;
    } catch (error) {
      logDebug("cache-read-failed", {
        titleId,
        error: String(error)
      });
      return null;
    }
  }

  async function saveCachedRatings(titleId, ratings, ratingSources) {
    try {
      const stored = await browser.storage.local.get(TITLE_CACHE_KEY);
      const cache = stored[TITLE_CACHE_KEY] || {};

      cache[titleId] = {
        ratings,
        ratingSources,
        updatedAt: Date.now()
      };

      if (Object.keys(cache).length > MAX_CACHED_TITLES) {
        const sortedEntries = Object.entries(cache).sort((a, b) => (a[1].updatedAt || 0) - (b[1].updatedAt || 0));
        delete cache[sortedEntries[0][0]];
      }

      await browser.storage.local.set({
        [TITLE_CACHE_KEY]: cache
      });
    } catch (error) {
      logDebug("cache-write-failed", {
        titleId,
        error: String(error)
      });
    }
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
