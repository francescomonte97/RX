const ADVICE_FLOAT_ENABLED_KEY = "reactiondex:adviceFloatEnabled";
const ADVICE_FLOAT_POS_KEY = "reactiondex:adviceFloatPos";

function getElements() {
  return {
    root: document.getElementById("adviceFloat"),
    button: document.getElementById("adviceFloatBtn"),
    grid: document.getElementById("reactionGrid")
  };
}

export function animateAdviceFloatOpenHub() {
  const { root } = getElements();
  if (!root) return;

  root.classList.remove("is-closing-hub");
  root.classList.remove("is-opening-hub");
  void root.offsetWidth;
  root.classList.add("is-opening-hub");

  window.setTimeout(() => {
    root.classList.remove("is-opening-hub");
  }, 340);
}

export function animateAdviceFloatCloseHub() {
  const { root } = getElements();
  if (!root) return;

  root.classList.remove("is-opening-hub");
  root.classList.remove("is-closing-hub");
  void root.offsetWidth;
  root.classList.add("is-closing-hub");

  window.setTimeout(() => {
    root.classList.remove("is-closing-hub");
  }, 300);
}




function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function saveAdviceFloatPosition(x, y) {
  localStorage.setItem(ADVICE_FLOAT_POS_KEY, JSON.stringify({ x, y }));
}

function loadAdviceFloatPosition() {
  try {
    return JSON.parse(localStorage.getItem(ADVICE_FLOAT_POS_KEY) || "null");
  } catch {
    return null;
  }
}

export function isAdviceFloatEnabled() {
  const raw = localStorage.getItem(ADVICE_FLOAT_ENABLED_KEY);
  return raw !== "0";
}

export function setAdviceFloatEnabled(enabled) {
  localStorage.setItem(ADVICE_FLOAT_ENABLED_KEY, enabled ? "1" : "0");
}

function setFloatPosition(root, x, y) {
  root.dataset.x = String(x);
  root.dataset.y = String(y);
  root.style.transform = `translate3d(${x}px, ${y}px, 0)`;
}

function getSavedOrDefaultPosition(root) {
  const saved = loadAdviceFloatPosition();
  if (saved && typeof saved.x === "number" && typeof saved.y === "number") {
    return saved;
  }

  const defaultX = window.innerWidth - root.offsetWidth - 16;
  const defaultY = window.innerHeight - root.offsetHeight - 96;

  return {
    x: Math.max(6, defaultX),
    y: Math.max(6, defaultY)
  };
}

function applySavedFloatPosition() {
  const { root } = getElements();
  if (!root) return;

  const pos = getSavedOrDefaultPosition(root);
  setFloatPosition(root, pos.x, pos.y);
}

export function renderAdviceFloatVisibility() {
  const { root } = getElements();
  if (!root) return;

  const enabled = isAdviceFloatEnabled();
  root.classList.toggle("is-hidden", !enabled);
  root.setAttribute("aria-hidden", String(!enabled));
}

export function hideAdviceFloat() {
  const { root } = getElements();
  if (!root) return;

  setAdviceFloatEnabled(false);

  root.classList.remove("is-popping-in");
  root.classList.add("is-popping-out");

  window.setTimeout(() => {
    root.classList.add("is-hidden");
    root.classList.remove("is-popping-out");
    renderAdviceFloatVisibility();
  }, 320);
}

export function showAdviceFloat() {
  const { root } = getElements();
  if (!root) return;

  setAdviceFloatEnabled(true);

  root.classList.remove("is-hidden");
  root.classList.remove("is-popping-out");
  root.classList.add("is-popping-in");

  renderAdviceFloatVisibility();

  window.setTimeout(() => {
    root.classList.remove("is-popping-in");
  }, 340);
}

