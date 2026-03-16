import {
  getActiveFilterCount,
  getActiveFilterChips,
  getCreatorExactCount,
  getCreatorShipPower,
  getShipPowerTier,
  getOrderedCreatorOptions,
  getAvailableCategories,
  hasMinimumFiltersForPreset
} from "./filters.js";
import { getFavoriteIds } from "./favorites.js";

/* ------------------------- UTIL ------------------------- */

function rarityClass(rarity) {
  if (rarity === "Comune") return "pill-comune";
  if (rarity === "Popolare") return "pill-non-comune";
  if (rarity === "Iconica") return "pill-epica";
  if (rarity === "Leggendaria") return "pill-leggendaria";
  return "";
}

function getCardRarityClass(rarity) {
  if (rarity === "Comune") return "rarity-comune";
  if (rarity === "Non Comune") return "rarity-non-comune";
  if (rarity === "Rara") return "rarity-rara";
  if (rarity === "Epica") return "rarity-epica";
  if (rarity === "Leggendaria") return "rarity-leggendaria";
  return "";
}

function getImageSourceClass(source = "") {
  const normalized = String(source).trim().toLowerCase();
  if (normalized === "real") return "source-real";
  if (normalized === "ai") return "source-ai";
  return "";
}

function getImageSourceLabel(source = "") {
  const normalized = String(source).trim().toLowerCase();
  if (normalized === "real") return "REAL";
  if (normalized === "ai") return "AI";
  return "";
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function truncateQuery(text = "", max = 12) {
  const clean = String(text).trim();
  if (clean.length <= max) return clean;
  return clean.slice(0, max).trimEnd() + "…";
}

function formatMonthYear(month = "", year = "") {
  const map = {
    Gennaio: "01",
    Febbraio: "02",
    Marzo: "03",
    Aprile: "04",
    Maggio: "05",
    Giugno: "06",
    Luglio: "07",
    Agosto: "08",
    Settembre: "09",
    Ottobre: "10",
    Novembre: "11",
    Dicembre: "12"
  };

  const mm = map[month] || "00";
  return `${mm}/${year}`;
}

function formatGeneration(gen = "") {
  return String(gen).replace(/^GEN\s*/i, "").trim();
}

function getCreatorShipInitials(creators = []) {
  if (!Array.isArray(creators) || creators.length < 2) return "";
  return creators
    .map((creator) => String(creator).trim().charAt(0).toUpperCase())
    .join("");
}

function uniq(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function getSectionByTitle(title = "") {
  const sections = Array.from(document.querySelectorAll(".section"));
  return sections.find((section) => {
    const label = section.querySelector(".section-title");
    return label?.textContent?.trim() === title;
  }) || null;
}

function getGenerationOptions(reactions = []) {
  const fromData = uniq(reactions.map((item) => item?.gen));
  const fallback = ["GEN 1", "GEN 2", "GEN 3", "GEN 3 HE", "GEN 4", "GEN 5"];
  const all = uniq([...fromData, ...fallback]);

  return all.sort((a, b) =>
    String(a).localeCompare(String(b), "it", { numeric: true })
  );
}

function getRarityOptions() {
  return ["Comune", "Non Comune", "Rara", "Epica", "Leggendaria"];
}

function getMonthOptions() {
  return [
    { value: "Gennaio", short: "GEN" },
    { value: "Febbraio", short: "FEB" },
    { value: "Marzo", short: "MAR" },
    { value: "Aprile", short: "APR" },
    { value: "Maggio", short: "MAG" },
    { value: "Giugno", short: "GIU" },
    { value: "Luglio", short: "LUG" },
    { value: "Agosto", short: "AGO" },
    { value: "Settembre", short: "SET" },
    { value: "Ottobre", short: "OTT" },
    { value: "Novembre", short: "NOV" },
    { value: "Dicembre", short: "DIC" }
  ];
}

function getYearRange() {
  return ["2020", "2021", "2022", "2023", "2024", "2025", "2026"];
}

function getSelectedYear(state, reactions = []) {
  if (Array.isArray(state.year) && state.year.length) {
    return String(state.year[0]);
  }

  const availableYears = uniq(reactions.map((item) => item?.year).filter(Boolean))
    .sort((a, b) => Number(b) - Number(a));

  return availableYears[0] || "2025";
}

/* ------------------------- DYNAMIC FILTER UI ------------------------- */

function ensureCategorySection() {
  let section = getSectionByTitle("Categoria");
  if (section) return section;

  const content = document.querySelector(".modal-content-scroll");
  const creatorSection = getSectionByTitle("Creator");
  if (!content) return null;

  section = document.createElement("div");
  section.className = "section";
  section.innerHTML = `
    <span class="section-title">Categoria</span>
    <div class="opt-carousel opt-carousel-categories"></div>
  `;

  if (creatorSection) {
    content.insertBefore(section, creatorSection);
  } else {
    content.prepend(section);
  }

  return section;
}

function ensureDateSplitSection() {
  let section = document.getElementById("dateSplitSection");
  if (section) return section;

  const content = document.querySelector(".modal-content-scroll");
  const monthSection = getSectionByTitle("Mese");
  const yearSection = getSectionByTitle("Anno");

  if (!content) return null;

  section = document.createElement("div");
  section.className = "section section-date-split";
  section.id = "dateSplitSection";
  section.innerHTML = `
    <div class="date-split-grid">
      <div class="date-col date-col-year">
        <span class="section-title">Anno</span>
        <div class="date-year-stepper" id="dateYearStepper"></div>
      </div>

      <div class="date-col date-col-month">
        <span class="section-title">Mese</span>
        <div class="date-month-grid" id="dateMonthGrid"></div>
      </div>
    </div>
  `;

  if (monthSection) {
    content.insertBefore(section, monthSection);
  } else if (yearSection) {
    content.insertBefore(section, yearSection);
  } else {
    content.appendChild(section);
  }

  return section;
}

function hideLegacyDateSections() {
  const yearSection = getSectionByTitle("Anno");
  const monthSection = getSectionByTitle("Mese");

  if (yearSection) yearSection.style.display = "none";
  if (monthSection) monthSection.style.display = "none";
}

function renderCarouselSection({
  sectionTitle,
  sectionClass = "",
  items = [],
  stateKey,
  state
}) {
  const section = sectionTitle === "Categoria"
    ? ensureCategorySection()
    : getSectionByTitle(sectionTitle);

  if (!section) return;

  let container = section.querySelector(".opt-carousel");
  if (!container) {
    const oldGrid = section.querySelector(".opt-grid");
    if (oldGrid) {
      oldGrid.className = `opt-carousel ${sectionClass}`.trim();
      container = oldGrid;
    }
  }

  if (!container) return;

  container.className = `opt-carousel ${sectionClass}`.trim();

  container.innerHTML = items.map((item) => {
    const value = typeof item === "string" ? item : item.value;
    const label = typeof item === "string" ? item : (item.label ?? item.value);
    const metric = typeof item === "string" ? "" : (item.metric ?? "");
    const active = Array.isArray(state[stateKey]) && state[stateKey].includes(value);

    return `
      <button
        class="opt-box opt-box-carousel ${active ? "active" : ""}"
        type="button"
        data-type="${escapeHtml(stateKey)}"
        data-value="${escapeHtml(value)}"
      >
        <span class="opt-box-label">${label}</span>
        ${metric ? `<span class="opt-box-meta">${escapeHtml(metric)}</span>` : ""}
      </button>
    `;
  }).join("");
}

function renderDateSplitSection(state, reactions = []) {
  const section = ensureDateSplitSection();
  if (!section) return;

  hideLegacyDateSections();

  const yearStepper = section.querySelector("#dateYearStepper");
  const monthGrid = section.querySelector("#dateMonthGrid");

  if (!yearStepper || !monthGrid) return;

  const yearRange = getYearRange();
  const selectedYear = getSelectedYear(state, reactions);
  const minYear = yearRange[0];
  const maxYear = yearRange[yearRange.length - 1];
  const canStepDown = Number(selectedYear) > Number(minYear);
  const canStepUp = Number(selectedYear) < Number(maxYear);

  yearStepper.innerHTML = `
    <button
      class="date-year-arrow ${canStepUp ? "" : "is-disabled"}"
      type="button"
      data-action="year-step-up"
      ${canStepUp ? "" : "disabled"}
      aria-label="Anno successivo"
    >
      ▲
    </button>

    <button
      class="opt-box date-year-display ${Array.isArray(state.year) && state.year.length ? "active" : ""}"
      type="button"
      data-type="year"
      data-value="${escapeHtml(selectedYear)}"
    >
      <span class="date-year-caption">Anno</span>
      <span class="date-year-value">${escapeHtml(selectedYear)}</span>
    </button>

    <button
      class="date-year-arrow ${canStepDown ? "" : "is-disabled"}"
      type="button"
      data-action="year-step-down"
      ${canStepDown ? "" : "disabled"}
      aria-label="Anno precedente"
    >
      ▼
    </button>
  `;

  monthGrid.innerHTML = getMonthOptions().map((month) => {
    const active = Array.isArray(state.month) && state.month.includes(month.value);

    return `
      <button
        class="opt-box date-month-mini ${active ? "active" : ""}"
        type="button"
        data-type="month"
        data-value="${escapeHtml(month.value)}"
      >
        ${escapeHtml(month.short)}
      </button>
    `;
  }).join("");
}

function renderDynamicFilterCarousels(state, reactions = []) {
  const creatorFallbacks = ["Min", "Lussu", "Fez", "Tommi", "Frec", "Lipu", "__others__"];
  const creatorOptions = getOrderedCreatorOptions(reactions, creatorFallbacks).map((item) => ({
    value: item.value,
    label: item.label === "__others__" ? "Altri creator" : item.label,
    metric: item.value === "__others__" ? "" : `${item.percent}%`
  }));

  renderCarouselSection({
    sectionTitle: "Creator",
    sectionClass: "opt-carousel-creators",
    items: creatorOptions,
    stateKey: "creator",
    state
  });

  const categoryOptions = getAvailableCategories(reactions).map((item) => ({
    value: item.value,
    label: item.value,
    metric: String(item.count)
  }));

  renderCarouselSection({
    sectionTitle: "Categoria",
    sectionClass: "opt-carousel-categories",
    items: categoryOptions,
    stateKey: "categories",
    state
  });

  const generationOptions = getGenerationOptions(reactions).map((value) => ({
    value,
    label: value,
    metric: ""
  }));

  renderCarouselSection({
    sectionTitle: "Generazione",
    sectionClass: "opt-carousel-generations",
    items: generationOptions,
    stateKey: "gen",
    state
  });

  const rarityOptions = getRarityOptions().map((value) => ({
    value,
    label: value,
    metric: ""
  }));

  renderCarouselSection({
    sectionTitle: "Rarità",
    sectionClass: "opt-carousel-rarity",
    items: rarityOptions,
    stateKey: "rarity",
    state
  });

  renderDateSplitSection(state, reactions);
}

/* ------------------------- IMAGE PRELOAD ------------------------- */

function preloadImage(src = "") {
  if (!src) return;
  const img = new Image();
  img.decoding = "async";
  img.src = src;
}

/* ------------------------- IMAGE FADE ------------------------- */

function bindImageFadeIn(grid) {
  grid.querySelectorAll(".img-slot img").forEach((img) => {
    const slot = img.closest(".img-slot");
    if (!slot) return;

    if (img.complete) {
      slot.classList.add("is-loaded");
      return;
    }

    img.addEventListener("load", () => {
      slot.classList.add("is-loaded");
    }, { once: true });

    img.addEventListener("error", () => {
      slot.classList.add("is-loaded");
    }, { once: true });
  });
}

/* ------------------------- PRELOAD NEXT IMAGES ------------------------- */

function bindSmartImagePreload(grid) {
  const cards = Array.from(grid.querySelectorAll(".card"));
  if (!cards.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;

      const index = cards.indexOf(entry.target);
      if (index === -1) return;

      const nextCards = [cards[index + 1], cards[index + 2]];

      nextCards.forEach((card) => {
        if (!card) return;

        const img = card.querySelector(".img-slot img");
        if (!img?.src) return;

        preloadImage(img.src);
      });
    });
  }, {
    root: null,
    rootMargin: "20px 0px",
    threshold: 0.01
  });

  cards.forEach((card) => observer.observe(card));
}

