import { CONFIG } from "./config.js";

function normalizeReaction(raw) {
  return {
    ...raw,
    hiddenTags: Array.isArray(raw.hiddenTags) ? raw.hiddenTags : [],
    weightedTags: Array.isArray(raw.weightedTags) ? raw.weightedTags : [],
    phrases: Array.isArray(raw.phrases) ? raw.phrases : [],
    synonyms: Array.isArray(raw.synonyms) ? raw.synonyms : [],
    moods: Array.isArray(raw.moods) ? raw.moods : [],
    contexts: Array.isArray(raw.contexts) ? raw.contexts : []
  };
}

export async function loadReactions() {
  const response = await fetch(CONFIG.reactionJsonPath, { cache: "no-store" });
  
  if (!response.ok) {
    throw new Error(`Impossibile caricare ${CONFIG.reactionJsonPath}`);
  }
  
  const data = await response.json();
  
  if (!Array.isArray(data)) {
    throw new Error("reaction.json deve contenere un array");
  }
  
  return data.map(normalizeReaction);
}