const RX_CARD_UNLOCK_KEY = "reactiondex:rxCardUnlocks";
const RX_SCAN_TIMEOUT_MS = 15000;

const RX_CARD_REGISTRY = {
  "rx_secret_2026": {
    cardId: "rx-card-001",
    name: "RX Card Vault",
    groups: ["vault"]
  },
  "rx_ultra_all": {
    cardId: "rx-card-999",
    name: "RX Master Card",
    groups: ["*"]
  }
};

let currentRequestedGroup = "vault";
let currentOnUnlocked = null;
let currentShowToast = null;

function getModalEls() {
  return {
    overlay: document.getElementById("rxCardOverlay"),
    card: document.getElementById("rxCardModal"),
    title: document.getElementById("rxCardTitle"),
    text: document.getElementById("rxCardText"),
    status: document.getElementById("rxCardStatus"),
    scanBtn: document.getElementById("rxCardScanBtn"),
    cancelBtn: document.getElementById("rxCardCancelBtn"),
    closeBtn: document.getElementById("rxCardCloseBtn")
  };
}

function getUnlockStore() {
  try {
    return JSON.parse(localStorage.getItem(RX_CARD_UNLOCK_KEY) || "{}");
  } catch {
    return {};
  }
}

function setUnlockStore(nextStore) {
  localStorage.setItem(RX_CARD_UNLOCK_KEY, JSON.stringify(nextStore || {}));
}

export function isSecretGroupUnlocked(group = "vault") {
  const store = getUnlockStore();
  return store[group] === true;
}

export function isReactionLocked(item) {
  if (!item?.isSecret) return false;
  return !isSecretGroupUnlocked(item.secretGroup || "vault");
}

export function unlockSecretGroup(group = "vault") {
  const store = getUnlockStore();
  store[group] = true;
  setUnlockStore(store);
}

export function resetSecretGroupUnlock(group) {
  if (!group) {
    localStorage.removeItem(RX_CARD_UNLOCK_KEY);
    return;
  }

  const store = getUnlockStore();
  delete store[group];
  setUnlockStore(store);
}

function decodeTextRecord(record) {
  const decoder = new TextDecoder(record.encoding || "utf-8");
  return decoder.decode(record.data);
}

function parseRxCardMessage(message) {
  if (!message?.records?.length) return null;

  for (const record of message.records) {
    if (record.recordType !== "text") continue;

    try {
      const text = decodeTextRecord(record);
      const data = JSON.parse(text);

      if (
        data &&
        typeof data === "object" &&
        data.type === "rx_card" &&
        typeof data.token === "string"
      ) {
        return data;
      }
    } catch {
      // ignore
    }
  }

  return null;
}

function validateRxCard(cardData, requestedGroup) {
  const entry = RX_CARD_REGISTRY[cardData.token];
  if (!entry) return null;

  const groups = Array.isArray(entry.groups) ? entry.groups : [];
  const allowed = groups.includes("*") || groups.includes(requestedGroup);

  if (!allowed) return null;

  return entry;
}

function setModalStatus(text = "", tone = "neutral") {
  const { status } = getModalEls();
  if (!status) return;

  status.textContent = text;
  status.dataset.tone = tone;
}

export function openRxCardModal(group = "vault") {
  currentRequestedGroup = group;

  const { overlay, title, text } = getModalEls();
  if (!overlay) return;

  if (title) title.textContent = "RX Card richiesta";
  if (text) {
    text.textContent =
      "Avvicina una RX Card compatibile per sbloccare questa reaction segreta.";
  }

  setModalStatus("⚠️Attiva NFC nelle impostazioni del device.", "neutral");

  overlay.classList.add("visible");
  overlay.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeRxCardModal() {
  const { overlay } = getModalEls();
  if (!overlay) return;

  overlay.classList.remove("visible");
  overlay.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

async function scanAndUnlockWithRxCard() {
  if (!("NDEFReader" in window)) {
    throw new Error("Web NFC non supportato da questo dispositivo/browser");
  }

  const ndef = new NDEFReader();
  await ndef.scan();

  setModalStatus("Scansione avviata. Avvicina la RX Card...", "pending");

  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      reject(new Error("Nessuna RX Card rilevata"));
    }, RX_SCAN_TIMEOUT_MS);

    ndef.onreadingerror = () => {
      window.clearTimeout(timeout);
      reject(new Error("Errore durante la lettura della RX Card"));
    };

    ndef.onreading = (event) => {
      window.clearTimeout(timeout);

      const cardData = parseRxCardMessage(event.message);
      if (!cardData) {
        reject(new Error("Tag NFC non compatibile"));
        return;
      }

      const match = validateRxCard(cardData, currentRequestedGroup);
      if (!match) {
        reject(new Error("RX Card non valida per questo contenuto"));
        return;
      }

      unlockSecretGroup(currentRequestedGroup);

      resolve({
        ok: true,
        group: currentRequestedGroup,
        card: match,
        raw: cardData
      });
    };
  });
}

