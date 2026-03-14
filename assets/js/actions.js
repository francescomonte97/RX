import { CONFIG } from "./config.js";

function slugify(value = "") {
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’`]/g, "")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function getProjectBase() {
  const segments = window.location.pathname.split("/").filter(Boolean);
  return segments.length > 0 ? `/${segments[0]}` : "";
}

function buildShareUrl(card) {
  if (card.shareUrl) return card.shareUrl;

  const origin = window.location.origin;
  const projectBase = getProjectBase();
  const slug = card.slug || slugify(card.name);

  return `${origin}${projectBase}/r/${slug}.html`;
}

export async function downloadImage(card) {
  const source = card.resolvedImage || card.image;
  const fileName = `${card.slug || slugify(card.name)}.jpg`;

  try {
    const response = await fetch(source, { mode: "cors" });
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(blobUrl), 1200);
    return { ok: true, message: "Download avviato" };
  } catch {
    window.open(source, "_blank");
    return { ok: false, message: "Immagine aperta in una nuova scheda" };
  }
}

export async function shareCard(card) {
  const text = `Guarda questa reaction: ${card.name}`;
  const url = buildShareUrl(card);
  const shareData = {
    title: `${card.name} • Reactiondex`,
    text,
    url
  };

  if (navigator.share) {
    try {
      await navigator.share(shareData);
      return { ok: true, message: "Condivisione avviata" };
    } catch {
      return { ok: false, message: "Condivisione annullata" };
    }
  }

  try {
    await navigator.clipboard.writeText(url);
    return { ok: true, message: "Link copiato negli appunti" };
  } catch {
    const whatsappUrl = `${CONFIG.whatsappBase}${encodeURIComponent(`${text} ${url}`)}`;
    window.open(whatsappUrl, "_blank");
    return { ok: true, message: "Condivisione WhatsApp" };
  }
}