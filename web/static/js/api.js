const IRSApi = (() => {
  const BASE = "/api";

  async function request(path, options = {}) {
    const response = await fetch(`${BASE}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...options
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`API ${response.status}: ${message}`);
    }

    return response.json();
  }

  function fetchIdeas(status = "all") {
    return request(`/ideas?status=${encodeURIComponent(status)}`);
  }

  function fetchIdea(ideaId) {
    return request(`/ideas/${encodeURIComponent(ideaId)}`);
  }

  function fetchTop10() {
    return request("/top10");
  }

  function fetchMovers() {
    return request("/movers");
  }

  function fetchRuns(limit = 24) {
    return request(`/runs?limit=${limit}`);
  }

  function fetchSources() {
    return request("/sources");
  }

  function fetchStats() {
    return request("/stats");
  }

  function dismissIdea(ideaId) {
    return request(`/ideas/${encodeURIComponent(ideaId)}/dismiss`, { method: "POST" });
  }

  function restoreIdea(ideaId) {
    return request(`/ideas/${encodeURIComponent(ideaId)}/restore`, { method: "POST" });
  }

  function markBuilding(ideaId) {
    return request(`/ideas/${encodeURIComponent(ideaId)}/building`, { method: "POST" });
  }

  function setScore(ideaId, score) {
    return request(`/ideas/${encodeURIComponent(ideaId)}/score`, {
      method: "POST",
      body: JSON.stringify({ score })
    });
  }

  function setField(ideaId, field, value) {
    return request(`/ideas/${encodeURIComponent(ideaId)}/field`, {
      method: "POST",
      body: JSON.stringify({ field, value })
    });
  }

  function enableSource(sourceId) {
    return request(`/sources/${encodeURIComponent(sourceId)}/enable`, { method: "POST" });
  }

  function disableSource(sourceId) {
    return request(`/sources/${encodeURIComponent(sourceId)}/disable`, { method: "POST" });
  }

  function runNow() {
    return request("/run-now", { method: "POST" });
  }

  async function loadDashboard() {
    const [ideas, top10, movers, runs, sources, stats] = await Promise.all([
      fetchIdeas("all"),
      fetchTop10(),
      fetchMovers(),
      fetchRuns(24),
      fetchSources(),
      fetchStats()
    ]);

    return { ideas, top10, movers, runs, sources, stats };
  }

  return {
    fetchIdeas, fetchIdea, fetchTop10, fetchMovers, fetchRuns, fetchSources, fetchStats,
    dismissIdea, restoreIdea, markBuilding, setScore, setField, enableSource, disableSource, runNow, loadDashboard
  };
})();