/* ------------------------- CARD FADE ON VIEWPORT ------------------------- */

function bindCardViewportReveal(grid) {
  const cards = grid.querySelectorAll(".card:not(.is-visible)");
  if (!cards.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;

      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    });
  }, {
    root: null,
    rootMargin: "0px 0px -8% 0px",
    threshold: 0.12
  });

  cards.forEach((card) => observer.observe(card));
}

/* ------------------------- SEARCH TICKER DEFAULT ------------------------- */

export function renderSearchTickerDefault(reactions, state) {
  const ticker = document.getElementById("searchTicker");
  const tickerCount = document.getElementById("searchTickerCount");
  const track = document.getElementById("searchTickerTrack");

  if (!ticker || !tickerCount || !track) return;

  if (state.semanticSearchEnabled) {
    ticker.classList.remove("visible");
    ticker.setAttribute("aria-hidden", "true");
    tickerCount.textContent = "0";
    track.innerHTML = "";
    track.style.animation = "";
    track.style.animationDuration = "";
    track.classList.remove("is-static");
    return;
  }

  const total = Array.isArray(reactions) ? reactions.length : 0;
  tickerCount.textContent = String(total);

  track.innerHTML = `
    <span class="search-ticker-single">
      ${total === 1 ? "Reaction disponibile" : "Reaction disponibili"}
    </span>
  `;

  track.classList.add("is-static");
  track.style.animation = "none";
  track.style.animationDuration = "";

  ticker.classList.add("visible");
  ticker.setAttribute("aria-hidden", "false");
}

