(async function init() {
  const BAR_ID = "imdb-content-warning-bar";
  const TITLE_CACHE_KEY = "titleRatingCache";
  const MAX_CACHED_TITLES = 300;
  const LOGO_STYLE_ID = "imdb-logo-glow-style";
  const guideTextCache = new Map();
  const LOGO_GLOWS = {
    green: "0 0 0 1px rgba(46, 160, 67, 0.24), 0 0 14px rgba(46, 160, 67, 0.5), 0 0 28px rgba(46, 160, 67, 0.28)",
    yellow: "0 0 0 1px rgba(224, 161, 0, 0.26), 0 0 14px rgba(224, 161, 0, 0.56), 0 0 28px rgba(224, 161, 0, 0.3)",
    red: "0 0 0 1px rgba(207, 34, 46, 0.3), 0 0 14px rgba(207, 34, 46, 0.62), 0 0 28px rgba(207, 34, 46, 0.34)"
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
  removeLegacyLogoArtifacts();
  ensureLogoGlowStyles();
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
    if (!currentSettings?.enabled) {
      setBarVisible(false);
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
      return;
    }

    const cachedRatings = await getCachedRatings(titleId);
    if (cachedRatings) {
      const cachedEvaluation = buildEvaluation(titleId, activeCategories, cachedRatings.ratings, cachedRatings.ratingSources);
      if (cachedEvaluation) {
        applyEvaluation(cachedEvaluation, true);
      }
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
      return;
    }

    applyEvaluation(evaluation, false);
  }

  async function loadGuideText(titleId) {
    const cached = guideTextCache.get(titleId);
    if (cached?.text) {
      return cached.text;
    }

    if (cached?.promise) {
      return cached.promise;
    }

    const url = `https://www.imdb.com/title/${titleId}/parentalguide/`;
    const request = (async () => {
      const response = await fetch(url, {
        credentials: "same-origin"
      });

      if (!response.ok) {
        throw new Error(`Unable to fetch parental guide: ${response.status}`);
      }

      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      const text = normalizeText(doc.body?.innerText || "");
      guideTextCache.set(titleId, { text });
      return text;
    })().catch((error) => {
      guideTextCache.delete(titleId);
      throw error;
    });

    guideTextCache.set(titleId, { promise: request });
    return request;
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

      updateSiteLogo(visible && color ? colorToLogoKey(color) : null);
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

  function ensureLogoGlowStyles() {
    let style = document.getElementById(LOGO_STYLE_ID);
    if (!style) {
      style = document.createElement("style");
      style.id = LOGO_STYLE_ID;
      (document.head || document.documentElement).appendChild(style);
    }

    style.textContent = `
      #home_img_holder {
        --imdb-logo-glow: none;
        position: relative !important;
        border-radius: 6px !important;
        background-image: none !important;
        filter: none !important;
      }

      #home_img_holder,
      #home_img_holder a {
        transition: box-shadow 220ms ease !important;
      }

      #home_img_holder #home_img,
      #home_img_holder img,
      #home_img_holder svg,
      #home_img_holder picture {
        filter: none !important;
        opacity: 1 !important;
        transition: none !important;
        position: relative !important;
        z-index: 1 !important;
      }

      #home_img_holder::after {
        content: "" !important;
        position: absolute !important;
        inset: -3px !important;
        border-radius: 8px !important;
        box-shadow: var(--imdb-logo-glow) !important;
        opacity: 0 !important;
        pointer-events: none !important;
        animation: imdb-logo-pulse 1.8s ease-in-out infinite !important;
        transition: opacity 180ms ease, box-shadow 220ms ease !important;
        z-index: 0 !important;
      }

      #home_img_holder[data-imdb-logo-glow="on"]::after {
        opacity: 1 !important;
      }

      @keyframes imdb-logo-pulse {
        0%, 100% {
          transform: scale(1);
          filter: brightness(1);
        }
        50% {
          transform: scale(1.02);
          filter: brightness(1.06);
        }
      }
    `;
  }

  function removeLegacyLogoArtifacts() {
    const legacyStyle = document.getElementById("imdb-logo-color-style");
    if (legacyStyle) {
      legacyStyle.remove();
    }

    const oldReplacementStyle = document.getElementById("imdb-logo-replacement-style");
    if (oldReplacementStyle) {
      oldReplacementStyle.remove();
    }

    const holder = document.getElementById("home_img_holder");
    if (!holder) {
      return;
    }

    holder.style.removeProperty("--imdb-custom-logo-url");
    holder.style.removeProperty("--imdb-logo-filter");
    holder.style.removeProperty("background-image");
    holder.style.removeProperty("filter");
    holder.removeAttribute("data-imdb-logo-glow");

    holder.querySelectorAll("#home_img, img, svg, picture").forEach((node) => {
      node.style.removeProperty("filter");
      node.style.removeProperty("opacity");
    });
  }

  function updateSiteLogo(colorKey) {
    const holder = document.getElementById("home_img_holder");
    if (!holder) {
      return;
    }

    if (!colorKey || !LOGO_GLOWS[colorKey]) {
      holder.style.setProperty("--imdb-logo-glow", "none");
      holder.removeAttribute("data-imdb-logo-glow");
      return;
    }

    holder.style.setProperty("--imdb-logo-glow", LOGO_GLOWS[colorKey]);
    holder.setAttribute("data-imdb-logo-glow", "on");
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
      // Ignore cache write failures.
    }
  }

  async function getSettings() {
    try {
      return await browser.runtime.sendMessage({ type: "get-settings" });
    } catch (error) {
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
})();