export function bindAdviceFloat({ onOpen } = {}) {
  const { root, button } = getElements();
  if (!root || !button || button.dataset.bound === "1") return;

  button.dataset.bound = "1";

  let pressTimer = null;
  let longPressTriggered = false;
  let moved = false;
  let dragging = false;

  let pointerStartX = 0;
  let pointerStartY = 0;
  let originX = 0;
  let originY = 0;

  let targetX = 0;
  let targetY = 0;
  let rafId = null;

  const LONG_PRESS_MS = 2000;
  const DRAG_THRESHOLD = 8;


  root.classList.remove("is-ready");
  applySavedFloatPosition();
  renderAdviceFloatVisibility();

  requestAnimationFrame(() => {
    root.classList.add("is-ready");
  });

  function clearPress() {
    clearTimeout(pressTimer);
    pressTimer = null;
    root.classList.remove("is-holding");
  }

  function updatePosition() {
    rafId = null;
    setFloatPosition(root, targetX, targetY);
  }

  function schedulePositionUpdate() {
    if (rafId !== null) return;
    rafId = window.requestAnimationFrame(updatePosition);
  }

  function stopDragging(commit = true) {
    if (!dragging) return;

    dragging = false;
    root.classList.remove("is-dragging");

    if (rafId !== null) {
      window.cancelAnimationFrame(rafId);
      rafId = null;
    }

    setFloatPosition(root, targetX, targetY);

    if (commit) {
      saveAdviceFloatPosition(targetX, targetY);
    }
  }

  button.addEventListener("pointerdown", (event) => {
    longPressTriggered = false;
    moved = false;
    dragging = false;

    pointerStartX = event.clientX;
    pointerStartY = event.clientY;

    originX = Number(root.dataset.x || 0);
    originY = Number(root.dataset.y || 0);

    targetX = originX;
    targetY = originY;

    root.classList.add("is-holding");

    clearTimeout(pressTimer);
    pressTimer = window.setTimeout(() => {
      longPressTriggered = true;
      hideAdviceFloat();
    }, LONG_PRESS_MS);

    button.setPointerCapture?.(event.pointerId);
  });

  button.addEventListener("pointermove", (event) => {
    const dx = event.clientX - pointerStartX;
    const dy = event.clientY - pointerStartY;
    const distance = Math.hypot(dx, dy);

    if (distance > DRAG_THRESHOLD) {
      moved = true;
      clearPress();
    }

    if (!moved) return;

    if (!dragging) {
      dragging = true;
      root.classList.add("is-dragging");
    }

    const maxX = window.innerWidth - root.offsetWidth - 6;
    const maxY = window.innerHeight - root.offsetHeight - 6;

    targetX = clamp(originX + dx, 6, maxX);
    targetY = clamp(originY + dy, 6, maxY);

    schedulePositionUpdate();
  });

  button.addEventListener("pointerup", () => {
    clearPress();

    if (dragging) {
      stopDragging(true);
      return;
    }

    if (longPressTriggered) {
      longPressTriggered = false;
      return;
    }

    if (!isAdviceFloatEnabled()) return;
    if (onOpen) onOpen();
  });

  button.addEventListener("pointercancel", () => {
    clearPress();
    stopDragging(false);
  });

  button.addEventListener("pointerleave", () => {
    clearPress();
  });

  window.addEventListener("resize", () => {
    const currentX = Number(root.dataset.x || 0);
    const currentY = Number(root.dataset.y || 0);

    const maxX = window.innerWidth - root.offsetWidth - 6;
    const maxY = window.innerHeight - root.offsetHeight - 6;

    const nextX = clamp(currentX, 6, maxX);
    const nextY = clamp(currentY, 6, maxY);

    setFloatPosition(root, nextX, nextY);
    saveAdviceFloatPosition(nextX, nextY);
  });
}

export function bindAdviceFloatReactivateFromCards() {
  const { grid } = getElements();
  if (!grid || grid.dataset.adviceRebind === "1") return;

  grid.dataset.adviceRebind = "1";

  let pressTimer = null;
  let activeCard = null;
  let startX = 0;
  let startY = 0;

  const LONG_PRESS_MS = 2000;
  const MOVE_TOLERANCE = 12;

  function clearCardPress() {
    clearTimeout(pressTimer);
    pressTimer = null;
    activeCard = null;
    startX = 0;
    startY = 0;
  }

  grid.addEventListener("pointerdown", (event) => {
    const card = event.target.closest(".card");
    if (!card) return;

    const actionButton = event.target.closest("[data-action]");
    if (actionButton) return;

    activeCard = card;
    startX = event.clientX;
    startY = event.clientY;

    clearTimeout(pressTimer);
    pressTimer = window.setTimeout(() => {
      showAdviceFloat();
      clearCardPress();
    }, LONG_PRESS_MS);
  });

  grid.addEventListener("pointermove", (event) => {
    if (!activeCard || !pressTimer) return;

    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    const distance = Math.hypot(dx, dy);

    if (distance > MOVE_TOLERANCE) {
      clearCardPress();
    }
  });

  grid.addEventListener("pointerup", clearCardPress);
  grid.addEventListener("pointercancel", clearCardPress);
  grid.addEventListener("pointerleave", clearCardPress);
}