/* ------------------------- SEARCH TICKER ------------------------- */

export function renderSearchTicker(reactions, state) {
  const ticker = document.getElementById("searchTicker");
  const tickerCount = document.getElementById("searchTickerCount");
  const track = document.getElementById("searchTickerTrack");

  if (!ticker || !tickerCount || !track) return;

  const query = String(state?.name || "").trim();

  const canShow =
    !state.semanticSearchEnabled &&
    !!query &&
    Array.isArray(reactions);

  if (!canShow) {
    ticker.classList.remove("visible");
    ticker.setAttribute("aria-hidden", "true");
    tickerCount.textContent = "0";
    track.innerHTML = "";
    track.style.animation = "";
    track.style.animationDuration = "";
    track.classList.remove("is-static");
    return;
  }

  const names = reactions
    .map((item) => item?.name?.trim())
    .filter(Boolean);

  tickerCount.textContent = String(names.length);

  if (!names.length) {
    const safeQuery = truncateQuery(query);

    track.innerHTML = `
      <span class="search-ticker-empty">
        Nessuna reaction trovata per "${escapeHtml(safeQuery)}"
      </span>
    `;

    track.style.animation = "none";
    track.style.animationDuration = "";
    track.classList.add("is-static");

    ticker.classList.add("visible");
    ticker.setAttribute("aria-hidden", "false");
    return;
  }

  if (names.length === 1) {
    track.innerHTML = `
      <span class="search-ticker-single">
        ${escapeHtml(names[0])}
      </span>
    `;

    track.style.animation = "none";
    track.style.animationDuration = "";
    track.classList.add("is-static");

    ticker.classList.add("visible");
    ticker.setAttribute("aria-hidden", "false");
    return;
  }

  const limitedNames = names.slice(0, 24);

  const items = limitedNames
    .map((name) => `<span class="search-ticker-item">${escapeHtml(name)}</span>`)
    .join("");

  track.innerHTML = items + items + items;

  const duration = Math.max(18, limitedNames.length * 2);

  track.classList.remove("is-static");
  track.style.animation = "";
  track.style.animationDuration = `${duration}s`;

  ticker.classList.add("visible");
  ticker.setAttribute("aria-hidden", "false");
}

