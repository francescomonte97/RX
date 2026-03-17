import { getFavoriteIds } from "./favorites.js";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

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

Analizza la Hotlist delle reaction preferite dall'utente  e dai un feedback generando dei pattern dove possibile, max 50 parole, non usare markup, non usare parole chiave del dataset ma riformula tutto, usa il termine reaction e non usare mai "reazioni" o "reazione". linguaggio tecnico e psicologico, non ripetere mai le stesse parole. non dare mai del tu all'utente.


Dataset:
${dataset}

Dataset:
${JSON.stringify(dataset, null, 2)}
`.trim();
}

/* ---------------- OPENROUTER ---------------- */

async function askOpenRouter(prompt) {
  const key = "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";

  if (!key) {
    throw new Error("OpenRouter API key mancante");
  }

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "HTTP-Referer": window.location.origin,
      "X-Title": "ReactionDEX"
    },
    body: JSON.stringify({
      model: "openrouter/auto",
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.9
    })
  });

  const rawText = await res.text();

  if (!res.ok) {
    throw new Error(rawText || "Errore OpenRouter");
  }

  let jsonResponse;

  try {
    jsonResponse = JSON.parse(rawText);
  } catch {
    throw new Error("Risposta OpenRouter non leggibile");
  }

  const content = jsonResponse?.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("Risposta OpenRouter vuota");
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
  const topTags = getTopItems(tags, 4);

  const chaosSignals = ["caos", "shock", "dramma", "evento assurdo", "momento intenso", "rissa", "casino"];
  const ironicSignals = ["ridicolo", "clown", "figuraccia", "imbarazzante", "grottesco"];

  const hasChaos = topTags.some((tag) => chaosSignals.includes(String(tag).toLowerCase()));
  const hasIrony = topTags.some((tag) => ironicSignals.includes(String(tag).toLowerCase()));

  

  const creatorsText = topCreators.length ? topCreators.join(", ") : "creator vari";
  const moodText = topMoods[0] || "scene emotivamente instabili";
  const contextText = topContexts[0] || "momenti che prendono una piega discutibile";

  return {
    source: "local",
    identity_text:
      `Guardando la tua Hotlist si capisce subito che tu non perdi tempo con reaction educate o troppo composte. ` +
      `Tu vuoi facce che crollano bene, scene che si inclinano male e quell'energia da "${moodText}" che arriva quando ${contextText} prende il sopravvento. ` +
      `Hai chiaramente un debole per ${creatorsText}, cioè gente che sa offrire il tipo di caos che non si dimentica in fretta.`
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
    const result = await askOpenRouter(prompt);

    return {
      source: "openrouter",
      archetype: result?.archetype || "RX Identity",
      identity_text:
        result?.identity_text ||
        "Tu e il caos visivo avete chiaramente firmato un patto non scritto."
    };
  } catch (error) {
    console.warn("RX Identity fallback locale:", error);
    return buildLocalHotlistIdentity(hotlist);
  }
}
