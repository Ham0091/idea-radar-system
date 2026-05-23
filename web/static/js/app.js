(function () {
  "use strict";

  var PAGE_SIZE = 16;
  var LONG_PRESS_MS = 450;
  var MOVE_RANGE_DAYS = { "24h": 1, "7d": 7, "30d": 30 };
  var FEED_FILTERS = ["Pain", "Build", "Momentum", "Saved", "Dismissed", "New"];

  var $ = function (selector, scope) { return (scope || document).querySelector(selector); };
  var $$ = function (selector, scope) { return Array.prototype.slice.call((scope || document).querySelectorAll(selector)); };

  var dom = {
    app: $("#app"),
    main: $("#mainContent"),
    viewRadar: $("#viewRadar"),
    viewMovers: $("#viewMovers"),
    viewExplore: $("#viewExplore"),
    viewSystem: $("#viewSystem"),
    navItems: $$(".nav-item"),
    profileChip: $("#profileChip"),
    appMark: $("#appMark"),
    scrim: $("#globalScrim"),
    inspectPanel: $("#inspectPanel"),
    inspectInner: $("#inspectInner"),
    settingsSheet: $("#settingsSheet"),
    sortSheet: $("#sortSheet"),
    searchSheet: $("#searchSheet"),
    toastStack: $("#toastStack"),
    scrollProgressFill: $("#scrollProgressFill"),
    themeColorMeta: document.getElementById("themeColorMeta")
  };

  var exploreObserver = null;
  var scoreObserver = null;
  var longPressTimer = null;

  /* ---- Helpers ---- */

  function nowIso() {
    return new Date().toISOString();
  }

  function applyTheme(theme) {
    if (theme === "vectorpunk" || theme === "vectorheart") {
      document.documentElement.setAttribute("data-theme", "vectorpunk");
      if (dom.themeColorMeta) dom.themeColorMeta.setAttribute("content", "#f7f8ff");
    } else {
      document.documentElement.setAttribute("data-theme", "editorial");
      if (dom.themeColorMeta) dom.themeColorMeta.setAttribute("content", "#f2ecdf");
    }
    try { localStorage.setItem("irs-theme", theme); } catch (e) { /* ignore */ }
  }

  function computeMomentumDelta(idea, windowDays) {
    var created = idea.created_at ? new Date(idea.created_at).getTime() : Date.now();
    var ageDays = Math.max((Date.now() - created) / 86400000, 1);
    var baselinePerDay = Number(idea.signal_count || 0) / ageDays;
    var baselineWindow = baselinePerDay * windowDays;
    var observed = Number(idea.recent_signal_count || 0);
    if (baselineWindow <= 0) return observed * 10;
    return ((observed - baselineWindow) / baselineWindow) * 100;
  }

  function sortIdeasForExplore(ideas, sortMode) {
    var list = ideas.slice();
    if (sortMode === "recency") {
      list.sort(function (a, b) { return new Date(b.created_at || b.updated_at || nowIso()) - new Date(a.created_at || a.updated_at || nowIso()); });
      return list;
    }
    if (sortMode === "momentum") {
      list.sort(function (a, b) { return computeMomentumDelta(b, 7) - computeMomentumDelta(a, 7); });
      return list;
    }
    if (sortMode === "build") {
      list.sort(function (a, b) { return IRSComponents.score(b.buildability) - IRSComponents.score(a.buildability); });
      return list;
    }
    list.sort(function (a, b) { return IRSComponents.rankScore(b) - IRSComponents.rankScore(a); });
    return list;
  }

  function applyExploreFilters(ideas, activeFilters) {
    if (!activeFilters.length) return ideas;
    return ideas.filter(function (idea) {
      return activeFilters.every(function (filter) {
        if (filter === "Pain") return IRSComponents.score(idea.pain) >= 7;
        if (filter === "Build") return IRSComponents.score(idea.buildability) >= 7;
        if (filter === "Momentum") return computeMomentumDelta(idea, 7) > 10;
        if (filter === "Saved") return idea.user_status === "building" || idea.user_score !== null;
        if (filter === "Dismissed") return idea.user_status === "dismissed";
        if (filter === "New") return IRSComponents.chapterForIdea(idea) === "today";
        return true;
      });
    });
  }

  function relatedIdeasFor(idea, ideas) {
    var baseKeywords = {};
    IRSComponents.parseJsonList(idea.keywords).forEach(function (k) { baseKeywords[String(k).toLowerCase()] = true; });
    return ideas
      .filter(function (c) { return c.id !== idea.id; })
      .map(function (c) {
        var overlap = IRSComponents.parseJsonList(c.keywords).filter(function (k) { return baseKeywords[String(k).toLowerCase()]; }).length;
        return { candidate: c, overlap: overlap, score: IRSComponents.rankScore(c) };
      })
      .filter(function (e) { return e.overlap > 0; })
      .sort(function (a, b) { return b.overlap - a.overlap || b.score - a.score; })
      .map(function (e) { return e.candidate; });
  }

  function groupTopByChapter(topIdeas) {
    var groups = { today: [], "this-week": [], "long-tail": [] };
    topIdeas.forEach(function (idea) { groups[IRSComponents.chapterForIdea(idea)].push(idea); });
    return groups;
  }

  async function ensureIdeaDetail(ideaId) {
    var existing = IRSState.getDetailById(ideaId);
    if (existing) return existing;
    var detail = await IRSApi.fetchIdea(ideaId);
    IRSState.upsertDetail(ideaId, detail);
    return detail;
  }

  async function preloadTopDetails() {
    var top10 = IRSState.get("top10");
    await Promise.all(top10.map(async function (idea) {
      try { await ensureIdeaDetail(idea.id); } catch (e) { console.error("Failed to preload detail:", e); }
    }));
  }

  /* ---- Render: Radar ---- */

  function renderRadar() {
    var top10 = IRSState.get("top10");
    if (!top10.length) {
      dom.viewRadar.innerHTML =
        '<header class="view-header">' +
          '<div class="view-kicker">Vectorheart field unit</div>' +
          '<h1 class="view-title">Signal field</h1>' +
          '<p class="view-subtitle">Loading opportunities from the pipeline.</p>' +
        '</header>' +
        IRSComponents.loadingState("Loading radar", "Pulling in the newest ideas and arranging the feed.");
      return;
    }

    var chapterGroups = groupTopByChapter(top10);
    var sections = [];

    ["today", "this-week", "long-tail"].forEach(function (chapter) {
      var ideas = chapterGroups[chapter];
      if (!ideas.length) return;

      var cards = ideas.map(function (idea) {
        var rank = top10.findIndex(function (e) { return e.id === idea.id; }) + 1;
        var detail = IRSState.getDetailById(idea.id);
        return IRSComponents.radarCard({ idea: idea, chapter: chapter, rank: rank, detail: detail, tabIndex: rank === 1 ? 0 : -1 });
      }).join("");

      sections.push(
        '<section class="radar-chapter">' +
          IRSComponents.chapterDivider(chapter) +
          '<div class="radar-feed" data-chapter="' + chapter + '">' + cards + '</div>' +
        '</section>'
      );
    });

    dom.viewRadar.innerHTML =
      '<header class="view-header field-head">' +
        '<div>' +
          '<div class="view-kicker">Vectorheart field unit</div>' +
          '<h1 class="view-title">Signal field</h1>' +
          '<p class="view-subtitle">' + top10.length + ' opportunities plotted for thumb scan</p>' +
        '</div>' +
        '<div class="field-dial" aria-hidden="true"><span>' + top10.length + '</span><small>LIVE</small></div>' +
      '</header>' +
      IRSComponents.viewActions([
        { id: "open-search", label: "Search" },
        { id: "switch-explore", label: "Build queue" },
        { id: "refresh", label: "Refresh", variant: "is-primary" },
        { id: "open-settings", label: "Settings" }
      ]) +
      sections.join("") +
      IRSComponents.emptyState("You\u2019re caught up.", "Browse the active ideas above. New signals surface when the pipeline refreshes.");

    bindChapterDividerReveal(dom.viewRadar);
    bindSignalCards(dom.viewRadar);
    revealVisibleCards(dom.viewRadar);
    observeScoreCountUps(dom.viewRadar);
    bindViewActions(dom.viewRadar);
  }

  /* ---- Render: Movers ---- */

  function moversForRange(range) {
    var ideas = IRSState.get("ideas").filter(function (idea) { return idea.user_status !== "dismissed"; });
    var days = MOVE_RANGE_DAYS[range] || 1;
    return ideas
      .map(function (idea) { return { idea: idea, delta: computeMomentumDelta(idea, days) }; })
      .sort(function (a, b) { return Math.abs(b.delta) - Math.abs(a.delta); })
      .slice(0, 20);
  }

  function renderMovers() {
    var range = IRSState.get("moversRange");
    var rows = moversForRange(range);

    var listHtml = rows.length
      ? rows.map(function (row) {
          var detail = IRSState.getDetailById(row.idea.id);
          return IRSComponents.moversCard({ idea: row.idea, delta: row.delta, detail: detail, rangeLabel: range });
        }).join("")
      : IRSComponents.emptyLine("No movers in this window.");

    dom.viewMovers.innerHTML =
      '<header class="view-header">' +
        '<div class="view-kicker">Rank current</div>' +
        '<h1 class="view-title">Movers</h1>' +
        '<p class="view-subtitle">Momentum traces from the latest signal windows.</p>' +
      '</header>' +
      '<div class="segmented" role="tablist" aria-label="Movers time range">' +
        '<button type="button" role="tab" aria-selected="' + (range === "24h") + '" class="' + (range === "24h" ? "is-active" : "") + '" data-range="24h">24h</button>' +
        '<button type="button" role="tab" aria-selected="' + (range === "7d") + '" class="' + (range === "7d" ? "is-active" : "") + '" data-range="7d">7d</button>' +
        '<button type="button" role="tab" aria-selected="' + (range === "30d") + '" class="' + (range === "30d" ? "is-active" : "") + '" data-range="30d">30d</button>' +
      '</div>' +
      '<section class="movers-list fade-enter">' + listHtml + '</section>';

    $$(".segmented [data-range]", dom.viewMovers).forEach(function (button) {
      button.addEventListener("click", function () {
        IRSState.set({ moversRange: button.dataset.range });
        renderMovers();
      });
    });

    var listEl = $(".movers-list", dom.viewMovers);
    if (listEl) {
      requestAnimationFrame(function () { listEl.classList.add("is-visible"); });
      bindSignalCards(dom.viewMovers);
      revealVisibleCards(dom.viewMovers);
      observeScoreCountUps(dom.viewMovers);
    }
  }

  /* ---- Render: Explore ---- */

  function renderExplore() {
    var ideas = IRSState.get("ideas").filter(function (idea) { return idea.user_status === "building"; });
    var explore = IRSState.get("explore");
    var filtered = applyExploreFilters(sortIdeasForExplore(ideas, explore.sort), explore.activeFilters);
    var rendered = filtered.slice(0, explore.page * PAGE_SIZE);
    var hasMore = rendered.length < filtered.length;

    var chips = FEED_FILTERS.map(function (label) {
      return '<button class="chip ' + (explore.activeFilters.indexOf(label) !== -1 ? "is-active" : "") + '" type="button" data-filter-chip="' + label + '">' + label + '</button>';
    }).join("");

    var cards = rendered.length
      ? rendered.map(function (idea) {
          return IRSComponents.radarCard({
            idea: idea,
            chapter: IRSComponents.chapterForIdea(idea),
            rank: 0,
            detail: IRSState.getDetailById(idea.id)
          });
        }).join("")
      : filtered.length
        ? ""
        : IRSComponents.emptyState("No matching ideas.", "Try clearing a filter or use search to find adjacent opportunities.");

    dom.viewExplore.innerHTML =
      '<header class="view-header">' +
        '<div class="view-kicker">Work bench</div>' +
        '<h1 class="view-title">Build queue</h1>' +
        '<p class="view-subtitle">Ideas already marked for build, grouped for next useful action.</p>' +
      '</header>' +
      IRSComponents.viewActions([
        { id: "open-search", label: "Search" },
        { id: "open-sort", label: "Sort", variant: "is-primary" },
        { id: "clear-filters", label: explore.activeFilters.length ? "Clear filters" : "Filters" }
      ]) +
      '<div class="filter-row"><div class="chip-scroll">' + chips + '</div></div>' +
      '<section class="explore-grid build-queue">' + (cards || IRSComponents.emptyState("No build queue yet.", "Save an opportunity from the field lens and it will land here.")) + '</section>' +
      (hasMore ? '<div class="loading-line" id="exploreSentinel" aria-hidden="true"></div>' : "");

    $$(".chip[data-filter-chip]", dom.viewExplore).forEach(function (chip) {
      chip.addEventListener("click", function () { toggleExploreFilter(chip.dataset.filterChip); });
    });

    bindSignalCards(dom.viewExplore);
    revealVisibleCards(dom.viewExplore);
    observeScoreCountUps(dom.viewExplore);
    bindExploreInfiniteScroll(hasMore);
    bindViewActions(dom.viewExplore);
  }

  /* ---- Render: System ---- */

  function makeLinePath(values, width, height) {
    return IRSComponents.sparklinePath(values, width, height);
  }

  function renderSystem() {
    var sources = IRSState.get("sources");
    var runs = IRSState.get("runs");
    var stats = IRSState.get("stats");
    var archivedIdeas = IRSState.get("ideas").filter(function (idea) {
      return idea.user_status === "dismissed" || idea.user_status === "archived";
    }).slice(0, 12);

    var pipelineCards = sources.map(function (source) {
      var enabled = Number(source.enabled) === 1;
      var failures = Number(source.consecutive_failures || 0);
      var status = !enabled ? "fail" : failures > 0 ? "warn" : "ok";
      var durationSeries = [3, 5, 4, 6, 4, 5, 3, 5, 4, 6, 5, 4];
      var path = makeLinePath(durationSeries, 140, 22);
      return '<article class="pipeline-card">' +
        '<div class="settings-row" style="min-height:auto"><span>' + IRSComponents.escapeHtml(source.source_id) + '</span><span class="status-dot ' + status + '" aria-hidden="true"></span></div>' +
        '<p class="view-subtitle">' + (enabled ? "healthy" : "disabled") + '</p>' +
        '<p class="view-subtitle">Last success ' + IRSComponents.relativeTime(source.last_success) + '</p>' +
        '<svg viewBox="0 0 140 22" height="22" role="img" aria-label="Run duration trend"><path class="sparkline-line" d="' + path + '" style="stroke:var(--ink-muted)"></path></svg>' +
      '</article>';
    }).join("");

    var runSeries = runs.slice(0, 28).reverse().map(function (r) { return Number(r.signals_fetched || 0); });
    var volumePath = makeLinePath(runSeries.length ? runSeries : [0, 1, 0, 2, 1, 0], 640, 86);

    var failures = [];
    sources.forEach(function (source) {
      if (Number(source.consecutive_failures || 0) > 0) {
        failures.push({ time: source.disabled_at || source.last_success || nowIso(), source: source.source_id, reason: "Consecutive failures: " + source.consecutive_failures });
      }
    });
    runs.slice(0, 5).forEach(function (run) {
      if (run.llm_failures && run.llm_failures !== "[]") {
        failures.push({ time: run.timestamp, source: "llm", reason: String(run.llm_failures) });
      }
    });

    var failuresHtml = failures.length
      ? failures.slice(0, 12).map(function (f) {
          return '<article class="failure-row">' +
            '<span class="score-sub">' + IRSComponents.formatDate(f.time) + ' \u00b7 ' + IRSComponents.relativeTime(f.time) + '</span>' +
            '<span class="signal-summary">' + IRSComponents.escapeHtml(f.source) + '</span>' +
            '<span class="view-subtitle">' + IRSComponents.escapeHtml(f.reason) + '</span>' +
          '</article>';
        }).join("")
      : '<p class="view-subtitle">No failures in recent runs.</p>';

    var isRunning = IRSState.get("pipelineRunning");
    var archiveHtml = archivedIdeas.length
      ? archivedIdeas.map(function (idea) {
          return IRSComponents.compactCard(idea);
        }).join("")
      : IRSComponents.emptyLine("No archived or dismissed ideas yet.");

    dom.viewSystem.innerHTML =
      '<header class="view-header">' +
        '<div class="view-kicker">Archive / ops</div>' +
        '<h1 class="view-title">Archive</h1>' +
        '<p class="view-subtitle">Dismissed signals, stale entries, and the pipeline gauges behind them.</p>' +
      '</header>' +
      IRSComponents.viewActions([
        { id: "run-pipeline", label: "Run pipeline", variant: "is-primary" },
        { id: "refresh", label: "Refresh" },
        { id: "open-settings", label: "Settings" }
      ]) +
      '<section class="inspect-section is-visible">' +
        '<h3 class="eyebrow-row"><span>quiet stack</span></h3>' +
        '<div class="search-results" style="margin-top:14px">' + archiveHtml + '</div>' +
      '</section>' +
      '<section class="inspect-section is-visible">' +
        '<h3 class="eyebrow-row"><span>PIPELINE CONTROL</span></h3>' +
        '<div style="margin-top:14px;display:flex;align-items:center;gap:12px">' +
          '<button class="chip ' + (isRunning ? "" : "is-active") + '" type="button" id="runPipelineBtn" ' + (isRunning ? "disabled" : "") + ' data-run-pipeline>' + (isRunning ? "Running\u2026" : "Run Pipeline") + '</button>' +
          '<span class="view-subtitle" id="pipelineRunStatus">' + (isRunning ? "Pipeline is running, please wait\u2026" : "Trigger a full signal collection and scoring cycle.") + '</span>' +
        '</div>' +
      '</section>' +
      '<section class="inspect-section is-visible">' +
        '<h3 class="eyebrow-row"><span>PIPELINE STATUS</span></h3>' +
        '<div class="pipeline-cards" style="margin-top:14px">' + (pipelineCards || IRSComponents.emptyLine("No source status available.")) + '</div>' +
      '</section>' +
      '<section class="inspect-section is-visible">' +
        '<h3 class="eyebrow-row"><span>SIGNAL VOLUME</span></h3>' +
        '<div class="signal-volume" style="margin-top:14px"><svg viewBox="0 0 640 86" preserveAspectRatio="none" role="img" aria-label="Signals ingested over 7 days"><path class="sparkline-line" d="' + volumePath + '" style="stroke:var(--ink-muted)"></path></svg></div>' +
        '<p class="view-subtitle" style="margin-top:8px">Active ideas ' + (stats ? stats.active_ideas : 0) + ' \u00b7 Building ' + (stats ? stats.building_ideas : 0) + ' \u00b7 Total signals ' + (stats ? stats.total_signals : 0) + '</p>' +
      '</section>' +
      '<section class="inspect-section is-visible">' +
        '<h3 class="eyebrow-row"><span>FAILURES</span></h3>' +
        '<div class="failure-list" style="margin-top:14px">' + failuresHtml + '</div>' +
      '</section>' +
      '<section class="inspect-section is-visible">' +
        '<h3 class="eyebrow-row"><span>ABOUT THE PIPELINE</span></h3>' +
        '<p class="view-subtitle" style="margin-top:12px">Signals are ingested from configured sources, compressed with the LLM layer, and matched into opportunities before deterministic scoring persists the result set.</p>' +
        '<p class="view-subtitle" style="margin-top:10px">Failures are retried and source health updates are reflected in source status cards and run logs.</p>' +
      '</section>';

    var runBtn = $("#runPipelineBtn");
    if (runBtn) {
      runBtn.addEventListener("click", async function () {
        IRSState.set({ pipelineRunning: true });
        renderSystem();
        try {
          var result = await IRSApi.runNow();
          if (result.ok) {
            showToast("Pipeline run completed successfully.", "success");
          } else {
            showToast("Pipeline run finished with errors.", "error");
          }
        } catch (error) {
          showToast("Pipeline run failed: " + error.message, "error");
        }
        IRSState.set({ pipelineRunning: false });
        await refreshData();
        renderAll();
      });
    }

    var failed = failures.length > 0;
    dom.viewSystem.classList.toggle("is-failed", failed);
    dom.viewSystem.classList.toggle("is-idle", !failed && !runs.length);
    bindViewActions(dom.viewSystem);
  }

  /* ---- Explore Helpers ---- */

  function toggleExploreFilter(label) {
    IRSState.setNested("explore", function (explore) {
      var exists = explore.activeFilters.indexOf(label) !== -1;
      var next = exists ? explore.activeFilters.filter(function (f) { return f !== label; }) : explore.activeFilters.concat(label);
      return Object.assign({}, explore, { activeFilters: next, page: 1 });
    });
    renderExplore();
  }

  function bindExploreInfiniteScroll(hasMore) {
    if (exploreObserver) { exploreObserver.disconnect(); exploreObserver = null; }
    if (!hasMore) return;
    var sentinel = $("#exploreSentinel");
    if (!sentinel) return;
    exploreObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          IRSState.setNested("explore", function (explore) { return Object.assign({}, explore, { page: explore.page + 1 }); });
          renderExplore();
        }
      });
    }, { threshold: 0.1 });
    exploreObserver.observe(sentinel);
  }

  /* ---- Reveal / Animation Binding ---- */

  function revealVisibleCards(scope) {
    IRSMotion.revealStagger($$(".signal-card", scope), 50);
  }

  function bindChapterDividerReveal(scope) {
    $$("[data-chapter-divider]", scope).forEach(function (divider) {
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.25 });
      observer.observe(divider);
    });
  }

  function observeScoreCountUps(scope) {
    if (scoreObserver) { scoreObserver.disconnect(); scoreObserver = null; }
    var items = $$("[data-count-target]", scope);
    scoreObserver = new IntersectionObserver(function (entries, observer) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var target = Number(entry.target.dataset.countTarget || 0);
        IRSMotion.countUp(entry.target, target, { duration: 500, decimals: 1 });
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.35 });
    items.forEach(function (item) { scoreObserver.observe(item); });
  }

  /* ---- Card Interactions ---- */

  function bindSignalCards(scope) {
    $$(".signal-card", scope).forEach(function (card) {
      var ideaId = card.dataset.ideaId;
      if (!ideaId) return;

      card.addEventListener("click", function (event) {
        var toggleButton = event.target.closest(".metadata-toggle");
        if (toggleButton) {
          var expanded = toggleButton.getAttribute("aria-expanded") === "true";
          toggleButton.setAttribute("aria-expanded", expanded ? "false" : "true");
          var expandedBlock = $(".metadata-expanded", card);
          if (expandedBlock) expandedBlock.hidden = expanded;
          return;
        }
        openInspect(ideaId, false);
      });

      card.addEventListener("pointerdown", function () {
        window.clearTimeout(longPressTimer);
        longPressTimer = window.setTimeout(function () { openInspect(ideaId, true); }, LONG_PRESS_MS);
      });

      ["pointerup", "pointercancel", "pointerleave"].forEach(function (evt) {
        card.addEventListener(evt, function () { window.clearTimeout(longPressTimer); });
      });
    });
  }

  /* ---- View Switching ---- */

  function switchView(viewName) {
    if (IRSState.get("currentView") === viewName) return;

    ["radar", "movers", "explore", "system"].forEach(function (name) {
      var el = name === "radar" ? dom.viewRadar : name === "movers" ? dom.viewMovers : name === "explore" ? dom.viewExplore : dom.viewSystem;
      el.classList.toggle("is-active", name === viewName);
    });

    dom.navItems.forEach(function (item) {
      item.classList.toggle("is-active", item.dataset.nav === viewName);
    });

    IRSState.set({ currentView: viewName, keyboardFocusIndex: 0 });
    updateScrollProgress();
    window.scrollTo(0, 0);
  }

  /* ---- Inspect Panel ---- */

  async function openInspect(ideaId, peek) {
    var idea = IRSState.getIdeaById(ideaId);
    if (!idea) return;

    var detail = await ensureIdeaDetail(ideaId);
    var related = relatedIdeasFor(idea, IRSState.get("ideas"));
    dom.inspectInner.innerHTML = IRSComponents.inspectView({ idea: idea, detail: detail, relatedIdeas: related });

    dom.inspectPanel.classList.add("is-open");
    dom.inspectPanel.setAttribute("aria-hidden", "false");
    dom.scrim.hidden = false;
    requestAnimationFrame(function () { dom.scrim.classList.add("is-visible"); });
    IRSState.set({ inspectIdeaId: ideaId, inspectPeek: Boolean(peek) });

    var sections = $$(".inspect-section", dom.inspectInner);
    IRSMotion.cascadeIn(sections, 50, 100);

    var bars = $$(".score-bar-fill", dom.inspectInner);
    bars.forEach(function (bar) {
      var width = bar.dataset.width || "0";
      requestAnimationFrame(function () { bar.style.width = width + "%"; });
    });

    var band = $(".inspect-band", dom.inspectInner);
    if (band) window.setTimeout(function () { band.classList.add("is-drawn"); }, 180);

    observeScoreCountUps(dom.inspectInner);
    bindInspectInteractions();
    updateScrollProgress();
  }

  function closeInspect() {
    if (!dom.inspectPanel.classList.contains("is-open")) return;
    IRSMotion.cascadeOut($$(".inspect-section", dom.inspectInner), 30);
    dom.inspectPanel.classList.remove("is-open");
    dom.inspectPanel.setAttribute("aria-hidden", "true");
    IRSState.set({ inspectIdeaId: null, inspectPeek: false });

    if (!anySheetOpen()) {
      dom.scrim.classList.remove("is-visible");
      window.setTimeout(function () {
        if (!anySheetOpen()) dom.scrim.hidden = true;
      }, 220);
    }
    updateScrollProgress();
  }

  function bindInspectInteractions() {
    var saveButton = $("[data-inspect-action='save']", dom.inspectInner);
    var dismissButton = $("[data-inspect-action='dismiss']", dom.inspectInner);

    if (saveButton) {
      saveButton.addEventListener("click", async function () {
        var ideaId = IRSState.get("inspectIdeaId");
        if (!ideaId) return;
        try {
          await IRSApi.markBuilding(ideaId);
          showToast("Saved to building", "success");
          await refreshData();
          renderAll();
          openInspect(ideaId, false);
        } catch (error) {
          showToast("Could not save this idea.", "error");
        }
      });
    }

    if (dismissButton) {
      dismissButton.addEventListener("click", async function () {
        var ideaId = IRSState.get("inspectIdeaId");
        if (!ideaId) return;
        try {
          await IRSApi.dismissIdea(ideaId);
          showToast("Idea dismissed.");
          closeInspect();
          await refreshData();
          renderAll();
        } catch (error) {
          showToast("Could not dismiss.", "error");
        }
      });
    }

    $$(".related-card", dom.inspectInner).forEach(function (button) {
      button.addEventListener("click", function () { openInspect(button.dataset.relatedId, false); });
    });
  }

  /* ---- Sheets ---- */

  function openSettingsSheet() {
    dom.settingsSheet.innerHTML = IRSComponents.settingsSheet({
      sources: IRSState.get("sources"),
      appearance: IRSState.get("appearance"),
      reducedMotion: IRSState.get("reducedMotionOverride"),
      theme: IRSState.get("theme")
    });
    IRSMotion.showSheet(dom.settingsSheet, dom.scrim);
    IRSState.set({ settingsOpen: true });
    bindSettingsInteractions();
  }

  function closeSettingsSheet() {
    IRSMotion.hideSheet(dom.settingsSheet, dom.scrim);
    IRSState.set({ settingsOpen: false });
  }

  function openSortSheet() {
    dom.sortSheet.innerHTML = IRSComponents.sortSheet(IRSState.get("explore").sort);
    IRSMotion.showSheet(dom.sortSheet, dom.scrim);
    IRSState.set({ sortSheetOpen: true });

    $$("[data-sort-option]", dom.sortSheet).forEach(function (button) {
      button.addEventListener("click", function () {
        IRSState.setNested("explore", function (explore) { return Object.assign({}, explore, { sort: button.dataset.sortOption, page: 1 }); });
        closeSortSheet();
        renderExplore();
      });
    });
  }

  function closeSortSheet() {
    IRSMotion.hideSheet(dom.sortSheet, dom.scrim);
    IRSState.set({ sortSheetOpen: false });
  }

  function openSearchSheet() {
    var query = IRSState.get("explore").searchQuery;
    dom.searchSheet.innerHTML = IRSComponents.searchSheet(query, IRSState.get("ideas"));
    IRSMotion.showSheet(dom.searchSheet, dom.scrim);
    IRSState.set({ searchSheetOpen: true });
    bindSearchInteractions();
    var input = $("#searchInput", dom.searchSheet);
    if (input) {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
  }

  function closeSearchSheet() {
    IRSMotion.hideSheet(dom.searchSheet, dom.scrim);
    IRSState.set({ searchSheetOpen: false });
  }

  function bindSearchInteractions() {
    var input = $("#searchInput", dom.searchSheet);
    if (!input) return;

    input.addEventListener("input", function () {
      IRSState.setNested("explore", function (explore) { return Object.assign({}, explore, { searchQuery: input.value }); });
      dom.searchSheet.innerHTML = IRSComponents.searchSheet(input.value, IRSState.get("ideas"));
      bindSearchInteractions();
      var nextInput = $("#searchInput", dom.searchSheet);
      if (nextInput) {
        nextInput.focus();
        nextInput.setSelectionRange(nextInput.value.length, nextInput.value.length);
      }
      $$(".compact-card[data-idea-id]", dom.searchSheet).forEach(function (card) {
        card.addEventListener("click", function () { closeSearchSheet(); openInspect(card.dataset.ideaId, false); });
      });
    });

    $$(".compact-card[data-idea-id]", dom.searchSheet).forEach(function (card) {
      card.addEventListener("click", function () { closeSearchSheet(); openInspect(card.dataset.ideaId, false); });
    });
  }

  function bindSettingsInteractions() {
    var signoutBtn = $("[data-settings-action='signout']", dom.settingsSheet);
    if (signoutBtn) signoutBtn.addEventListener("click", function () { showToast("Sign out is not configured for local mode."); });

    $$(".chip[data-appearance]", dom.settingsSheet).forEach(function (chip) {
      chip.addEventListener("click", function () {
        IRSState.set({ appearance: chip.dataset.appearance });
        openSettingsSheet();
      });
    });

    var reducedMotionToggle = $("[data-settings-toggle='reduced-motion']", dom.settingsSheet);
    if (reducedMotionToggle) {
      reducedMotionToggle.addEventListener("click", function () {
        IRSState.set({ reducedMotionOverride: !IRSState.get("reducedMotionOverride") });
        openSettingsSheet();
      });
    }

    $$("[data-theme-option]", dom.settingsSheet).forEach(function (chip) {
      chip.addEventListener("click", function () {
        var theme = chip.dataset.themeOption;
        IRSState.set({ theme: theme });
        applyTheme(theme);
        openSettingsSheet();
      });
    });

    $$("[data-source-toggle]", dom.settingsSheet).forEach(function (toggle) {
      toggle.addEventListener("click", async function () {
        var sourceId = toggle.dataset.sourceToggle;
        var source = IRSState.get("sources").find(function (s) { return s.source_id === sourceId; });
        if (!source) return;
        try {
          if (Number(source.enabled) === 1) {
            await IRSApi.disableSource(sourceId);
            showToast("Disabled " + sourceId + ".");
          } else {
            await IRSApi.enableSource(sourceId);
            showToast("Enabled " + sourceId + ".", "success");
          }
          await refreshData();
          openSettingsSheet();
          renderSystem();
        } catch (error) {
          showToast("Source update failed.", "error");
        }
      });
    });
  }

  /* ---- Overlay Helpers ---- */

  function anySheetOpen() {
    return dom.settingsSheet.classList.contains("is-open") ||
      dom.sortSheet.classList.contains("is-open") ||
      dom.searchSheet.classList.contains("is-open") ||
      dom.inspectPanel.classList.contains("is-open");
  }

  function closeOverlays() {
    closeInspect();
    closeSettingsSheet();
    closeSortSheet();
    closeSearchSheet();
  }

  /* ---- Toast ---- */

  function showToast(message, tone) {
    if (!tone) tone = "neutral";
    var wrapper = document.createElement("div");
    wrapper.innerHTML = IRSComponents.toast(message, tone);
    var toast = wrapper.firstElementChild;
    dom.toastStack.appendChild(toast);
    requestAnimationFrame(function () { toast.classList.add("is-visible"); });
    window.setTimeout(function () {
      toast.classList.add("is-leaving");
      window.setTimeout(function () { toast.remove(); }, 220);
    }, 3200);
  }

  /* ---- Navigation ---- */

  function bindNavigation() {
    dom.navItems.forEach(function (item) {
      item.addEventListener("click", function () { switchView(item.dataset.nav); });
    });
    dom.profileChip.addEventListener("click", openSettingsSheet);
    dom.appMark.addEventListener("click", function () { switchView("radar"); });
  }

  /* ---- Global Interactions ---- */

  function bindGlobalInteractions() {
    dom.scrim.addEventListener("click", closeOverlays);

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") closeOverlays();
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        handleKeyboardCardNavigation(event.key === "ArrowDown" ? 1 : -1);
      }
      if (event.key === "Enter") {
        var focused = document.activeElement;
        if (focused && focused.classList.contains("signal-card") && focused.dataset.ideaId) {
          openInspect(focused.dataset.ideaId, false);
        }
      }
    });

    // Pull-to-refresh
    var pullStart = null;
    document.addEventListener("touchstart", function (event) {
      if (window.scrollY === 0 && IRSState.get("currentView") === "radar" && !anySheetOpen()) {
        pullStart = event.touches[0].clientY;
      }
    }, { passive: true });

    document.addEventListener("touchend", async function (event) {
      if (pullStart === null) return;
      var diff = event.changedTouches[0].clientY - pullStart;
      pullStart = null;
      if (diff > 80) {
        await refreshData();
        renderAll();
        showToast("Radar refreshed.", "success");
      }
    }, { passive: true });

    // Scroll progress
    window.addEventListener("scroll", updateScrollProgress, { passive: true });
    dom.inspectInner.addEventListener("scroll", updateScrollProgress, { passive: true });
  }

  function handleKeyboardCardNavigation(direction) {
    var cards = $$(".view.is-active .signal-card");
    if (!cards.length) return;
    var currentIndex = Math.max(0, Math.min(cards.length - 1, IRSState.get("keyboardFocusIndex")));
    var nextIndex = Math.max(0, Math.min(cards.length - 1, currentIndex + direction));
    cards.forEach(function (card, index) {
      card.tabIndex = index === nextIndex ? 0 : -1;
      card.classList.toggle("is-focused", index === nextIndex);
    });
    cards[nextIndex].focus();
    IRSState.set({ keyboardFocusIndex: nextIndex });
  }

  function updateScrollProgress() {
    var progress = 0;
    if (dom.inspectPanel.classList.contains("is-open")) {
      var max = dom.inspectInner.scrollHeight - dom.inspectInner.clientHeight;
      progress = max > 0 ? dom.inspectInner.scrollTop / max : 1;
    } else {
      var scrollMax = document.documentElement.scrollHeight - window.innerHeight;
      progress = scrollMax > 0 ? window.scrollY / scrollMax : 0;
    }
    dom.scrollProgressFill.style.width = (Math.max(0, Math.min(progress, 1)) * 100).toFixed(2) + "%";
  }

  /* ---- View Actions ---- */

  function bindViewActions(scope) {
    $$(".view-action", scope).forEach(function (button) {
      button.addEventListener("click", async function () {
        var action = button.dataset.action;
        if (action === "open-search") {
          openSearchSheet();
        } else if (action === "switch-explore") {
          switchView("explore");
        } else if (action === "open-settings") {
          openSettingsSheet();
        } else if (action === "refresh") {
          try {
            button.disabled = true;
            await refreshData();
            renderAll();
            showToast("Refreshed.", "success");
          } finally {
            button.disabled = false;
          }
        } else if (action === "run-pipeline") {
          var runBtn = $("#runPipelineBtn");
          if (runBtn) runBtn.click();
        } else if (action === "clear-filters") {
          IRSState.setNested("explore", function (explore) { return Object.assign({}, explore, { activeFilters: [], page: 1 }); });
          renderExplore();
        } else if (action === "open-sort") {
          openSortSheet();
        }
      });
    });
  }

  /* ---- Data ---- */

  async function refreshData() {
    var data = await IRSApi.loadDashboard();
    IRSState.set(Object.assign(data, { loading: false, error: null }));
    await preloadTopDetails();
  }

  function renderAll() {
    renderRadar();
    renderMovers();
    renderExplore();
    renderSystem();
    switchView(IRSState.get("currentView"));
    updateScrollProgress();
  }

  /* ---- Initialize ---- */

  async function initialize() {
    var savedTheme = null;
    try { savedTheme = localStorage.getItem("irs-theme"); } catch (e) { /* ignore */ }
    if (savedTheme === "editorial" || savedTheme === "vectorheart" || savedTheme === "vectorpunk") {
      IRSState.set({ theme: savedTheme });
    }
    applyTheme(IRSState.get("theme"));

    bindNavigation();
    bindGlobalInteractions();
    IRSMotion.onReducedMotionChange(function () { /* no-op, CSS handles it */ });

    dom.viewRadar.innerHTML =
      '<header class="view-header">' +
        '<h1 class="view-title">Signal field</h1>' +
        '<p class="view-subtitle">Loading opportunities\u2026</p>' +
      '</header>' +
      '<div class="radar-feed">' +
        '<article class="signal-card is-visible"></article>' +
        '<article class="signal-card is-visible"></article>' +
        '<article class="signal-card is-visible"></article>' +
      '</div>';

    try {
      await refreshData();
      renderAll();
    } catch (error) {
      console.error(error);
      IRSState.set({ loading: false, error: error.message });
      dom.viewRadar.innerHTML =
        '<header class="view-header">' +
          '<div class="view-kicker">Vectorheart field unit</div>' +
          '<h1 class="view-title">Signal field</h1>' +
          '<p class="view-subtitle">The pipeline didn\u2019t answer this time.</p>' +
        '</header>' +
        IRSComponents.emptyState("Couldn\u2019t reach the pipeline.", "Check the backend, then pull to refresh again.");
      showToast("Connection failed. Please try again.", "error");
    }
  }

  document.addEventListener("DOMContentLoaded", initialize);
})();
