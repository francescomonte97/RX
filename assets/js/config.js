export const CONFIG = {
  reactionJsonPath: "./reaction.json",
  githubRawBase: "",
  whatsappBase: "https://wa.me/?text=",
  appBaseShareUrl: "https://reactiondex.it/r",

  image: {
    fallbackFile: "placeholder.jpg",
    candidateBases: [
      "https://reactiondex.it/reaction"
    ]
  },

  search: {
    minSemanticScore: 5.5,
    weakMatchPenaltyThreshold: 8,
    weakMatchPenalty: 2,
    debugMatchScore: false,
    tfidfBoost: 26,
    fuzzy: {
      enabled: true,
      maxDistanceShort: 1,
      maxDistanceLong: 2,
      bonus: 2.2
    }
  }
};
