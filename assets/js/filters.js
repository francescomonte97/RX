import { CONFIG } from "./config.js";

const ITALIAN_STOPWORDS = new Set([
  "a", "ad", "al", "alla", "allo", "ai", "agli", "all", "alle",
  "da", "dal", "dalla", "dallo", "dai", "dagli", "dalle",
  "di", "del", "della", "dello", "dei", "degli", "delle",
  "e", "ed", "o", "oppure", "ma", "anche", "poi",
  "in", "nel", "nella", "nello", "nei", "negli", "nelle",
  "su", "sul", "sulla", "sullo", "sui", "sugli", "sulle",
  "con", "senza", "per", "tra", "fra", "verso", "come",
  "il", "lo", "la", "i", "gli", "le", "un", "uno", "una",
  "mi", "ti", "si", "ci", "vi", "ne",
  "io", "tu", "lui", "lei", "noi", "voi", "loro",
  "che", "chi", "cui", "non", "siamo", "sono", "sei", "era", "ero",
  "ho", "hai", "ha", "abbiamo", "avete", "hanno",
  "questa", "questo", "quello", "quella", "questi", "quelle",
  "cosa", "qui", "qua", "li", "gia", "molto", "poco"
]);

const OTHER_CREATORS_VALUE = "__others__";

const PRIMARY_CREATORS = [
  "Min",
  "Lussu",
  "Fez",
  "Tommi",
  "Frec",
  "Lipu"
];

