import { getFavoriteIds } from "./favorites.js";

const HOTLIST_PROXY_URL = "https://rx.montefortefrancesco50.workers.dev/";

/* ---------------- DATASET ---------------- */

function getHotlistReactions(allReactions = []) {
  const ids = new Set(getFavoriteIds());
  return allReactions.filter((r) => ids.has(r.id));
}

function buildDataset(hotlist = []) {
  return hotlist.map((r) => ({
    name: r.name || "",
    creators: Array.isArray(r.creators) ? r.creators : [],
    moods: Array.isArray(r.moods) ? r.moods : [],
    contexts: Array.isArray(r.contexts) ? r.contexts : [],
    tags: Array.isArray(r.hiddenTags) ? r.hiddenTags : []
  }));
}

/* ---------------- PROMPT ---------------- */

function buildPrompt(dataset) {
  return `
Analizza la Hotlist delle reaction preferite dall'utente e dai un feedback generando dei pattern dove possibile, max 50 parole, non usare markup, non usare parole chiave del dataset ma riformula tutto, usa il termine reaction e non usare mai "reazioni" o "reazione". Linguaggio tecnico e psicologico, non ripetere mai le stesse parole. Non dare mai del tu all'utente.

Dataset:
${JSON.stringify(dataset, null, 2)}
`.trim();
}

/* ---------------- PROXY WORKER ---------------- */

async function askHotlistProxy(prompt) {
  const res = await fetch(HOTLIST_PROXY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ prompt })
  });

  const rawText = await res.text();

  if (!res.ok) {
    throw new Error(rawText || "Errore proxy");
  }

  let data;
  try {
    data = JSON.parse(rawText);
  } catch {
    throw new Error("Risposta proxy non leggibile");
  }

  const content = data?.choices?.[0]?.message?.content;

  if (!content) {
    if (data?.identity_text) return data;
    throw new Error("Risposta proxy vuota");
  }

  const cleaned = String(content)
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);

    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return {
          identity_text: cleaned
        };
      }
    }

    return {
      identity_text: cleaned
    };
  }
}

/* ---------------- LOCAL FALLBACK ---------------- */

function getTopItems(list = [], limit = 3) {
  const map = new Map();

  list.forEach((item) => {
    const key = String(item).trim();
    if (!key) return;
    map.set(key, (map.get(key) || 0) + 1);
  });

  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name]) => name);
}

function buildLocalHotlistIdentity(hotlist = []) {
  const creators = hotlist.flatMap((r) => r.creators || []);
  const moods = hotlist.flatMap((r) => r.moods || []);
  const contexts = hotlist.flatMap((r) => r.contexts || []);
  const tags = hotlist.flatMap((r) => r.hiddenTags || []);

  const topCreators = getTopItems(creators, 3);
  const topMoods = getTopItems(moods, 3);
  const topContexts = getTopItems(contexts, 3);

  const creatorsText = topCreators.length ? topCreators.join(", ") : "creator vari";
  const moodText = topMoods[0] || "scene emotivamente instabili";
  const contextText = topContexts[0] || "momenti che prendono una piega discutibile";

  return {
    source: "local",
    identity_text:
      `Guardando la Hotlist emerge una preferenza chiara per reaction poco composte e ad alta intensità. ` +
      `Si nota una tendenza verso scene con energia da "${moodText}" che si attiva quando ${contextText} prende il sopravvento. ` +
      `La ricorrenza di ${creatorsText} suggerisce una ricerca costante di impatto e caos memorabile.`
  };
}

/* ---------------- MAIN FUNCTION ---------------- */

export async function analyzeHotlistIdentity(allReactions = []) {
  const hotlist = getHotlistReactions(allReactions);

  if (hotlist.length < 3) {
    throw new Error("Servono almeno 3 reaction nella Hotlist");
  }

  const dataset = buildDataset(hotlist);
  const prompt = buildPrompt(dataset);

  try {
    const result = await askHotlistProxy(prompt);

    return {
      source: "openrouter",
      archetype: result?.archetype || "RX Identity",
      identity_text:
        result?.identity_text ||
        "Il profilo della Hotlist mostra una preferenza netta per reaction ad alta intensità visiva."
    };
  } catch (error) {
    console.warn("RX Identity fallback locale:", error);
    return buildLocalHotlistIdentity(hotlist);
  }
}
