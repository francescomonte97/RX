import { CONFIG } from "./config.js";
import {
  getActiveFilterCount,
  getActiveFilterChips,
  getCreatorExactCount,
  getCreatorShipPower,
  getShipPowerTier
} from "./filters.js";
import { getFavoriteIds } from "./favorites.js";

/* ------------------------- UTIL ------------------------- */

function rarityClass(rarity) {
  if (rarity === "Comune") return "pill-comune";
  if (rarity === "Non Comune") return "pill-non-comune";
  if (rarity === "Rara") return "pill-rara";
  if (rarity === "Epica") return "pill-epica";
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
  const resultsHeader = document.querySelector(".results-head");

  const selectedCreators = Array.isArray(state.creator) ? state.creator : [];
  const exactCount = getCreatorExactCount(reactions, state);
  const displayExactCount = exactCount > 9 ? "9+" : String(exactCount);
  const shipPower = getCreatorShipPower(reactions, state);
  const shipTier = getShipPowerTier(shipPower);
  const initials = getCreatorShipInitials(selectedCreators);
  const canShowShip = selectedCreators.length >= 2;

  let shipHint = "";
  if (selectedCreators.length < 2) {
    shipHint = "Seleziona 2+ creator per attivare Ship RX";
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
            <div class="ship-rx-label">Ship RX</div>

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

  if (tuningLabel) tuningLabel.textContent = "Filtri RX";

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
  if (creatorExactChip && handlers.onCreatorExactToggle) {
    creatorExactChip.addEventListener("click", handlers.onCreatorExactToggle);
  }
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