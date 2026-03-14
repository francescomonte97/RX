const STORAGE_KEY = "rxcore-favorites";
const MAX_HOTLIST = 9;

function readIds() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeIds(ids) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...new Set(ids)]));
}

export function getFavoriteIds() {
  return readIds();
}

export function isFavorite(id) {
  return readIds().includes(id);
}

export function toggleFavorite(id) {
  const ids = readIds();

  if (ids.includes(id)) {
    const next = ids.filter((value) => value !== id);
    writeIds(next);
    return {
      added: false,
      removed: true,
      limit: false
    };
  }

  if (ids.length >= MAX_HOTLIST) {
    return {
      added: false,
      removed: false,
      limit: true
    };
  }

  ids.push(id);
  writeIds(ids);

  return {
    added: true,
    removed: false,
    limit: false
  };
}

export function filterFavorites(reactions) {
  const ids = new Set(readIds());
  return reactions.filter((item) => ids.has(item.id));
}