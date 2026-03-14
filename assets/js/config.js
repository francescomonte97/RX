export const CONFIG = {
  reactionJsonPath: "./reaction.json",
  githubRawBase: "https://raw.githubusercontent.com/TUO-USERNAME/TUO-REPO/main/reaction",
  whatsappBase: "https://wa.me/?text=",
  appBaseShareUrl: "https://tuodominio.it/reactions",

  image: {
    fallbackFile: "placeholder.jpg",
    candidateBases: [
      "./reaction",
      "../reaction",
      "../../reaction",
      "../../../reaction"
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