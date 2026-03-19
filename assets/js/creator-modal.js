const KEY = "reactiondex:firstOpen";

let currentInstallHandler = null;
let canCloseCreatorModal = false;
let typingTimerIds = [];
let creatorModalSessionId = 0;

function getEl() {
  return {
    overlay: document.getElementById("creatorModalOverlay"),
    backdrop: document.getElementById("creatorModalBackdrop"),
    card: document.getElementById("creatorModalCard"),
    text: document.getElementById("creatorModalText"),
    avatar: document.getElementById("creatorModalAvatar"),
    tag: document.getElementById("creatorModalAdvice"),
    actions: document.getElementById("creatorModalActions")
  };
}

function clearTypingTimers() {
  typingTimerIds.forEach((id) => window.clearTimeout(id));
  typingTimerIds = [];
}

function resetCreatorModalContent() {
  const el = getEl();
  if (!el.text || !el.actions || !el.tag) return;

  clearTypingTimers();
  canCloseCreatorModal = false;

  el.text.textContent = "";
  el.text.classList.remove("is-typing");

  el.actions.innerHTML = "";
  el.actions.style.display = "none";

  el.tag.textContent = "lipu's advice";
}

function typeWriter(el, text, speed = 26, sessionId) {
  if (!el) return;

  el.textContent = "";
  el.classList.add("is-typing");
  canCloseCreatorModal = false;

  let i = 0;

  function tick() {
    if (sessionId !== creatorModalSessionId) return;

    if (i >= text.length) {
      el.classList.remove("is-typing");
      canCloseCreatorModal = true;
      return;
    }

    const char = text[i];
    el.textContent += char;
    i += 1;

    let delay = speed;
    if (char === "," || char === ";") delay += 80;
    if (char === "." || char === "!" || char === "?") delay += 140;

    const t = window.setTimeout(tick, delay);
    typingTimerIds.push(t);
  }

  const starter = window.setTimeout(tick, 200);
  typingTimerIds.push(starter);
}

function renderActions({ showActions = false, onInstall } = {}) {
  const el = getEl();
  if (!el.actions) return;

  el.actions.innerHTML = "";
  el.actions.style.display = showActions ? "flex" : "none";

  if (!showActions) return;

  el.actions.innerHTML = `
    <button class="creator-modal-primary" id="creatorInstallBtn" type="button">
      Installa
    </button>

    <button class="creator-modal-secondary" id="creatorLaterBtn" type="button">
      Più tardi
    </button>
  `;

  const installBtn = document.getElementById("creatorInstallBtn");
  const laterBtn = document.getElementById("creatorLaterBtn");

  laterBtn?.addEventListener("click", () => {
    closeCreatorModal();
  });

  installBtn?.addEventListener("click", async () => {
    if (onInstall) {
      await onInstall();
    }
  });
}

export function setCreatorModalInstallHandler(handler) {
  currentInstallHandler = handler;
}

export function openCreatorModal({
  text = "Per un’esperienza più fluida puoi installare Reactiondex come app sul tuo dispositivo.",
  avatar = "lipu_av",
  creatorName = "Lipu",
  showActions = false
} = {}) {
  const el = getEl();
  if (!el.overlay || !el.text) return;

  creatorModalSessionId += 1;
  const sessionId = creatorModalSessionId;

  resetCreatorModalContent();

  if (el.avatar) {
    el.avatar.src = `./assets/img/creators/${avatar}.png`;
    el.avatar.onerror = () => {
      el.avatar.src = "./assets/img/creators/lipu_av.jpg";
    };
  }

  if (el.tag) {
    el.tag.textContent = `${creatorName.toLowerCase()}'s advice`;
  }

  renderActions({
    showActions,
    onInstall: currentInstallHandler
  });

  el.overlay.classList.add("visible");
  el.overlay.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";

  typeWriter(el.text, text, 26, sessionId);
}

export function closeCreatorModal({ markSeen = true } = {}) {
  const el = getEl();
  if (!el.overlay) return;

  creatorModalSessionId += 1;

  el.overlay.classList.remove("visible");
  el.overlay.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";

  resetCreatorModalContent();

  if (markSeen) {
    localStorage.setItem(KEY, "1");
  }
}

export function shouldShowFirstOpenCreatorModal() {
  return localStorage.getItem(KEY) !== "1";
}

export function bindCreatorModalEvents() {
  const el = getEl();
  if (!el.backdrop || el.backdrop.dataset.bound === "1") return;

  el.backdrop.dataset.bound = "1";

  el.backdrop.addEventListener("click", () => {
    if (!canCloseCreatorModal) return;
    closeCreatorModal();
  });
}

export function bindCreatorModalSwipeDismiss() {
  return;
                    }
