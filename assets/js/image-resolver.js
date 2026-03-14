import { CONFIG } from "./config.js";

const cache = new Map();

function buildCandidates(card) {
  const candidates = [];

  if (card.image) {
    candidates.push(card.image);
  }

  if (card.imageFile) {
    CONFIG.image.candidateBases.forEach((base) => {
      candidates.push(`${base}/${card.imageFile}`);
    });

    if (CONFIG.githubRawBase) {
      candidates.push(`${CONFIG.githubRawBase}/${card.imageFile}`);
    }
  }

  if (card.slug) {
    CONFIG.image.candidateBases.forEach((base) => {
      candidates.push(`${base}/${card.slug}.jpg`);
      candidates.push(`${base}/${card.slug}.png`);
      candidates.push(`${base}/${card.slug}.webp`);
    });

    if (CONFIG.githubRawBase) {
      candidates.push(`${CONFIG.githubRawBase}/${card.slug}.jpg`);
      candidates.push(`${CONFIG.githubRawBase}/${card.slug}.png`);
      candidates.push(`${CONFIG.githubRawBase}/${card.slug}.webp`);
    }
  }

  return [...new Set(candidates)];
}

function testImage(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });
}

export async function resolveImage(card) {
  const cacheKey = `${card.id}-${card.image || ""}-${card.imageFile || ""}-${card.slug || ""}`;

  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  const candidates = buildCandidates(card);

  for (const candidate of candidates) {
    const ok = await testImage(candidate);
    if (ok) {
      cache.set(cacheKey, candidate);
      return candidate;
    }
  }

  const fallback = `${CONFIG.image.candidateBases[0]}/${CONFIG.image.fallbackFile}`;
  cache.set(cacheKey, fallback);
  return fallback;
}

export async function enrichCardsWithResolvedImages(cards = []) {
  return Promise.all(
    cards.map(async (card) => ({
      ...card,
      resolvedImage: await resolveImage(card)
    }))
  );
}