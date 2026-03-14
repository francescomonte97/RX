import { state, resetStateFilters } from "./state.js";
import { filterByNameRealtime, filterSemanticManual, toggleFilter } from "./filters.js";
import { downloadImage, shareCard } from "./actions.js";
import {
  renderTopUI,
  renderGrid,
  renderGridSkeleton,
  renderSearchTicker,
  renderSearchTickerDefault,
  showToast
} from "./render.js";
import { enrichCardsWithResolvedImages } from "./image-resolver.js";
import { loadReactions } from "./reaction-service.js";
import { filterFavorites, toggleFavorite, getFavoriteIds } from "./favorites.js";
import { analyzeHotlistIdentity } from "./hotlist-insights.js";

const INSTALL_PROMPT_DISMISSED_KEY = "reactiondex:installPromptDismissed";
const INSTALL_PROMPT_ACCEPTED_KEY = "reactiondex:installPromptAccepted";

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

function renderAllTopUI() {
  renderTopUI(state, reactions, {
    onCreatorExactToggle: async () => {
      if (!Array.isArray(state.creator) || state.creator.length < 2) return;
      state.creatorExactMode = !state.creatorExactMode;
      await refreshByMode();
    }
  });
}

function openTuning() {
  if (!dom.tuningModal) return;

  dom.tuningModal.classList.remove("closing");
  dom.tuningModal.classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeTuning() {
  if (!dom.tuningModal) return;

  dom.tuningModal.classList.add("closing");

  setTimeout(() => {
    dom.tuningModal.classList.remove("open", "closing");
    document.body.style.overflow = "";
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
  if (dom.rxInsightTitle) dom.rxInsightTitle.textContent = "RX Identity";
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
  button.textContent = isAnalyzingHotlist ? "Sto leggendo la tua Hotlist..." : "Scopri la tua RX Identity";
}

function showRxInsightLoading() {
  if (!dom.rxInsightLoading || !dom.rxInsightResult || !dom.rxInsightLoadingCopy) return;

  const loadingCopies = [
    "Attendi..."
  ];

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

  dom.rxInsightTitle.textContent = result.archetype || "RX Identity";
  dom.rxInsightProfile.textContent =
    result.identity_text ||
    "Tu e il caos visivo avete chiaramente firmato un patto non scritto.";

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
    console.log("RX Identity:", result);

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
      renderAllTopUI();
      renderSearchTicker([], state);
      updateHotlistAiPanel();
      return;
    }

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

  dom.tuningTrigger?.addEventListener("click", openTuning);
  dom.closeModalBtn?.addEventListener("click", closeTuning);

  dom.tuningModal?.addEventListener("click", (event) => {
    if (event.target === dom.tuningModal) {
      closeTuning();
    }
  });

  document.querySelectorAll(".opt-box").forEach((button) => {
    button.addEventListener("click", async () => {
      const type = button.dataset.type;
      const value = button.dataset.value;

      toggleFilter(state, type, value);
      renderAllTopUI();

      if (state.semanticSearchEnabled) {
        state.semanticSearchDirty = true;
        renderSearchTicker([], state);
      } else {
        await refreshNameMode();
      }
    });
  });

  dom.resetBtn?.addEventListener("click", async () => {
    resetStateFilters();
    state.name = "";
    state.lastSemanticQuery = "";
    state.semanticSearchDirty = false;
    state.favoritesOnly = false;
    state.semanticSearchEnabled = false;
    state.isSemanticLoading = false;

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

async function init() {
  try {
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

    if (shouldShowInstallPopup()) {
      setTimeout(() => {
        openInstallPromptModal();
      }, 700);
    }

    renderAllTopUI();

    const initialResults = applyFavoritesMode(reactions);
    renderSearchTickerDefault(initialResults, state);
    await renderResults(initialResults);
    updateHotlistAiPanel();
  } catch (error) {
    console.error(error);
    showToast("Errore caricamento reaction");
  }
}

window.addEventListener("DOMContentLoaded", init);