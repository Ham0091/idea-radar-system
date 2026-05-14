(function () {
  "use strict";

  const PAGE_SIZE = 16;
  const LONG_PRESS_MS = 450;
  const MOVE_RANGE_DAYS = { "24h": 1, "7d": 7, "30d": 30 };
  const FEED_FILTERS = ["Pain", "Build", "Momentum", "Saved", "Dismissed", "New"];

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

  const dom = {
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
    inspectScanline: $("#inspectScanline"),
    settingsSheet: $("#settingsSheet"),
    sortSheet: $("#sortSheet"),
    searchSheet: $("#searchSheet"),
    toastStack: $("#toastStack"),
    timeRhythmFill: $("#timeRhythmFill")
  };

  let exploreObserver = null;
  let scoreObserver = null;
  let longPressTimer = null;

  function activeViewElement() {
    const view = IRSState.get("currentView");
    if (view === "radar") return dom.viewRadar;
    if (view === "movers") return dom.viewMovers;
    if (view === "explore") return dom.viewExplore;
    return dom.viewSystem;
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function computeMomentumDelta(idea, windowDays) {
    const created = idea.created_at ? new Date(idea.created_at).getTime() : Date.now();
    const ageDays = Math.max((Date.now() - created) / 86400000, 1);
    const baselinePerDay = Number(idea.signal_count || 0) / ageDays;
    const baselineWindow = baselinePerDay * windowDays;
    const observed = Number(idea.recent_signal_count || 0);
    if (baselineWindow <= 0) {
      return observed * 10;
    }
    return ((observed - baselineWindow) / baselineWindow) * 100;
  }

  function sortIdeasForExplore(ideas, sortMode) {
    const list = ideas.slice();
    if (sortMode === "recency") {
      list.sort((a, b) => new Date(b.created_at || b.updated_at || nowIso()) - new Date(a.created_at || a.updated_at || nowIso()));
      return list;
    }
    if (sortMode === "momentum") {
      list.sort((a, b) => computeMomentumDelta(b, 7) - computeMomentumDelta(a, 7));
      return list;
    }
    if (sortMode === "build") {
      list.sort((a, b) => IRSComponents.score(b.buildability) - IRSComponents.score(a.buildability));
      return list;
    }
    list.sort((a, b) => IRSComponents.rankScore(b) - IRSComponents.rankScore(a));
    return list;
  }

  function applyExploreFilters(ideas, activeFilters) {
    if (!activeFilters.length) {
      return ideas;
    }

    return ideas.filter((idea) => {
      return activeFilters.every((filter) => {
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
    const baseKeywords = new Set(IRSComponents.parseJsonList(idea.keywords).map((key) => String(key).toLowerCase()));
    return ideas
      .filter((candidate) => candidate.id !== idea.id)
      .map((candidate) => {
        const candidateKeywords = IRSComponents.parseJsonList(candidate.keywords).map((key) => String(key).toLowerCase());
        const overlap = candidateKeywords.filter((key) => baseKeywords.has(key)).length;
        return { candidate, overlap, score: IRSComponents.rankScore(candidate) };
      })
      .filter((entry) => entry.overlap > 0)
      .sort((a, b) => b.overlap - a.overlap || b.score - a.score)
      .map((entry) => entry.candidate);
  }

  function groupTopByChapter(topIdeas) {
    const groups = { today: [], "this-week": [], "long-tail": [] };
    topIdeas.forEach((idea) => {
      groups[IRSComponents.chapterForIdea(idea)].push(idea);
    });
    return groups;
  }

  async function ensureIdeaDetail(ideaId) {
    const existing = IRSState.getDetailById(ideaId);
    if (existing) {
      return existing;
    }
    const detail = await IRSApi.fetchIdea(ideaId);
    IRSState.upsertDetail(ideaId, detail);
    return detail;
  }

  async function preloadTopDetails() {
    const top10 = IRSState.get("top10");
    await Promise.all(
      top10.map(async (idea) => {
        try {
          await ensureIdeaDetail(idea.id);
        } catch (error) {
          console.error("Failed to preload detail:", error);
        }
      })
    );
  }

  function renderRadar() {
    const top10 = IRSState.get("top10");
    if (!top10.length) {
      dom.viewRadar.innerHTML = `
        <header class="view-header">
          <h1 class="view-title">Radar</h1>
        </header>
        ${IRSComponents.emptyLine("Nothing surfaced yet. Next ingestion in Xh.")}
      `;
      return;
    }

    const chapterGroups = groupTopByChapter(top10);
    const sections = [];

    ["today", "this-week", "long-tail"].forEach((chapter) => {
      const ideas = chapterGroups[chapter];
      if (!ideas.length) {
        return;
      }

      const cards = ideas
        .map((idea, index) => {
          const rank = top10.findIndex((entry) => entry.id === idea.id) + 1;
          const detail = IRSState.getDetailById(idea.id);
          return IRSComponents.radarCard({
            idea,
            chapter,
            rank,
            detail,
            tabIndex: rank === 1 ? 0 : -1
          });
        })
        .join("");

      sections.push(`
        <section class="radar-chapter">
          ${IRSComponents.chapterDivider(chapter)}
          <div class="radar-feed" data-chapter="${chapter}">
            ${cards}
          </div>
        </section>
      `);
    });

    dom.viewRadar.innerHTML = `
      <header class="view-header">
        <h1 class="view-title">Radar</h1>
        <p class="view-subtitle">${top10.length} opportunities in active rotation</p>
      </header>
      ${sections.join("")}
      <section class="empty-line">You&#39;re caught up. Next ingestion in Xh.</section>
    `;

    bindChapterDividerReveal(dom.viewRadar);
    bindSignalCards(dom.viewRadar);
    revealVisibleCards(dom.viewRadar);
    observeScoreCountUps(dom.viewRadar);
  }

  function moversForRange(range) {
    const ideas = IRSState.get("ideas").filter((idea) => idea.user_status !== "dismissed");
    const days = MOVE_RANGE_DAYS[range] || 1;
    return ideas
      .map((idea) => ({
        idea,
        delta: computeMomentumDelta(idea, days)
      }))
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      .slice(0, 20);
  }

  function renderMovers() {
    const range = IRSState.get("moversRange");
    const rows = moversForRange(range);

    const listHtml = rows.length
      ? rows
          .map(({ idea, delta }) => {
            const detail = IRSState.getDetailById(idea.id);
            return IRSComponents.moversCard({
              idea,
              delta,
              detail,
              rangeLabel: range
            });
          })
          .join("")
      : IRSComponents.emptyLine("No movers in this window.");

    const indicatorOffset = range === "24h" ? 0 : range === "7d" ? 100 : 200;
    dom.viewMovers.innerHTML = `
      <header class="view-header">
        <h1 class="view-title">Movers</h1>
        <p class="view-subtitle">Rising momentum opportunities by time window.</p>
      </header>
      <div class="segmented" role="tablist" aria-label="Movers time range">
        <button type="button" role="tab" aria-selected="${range === "24h"}" class="${range === "24h" ? "is-active" : ""}" data-range="24h">24h</button>
        <button type="button" role="tab" aria-selected="${range === "7d"}" class="${range === "7d" ? "is-active" : ""}" data-range="7d">7d</button>
        <button type="button" role="tab" aria-selected="${range === "30d"}" class="${range === "30d" ? "is-active" : ""}" data-range="30d">30d</button>
        <span class="segment-indicator" style="transform:translateX(${indicatorOffset}%);"></span>
      </div>
      <section class="movers-list fade-enter">
        ${listHtml}
      </section>
    `;

    $$(".segmented [data-range]", dom.viewMovers).forEach((button) => {
      button.addEventListener("click", () => {
        IRSState.set({ moversRange: button.dataset.range });
        renderMovers();
      });
    });

    const listElement = $(".movers-list", dom.viewMovers);
    if (listElement) {
      requestAnimationFrame(() => listElement.classList.add("is-visible"));
      bindSignalCards(dom.viewMovers);
      revealVisibleCards(dom.viewMovers);
      observeScoreCountUps(dom.viewMovers);
    }
  }

  function renderExplore() {
    const ideas = IRSState.get("ideas");
    const { activeFilters, sort, page } = IRSState.get("explore");
    const filtered = applyExploreFilters(sortIdeasForExplore(ideas, sort), activeFilters);
    const rendered = filtered.slice(0, page * PAGE_SIZE);
    const hasMore = rendered.length < filtered.length;

    const chips = FEED_FILTERS.map((label) => `
      <button class="chip ${activeFilters.includes(label) ? "is-active" : ""}" type="button" data-filter-chip="${label}">${label}</button>
    `).join("");

    const cards = rendered.length
      ? rendered.map((idea) => IRSComponents.radarCard({
          idea,
          chapter: IRSComponents.chapterForIdea(idea),
          rank: 0,
          detail: IRSState.getDetailById(idea.id)
        })).join("")
      : IRSComponents.emptyLine("No signals match these filters.");

    dom.viewExplore.innerHTML = `
      <header class="view-header">
        <h1 class="view-title">Explore</h1>
        <p class="view-subtitle">Browse and filter opportunity space.</p>
      </header>
      <div class="filter-row">
        <div class="chip-scroll">${chips}</div>
        <button class="icon-button" type="button" data-open-search aria-label="Search opportunities">
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm9 16-4.2-4.2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        </button>
      </div>
      <div class="sort-row">
        <button class="sort-button" type="button" data-open-sort>Sort: ${sort === "score" ? "Score" : sort === "momentum" ? "Momentum delta" : sort === "recency" ? "Recency" : "Build complexity"} ↓</button>
      </div>
      <section class="explore-grid">
        ${cards}
      </section>
      ${hasMore ? '<div class="loading-line" id="exploreSentinel" aria-hidden="true"></div>' : ""}
    `;

    $$(".chip[data-filter-chip]", dom.viewExplore).forEach((chip) => {
      chip.addEventListener("click", () => toggleExploreFilter(chip.dataset.filterChip));
    });

    const openSort = $("[data-open-sort]", dom.viewExplore);
    if (openSort) openSort.addEventListener("click", openSortSheet);

    const openSearch = $("[data-open-search]", dom.viewExplore);
    if (openSearch) openSearch.addEventListener("click", openSearchSheet);

    bindSignalCards(dom.viewExplore);
    revealVisibleCards(dom.viewExplore);
    observeScoreCountUps(dom.viewExplore);
    bindExploreInfiniteScroll(hasMore);
  }

  function makeLinePath(values, width, height) {
    return IRSComponents.sparklinePath(values, width, height);
  }

  function renderSystem() {
    const sources = IRSState.get("sources");
    const runs = IRSState.get("runs");
    const stats = IRSState.get("stats");

    const pipelineCards = sources
      .map((source) => {
        const enabled = Number(source.enabled) === 1;
        const failures = Number(source.consecutive_failures || 0);
        const status = !enabled ? "fail" : failures > 0 ? "warn" : "ok";
        const durationSeries = [3, 5, 4, 6, 4, 5, 3, 5, 4, 6, 5, 4];
        const path = makeLinePath(durationSeries, 140, 22);
        return `
          <article class="pipeline-card">
            <div class="settings-row" style="min-height:auto;">
              <span>${IRSComponents.escapeHtml(source.source_id)}</span>
              <span class="status-dot ${status}" aria-hidden="true"></span>
            </div>
            <p class="view-subtitle">${enabled ? "healthy" : "disabled"}</p>
            <p class="view-subtitle">Last success ${IRSComponents.relativeTime(source.last_success)}</p>
            <svg viewBox="0 0 140 22" height="22" role="img" aria-label="Run duration trend">
              <path class="sparkline-line" d="${path}" style="stroke:var(--accent-indigo)"></path>
            </svg>
          </article>
        `;
      })
      .join("");

    const runSeries = runs
      .slice(0, 28)
      .reverse()
      .map((run) => Number(run.signals_fetched || 0));
    const volumePath = makeLinePath(runSeries.length ? runSeries : [0, 1, 0, 2, 1, 0], 640, 86);

    const failures = [];
    sources.forEach((source) => {
      if (Number(source.consecutive_failures || 0) > 0) {
        failures.push({
          time: source.disabled_at || source.last_success || nowIso(),
          source: source.source_id,
          reason: `Consecutive failures: ${source.consecutive_failures}`
        });
      }
    });
    runs.slice(0, 5).forEach((run) => {
      if (run.llm_failures && run.llm_failures !== "[]") {
        failures.push({
          time: run.timestamp,
          source: "llm",
          reason: String(run.llm_failures)
        });
      }
    });

    const failuresHtml = failures.length
      ? failures
          .slice(0, 12)
          .map((failure) => `
            <article class="failure-row">
              <span class="score-sub">${IRSComponents.formatDate(failure.time)} · ${IRSComponents.relativeTime(failure.time)}</span>
              <span class="signal-summary">${IRSComponents.escapeHtml(failure.source)}</span>
              <span class="view-subtitle">${IRSComponents.escapeHtml(failure.reason)}</span>
            </article>
          `)
          .join("")
      : `<p class="view-subtitle">No failures in recent runs.</p>`;

    dom.viewSystem.innerHTML = `
      <header class="view-header">
        <h1 class="view-title">System</h1>
        <p class="view-subtitle">Pipeline health and ingestion behavior.</p>
      </header>

      <section class="inspect-section is-visible">
        <h3 class="eyebrow-row"><span>PIPELINE STATUS</span></h3>
        <div class="pipeline-cards" style="margin-top:14px;">${pipelineCards || IRSComponents.emptyLine("No source status available.")}</div>
      </section>

      <section class="inspect-section is-visible">
        <h3 class="eyebrow-row"><span>SIGNAL VOLUME</span></h3>
        <div class="signal-volume" style="margin-top:14px;">
          <svg viewBox="0 0 640 86" preserveAspectRatio="none" role="img" aria-label="Signals ingested over 7 days">
            <path class="sparkline-line" d="${volumePath}" style="stroke:var(--accent-indigo)"></path>
          </svg>
        </div>
        <p class="view-subtitle" style="margin-top:8px;">Active ideas ${stats ? stats.active_ideas : 0} · Building ${stats ? stats.building_ideas : 0} · Total signals ${stats ? stats.total_signals : 0}</p>
      </section>

      <section class="inspect-section is-visible">
        <h3 class="eyebrow-row"><span>FAILURES</span></h3>
        <div class="failure-list" style="margin-top:14px;">${failuresHtml}</div>
      </section>

      <section class="inspect-section is-visible">
        <h3 class="eyebrow-row"><span>ABOUT THE PIPELINE</span></h3>
        <p class="view-subtitle" style="margin-top:12px;">Signals are ingested from configured sources, compressed with the LLM layer, and matched into opportunities before deterministic scoring persists the result set.</p>
        <p class="view-subtitle" style="margin-top:10px;">Failures are retried and source health updates are reflected in source status cards and run logs.</p>
      </section>
    `;

    const failed = failures.length > 0;
    dom.viewSystem.classList.toggle("is-failed", failed);
    dom.viewSystem.classList.toggle("is-idle", !failed && !runs.length);
  }

  function toggleExploreFilter(label) {
    IRSState.setNested("explore", (explore) => {
      const exists = explore.activeFilters.includes(label);
      const nextFilters = exists ? explore.activeFilters.filter((item) => item !== label) : [...explore.activeFilters, label];
      return { ...explore, activeFilters: nextFilters, page: 1 };
    });
    renderExplore();
  }

  function bindExploreInfiniteScroll(hasMore) {
    if (exploreObserver) {
      exploreObserver.disconnect();
      exploreObserver = null;
    }
    if (!hasMore) {
      return;
    }
    const sentinel = $("#exploreSentinel");
    if (!sentinel) {
      return;
    }
    exploreObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          IRSState.setNested("explore", (explore) => ({ ...explore, page: explore.page + 1 }));
          renderExplore();
        }
      });
    }, { threshold: 0.1 });
    exploreObserver.observe(sentinel);
  }

  function revealVisibleCards(scope) {
    const cards = $$(".signal-card", scope);
    IRSMotion.revealStagger(cards, 60);
  }

  function bindChapterDividerReveal(scope) {
    const dividers = $$("[data-chapter-divider]", scope);
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
        }
      });
    }, { threshold: 0.25 });

    dividers.forEach((divider) => observer.observe(divider));
  }

  function observeScoreCountUps(scope) {
    if (scoreObserver) {
      scoreObserver.disconnect();
      scoreObserver = null;
    }
    const items = $$("[data-count-target]", scope);
    scoreObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }
        const target = Number(entry.target.dataset.countTarget || 0);
        IRSMotion.countUp(entry.target, target, { duration: 480, decimals: 1 });
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.35 });
    items.forEach((item) => scoreObserver.observe(item));
  }

  function bindSignalCards(scope) {
    $$(".signal-card", scope).forEach((card) => {
      const ideaId = card.dataset.ideaId;
      if (!ideaId) {
        return;
      }

      card.addEventListener("click", (event) => {
        const toggleButton = event.target.closest(".metadata-toggle");
        if (toggleButton) {
          const expanded = toggleButton.getAttribute("aria-expanded") === "true";
          toggleButton.setAttribute("aria-expanded", expanded ? "false" : "true");
          const expandedBlock = $(".metadata-expanded", card);
          if (expandedBlock) {
            expandedBlock.hidden = expanded;
          }
          return;
        }
        openInspect(ideaId, false);
      });

      card.addEventListener("pointerdown", () => {
        window.clearTimeout(longPressTimer);
        longPressTimer = window.setTimeout(() => {
          openInspect(ideaId, true);
        }, LONG_PRESS_MS);
      });

      ["pointerup", "pointercancel", "pointerleave"].forEach((eventName) => {
        card.addEventListener(eventName, () => {
          window.clearTimeout(longPressTimer);
        });
      });
    });
  }

  function switchView(viewName) {
    if (IRSState.get("currentView") === viewName) {
      return;
    }

    ["radar", "movers", "explore", "system"].forEach((name) => {
      const isActive = name === viewName;
      const viewEl =
        name === "radar" ? dom.viewRadar :
        name === "movers" ? dom.viewMovers :
        name === "explore" ? dom.viewExplore : dom.viewSystem;
      viewEl.classList.toggle("is-active", isActive);
    });

    dom.navItems.forEach((item) => {
      const isActive = item.dataset.nav === viewName;
      item.classList.toggle("is-active", isActive);
      item.classList.add("show-label");
      window.setTimeout(() => item.classList.remove("show-label"), 1200);
    });

    IRSState.set({ currentView: viewName, keyboardFocusIndex: 0 });
    updateTimeRhythm();
  }

  async function openInspect(ideaId, peek) {
    const idea = IRSState.getIdeaById(ideaId);
    if (!idea) {
      return;
    }

    const detail = await ensureIdeaDetail(ideaId);
    const related = relatedIdeasFor(idea, IRSState.get("ideas"));
    const html = IRSComponents.inspectView({ idea, detail, relatedIdeas: related });

    dom.inspectInner.innerHTML = html;
    dom.inspectPanel.classList.toggle("is-peek", Boolean(peek));
    dom.inspectPanel.classList.add("is-open");
    dom.inspectPanel.setAttribute("aria-hidden", "false");
    dom.scrim.hidden = false;
    requestAnimationFrame(() => dom.scrim.classList.add("is-visible"));
    IRSMotion.runScanline(dom.inspectScanline);
    IRSState.set({ inspectIdeaId: ideaId, inspectPeek: Boolean(peek) });

    const sections = $$(".inspect-section", dom.inspectInner);
    IRSMotion.cascadeIn(sections, 60, 120);

    const bars = $$(".score-bar-fill", dom.inspectInner);
    bars.forEach((bar) => {
      const width = bar.dataset.width || "0";
      requestAnimationFrame(() => {
        bar.style.width = `${width}%`;
      });
    });

    const band = $(".inspect-band", dom.inspectInner);
    if (band) {
      window.setTimeout(() => band.classList.add("is-drawn"), 180);
    }

    const inspectTitle = $(".inspect-title", dom.inspectInner);
    const inspectScore = $(".inspect-score", dom.inspectInner);
    IRSMotion.runCABeat(inspectTitle);
    IRSMotion.runCABeat(inspectScore);
    observeScoreCountUps(dom.inspectInner);
    bindInspectInteractions();
    updateTimeRhythm();
  }

  function closeInspect() {
    if (!dom.inspectPanel.classList.contains("is-open")) {
      return;
    }
    IRSMotion.cascadeOut($$(".inspect-section", dom.inspectInner), 40);
    dom.inspectPanel.classList.remove("is-open", "is-peek");
    dom.inspectPanel.setAttribute("aria-hidden", "true");
    IRSState.set({ inspectIdeaId: null, inspectPeek: false });

    if (!anySheetOpen()) {
      dom.scrim.classList.remove("is-visible");
      window.setTimeout(() => {
        if (!anySheetOpen()) {
          dom.scrim.hidden = true;
        }
      }, 220);
    }

    updateTimeRhythm();
  }

  function bindInspectInteractions() {
    const saveButton = $("[data-inspect-action='save']", dom.inspectInner);
    const dismissButton = $("[data-inspect-action='dismiss']", dom.inspectInner);

    if (saveButton) {
      saveButton.addEventListener("click", async () => {
        const ideaId = IRSState.get("inspectIdeaId");
        if (!ideaId) {
          return;
        }
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
      dismissButton.addEventListener("click", closeInspect);
    }

    $$(".related-card", dom.inspectInner).forEach((button) => {
      button.addEventListener("click", () => openInspect(button.dataset.relatedId, false));
    });
  }

  function openSettingsSheet() {
    dom.settingsSheet.innerHTML = IRSComponents.settingsSheet({
      sources: IRSState.get("sources"),
      appearance: IRSState.get("appearance"),
      reducedMotion: IRSState.get("reducedMotionOverride")
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

    $$("[data-sort-option]", dom.sortSheet).forEach((button) => {
      button.addEventListener("click", () => {
        IRSState.setNested("explore", (explore) => ({ ...explore, sort: button.dataset.sortOption, page: 1 }));
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
    const query = IRSState.get("explore").searchQuery;
    dom.searchSheet.innerHTML = IRSComponents.searchSheet(query, IRSState.get("ideas"));
    IRSMotion.showSheet(dom.searchSheet, dom.scrim);
    IRSState.set({ searchSheetOpen: true });
    bindSearchInteractions();
    const input = $("#searchInput", dom.searchSheet);
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
    const input = $("#searchInput", dom.searchSheet);
    if (!input) {
      return;
    }
    input.addEventListener("input", () => {
      IRSState.setNested("explore", (explore) => ({ ...explore, searchQuery: input.value }));
      dom.searchSheet.innerHTML = IRSComponents.searchSheet(input.value, IRSState.get("ideas"));
      bindSearchInteractions();
      const nextInput = $("#searchInput", dom.searchSheet);
      if (nextInput) {
        nextInput.focus();
        nextInput.setSelectionRange(nextInput.value.length, nextInput.value.length);
      }
      $$(".compact-card[data-idea-id]", dom.searchSheet).forEach((card) => {
        card.addEventListener("click", () => {
          closeSearchSheet();
          openInspect(card.dataset.ideaId, false);
        });
      });
    });

    $$(".compact-card[data-idea-id]", dom.searchSheet).forEach((card) => {
      card.addEventListener("click", () => {
        closeSearchSheet();
        openInspect(card.dataset.ideaId, false);
      });
    });
  }

  function bindSettingsInteractions() {
    $("[data-settings-action='signout']", dom.settingsSheet)?.addEventListener("click", () => {
      showToast("Sign out is not configured for local mode.");
    });

    $$(".chip[data-appearance]", dom.settingsSheet).forEach((chip) => {
      chip.addEventListener("click", () => {
        IRSState.set({ appearance: chip.dataset.appearance });
        applyEnvironment();
        openSettingsSheet();
      });
    });

    const reducedMotionToggle = $("[data-settings-toggle='reduced-motion']", dom.settingsSheet);
    if (reducedMotionToggle) {
      reducedMotionToggle.addEventListener("click", () => {
        IRSState.set({ reducedMotionOverride: !IRSState.get("reducedMotionOverride") });
        applyEnvironment();
        openSettingsSheet();
      });
    }

    $$("[data-source-toggle]", dom.settingsSheet).forEach((toggle) => {
      toggle.addEventListener("click", async () => {
        const sourceId = toggle.dataset.sourceToggle;
        const source = IRSState.get("sources").find((entry) => entry.source_id === sourceId);
        if (!source) {
          return;
        }
        try {
          if (Number(source.enabled) === 1) {
            await IRSApi.disableSource(sourceId);
            showToast(`Disabled ${sourceId}.`);
          } else {
            await IRSApi.enableSource(sourceId);
            showToast(`Enabled ${sourceId}.`, "success");
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

  function showToast(message, tone = "neutral") {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = IRSComponents.toast(message, tone);
    const toast = wrapper.firstElementChild;
    dom.toastStack.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("is-visible"));

    window.setTimeout(() => {
      toast.classList.add("is-leaving");
      window.setTimeout(() => toast.remove(), 220);
    }, 3200);
  }

  function bindNavigation() {
    dom.navItems.forEach((item) => {
      item.addEventListener("click", () => {
        switchView(item.dataset.nav);
      });
    });
    dom.profileChip.addEventListener("click", openSettingsSheet);
    dom.appMark.addEventListener("click", () => switchView("radar"));
  }

  function bindGlobalInteractions() {
    dom.scrim.addEventListener("click", closeOverlays);

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeOverlays();
      }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        handleKeyboardCardNavigation(event.key === "ArrowDown" ? 1 : -1);
      }
      if (event.key === "Enter") {
        const focused = document.activeElement;
        if (focused && focused.classList.contains("signal-card") && focused.dataset.ideaId) {
          openInspect(focused.dataset.ideaId, false);
        }
      }
    });

    let inspectDragStart = null;
    dom.inspectPanel.addEventListener("pointerdown", (event) => {
      if (event.clientY > 120 || window.innerWidth >= 1024) {
        return;
      }
      inspectDragStart = event.clientY;
    });

    dom.inspectPanel.addEventListener("pointerup", (event) => {
      if (inspectDragStart === null) {
        return;
      }
      const delta = event.clientY - inspectDragStart;
      inspectDragStart = null;
      if (delta > 90) {
        closeInspect();
      }
    });

    let pullStart = null;
    document.addEventListener("touchstart", (event) => {
      if (window.scrollY === 0 && IRSState.get("currentView") === "radar" && !anySheetOpen()) {
        pullStart = event.touches[0].clientY;
      }
    }, { passive: true });

    document.addEventListener("touchend", async (event) => {
      if (pullStart === null) {
        return;
      }
      const diff = event.changedTouches[0].clientY - pullStart;
      pullStart = null;
      if (diff > 80) {
        await refreshData();
        renderAll();
        IRSMotion.runScanline(dom.inspectScanline);
        showToast("Radar refreshed.", "success");
      }
    }, { passive: true });

    window.addEventListener("scroll", updateTimeRhythm, { passive: true });
    dom.inspectInner.addEventListener("scroll", updateTimeRhythm, { passive: true });
  }

  function handleKeyboardCardNavigation(direction) {
    const cards = $$(".view.is-active .signal-card");
    if (!cards.length) {
      return;
    }
    const currentIndex = Math.max(0, Math.min(cards.length - 1, IRSState.get("keyboardFocusIndex")));
    const nextIndex = Math.max(0, Math.min(cards.length - 1, currentIndex + direction));
    cards.forEach((card, index) => {
      card.tabIndex = index === nextIndex ? 0 : -1;
      card.classList.toggle("is-focused", index === nextIndex);
    });
    cards[nextIndex].focus();
    IRSState.set({ keyboardFocusIndex: nextIndex });
  }

  function updateTimeRhythm() {
    let progress = 0;
    if (dom.inspectPanel.classList.contains("is-open")) {
      const max = dom.inspectInner.scrollHeight - dom.inspectInner.clientHeight;
      progress = max > 0 ? dom.inspectInner.scrollTop / max : 1;
    } else {
      const scrollMax = document.documentElement.scrollHeight - window.innerHeight;
      progress = scrollMax > 0 ? window.scrollY / scrollMax : 0;
    }
    const clamped = Math.max(0, Math.min(progress, 1));
    dom.timeRhythmFill.style.width = `${(clamped * 100).toFixed(2)}%`;
  }

  function applyEnvironment() {
    const reducedMotion = IRSState.get("reducedMotionOverride") || IRSMotion.prefersReducedMotion.matches;
    IRSMotion.applyEnvironment(dom.app, {
      appearance: IRSState.get("appearance"),
      reducedMotion
    });
  }

  async function refreshData() {
    const data = await IRSApi.loadDashboard();
    IRSState.set({ ...data, loading: false, error: null });
    await preloadTopDetails();
  }

  function renderAll() {
    renderRadar();
    renderMovers();
    renderExplore();
    renderSystem();
    switchView(IRSState.get("currentView"));
    updateTimeRhythm();
  }

  async function initialize() {
    bindNavigation();
    bindGlobalInteractions();
    applyEnvironment();
    IRSMotion.onReducedMotionChange(applyEnvironment);

    dom.viewRadar.innerHTML = `
      <header class="view-header">
        <h1 class="view-title">Radar</h1>
        <p class="view-subtitle">Loading opportunities...</p>
      </header>
      <div class="radar-feed">
        <article class="signal-card is-visible"></article>
        <article class="signal-card is-visible"></article>
        <article class="signal-card is-visible"></article>
      </div>
    `;

    try {
      await refreshData();
      renderAll();
    } catch (error) {
      console.error(error);
      IRSState.set({ loading: false, error: error.message });
      dom.viewRadar.innerHTML = `
        <header class="view-header">
          <h1 class="view-title">Radar</h1>
        </header>
        ${IRSComponents.emptyLine("Couldn&#39;t reach the pipeline. Retrying in Xs.")}
      `;
      showToast("Connection failed. Please try again.", "error");
    }
  }

  document.addEventListener("DOMContentLoaded", initialize);
})();
