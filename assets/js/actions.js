import { CONFIG } from "./config.js";

export async function downloadImage(card) {
  const source = card.resolvedImage || card.image;
  const fileName = `${card.slug || card.name.toLowerCase().replace(/\s+/g, "-")}.jpg`;

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
  const url = card.shareUrl || `${CONFIG.appBaseShareUrl}/${card.slug}`;
  const shareData = { title: card.name, text, url };

  if (navigator.share) {
    try {
      await navigator.share(shareData);
      return { ok: true, message: "Condivisione avviata" };
    } catch {
      return { ok: false, message: "Condivisione annullata" };
    }
  }

  const whatsappUrl = `${CONFIG.whatsappBase}${encodeURIComponent(`${text} ${url}`)}`;
  window.open(whatsappUrl, "_blank");
  return { ok: true, message: "Condivisione WhatsApp" };
}