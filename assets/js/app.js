import { state, resetStateFilters } from "./state.js";
import {
  filterByNameRealtime,
  filterSemanticManual,
  toggleFilter,
  getSerializableFilters,
  applyPresetFilters,
  isPresetEqualToState
} from "./filters.js";
import { downloadImage, shareCard } from "./actions.js";
import {
  renderTopUI,
  renderGrid,
  renderGridSkeleton,
  renderSearchTicker,
  renderSearchTickerDefault,
  showToast,
  openPresetManagerModal,
  closePresetManagerModal,
  openSavePresetModal,
  closeSavePresetModal
} from "./render.js";
import { enrichCardsWithResolvedImages } from "./image-resolver.js";
import { loadReactions } from "./reaction-service.js";
import { filterFavorites, toggleFavorite, getFavoriteIds } from "./favorites.js";
import { analyzeHotlistIdentity } from "./hotlist-insights.js";

const INSTALL_PROMPT_DISMISSED_KEY = "reactiondex:installPromptDismissed";
const INSTALL_PROMPT_ACCEPTED_KEY = "reactiondex:installPromptAccepted";
const PRESETS_STORAGE_KEY = "reactiondex:presets";
const YEAR_MIN = 2020;
const YEAR_MAX = 2026;

const dom = {
  searchInput: document.getElementById("searchInput"),
  semanticToggleBtn: document.getElementById("semanticToggleBtn"),
  runSemanticSearchBtn: document.getElementById("runSemanticSearchBtn"),
  favoritesToggleBtn: document.getElementById("favoritesToggleBtn"),
  tuningModal: document.getElementById("tuningModal"),
  tuningTrigger: document.getElementById("tuningTrigger"),
  closeModalBtn: document.getElementById("closeModalBtn"),
  resetBtn: document.getElementById("resetBtn"),
  resetFiltersBtn: document.getElementById("resetFiltersBtn"),
  applyFiltersBtn: document.getElementById("applyFiltersBtn"),
  installPromptOverlay: document.getElementById("installPromptOverlay"),
  confirmInstallPromptBtn: document.getElementById("confirmInstallPromptBtn"),
  dismissInstallPromptBtn: document.getElementById("dismissInstallPromptBtn"),
  hotlistAiPanel: document.getElementById("hotlistAiPanel"),
  analyzeHotlistBtn: document.getElementById("analyzeHotlistBtn"),

  rxInsightOverlay: document.getElementById("rxInsightOverlay"),
  rxInsightLoading: document.getElementById("rxInsightLoading"),
  rxInsightLoadingCopy: document.getElementById("rxInsightLoadingCopy"),
  rxInsightResult: document.getElementById("rxInsightResult"),
  rxInsightTitle: document.getElementById("rxInsightTitle"),
  rxInsightProfile: document.getElementById("rxInsightProfile"),
  closeRxInsightBtn: document.getElementById("closeRxInsightBtn")
};

let reactions = [];
let deferredInstallPrompt = null;
let isAnalyzingHotlist = false;

/* ------------------------- PRESETS ------------------------- */