/* ------------------------- TOP UI ------------------------- */

export function renderTopUI(state, reactions = [], handlers = {}) {
  const activeCount = getActiveFilterCount(state);
  const hasActive = activeCount > 0;
  const favoriteIds = getFavoriteIds();

  const tuningLabel = document.getElementById("tuningLabel");
  const filterCount = document.getElementById("filterCount");
  const preview = document.getElementById("activeFiltersPreview");
  const semanticToggleBtn = document.getElementById("semanticToggleBtn");
  const runBtn = document.getElementById("runSemanticSearchBtn");
  const searchActionRow = document.getElementById("searchActionRow");
  const searchLoader = document.getElementById("searchLoader");
  const searchInput = document.getElementById("searchInput");
  const searchShell = document.getElementById("searchShell");
  const favoritesToggleBtn = document.getElementById("favoritesToggleBtn");
  const favoritesCount = document.getElementById("favoritesCount");
  const paneMetaCount = document.getElementById("paneMetaCount");
  const paneActionsMeta = document.getElementById("paneActionsMeta");
  const paneHeader = document.querySelector(".pane-header");
  
  const resultsHeader = document.querySelector(".results-head");

  renderDynamicFilterCarousels(state, reactions);


renderPresetManager(state, handlers);
prepareSavePresetModal(handlers);



const titleWrap = paneHeader?.querySelector(".pane-title-wrap");
const hasActivePreset = !!state.activePresetId;
const canSavePreset = hasMinimumFiltersForPreset(state, 2);

if (titleWrap) {
  let presetOpenBtn = document.getElementById("openPresetManagerBtn");
  let presetSaveBtn = document.getElementById("openSavePresetBtnIcon");

  if (!presetOpenBtn) {
    presetOpenBtn = document.createElement("button");
    presetOpenBtn.type = "button";
    presetOpenBtn.id = "openPresetManagerBtn";
    presetOpenBtn.className = "secondary-btn-preset-open";
    presetOpenBtn.textContent = "Preset";
    titleWrap.appendChild(presetOpenBtn);
  }

  presetOpenBtn.classList.toggle("is-active", hasActivePreset);

  if (presetOpenBtn && handlers.onOpenPresetManager && !presetOpenBtn.dataset.bound) {
    presetOpenBtn.dataset.bound = "1";
    presetOpenBtn.addEventListener("click", handlers.onOpenPresetManager);
  }

  if (canSavePreset && !presetSaveBtn) {
    presetSaveBtn = document.createElement("button");
    presetSaveBtn.type = "button";
    presetSaveBtn.id = "openSavePresetBtnIcon";
    presetSaveBtn.className = "icon-preset-save-btn";
    presetSaveBtn.setAttribute("aria-label", "Salva preset");
    presetSaveBtn.setAttribute("title", "Salva preset");
    presetSaveBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
        <path d="M5 4.5h11l3 3V19a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19Z"/>
        <path d="M8 4.5v5h8v-5"/>
        <path d="M9 15h6"/>
      </svg>
    `;
    titleWrap.appendChild(presetSaveBtn);
  }

  if (!canSavePreset && presetSaveBtn) {
    presetSaveBtn.remove();
    presetSaveBtn = null;
  }

  if (presetSaveBtn && handlers.onOpenSavePreset && !presetSaveBtn.dataset.bound) {
    presetSaveBtn.dataset.bound = "1";
    presetSaveBtn.addEventListener("click", handlers.onOpenSavePreset);
  }
}





  const selectedCreators = Array.isArray(state.creator) ? state.creator : [];
  const exactCount = getCreatorExactCount(reactions, state);
  const displayExactCount = exactCount > 9 ? "9+" : String(exactCount);
  const shipPower = getCreatorShipPower(reactions, state);
  const shipTier = getShipPowerTier(shipPower);
  const initials = getCreatorShipInitials(selectedCreators);
  const canShowShip = selectedCreators.length >= 2;

  let shipHint = "";
  if (selectedCreators.length < 2) {
    shipHint = "Seleziona 2+ creator per attivare ShineShip";
  } else if (!state.creatorExactMode) {
    shipHint = "Tocca la ship per unirli";
  }

  if (paneMetaCount) {
    if (!canShowShip) {
      paneMetaCount.innerHTML = `
        <div class="ship-rx-wrap ship-rx-wrap-empty">
          <div class="ship-rx-hint visible">
            ${escapeHtml(shipHint)}
          </div>
        </div>
      `;
    } else {
      paneMetaCount.innerHTML = `
        <div class="ship-rx-wrap">
          <button
            type="button"
            id="creatorExactChip"
            class="ship-rx-box ${state.creatorExactMode ? "active" : ""}"
            aria-pressed="${String(!!state.creatorExactMode)}"
          >
            <div class="ship-rx-label">ShineShip </div>

            <div class="ship-rx-content">
              <span class="ship-rx-initials">${escapeHtml(initials)}</span>
              <span
                class="ship-rx-count-heart tier-${escapeHtml(shipTier)}"
                data-digits="${displayExactCount.length}"
              >
                ${escapeHtml(displayExactCount)}
              </span>
            </div>

            <div class="ship-rx-power">
              <span class="ship-rx-power-label">Power</span>
              <span class="ship-rx-power-value">${escapeHtml(String(shipPower))}%</span>
            </div>
          </button>

          <div class="ship-rx-hint ${shipHint ? "visible" : ""}">
            ${escapeHtml(shipHint)}
          </div>
        </div>
      `;
    }
  }
  
  
  

  if (paneActionsMeta) {
    paneActionsMeta.textContent =
      activeCount > 0
        ? `${activeCount} filtri attivi`
        : "Nessun filtro attivo";
  }



let presetOpenBtn = document.getElementById("openPresetManagerBtn");

if (paneHeader && !presetOpenBtn) {
  const titleWrap = paneHeader.querySelector(".pane-title-wrap");

  if (titleWrap) {
    presetOpenBtn = document.createElement("button");
    presetOpenBtn.type = "button";
    presetOpenBtn.id = "openPresetManagerBtn";
    presetOpenBtn.className = "secondary-btn secondary-btn-preset-open";
    presetOpenBtn.textContent = "Preset";
    titleWrap.appendChild(presetOpenBtn);
  }
}

if (presetOpenBtn && handlers.onOpenPresetManager && !presetOpenBtn.dataset.bound) {
  presetOpenBtn.dataset.bound = "1";
  presetOpenBtn.addEventListener("click", handlers.onOpenPresetManager);
}







  if (favoritesCount) {
    favoritesCount.textContent = String(favoriteIds.length);
    favoritesCount.classList.toggle("visible", favoriteIds.length > 0);
  }

  if (resultsHeader) {
    resultsHeader.classList.toggle("rx-mode", !!state.semanticSearchEnabled);
  }

  document.querySelectorAll(".opt-box").forEach((button) => {
    const type = button.dataset.type;
    const value = button.dataset.value;

    if (state[type]) {
      button.classList.toggle("active", state[type].includes(value));
    }
  });

  if (tuningLabel) tuningLabel.textContent = "RX Studio";
  
  
  if (filterCount) {
    filterCount.textContent = activeCount;
    filterCount.classList.toggle("visible", hasActive);
  }

  if (favoritesToggleBtn) {
    favoritesToggleBtn.classList.toggle("active-favorites", !!state.favoritesOnly);
  }

  if (searchShell) {
    searchShell.classList.toggle("semantic-on", !!state.semanticSearchEnabled);
  }

  if (semanticToggleBtn) {
    semanticToggleBtn.classList.toggle("active", !!state.semanticSearchEnabled);
    semanticToggleBtn.setAttribute("aria-pressed", String(!!state.semanticSearchEnabled));

    const toggleText = semanticToggleBtn.querySelector(".mode-toggle-text");
    if (toggleText) {
      toggleText.textContent = "RX Finder";
    }
  }

  if (searchInput) {
    searchInput.placeholder = state.semanticSearchEnabled
      ? "Cerca per descrizione..."
      : "Cerca per reaction...";
  }

  if (searchActionRow) {
    searchActionRow.classList.toggle("visible", !!state.semanticSearchEnabled);
  }

  if (runBtn) {
    runBtn.disabled = !state.name.trim() || !!state.isSemanticLoading;
  }

  if (searchLoader) {
    searchLoader.classList.toggle("visible", !!state.isSemanticLoading);
  }

  const chips = [
    ...getActiveFilterChips(state),
    ...(state.favoritesOnly ? ["Hotlist"] : [])
  ];

  if (preview) {
    preview.innerHTML = chips
      .map((chip) => `<span class="mini-chip">${escapeHtml(chip)}</span>`)
      .join("");
  }

  const creatorExactChip = document.getElementById("creatorExactChip");
  if (creatorExactChip && handlers.onCreatorExactToggle && !creatorExactChip.dataset.bound) {
    creatorExactChip.dataset.bound = "1";
    creatorExactChip.addEventListener("click", handlers.onCreatorExactToggle);
  }
}


function getRxStudioHost() {
  return document.querySelector("#tuningModal .modal-pane") || document.getElementById("tuningModal");
}



function ensurePresetManagerModal() {
  let overlay = document.getElementById("presetManagerOverlay");
  if (overlay) return overlay;

  const host = getRxStudioHost();
  if (!host) return null;

  overlay = document.createElement("div");
  overlay.id = "presetManagerOverlay";
  overlay.className = "preset-overlay preset-overlay-in-studio";
  overlay.setAttribute("aria-hidden", "true");

  overlay.innerHTML = `
    <div class="preset-modal-card">
      <div class="preset-modal-header">
        <div class="preset-modal-title-wrap">
          <div class="preset-modal-kicker">RX Studio</div>
          <h3 class="preset-modal-title">Preset</h3>
        </div>

        <button
          type="button"
          class="preset-modal-close"
          id="closePresetManagerBtn"
          aria-label="Chiudi"
        >✕</button>
      </div>

      <div class="preset-modal-body" id="presetManagerBody"></div>
    </div>
  `;

  host.appendChild(overlay);
  return overlay;
} 


function ensureSavePresetModal() {
  let overlay = document.getElementById("savePresetOverlay");
  if (overlay) return overlay;

  const host = getRxStudioHost();
  if (!host) return null;

  overlay = document.createElement("div");
  overlay.id = "savePresetOverlay";
  overlay.className = "preset-overlay preset-overlay-in-studio";
  overlay.setAttribute("aria-hidden", "true");

  overlay.innerHTML = `
    <div class="preset-modal-card preset-modal-card-small">
      <div class="preset-modal-header">
        <div class="preset-modal-title-wrap">
          <div class="preset-modal-kicker">RX Studio</div>
          <h3 class="preset-modal-title">Salva preset</h3>
        </div>

        <button
          type="button"
          class="preset-modal-close"
          id="closeSavePresetBtn"
          aria-label="Chiudi"
        >✕</button>
      </div>

      <div class="preset-save-body">
        <label class="preset-input-label" for="presetNameInput">Nome preset</label>
        <input
          id="presetNameInput"
          class="preset-input"
          type="text"
          maxlength="28"
          placeholder="Es. Lipu love vibes"
        />

        <label class="preset-check-row">
          <input id="presetDefaultCheckbox" type="checkbox" />
          <span>Imposta come predefinito</span>
        </label>

        <div class="preset-actions-row">
          <button type="button" class="secondary-btn" id="cancelSavePresetBtn">Annulla</button>
          <button type="button" class="apply-btn" id="confirmSavePresetBtn">Salva</button>
        </div>
      </div>
    </div>
  `;

  host.appendChild(overlay);
  return overlay;
} 

function humanizeFilterKey(key) {
  if (key === "gen") return "Gen";
  if (key === "rarity") return "Status";
  if (key === "year") return "Anno";
  if (key === "month") return "Mese";
  if (key === "imageSource") return "Origine";
  if (key === "creator") return "Creator";
  if (key === "categories") return "Categoria";
  return key;
}

function compactPresetSummary(filters = {}) {
  const parts = [];

  Object.entries(filters).forEach(([key, values]) => {
    if (!Array.isArray(values) || !values.length) return;
    const label = humanizeFilterKey(key);
    const joined = values.slice(0, 2).join(", ");
    const suffix = values.length > 2 ? ` +${values.length - 2}` : "";
    parts.push(`${label}: ${joined}${suffix}`);
  });

  return parts.slice(0, 3);
}

function renderPresetManager(state, handlers = {}) {
  const overlay = ensurePresetManagerModal();
  const body = overlay.querySelector("#presetManagerBody");
  if (!body) return;

  const presets = Array.isArray(state.presets) ? state.presets : [];

  if (!presets.length) {
    body.innerHTML = `
      <div class="preset-empty-state">
        <strong>Nessun preset salvato</strong>
        <span>Salva una combinazione di filtri per richiamarla al volo.</span>
      </div>
    `;
  } else {
    body.innerHTML = presets.map((preset) => {
      const isActive = state.activePresetId === preset.id;
      const summary = compactPresetSummary(preset.filters || {});

      return `
        <article class="preset-item ${isActive ? "is-active" : ""}">
          <div class="preset-item-top">
            <div class="preset-item-title-wrap">
              <div class="preset-item-title">${escapeHtml(preset.name || "Preset")}</div>
              <div class="preset-item-badges">
                ${preset.isDefault ? `<span class="preset-mini-badge preset-default-badge">Default</span>` : ""}
                ${isActive ? `<span class="preset-mini-badge preset-active-badge">Attivo</span>` : ""}
              </div>
            </div>
          </div>

          <div class="preset-item-summary">
            ${
              summary.length
                ? summary.map((line) => `<div class="preset-item-line">${escapeHtml(line)}</div>`).join("")
                : `<div class="preset-item-line">Nessun filtro</div>`
            }
          </div>

          <div class="preset-item-actions">
            <button type="button" class="preset-action-btn" data-preset-action="apply" data-preset-id="${escapeHtml(preset.id)}">Attiva</button>
            <button type="button" class="preset-action-btn" data-preset-action="default" data-preset-id="${escapeHtml(preset.id)}">${preset.isDefault ? "Predefinito" : "Imposta default"}</button>
            <button type="button" class="preset-action-btn preset-action-btn-danger" data-preset-action="delete" data-preset-id="${escapeHtml(preset.id)}">Elimina</button>
          </div>
        </article>
      `;
    }).join("");
  }

  const closeBtn = overlay.querySelector("#closePresetManagerBtn");
  if (closeBtn && !closeBtn.dataset.bound) {
    closeBtn.dataset.bound = "1";
    closeBtn.addEventListener("click", () => handlers.onClosePresetManager?.());
  }

  overlay.onclick = (event) => {
    if (event.target === overlay) {
      handlers.onClosePresetManager?.();
    }
  };

  body.querySelectorAll("[data-preset-action='apply']").forEach((button) => {
    button.addEventListener("click", () => {
      handlers.onApplyPreset?.(button.dataset.presetId);
    });
  });

  body.querySelectorAll("[data-preset-action='default']").forEach((button) => {
    button.addEventListener("click", () => {
      handlers.onToggleDefaultPreset?.(button.dataset.presetId);
    });
  });

  body.querySelectorAll("[data-preset-action='delete']").forEach((button) => {
    button.addEventListener("click", () => {
      handlers.onDeletePreset?.(button.dataset.presetId);
    });
  });
}

function prepareSavePresetModal(handlers = {}) {
  const overlay = ensureSavePresetModal();
  const input = overlay.querySelector("#presetNameInput");
  const checkbox = overlay.querySelector("#presetDefaultCheckbox");
  const closeBtn = overlay.querySelector("#closeSavePresetBtn");
  const cancelBtn = overlay.querySelector("#cancelSavePresetBtn");
  const confirmBtn = overlay.querySelector("#confirmSavePresetBtn");

  if (input) input.value = "";
  if (checkbox) checkbox.checked = false;

  if (closeBtn && !closeBtn.dataset.bound) {
    closeBtn.dataset.bound = "1";
    closeBtn.addEventListener("click", () => handlers.onCloseSavePreset?.());
  }

  if (cancelBtn && !cancelBtn.dataset.bound) {
    cancelBtn.dataset.bound = "1";
    cancelBtn.addEventListener("click", () => handlers.onCloseSavePreset?.());
  }

  if (confirmBtn && !confirmBtn.dataset.bound) {
    confirmBtn.dataset.bound = "1";
    confirmBtn.addEventListener("click", () => {
      handlers.onConfirmSavePreset?.({
        name: input?.value?.trim() || "",
        isDefault: !!checkbox?.checked
      });
    });
  }

  overlay.onclick = (event) => {
    if (event.target === overlay) {
      handlers.onCloseSavePreset?.();
    }
  };
}

export function openPresetManagerModal() {
  const overlay = ensurePresetManagerModal();
  if (!overlay) return;

  overlay.classList.add("visible");
  overlay.setAttribute("aria-hidden", "false");
}

export function closePresetManagerModal() {
  const overlay = document.getElementById("presetManagerOverlay");
  if (!overlay) return;

  overlay.classList.remove("visible");
  overlay.setAttribute("aria-hidden", "true");
}

export function openSavePresetModal() {
  const overlay = ensureSavePresetModal();
  if (!overlay) return;

  overlay.classList.add("visible");
  overlay.setAttribute("aria-hidden", "false");

  const input = overlay.querySelector("#presetNameInput");
  if (input) {
    setTimeout(() => input.focus(), 30);
  }
}


export function closeSavePresetModal() {
  const overlay = document.getElementById("savePresetOverlay");
  if (!overlay) return;

  overlay.classList.remove("visible");
  overlay.setAttribute("aria-hidden", "true");
}







/* ------------------------- SKELETON ------------------------- */

export function renderGridSkeleton(count = 3) {
  const grid = document.getElementById("reactionGrid");
  const counter = document.getElementById("count");

  if (!grid) return;

  if (counter) counter.textContent = "…";

  grid.innerHTML = Array.from({ length: count }).map(() => `
    <article class="skeleton-card">
      <div class="skeleton-inner">
        <div class="skeleton-image skeleton-shimmer"></div>
        <div class="skeleton-title skeleton-shimmer"></div>

        <div class="skeleton-tags">
          <div class="skeleton-tag skeleton-shimmer"></div>
          <div class="skeleton-tag skeleton-shimmer"></div>
          <div class="skeleton-tag skeleton-shimmer"></div>
        </div>

        <div class="skeleton-buttons">
          <div class="skeleton-btn skeleton-shimmer"></div>
          <div class="skeleton-btn skeleton-shimmer"></div>
          <div class="skeleton-btn-heart skeleton-shimmer"></div>
        </div>
      </div>
    </article>
  `).join("");
}

/* ------------------------- GRID ------------------------- */

export function renderGrid(reactions, handlers = {}) {
  const grid = document.getElementById("reactionGrid");
  const count = document.getElementById("count");
  const favoriteIds = new Set(getFavoriteIds());

  if (!grid) return;

  if (!handlers.append) {
    if (count) count.textContent = reactions.length;

    if (!reactions.length) {
      const isHotlistMode = !!handlers.isHotlistMode;

      grid.innerHTML = isHotlistMode
        ? `
          <div class="empty-state">
            <strong>La tua Hotlist è vuota</strong>
            <span>Accendi le reaction che vuoi ritrovare al volo.</span>
          </div>
        `
        : `
          <div class="empty-state">
            <strong>Nessuna reaction trovata</strong>
            <span>Prova a modificare ricerca o filtri.</span>
          </div>
        `;
      return;
    }
  }

  const html = reactions.map((rx, index) => {
    const imageSourceLabel = getImageSourceLabel(rx.imageSource);
    const imageSourceClass = getImageSourceClass(rx.imageSource);

    const imageSrc = escapeHtml(rx.resolvedImage || rx.image || "");
    const fetchPriority = index < 3 ? 'fetchpriority="high"' : "";
    const loadingMode = index < 3 ? 'loading="eager"' : 'loading="lazy"';

    return `
      <article class="card ${getCardRarityClass(rx.rarity)}" data-id="${rx.id}">
        <div class="card-inner">

          <div class="dex-top">
            <div class="img-slot">
              ${rx._isBestMatch ? `<div class="best-match-badge">Best Match</div>` : ""}
              <img
                src="${imageSrc}"
                alt="${escapeHtml(rx.name)}"
                ${loadingMode}
                decoding="async"
                ${fetchPriority}
              >
              <div class="img-overlay"></div>
            </div>
          </div>

          <div class="card-meta">
            <div class="name-row">
              <div class="name-inline-wrap">
                <div class="rx-name">
                  ${escapeHtml(rx.name)}
                </div>

                ${
                  imageSourceLabel
                    ? `
                      <span class="source-badge ${imageSourceClass}">
                        <span class="source-icon"></span>
                        <span class="source-text">${escapeHtml(imageSourceLabel)}</span>
                      </span>
                    `
                    : ""
                }
              </div>

              ${
                Array.isArray(rx.creators) && rx.creators.length
                  ? `
                    <div class="rx-creators">
                      ${rx.creators.map((c) => escapeHtml(c)).join(" • ")}
                    </div>
                  `
                  : ""
              }
            </div>

            ${
              typeof rx._confidence === "number"
                ? `
                  <div class="confidence-wrap">
                    <div class="confidence-top">
                      <span class="confidence-label">RX confidence score</span>
                      <span class="confidence-value">${rx._confidence}%</span>
                    </div>

                    <div class="confidence-bar">
                      <div class="confidence-fill" style="width:${rx._confidence}%"></div>
                    </div>
                  </div>
                `
                : ""
            }

            <div class="card-tags-row">
              <div class="meta-chip meta-chip-gen">Gen ${escapeHtml(formatGeneration(rx.gen))}</div>
              <div class="meta-chip meta-chip-date">${escapeHtml(formatMonthYear(rx.month, rx.year))}</div>
              <div class="meta-chip meta-chip-rarity ${rarityClass(rx.rarity)}">${escapeHtml(rx.rarity)}</div>
            </div>

            <div class="card-buttons">
              <button class="card-btn card-btn-neutral" data-action="download" data-id="${rx.id}">
                <span class="btn-ico">⤓</span>
                <span>Scarica</span>
              </button>

              <button class="card-btn card-btn-neutral" data-action="share" data-id="${rx.id}">
                <span class="btn-ico">↗</span>
                <span>Condividi</span>
              </button>

              <button
                class="card-btn favorite-btn ${favoriteIds.has(rx.id) ? "is-favorite" : ""}"
                data-action="favorite"
                data-id="${rx.id}"
                aria-label="${favoriteIds.has(rx.id) ? "Rimuovi dalla Hotlist" : "Aggiungi alla Hotlist"}"
                title="${favoriteIds.has(rx.id) ? "Rimuovi dalla Hotlist" : "Aggiungi alla Hotlist"}"
              >
                <span class="favorite-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 2.8c.9 2.2 2.7 3.7 4.6 5.3 1.7 1.4 2.9 3 2.9 5.4 0 4.3-3.2 7.2-7.5 7.2S4.5 17.8 4.5 13.5c0-2.7 1.6-4.5 3.5-6.2 1.7-1.6 3-2.9 4-4.5Z"/>
                    <path d="M12 12.2c.7 1 1.8 1.7 2.4 2.8.5.8.6 1.5.6 2.1 0 1.8-1.3 3-3 3s-3-1.2-3-3c0-.9.4-1.8 1.1-2.6.6-.7 1.2-1.3 1.9-2.3Z"/>
                  </svg>
                </span>
              </button>
            </div>

          </div>

        </div>
      </article>
    `;
  }).join("");

  if (handlers.append) {
    grid.insertAdjacentHTML("beforeend", html);
  } else {
    grid.innerHTML = html;
  }

  bindImageFadeIn(grid);
  bindSmartImagePreload(grid);
  bindCardViewportReveal(grid);

  const cardMap = new Map(reactions.map((item) => [Number(item.id), item]));

  grid.querySelectorAll("[data-action='download']").forEach((button) => {
    button.addEventListener("click", () => {
      const card = cardMap.get(Number(button.dataset.id));
      if (card && handlers.onDownload) handlers.onDownload(card);
    });
  });

  grid.querySelectorAll("[data-action='share']").forEach((button) => {
    button.addEventListener("click", () => {
      const card = cardMap.get(Number(button.dataset.id));
      if (card && handlers.onShare) handlers.onShare(card);
    });
  });

  grid.querySelectorAll("[data-action='favorite']").forEach((button) => {
    button.addEventListener("click", () => {
      const card = cardMap.get(Number(button.dataset.id));
      if (card && handlers.onFavorite) handlers.onFavorite(card);
    });
  });
}

/* ------------------------- TOAST ------------------------- */

export function showToast(message) {
  const toast = document.getElementById("statusToast");
  if (!toast) return;

  toast.textContent = message;
  toast.classList.add("visible");

  clearTimeout(showToast._timer);

  showToast._timer = setTimeout(() => {
    toast.classList.remove("visible");
  }, 1800);
}
