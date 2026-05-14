const IRSState = (() => {
  const state = {
    ideas: [],
    top10: [],
    ideaDetails: {},
    movers: { entries: [], exits: [] },
    runs: [],
    sources: [],
    stats: null,
    currentView: "radar",
    inspectIdeaId: null,
    inspectPeek: false,
    settingsOpen: false,
    sortSheetOpen: false,
    searchSheetOpen: false,
    loading: true,
    error: null,
    appearance: "default",
    reducedMotionOverride: false,
    moversRange: "24h",
    explore: {
      activeFilters: [],
      sort: "score",
      searchQuery: "",
      page: 1
    },
    keyboardFocusIndex: 0
  };

  const listeners = new Set();

  function get(key) {
    if (typeof key === "string") {
      return state[key];
    }
    return JSON.parse(JSON.stringify(state));
  }

  function set(updates) {
    Object.assign(state, updates);
    notify();
  }

  function merge(path, updates) {
    state[path] = { ...state[path], ...updates };
    notify();
  }

  function setNested(path, updater) {
    state[path] = updater(state[path]);
    notify();
  }

  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function notify() {
    for (const listener of listeners) {
      listener(state);
    }
  }

  function getIdeaById(ideaId) {
    return state.ideas.find((idea) => idea.id === ideaId) || null;
  }

  function getDetailById(ideaId) {
    return state.ideaDetails[ideaId] || null;
  }

  function upsertDetail(ideaId, detail) {
    state.ideaDetails = { ...state.ideaDetails, [ideaId]: detail };
    notify();
  }

  return {
    get,
    set,
    merge,
    setNested,
    subscribe,
    getIdeaById,
    getDetailById,
    upsertDetail
  };
})();
