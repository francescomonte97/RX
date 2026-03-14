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

  creatorExactMode: false
};  

export function resetStateFilters() {  
  state.gen = [];  
  state.rarity = [];  
  state.year = [];  
  state.month = [];  
  state.imageSource = [];  
  state.creator = [];  

  state.creatorExactMode = false;
}