export function normalizeText(value = "") {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’`]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeText(value = "") {
  return normalizeText(value).split(" ").filter(Boolean);
}

function removeStopwords(tokens = []) {
  return tokens.filter((token) => token.length > 1 && !ITALIAN_STOPWORDS.has(token));
}

function uniqueTokens(tokens = []) {
  return [...new Set(tokens)];
}

export function buildSmartTokens(value = "") {
  return uniqueTokens(removeStopwords(tokenizeText(value)));
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeCreators(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

function levenshtein(a = "", b = "") {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i += 1) dp[i][0] = i;
  for (let j = 0; j <= n; j += 1) dp[0][j] = j;

  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }

  return dp[m][n];
}

function isFuzzyClose(token, candidate) {
  if (!CONFIG.search.fuzzy.enabled) return false;
  if (!token || !candidate) return false;
  if (Math.abs(token.length - candidate.length) > 2) return false;

  const maxDistance = token.length <= 4
    ? CONFIG.search.fuzzy.maxDistanceShort
    : CONFIG.search.fuzzy.maxDistanceLong;

  return levenshtein(token, candidate) <= maxDistance;
}

function flattenReactionSearchParts(reaction) {
  return {
    hiddenTags: safeArray(reaction.hiddenTags),
    weightedTags: safeArray(reaction.weightedTags).map((item) => ({
      tag: item.tag,
      weight: Number(item.weight) || 1
    })),
    phrases: safeArray(reaction.phrases),
    synonyms: safeArray(reaction.synonyms),
    moods: safeArray(reaction.moods),
    contexts: safeArray(reaction.contexts)
  };
}

function buildSemanticDocuments(reaction) {
  const parts = flattenReactionSearchParts(reaction);

  const weighted = parts.weightedTags.flatMap((item) =>
    Array.from({ length: Math.max(1, Math.round(item.weight)) }, () => item.tag)
  );

  return [
    ...parts.hiddenTags,
    ...weighted,
    ...parts.phrases,
    ...parts.synonyms,
    ...parts.moods,
    ...parts.contexts
  ].join(" ");
}

function dotProduct(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) sum += a[i] * b[i];
  return sum;
}

function magnitude(vec) {
  return Math.sqrt(vec.reduce((sum, value) => sum + value * value, 0));
}

function cosineSimilarity(a, b) {
  const magA = magnitude(a);
  const magB = magnitude(b);

  if (!magA || !magB) return 0;
  return dotProduct(a, b) / (magA * magB);
}

function buildVocabulary(docTokensList) {
  return [...new Set(docTokensList.flat())];
}

function computeIdf(vocabulary, docTokensList) {
  const docCount = docTokensList.length;

  return vocabulary.map((term) => {
    const docsWithTerm = docTokensList.reduce((count, tokens) => {
      return count + (tokens.includes(term) ? 1 : 0);
    }, 0);

    return Math.log((1 + docCount) / (1 + docsWithTerm)) + 1;
  });
}

function buildTfIdfVector(tokens, vocabulary, idfValues) {
  const frequencies = new Map();

  tokens.forEach((token) => {
    frequencies.set(token, (frequencies.get(token) || 0) + 1);
  });

  const maxFreq = Math.max(1, ...frequencies.values(), 1);

  return vocabulary.map((term, index) => {
    const freq = frequencies.get(term) || 0;
    const tf = freq / maxFreq;
    return tf * idfValues[index];
  });
}

function buildFieldIndex(reaction) {
  const parts = flattenReactionSearchParts(reaction);

  return {
    phraseFields: [
      ...parts.phrases.map((text) => ({ text, weight: 12 })),
      ...parts.contexts.map((text) => ({ text, weight: 8 }))
    ],
    tokenFields: [
      ...parts.hiddenTags.map((text) => ({ text, weight: 4 })),
      ...parts.weightedTags.map((item) => ({ text: item.tag, weight: item.weight * 2.2 })),
      ...parts.synonyms.map((text) => ({ text, weight: 5 })),
      ...parts.moods.map((text) => ({ text, weight: 5 })),
      ...parts.contexts.map((text) => ({ text, weight: 4 })),
      ...parts.phrases.map((text) => ({ text, weight: 6 }))
    ]
  };
}

function scoreTokenAgainstField(token, fieldText, fieldWeight) {
  const normalizedField = normalizeText(fieldText);
  const fieldTokens = buildSmartTokens(fieldText);

  if (!token || !normalizedField) return 0;

  if (normalizedField === token) return fieldWeight * 3;
  if (fieldTokens.includes(token)) return fieldWeight * 2;
  if (normalizedField.startsWith(token)) return fieldWeight * 1.3;
  if (normalizedField.includes(token)) return fieldWeight * 0.9;

  for (const fieldToken of fieldTokens) {
    if (isFuzzyClose(token, fieldToken)) {
      return fieldWeight * CONFIG.search.fuzzy.bonus;
    }
  }

  return 0;
}

function scoreFullQueryMatches(fullQuery, reactionIndex) {
  let score = 0;

  reactionIndex.phraseFields.forEach((field) => {
    const normalized = normalizeText(field.text);

    if (normalized === fullQuery) score += field.weight * 3;
    else if (normalized.includes(fullQuery)) score += field.weight * 1.8;
  });

  return score;
}

function scoreTokenCoverage(queryTokens, reactionIndex) {
  let covered = 0;

  queryTokens.forEach((token) => {
    const hit = reactionIndex.tokenFields.some((field) => {
      return scoreTokenAgainstField(token, field.text, field.weight) > 0;
    });

    if (hit) covered += 1;
  });

  return covered;
}

function scoreSemanticHeuristics(query, reaction) {
  const queryTokens = buildSmartTokens(query);
  const fullQuery = normalizeText(query);

  if (!queryTokens.length && !fullQuery) return 0;

  const reactionIndex = buildFieldIndex(reaction);
  let score = 0;

  reactionIndex.tokenFields.forEach((field) => {
    queryTokens.forEach((token) => {
      score += scoreTokenAgainstField(token, field.text, field.weight);
    });
  });

  score += scoreFullQueryMatches(fullQuery, reactionIndex);

  const coverage = scoreTokenCoverage(queryTokens, reactionIndex);
  score += coverage * 3.5;

  if (queryTokens.length > 1) {
    const ratio = coverage / queryTokens.length;
    if (ratio >= 1) score += 12;
    else if (ratio >= 0.75) score += 8;
    else if (ratio >= 0.5) score += 4;
  }

  if (score > 0 && score < CONFIG.search.weakMatchPenaltyThreshold) {
    score -= CONFIG.search.weakMatchPenalty;
  }

  return Math.max(0, score);
}

function scoreCosineSemantic(query, reactions) {
  const queryTokens = buildSmartTokens(query);
  if (!queryTokens.length) return new Map();

  const documents = reactions.map((reaction) => buildSmartTokens(buildSemanticDocuments(reaction)));
  const queryDoc = queryTokens;
  const allDocs = [...documents, queryDoc];

  const vocabulary = buildVocabulary(allDocs);
  const idfValues = computeIdf(vocabulary, allDocs);
  const queryVector = buildTfIdfVector(queryDoc, vocabulary, idfValues);

  const scoreMap = new Map();

  reactions.forEach((reaction, index) => {
    const docVector = buildTfIdfVector(documents[index], vocabulary, idfValues);
    const similarity = cosineSimilarity(queryVector, docVector);
    scoreMap.set(reaction.id, similarity);
  });

  return scoreMap;
}

function normalizeCreatorsList(creators = []) {
  return safeCreators(creators).map((creator) => String(creator).trim());
}

function hasPrimaryCreator(creators = []) {
  return normalizeCreatorsList(creators).some((creator) =>
    PRIMARY_CREATORS.includes(creator)
  );
}

function isCreatorExactMatch(itemCreators = [], selectedCreators = []) {
  if (selectedCreators.length < 2) return false;
  if (itemCreators.length !== selectedCreators.length) return false;

  return selectedCreators.every((creator) => itemCreators.includes(creator));
}

function hasAllSelectedCreators(itemCreators = [], selectedCreators = []) {
  if (selectedCreators.length < 2) return false;
  return selectedCreators.every((creator) => itemCreators.includes(creator));
}

function matchesCreatorFilter(item, state) {
  const selectedCreators = safeArray(state.creator);

  if (!selectedCreators.length) return true;

  const itemCreators = normalizeCreatorsList(item.creators);

  if (state.creatorExactMode && selectedCreators.length >= 2) {
    return isCreatorExactMatch(itemCreators, selectedCreators);
  }

  return selectedCreators.some((selectedCreator) => {
    if (selectedCreator === OTHER_CREATORS_VALUE) {
      return itemCreators.length > 0 && !hasPrimaryCreator(itemCreators);
    }

    return itemCreators.includes(selectedCreator);
  });
}

export function getCreatorExactCount(reactions = [], state) {
  const selectedCreators = safeArray(state.creator);

  if (selectedCreators.length < 2) return 0;

  return reactions.filter((item) => {
    const itemCreators = normalizeCreatorsList(item.creators);
    return isCreatorExactMatch(itemCreators, selectedCreators);
  }).length;
}

export function getCreatorTogetherCount(reactions = [], stateOrCreators = []) {
  const selectedCreators = Array.isArray(stateOrCreators)
    ? safeArray(stateOrCreators)
    : safeArray(stateOrCreators?.creator);

  if (selectedCreators.length < 2) return 0;

  return reactions.filter((item) => {
    const itemCreators = normalizeCreatorsList(item.creators);
    return hasAllSelectedCreators(itemCreators, selectedCreators);
  }).length;
}

export function getCreatorShipPower(reactions = [], stateOrCreators = []) {
  const selectedCreators = Array.isArray(stateOrCreators)
    ? safeArray(stateOrCreators)
    : safeArray(stateOrCreators?.creator);

  if (selectedCreators.length < 2) return 0;

  const creatorCounts = selectedCreators.map((creator) =>
    reactions.filter((item) => {
      const itemCreators = normalizeCreatorsList(item.creators);
      return itemCreators.includes(creator);
    }).length
  );

  const togetherCount = getCreatorTogetherCount(reactions, selectedCreators);
  const averageCount =
    creatorCounts.reduce((sum, count) => sum + count, 0) / creatorCounts.length;

  if (!averageCount) return 0;

  return Math.min(100, Math.round((togetherCount / averageCount) * 100));
}

export function getShipPowerTier(power = 0) {
  if (power >= 75) return "gold";
  if (power >= 50) return "silver";
  if (power >= 25) return "bronze";
  return "neutral";
}

export function getCreatorExactLabel(creators = [], count = 0) {
  if (!Array.isArray(creators) || creators.length < 2) return "";

  const initials = creators
    .map((creator) => String(creator).trim().charAt(0).toUpperCase())
    .join("");

  return `${initials} · ${count}`;
}

export function toggleFilter(state, type, value) {
  const list = state[type];
  const index = list.indexOf(value);

  if (index > -1) list.splice(index, 1);
  else list.push(value);

  if (type === "creator" && safeArray(state.creator).length < 2) {
    state.creatorExactMode = false;
  }
}

export function getActiveFilterCount(state) {
  return (
    state.gen.length +
    state.rarity.length +
    state.year.length +
    state.month.length +
    state.imageSource.length +
    state.creator.length
  );
}

export function getActiveFilterChips(state) {
  const creatorChips =
    state.creatorExactMode && safeArray(state.creator).length >= 2
      ? [`Ship RX: ${safeArray(state.creator).map((creator) => String(creator).trim().charAt(0).toUpperCase()).join("")}`]
      : safeArray(state.creator).map((value) =>
          value === OTHER_CREATORS_VALUE ? "Altri creator" : value
        );

  return [
    ...state.gen,
    ...state.rarity,
    ...state.year,
    ...state.month,
    ...state.imageSource.map((value) => value === "ai" ? "AI" : "REAL"),
    ...creatorChips
  ];
}

function applyBaseFilters(reactions, state) {
  return reactions.filter((item) => {
    const matchGen = state.gen.length === 0 || state.gen.includes(item.gen);
    const matchRarity = state.rarity.length === 0 || state.rarity.includes(item.rarity);
    const matchYear = state.year.length === 0 || state.year.includes(item.year);
    const matchMonth = state.month.length === 0 || state.month.includes(item.month);
    const matchImageSource =
      state.imageSource.length === 0 ||
      state.imageSource.includes(String(item.imageSource || "").toLowerCase());

    const matchCreator = matchesCreatorFilter(item, state);

    return matchGen && matchRarity && matchYear && matchMonth && matchImageSource && matchCreator;
  });
}

export function filterByNameRealtime(reactions, state) {
  const query = normalizeText(state.name);
  const baseFiltered = applyBaseFilters(reactions, state);

  if (!query) return baseFiltered;

  if (query.length === 1) {
    return baseFiltered
      .filter((item) => {
        const normalizedName = normalizeText(item.name);
        const normalizedCreators = normalizeCreatorsList(item.creators).map(normalizeText);

        return (
          normalizedName.startsWith(query) ||
          normalizedCreators.some((creator) => creator.startsWith(query))
        );
      })
      .sort((a, b) => a.name.localeCompare(b.name, "it"));
  }

  return baseFiltered.filter((item) => {
    const normalizedName = normalizeText(item.name);
    const normalizedCreators = normalizeCreatorsList(item.creators).map(normalizeText);

    return (
      normalizedName.includes(query) ||
      normalizedCreators.some((creator) => creator.includes(query))
    );
  });
}

export function filterSemanticManual(reactions, state) {
  const query = normalizeText(state.name);
  const baseFiltered = applyBaseFilters(reactions, state);

  if (!query) return [];

  const cosineMap = scoreCosineSemantic(query, baseFiltered);

  const ranked = baseFiltered
    .map((item) => {
      const heuristic = scoreSemanticHeuristics(query, item);
      const cosine = cosineMap.get(item.id) || 0;
      const combinedScore = heuristic + cosine * CONFIG.search.tfidfBoost;

      return {
        ...item,
        _heuristicScore: heuristic,
        _cosineScore: cosine,
        _matchScore: combinedScore,
        _matchType: "semantic"
      };
    })
    .filter((item) => item._matchScore >= CONFIG.search.minSemanticScore)
    .sort((a, b) => {
      if (b._matchScore !== a._matchScore) {
        return b._matchScore - a._matchScore;
      }
      return a.name.localeCompare(b.name, "it");
    })
    .slice(0, 3);

  if (ranked.length > 0) {
    ranked[0]._isBestMatch = true;
  }

  return ranked.map((item, index, list) => {
    const maxScore = list[0]?._matchScore || item._matchScore || 1;
    const confidence = Math.max(0, Math.min(100, Math.round((item._matchScore / maxScore) * 100)));

    return {
      ...item,
      _confidence: confidence
    };
  });
}