async function handleRxCardScan() {
  try {
    setModalStatus("Attendo la RX Card...", "pending");

    const result = await scanAndUnlockWithRxCard();

    setModalStatus(`Sblocco completato: ${result.group}`, "success");

    if (currentShowToast) {
      currentShowToast(`Reaction segrete sbloccate: ${result.group}`);
    }

    window.setTimeout(async () => {
      closeRxCardModal();
      if (typeof currentOnUnlocked === "function") {
        await currentOnUnlocked(result.group);
      }
    }, 550);
  } catch (error) {
    setModalStatus(error.message || "Impossibile leggere la RX Card", "error");
    if (currentShowToast) {
      currentShowToast(error.message || "Impossibile leggere la RX Card");
    }
  }
}

function makeSecretOverlayMarkup(item) {
  const label = item?.secretLabel || "Reaction segreta";
  const hint = item?.secretHint || "Serve una RX Card per sbloccarla";
  const rxCardImg = "/assets/img/icons/rx-card.png";

  return `
    <div class="rx-secret-overlay" data-secret-overlay="1">
      <div class="rx-secret-badge">${label}</div>
      <div class="rx-secret-hint">${hint}</div>
      <button
        class="rx-secret-unlock-btn"
        type="button"
        data-secret-unlock-btn="1"
      >
        Scansiona RX Card
        
      </button>
  
    </div>
  `;
}
function clearSecretCard(card) {
  card.classList.remove("is-secret-card");
  card.removeAttribute("data-secret-group");

  const overlay = card.querySelector("[data-secret-overlay='1']");
  if (overlay) overlay.remove();
}

function decorateSingleSecretCard(card, item) {
  const secretGroup = item?.secretGroup || "vault";
  const locked = isReactionLocked(item);

  if (!locked) {
    clearSecretCard(card);
    return;
  }

  card.classList.add("is-secret-card");
  card.dataset.secretGroup = secretGroup;

  const imgSlot = card.querySelector(".img-slot") || card;
  let overlay = card.querySelector("[data-secret-overlay='1']");

  if (!overlay) {
    imgSlot.insertAdjacentHTML("beforeend", makeSecretOverlayMarkup(item));
    overlay = card.querySelector("[data-secret-overlay='1']");
  }

  const unlockBtn = overlay?.querySelector("[data-secret-unlock-btn='1']");
  if (unlockBtn && unlockBtn.dataset.bound !== "1") {
    unlockBtn.dataset.bound = "1";

    unlockBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openRxCardModal(secretGroup);
    });
  }
}

export function decorateSecretReactionCards(items = []) {
  const byId = new Map(items.map((item) => [String(item.id), item]));
  const cards = document.querySelectorAll(".card[data-id]");

  cards.forEach((card) => {
    const id = String(card.dataset.id || "");
    const item = byId.get(id);

    if (!item) {
      clearSecretCard(card);
      return;
    }

    decorateSingleSecretCard(card, item);
  });
}

export function bindRxCardSecretSystem({
  showToast,
  onUnlocked
} = {}) {
  currentShowToast = showToast || null;
  currentOnUnlocked = onUnlocked || null;

  const { overlay, scanBtn, cancelBtn, closeBtn } = getModalEls();

  if (scanBtn && scanBtn.dataset.bound !== "1") {
    scanBtn.dataset.bound = "1";
    scanBtn.addEventListener("click", async () => {
      await handleRxCardScan();
    });
  }

  if (cancelBtn && cancelBtn.dataset.bound !== "1") {
    cancelBtn.dataset.bound = "1";
    cancelBtn.addEventListener("click", closeRxCardModal);
  }

  if (closeBtn && closeBtn.dataset.bound !== "1") {
    closeBtn.dataset.bound = "1";
    closeBtn.addEventListener("click", closeRxCardModal);
  }

  if (overlay && overlay.dataset.bound !== "1") {
    overlay.dataset.bound = "1";
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        closeRxCardModal();
      }
    });
  }
}