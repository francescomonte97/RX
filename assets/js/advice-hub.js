import { ADVICE_SECTIONS } from "./advice-hub-data.js";
import {
  animateAdviceFloatOpenHub,
  animateAdviceFloatCloseHub
} from "./advice-float.js";

function getEls() {
  return {
    overlay: document.getElementById("adviceHubOverlay"),
    backdrop: document.getElementById("adviceHubBackdrop"),
    body: document.getElementById("adviceHubBody"),
    closeBtn: document.getElementById("closeAdviceHubBtn")
  };
}

function renderAdviceHub() {
  const { body } = getEls();
  if (!body) return;

  body.innerHTML = ADVICE_SECTIONS.map((section, sectionIndex) => `
    <div class="advice-section" style="--advice-section-delay:${sectionIndex * 60}ms">
      <div class="advice-section-title">${section.title}</div>

      ${section.items.map((item, itemIndex) => `
        <div
          class="advice-item advice-item-expanded"
          data-id="${item.id}"
          style="--advice-item-delay:${(sectionIndex * 60) + (itemIndex * 45)}ms"
        >
          <div class="advice-item-title">${item.title}</div>
          <div class="advice-item-text">${item.text}</div>
        </div>
      `).join("")}
    </div>
  `).join("");
}

function animateAdviceHubOpen() {
  const { body } = getEls();
  if (!body) return;

  body.classList.remove("is-animated");
  void body.offsetWidth;
  body.classList.add("is-animated");
}

export function openAdviceHub() {
  const { overlay, body } = getEls();
  if (!overlay || !body) return;

  animateAdviceFloatOpenHub();

  overlay.classList.add("visible");
  overlay.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";

  animateAdviceHubOpen();
}

export function closeAdviceHub() {
  const { overlay, body } = getEls();
  if (!overlay || !body) return;

  overlay.classList.remove("visible");
  overlay.setAttribute("aria-hidden", "true");
  body.classList.remove("is-animated");
  document.body.style.overflow = "";

  animateAdviceFloatCloseHub();
}

export function bindAdviceHub() {
  const { overlay, backdrop, closeBtn, body } = getEls();
  if (!overlay || !body) return;

  renderAdviceHub();

  backdrop?.addEventListener("click", closeAdviceHub);
  closeBtn?.addEventListener("click", closeAdviceHub);

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      closeAdviceHub();
    }
  });
  }