function generatePresetId() {
  return `preset_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function loadPresetsFromStorage() {
  try {
    const raw = localStorage.getItem(PRESETS_STORAGE_KEY);
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function savePresetsToStorage() {
  localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(state.presets || []));
}

function syncPresetsFromStorage() {
  state.presets = loadPresetsFromStorage();
}

function getDefaultPreset() {
  return (state.presets || []).find((preset) => preset.isDefault) || null;
}

function clearPresetActiveState() {
  state.activePresetId = null;
}

function clearPresetActiveStateIfManualFilters() {
  const activePreset = (state.presets || []).find((preset) => preset.id === state.activePresetId);
  if (!activePreset) {
    state.activePresetId = null;
    return;
  }

  if (!isPresetEqualToState(state, activePreset.filters || {})) {
    state.activePresetId = null;
  }
}

function setDefaultPresetById(presetId) {
  state.presets = (state.presets || []).map((preset) => ({
    ...preset,
    isDefault: preset.id === presetId
  }));
  savePresetsToStorage();
}

function deletePresetById(presetId) {
  const deletedWasActive = state.activePresetId === presetId;
  const deletedWasDefault = (state.presets || []).some(
    (preset) => preset.id === presetId && preset.isDefault
  );

  state.presets = (state.presets || []).filter((preset) => preset.id !== presetId);

  if (deletedWasActive) {
    state.activePresetId = null;
  }

  if (deletedWasDefault) {
    state.presets = state.presets.map((preset, index) => ({
      ...preset,
      isDefault: index === 0 ? true : preset.isDefault
    }));
  }

  savePresetsToStorage();
}

function buildPresetPayload(name, isDefault = false) {
  return {
    id: generatePresetId(),
    name,
    filters: getSerializableFilters(state),
    isDefault,
    createdAt: Date.now()
  };
}

async function applyPresetById(presetId) {
  const preset = (state.presets || []).find((item) => item.id === presetId);
  if (!preset) {
    showToast("Preset non trovato");
    return;
  }

  applyPresetFilters(state, preset.filters || {});
  state.activePresetId = preset.id;

  renderAllTopUI();
  await refreshByMode();
  showToast(`Preset "${preset.name}" attivato`);
}

async function applyDefaultPresetOnInit() {
  syncPresetsFromStorage();

  const defaultPreset = getDefaultPreset();
  if (!defaultPreset) return;

  applyPresetFilters(state, defaultPreset.filters || {});
  state.activePresetId = defaultPreset.id;
}

/* ------------------------- GENERIC ------------------------- */

function shuffleArray(items = []) {
  const array = [...items];

  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }

  return array;
}

function isStandaloneMode() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function shouldShowInstallPopup() {
  const dismissed = localStorage.getItem(INSTALL_PROMPT_DISMISSED_KEY) === "1";
  const accepted = localStorage.getItem(INSTALL_PROMPT_ACCEPTED_KEY) === "1";
  return !dismissed && !accepted && !isStandaloneMode();
}

function getCurrentSelectedYear() {
  if (Array.isArray(state.year) && state.year.length) {
    const parsed = Number(state.year[0]);
    if (!Number.isNaN(parsed)) return parsed;
  }

  const yearsFromData = reactions
    .map((item) => Number(item?.year))
    .filter((year) => !Number.isNaN(year))
    .sort((a, b) => b - a);

  return yearsFromData[0] || 2025;
}

async function setSingleYear(nextYear) {
  const clamped = Math.min(YEAR_MAX, Math.max(YEAR_MIN, Number(nextYear)));
  state.year = [String(clamped)];
  clearPresetActiveStateIfManualFilters();

  if (state.semanticSearchEnabled) {
    state.semanticSearchDirty = true;
    renderAllTopUI();
    renderSearchTicker([], state);
    updateHotlistAiPanel();
    return;
  }

  await refreshNameMode();
}

async function stepYear(direction) {
  const current = getCurrentSelectedYear();
  const next = direction === "up" ? current + 1 : current - 1;

  if (next < YEAR_MIN || next > YEAR_MAX) return;
  await setSingleYear(next);
}

/* ------------------------- FILTER BUTTONS ------------------------- */

function bindDynamicFilterButtons() {
  document.querySelectorAll(".opt-box").forEach((button) => {
    if (button.dataset.bound === "1") return;
    button.dataset.bound = "1";

    button.addEventListener("click", async () => {
      const action = button.dataset.action;

      if (action === "year-step-up") {
        await stepYear("up");
        return;
      }

      if (action === "year-step-down") {
        await stepYear("down");
        return;
      }

      const type = button.dataset.type;
      const value = button.dataset.value;

      if (!type) return;

      if (type === "year" && button.classList.contains("date-year-display")) {
        state.year = state.year.length ? [] : [String(value)];
        clearPresetActiveStateIfManualFilters();

        if (state.semanticSearchEnabled) {
          state.semanticSearchDirty = true;
          renderAllTopUI();
          renderSearchTicker([], state);
          updateHotlistAiPanel();
        } else {
          await refreshNameMode();
        }
        return;
      }

      toggleFilter(state, type, value);
      clearPresetActiveStateIfManualFilters();
      renderAllTopUI();

      if (state.semanticSearchEnabled) {
        state.semanticSearchDirty = true;
        renderSearchTicker([], state);
        updateHotlistAiPanel();
      } else {
        await refreshNameMode();
      }
    });
  });

  document.querySelectorAll("[data-action='year-step-up'], [data-action='year-step-down']").forEach((button) => {
    if (button.dataset.bound === "1") return;
    button.dataset.bound = "1";

    button.addEventListener("click", async () => {
      const action = button.dataset.action;
      if (action === "year-step-up") {
        await stepYear("up");
      } else if (action === "year-step-down") {
        await stepYear("down");
      }
    });
  });
}

/* ------------------------- TOP UI WRAPPER ------------------------- */

function renderAllTopUI() {
  renderTopUI(state, reactions, {
    onCreatorExactToggle: async () => {
      if (!Array.isArray(state.creator) || state.creator.length < 2) return;
      state.creatorExactMode = !state.creatorExactMode;
      clearPresetActiveStateIfManualFilters();
      await refreshByMode();
    },

    onOpenPresetManager: () => {
      openPresetManagerModal();
    },

    onOpenSavePreset: () => {
      openSavePresetModal();
    },

    onCloseSavePreset: () => {
      closeSavePresetModal();
    },

    onConfirmSavePreset: async ({ name, isDefault }) => {
      const cleanName = String(name || "").trim();

      if (!cleanName) {
        showToast("Inserisci un nome preset");
        return;
      }

      const exists = (state.presets || []).some(
        (preset) => preset.name.toLowerCase() === cleanName.toLowerCase()
      );

      if (exists) {
        showToast("Esiste già un preset con questo nome");
        return;
      }

      if (isDefault) {
        state.presets = (state.presets || []).map((preset) => ({
          ...preset,
          isDefault: false
        }));
      }

      const preset = buildPresetPayload(cleanName, !!isDefault);
      state.presets = [preset, ...(state.presets || [])];
      state.activePresetId = preset.id;

      savePresetsToStorage();
      closeSavePresetModal();
      renderAllTopUI();
      showToast(`Preset "${cleanName}" salvato`);
    },

    onClosePresetManager: () => {
      closePresetManagerModal();
      if (dom.tuningModal?.classList.contains("open")) {
        document.body.style.overflow = "hidden";
      }
    },

    onApplyPreset: async (presetId) => {
      closePresetManagerModal();
      await applyPresetById(presetId);
    },

    onDeletePreset: (presetId) => {
      deletePresetById(presetId);
      renderAllTopUI();
      showToast("Preset eliminato");
    },

    onToggleDefaultPreset: (presetId) => {
      setDefaultPresetById(presetId);
      renderAllTopUI();
      showToast("Preset predefinito aggiornato");
    }
  });

  bindDynamicFilterButtons();
}

/* ------------------------- MODALS ------------------------- */

function openTuning() {
  if (!dom.tuningModal) return;

  const sheet = document.querySelector(".modal-pane");
  if (sheet) {
    sheet.style.transition = "none";
    sheet.style.transform = "translateY(0)";
  }

  dom.tuningModal.classList.remove("closing");
  dom.tuningModal.classList.add("open");
  document.body.style.overflow = "hidden";

  requestAnimationFrame(() => {
    if (sheet) {
      sheet.style.transition = "transform 0.24s ease";
      sheet.style.transform = "translateY(0)";
    }
  });
}
function closeTuning() {
  if (!dom.tuningModal) return;

  const sheet = document.querySelector(".modal-pane");
  if (sheet) {
    sheet.style.transition = "transform 0.24s ease";
  }

  dom.tuningModal.classList.add("closing");

  setTimeout(() => {
    dom.tuningModal.classList.remove("open", "closing");
    document.body.style.overflow = "";

    if (sheet) {
      sheet.style.transform = "translateY(0)";
      sheet.style.transition = "none";
    }
  }, 340);
}
function openInstallPromptModal() {
  if (!dom.installPromptOverlay) return;
  dom.installPromptOverlay.classList.add("visible");
  dom.installPromptOverlay.setAttribute("aria-hidden", "false");
}

function closeInstallPromptModal() {
  if (!dom.installPromptOverlay) return;
  dom.installPromptOverlay.classList.remove("visible");
  dom.installPromptOverlay.setAttribute("aria-hidden", "true");
}

function openRxInsightModal() {
  if (!dom.rxInsightOverlay) return;
  dom.rxInsightOverlay.classList.add("visible");
  dom.rxInsightOverlay.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function resetRxInsightModal() {
  if (dom.rxInsightLoading) dom.rxInsightLoading.hidden = false;
  if (dom.rxInsightResult) dom.rxInsightResult.hidden = true;
  if (dom.rxInsightTitle) dom.rxInsightTitle.textContent = "Analisi del Ministro";
  if (dom.rxInsightProfile) dom.rxInsightProfile.textContent = "—";
  if (dom.rxInsightLoadingCopy) {
    dom.rxInsightLoadingCopy.textContent = "Sto leggendo il tuo caos interiore RX...";
  }
}

function closeRxInsightModal() {
  if (!dom.rxInsightOverlay) return;
  dom.rxInsightOverlay.classList.remove("visible");
  dom.rxInsightOverlay.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  resetRxInsightModal();
}

/* ------------------------- RESULTS ------------------------- */

function applyFavoritesMode(items) {
  return state.favoritesOnly ? filterFavorites(items) : items;
}

function updateHotlistAiPanel() {
  const panel = dom.hotlistAiPanel;
  const button = dom.analyzeHotlistBtn;
  if (!panel || !button) return;

  const hotlistCount = getFavoriteIds().length;
  const shouldShow = state.favoritesOnly && hotlistCount >= 3;

  panel.classList.toggle("visible", shouldShow);
  button.disabled = isAnalyzingHotlist || hotlistCount < 3;
  button.textContent = isAnalyzingHotlist ? "Sto leggendo la tua Hotlist..." : "Mostra analisi del Ministro";
}

function showRxInsightLoading() {
  if (!dom.rxInsightLoading || !dom.rxInsightResult || !dom.rxInsightLoadingCopy) return;

  const loadingCopies = ["Attendi..."];

  dom.rxInsightLoading.hidden = false;
  dom.rxInsightResult.hidden = true;
  dom.rxInsightLoadingCopy.textContent =
    loadingCopies[Math.floor(Math.random() * loadingCopies.length)];

  openRxInsightModal();
}

function renderRxInsightResult(result = {}) {
  if (
    !dom.rxInsightLoading ||
    !dom.rxInsightResult ||
    !dom.rxInsightTitle ||
    !dom.rxInsightProfile
  ) {
    return;
  }

  dom.rxInsightTitle.textContent = result.archetype || "Analisi del Ministro";
  dom.rxInsightProfile.textContent =
    result.identity_text;

  dom.rxInsightLoading.hidden = true;
  dom.rxInsightResult.hidden = false;
}

async function handleAnalyzeHotlist() {
  if (isAnalyzingHotlist) return;

  const hotlistCount = getFavoriteIds().length;

  if (hotlistCount < 3) {
    showToast("Aggiungi almeno 3 reaction alla Hotlist");
    return;
  }

  try {
    isAnalyzingHotlist = true;
    updateHotlistAiPanel();
    showRxInsightLoading();

    const result = await analyzeHotlistIdentity(reactions);
    console.log("Analisi del Ministro:", result);

    renderRxInsightResult(result);

    showToast(
      result.source === "local"
        ? "RX Identity generata in locale"
        : "RX Identity sbloccata"
    );
  } catch (error) {
    console.error(error);
    closeRxInsightModal();
    showToast(error.message || "Errore analisi Hotlist");
  } finally {
    isAnalyzingHotlist = false;
    updateHotlistAiPanel();
  }
}

async function renderResults(results) {
  const enriched = await enrichCardsWithResolvedImages(results);

  renderGrid(enriched, {
    isHotlistMode: !!state.favoritesOnly,
    onDownload: async (card) => {
      const result = await downloadImage(card);
      showToast(result.message);
    },
    onShare: async (card) => {
      const result = await shareCard(card);
      showToast(result.message);
    },
    onFavorite: async (card) => {
      const result = toggleFavorite(card.id);

      if (result.limit) {
        showToast("Hotlist piena (max 9)");
        updateHotlistAiPanel();
        return;
      }

      showToast(
        result.added
          ? "Aggiunta alla Hotlist"
          : "Rimossa dalla Hotlist"
      );

      await refreshByMode();
      updateHotlistAiPanel();
    }
  });
}

async function refreshNameMode() {
  renderAllTopUI();

  const filtered = filterByNameRealtime(reactions, state);
  const finalResults = applyFavoritesMode(filtered);

  if (!state.name.trim()) {
    renderSearchTickerDefault(finalResults, state);
  } else {
    renderSearchTicker(finalResults, state);
  }

  await renderResults(finalResults);
  updateHotlistAiPanel();
}

async function runSemanticSearch() {
  if (!state.name.trim()) {
    showToast("Scrivi una descrizione");
    return;
  }

  state.isSemanticLoading = true;
  renderAllTopUI();
  renderSearchTicker([], state);

  await new Promise((resolve) => setTimeout(resolve, 500));

  const filtered = filterSemanticManual(reactions, state);
  const finalResults = applyFavoritesMode(filtered);

  state.lastSemanticQuery = state.name;
  state.semanticSearchDirty = false;
  state.isSemanticLoading = false;

  renderAllTopUI();
  renderSearchTicker([], state);
  await renderResults(finalResults);
  updateHotlistAiPanel();
}

async function refreshByMode() {
  if (state.semanticSearchEnabled) {
    renderAllTopUI();

    if (!state.lastSemanticQuery && !state.name.trim()) {
      renderSearchTicker([], state);
      await renderResults([]);
      updateHotlistAiPanel();
      return;
    }

    if (state.semanticSearchDirty) {
      updateHotlistAiPanel();
      return;
    }

    const filtered = filterSemanticManual(reactions, state);
    const finalResults = applyFavoritesMode(filtered);

    renderSearchTicker([], state);
    await renderResults(finalResults);
    updateHotlistAiPanel();
    return;
  }

  await refreshNameMode();
}

/* ------------------------- EFFECTS ------------------------- */

function bindCloseButtonPressEffect() {
  const closeBtn = dom.closeModalBtn;
  if (!closeBtn) return;

  const pressOn = () => closeBtn.classList.add("is-pressed");
  const pressOff = () => closeBtn.classList.remove("is-pressed");

  closeBtn.addEventListener("pointerdown", pressOn);
  closeBtn.addEventListener("pointerup", pressOff);
  closeBtn.addEventListener("pointerleave", pressOff);
  closeBtn.addEventListener("pointercancel", pressOff);
}

function bindEvents() {
  dom.searchInput?.addEventListener("input", async (event) => {
    state.name = event.target.value.trim().toLowerCase();

    if (state.semanticSearchEnabled) {
      state.semanticSearchDirty = true;
      clearPresetActiveStateIfManualFilters();
      renderAllTopUI();
      renderSearchTicker([], state);
      updateHotlistAiPanel();
      return;
    }

    clearPresetActiveStateIfManualFilters();
    await refreshNameMode();
  });

  dom.searchInput?.addEventListener("keydown", async (event) => {
    if (event.key === "Enter" && state.semanticSearchEnabled && state.name.trim()) {
      event.preventDefault();
      await runSemanticSearch();
    }
  });

  dom.semanticToggleBtn?.addEventListener("click", async () => {
    state.semanticSearchEnabled = !state.semanticSearchEnabled;
    state.semanticSearchDirty = state.semanticSearchEnabled;
    state.lastSemanticQuery = "";

    clearPresetActiveStateIfManualFilters();
    renderAllTopUI();

    if (!state.semanticSearchEnabled) {
      await refreshNameMode();
      showToast("Ricerca base attiva");
      return;
    }

    renderSearchTicker([], state);
    await renderResults([]);
    updateHotlistAiPanel();
    showToast("Ricerca RX Finder attiva");
  });

  dom.runSemanticSearchBtn?.addEventListener("click", async () => {
    if (!state.name.trim() || state.isSemanticLoading) return;
    await runSemanticSearch();
  });

  dom.favoritesToggleBtn?.addEventListener("click", async () => {
    state.favoritesOnly = !state.favoritesOnly;
    await refreshByMode();
    showToast(state.favoritesOnly ? "Vista Hotlist attiva" : "Vista completa attiva");
  });

  dom.analyzeHotlistBtn?.addEventListener("click", async () => {
    await handleAnalyzeHotlist();
  });

  dom.closeRxInsightBtn?.addEventListener("click", closeRxInsightModal);

  dom.rxInsightOverlay?.addEventListener("click", (event) => {
    if (event.target === dom.rxInsightOverlay) {
      closeRxInsightModal();
    }
  });

  dom.tuningTrigger?.addEventListener("click", () => {
    openTuning();
    renderAllTopUI();
  });

  dom.closeModalBtn?.addEventListener("click", closeTuning);

  dom.tuningModal?.addEventListener("click", (event) => {
    if (event.target === dom.tuningModal) {
      closeTuning();
    }
  });

  dom.resetBtn?.addEventListener("click", async () => {
    resetStateFilters();
    state.name = "";
    state.lastSemanticQuery = "";
    state.semanticSearchDirty = false;
    state.favoritesOnly = false;
    state.semanticSearchEnabled = false;
    state.isSemanticLoading = false;
    clearPresetActiveState();

    if (dom.searchInput) {
      dom.searchInput.value = "";
    }

    renderAllTopUI();
    await refreshNameMode();
    updateHotlistAiPanel();
    showToast("Reset completato");
  });

  dom.resetFiltersBtn?.addEventListener("click", async () => {
    resetStateFilters();
    clearPresetActiveState();

    if (state.semanticSearchEnabled) {
      state.semanticSearchDirty = true;
      renderAllTopUI();
      renderSearchTicker([], state);
      updateHotlistAiPanel();
    } else {
      await refreshNameMode();
    }

    showToast("Filtri resettati");
  });

  dom.applyFiltersBtn?.addEventListener("click", async () => {
    closeTuning();

    if (state.semanticSearchEnabled) {
      state.semanticSearchDirty = true;
      renderAllTopUI();
      renderSearchTicker([], state);
      updateHotlistAiPanel();
    } else {
      await refreshNameMode();
    }

    showToast("Filtri applicati");
  });

  dom.dismissInstallPromptBtn?.addEventListener("click", () => {
    localStorage.setItem(INSTALL_PROMPT_DISMISSED_KEY, "1");
    closeInstallPromptModal();
  });

  dom.confirmInstallPromptBtn?.addEventListener("click", async () => {
    localStorage.setItem(INSTALL_PROMPT_ACCEPTED_KEY, "1");

    if (!deferredInstallPrompt) {
      showToast("Il browser non espone il prompt: usa il menu del browser e scegli Installa app");
      closeInstallPromptModal();
      return;
    }

    try {
      await deferredInstallPrompt.prompt();
      const result = await deferredInstallPrompt.userChoice;

      if (result?.outcome === "accepted") {
        showToast("Installazione avviata");
      } else {
        showToast("Installazione annullata");
      }
    } catch (error) {
      console.error(error);
      showToast("Impossibile aprire il prompt di installazione");
    } finally {
      deferredInstallPrompt = null;
      closeInstallPromptModal();
    }
  });

  dom.installPromptOverlay?.addEventListener("click", (event) => {
    if (event.target === dom.installPromptOverlay) {
      localStorage.setItem(INSTALL_PROMPT_DISMISSED_KEY, "1");
      closeInstallPromptModal();
    }
  });
}

function bindPressFeedback() {
  document.querySelectorAll(".tool-btn").forEach((button) => {
    const pressOn = () => button.classList.add("is-pressed");
    const pressOff = () => button.classList.remove("is-pressed");

    button.addEventListener("pointerdown", pressOn);
    button.addEventListener("pointerup", pressOff);
    button.addEventListener("pointerleave", pressOff);
    button.addEventListener("pointercancel", pressOff);
  });
}

function bindSearchButtonFeedback() {
  const btn = dom.runSemanticSearchBtn;
  if (!btn) return;

  const pressOn = () => btn.classList.add("is-pressed");
  const pressOff = () => btn.classList.remove("is-pressed");

  btn.addEventListener("pointerdown", pressOn);
  btn.addEventListener("pointerup", pressOff);
  btn.addEventListener("pointerleave", pressOff);
  btn.addEventListener("pointercancel", pressOff);
}

function bindPWA() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./service-worker.js").catch(console.error);
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    localStorage.setItem(INSTALL_PROMPT_ACCEPTED_KEY, "1");
    closeInstallPromptModal();
    showToast("Installazione completata");
  });
}

function bindHeaderScrollEffect() {
  const header = document.querySelector(".app-header");
  if (!header) return;

  window.addEventListener("scroll", () => {
    if (window.scrollY > 10) {
      header.style.backdropFilter = "blur(24px) saturate(1.14)";
      header.style.webkitBackdropFilter = "blur(24px) saturate(1.14)";
    } else {
      header.style.backdropFilter = "blur(20px) saturate(1.12)";
      header.style.webkitBackdropFilter = "blur(20px) saturate(1.12)";
    }
  });
}


function bindBottomSheetSwipe() {
  const sheet = document.querySelector(".modal-pane");
  const scrollArea = document.querySelector(".modal-content-scroll");
  const dragger = document.querySelector(".dragger");

  if (!sheet || !scrollArea) return;

  let startY = 0;
  let currentY = 0;
  let isDragging = false;
  let canDrag = false;

  const resetSheetPosition = () => {
    sheet.style.transition = "transform 0.24s ease";
    sheet.style.transform = "translateY(0)";
  };

  const startDrag = (clientY, target) => {
    const tappedDragger = dragger?.contains(target);
    const scrollIsAtTop = scrollArea.scrollTop <= 0;

    canDrag = tappedDragger || scrollIsAtTop;
    if (!canDrag) return;

    startY = clientY;
    currentY = clientY;
    isDragging = true;
    sheet.style.transition = "none";
  };

  const moveDrag = (clientY) => {
    if (!isDragging || !canDrag) return;

    currentY = clientY;
    const diff = currentY - startY;

    if (diff <= 0) {
      sheet.style.transform = "translateY(0)";
      return;
    }

    sheet.style.transform = `translateY(${diff}px)`;
  };

  const endDrag = () => {
    if (!isDragging) return;

    const diff = currentY - startY;
    sheet.style.transition = "transform 0.24s ease";

    if (canDrag && diff > 120) {
      closeTuning();

      setTimeout(() => {
        sheet.style.transform = "translateY(0)";
      }, 260);
    } else {
      sheet.style.transform = "translateY(0)";
    }

    isDragging = false;
    canDrag = false;
    startY = 0;
    currentY = 0;
  };

  sheet.addEventListener("touchstart", (e) => {
    startDrag(e.touches[0].clientY, e.target);
  }, { passive: true });

  sheet.addEventListener("touchmove", (e) => {
    if (!isDragging || !canDrag) return;

    const diff = e.touches[0].clientY - startY;

    if (scrollArea.scrollTop > 0 && !(dragger && dragger.contains(e.target))) {
      isDragging = false;
      canDrag = false;
      sheet.style.transform = "translateY(0)";
      return;
    }

    if (diff > 0) {
      e.preventDefault();
      moveDrag(e.touches[0].clientY);
    }
  }, { passive: false });

  sheet.addEventListener("touchend", endDrag);
  sheet.addEventListener("touchcancel", endDrag);

  sheet._resetBottomSheetPosition = resetSheetPosition;
}



/* ------------------------- INIT ------------------------- */

async function init() {
  try {
    syncPresetsFromStorage();
    await applyDefaultPresetOnInit();

    renderAllTopUI();
    renderGridSkeleton(3);

    const loadedReactions = await loadReactions();
    reactions = shuffleArray(loadedReactions);

    bindEvents();
    bindCloseButtonPressEffect();
    bindPressFeedback();
    bindSearchButtonFeedback();
    bindPWA();
    bindHeaderScrollEffect();
    bindBottomSheetSwipe();

    if (shouldShowInstallPopup()) {
      setTimeout(() => {
        openInstallPromptModal();
      }, 700);
    }

    renderAllTopUI();

    const initialResults = applyFavoritesMode(filterByNameRealtime(reactions, state));
    renderSearchTickerDefault(initialResults, state);
    await renderResults(initialResults);
    updateHotlistAiPanel();
  } catch (error) {
    console.error(error);
    showToast("Errore caricamento reaction");
  }
}









window.addEventListener("DOMContentLoaded", init);
