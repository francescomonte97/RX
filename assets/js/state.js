export const state = {
  name: "",
  semanticSearchEnabled: false,
  semanticSearchDirty: false,
  lastSemanticQuery: "",
  isSemanticLoading: false,
  favoritesOnly: false,

  gen: [],
  rarity: [],
  year: [],
  month: [],
  imageSource: [],
  creator: [],
  categories: [],

  creatorExactMode: false,

  
  presets: [],
  activePresetId: null
};

export function resetStateFilters() {
  state.gen = [];
  state.rarity = [];
  state.year = [];
  state.month = [];
  state.imageSource = [];
  state.creator = [];
  state.categories = [];

  state.creatorExactMode = false;

  
  state.activePresetId = null;
}
