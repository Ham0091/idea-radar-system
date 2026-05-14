const IRSComponents = (() => {
  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function score(value) {
    return Number(value || 0);
  }

  function scoreText(value, digits = 1) {
    return score(value).toFixed(digits);
  }

  function rankScore(idea) {
    if (idea.user_score !== null && idea.user_score !== undefined) {
      return score(idea.user_score);
    }
    if (idea.ranking_score !== null && idea.ranking_score !== undefined) {
      return score(idea.ranking_score);
    }
    return score(idea.computed_score);
  }

  function parseJsonList(value) {
    if (Array.isArray(value)) {
      return value;
    }
    if (typeof value !== "string" || value.trim() === "") {
      return [];
    }
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function firstSentence(text) {
    if (!text) {
      return "";
    }
    const normalized = String(text).replace(/\s+/g, " ").trim();
    const period = normalized.indexOf(".");
    const sentence = period > 0 ? normalized.slice(0, period + 1) : normalized;
    return sentence.length > 180 ? `${sentence.slice(0, 177)}...` : sentence;
  }

  function formatAge(iso) {
    if (!iso) {
      return "--";
    }
    const now = Date.now();
    const value = new Date(iso).getTime();
    if (Number.isNaN(value)) {
      return "--";
    }
    const diffMs = Math.max(now - value, 0);
    const hours = Math.floor(diffMs / 3600000);
    if (hours < 24) {
      return `${hours}h`;
    }
    const days = Math.floor(hours / 24);
    if (days < 7) {
      return `${days}d`;
    }
    const weeks = Math.floor(days / 7);
    return `${weeks}w`;
  }

  function formatDate(iso) {
    if (!iso) {
      return "--";
    }
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric"
    });
  }

  function relativeTime(iso) {
    if (!iso) {
      return "--";
    }
    const diffMs = Date.now() - new Date(iso).getTime();
    const hours = Math.floor(diffMs / 3600000);
    if (hours < 1) {
      return "now";
    }
    if (hours < 24) {
      return `${hours}h ago`;
    }
    const days = Math.floor(hours / 24);
    if (days < 7) {
      return `${days}d ago`;
    }
    return `${Math.floor(days / 7)}w ago`;
  }

  function chapterForIdea(idea) {
    const anchor = idea.created_at || idea.last_signal_at || idea.updated_at;
    if (!anchor) {
      return "long-tail";
    }
    const ageHours = (Date.now() - new Date(anchor).getTime()) / 3600000;
    if (ageHours <= 24) {
      return "today";
    }
    if (ageHours <= 24 * 7) {
      return "this-week";
    }
    return "long-tail";
  }

  function chapterTitle(chapter) {
    if (chapter === "today") {
      return "Today";
    }
    if (chapter === "this-week") {
      return "This Week";
    }
    return "Long Tail";
  }

  function chapterByline(chapter) {
    if (chapter === "today") {
      return "What surfaced in the last 24 hours.";
    }
    if (chapter === "this-week") {
      return "Signals that continued gathering weight.";
    }
    return "Older opportunities that remain active.";
  }

  function chapterStickyLabel(chapter) {
    return `<div class="eyebrow-row"><span>${escapeHtml(chapterTitle(chapter).toUpperCase())}</span></div>`;
  }

  function chapterDivider(chapter) {
    return `
      <section class="chapter-divider" data-chapter-divider="${escapeHtml(chapter)}">
        <h2 class="chapter-divider-title">${escapeHtml(chapterTitle(chapter))}</h2>
        <p class="chapter-divider-byline">${escapeHtml(chapterByline(chapter))}</p>
        <div class="chapter-divider-rule"></div>
      </section>
    `;
  }

  function dominantSemantic(idea) {
    const pain = score(idea.pain);
    const build = score(idea.buildability);
    const momentum = Math.min(10, score(idea.recent_signal_count));

    if (pain >= build && pain >= momentum) {
      return { key: "pain", css: "var(--sem-pain)" };
    }
    if (build >= pain && build >= momentum) {
      return { key: "build", css: "var(--sem-build)" };
    }
    return { key: "momentum", css: "var(--sem-momentum)" };
  }

  function normalizePoints(points, minLength = 14) {
    const list = Array.isArray(points) ? points.slice(0, minLength) : [];
    while (list.length < minLength) {
      list.push(0);
    }
    return list;
  }

  function sparklinePath(points, width = 320, height = 28) {
    const values = normalizePoints(points);
    const maxValue = Math.max(...values, 1);
    const step = width / Math.max(values.length - 1, 1);

    return values
      .map((value, index) => {
        const x = index * step;
        const y = height - (value / maxValue) * (height - 3) - 1.5;
        return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(" ");
  }

  function dailySignalSeries(detail, fallbackCount = 0) {
    const days = 14;
    const buckets = new Array(days).fill(0);
    const signals = Array.isArray(detail?.signals) ? detail.signals : [];
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (days - 1));

    for (const signal of signals) {
      const time = new Date(signal.timestamp || signal.created_at || signal.updated_at);
      const offset = Math.floor((time - start) / 86400000);
      if (offset >= 0 && offset < days) {
        buckets[offset] += 1;
      }
    }

    if (!signals.length && fallbackCount > 0) {
      const seeded = Math.max(1, Math.round(fallbackCount / days));
      for (let i = 0; i < days; i += 1) {
        buckets[i] = seeded + ((i % 3) - 1);
      }
    }

    return buckets.map((item) => Math.max(item, 0));
  }

  function radarCard({ idea, chapter, rank, detail, tabIndex = -1 }) {
    const dominant = dominantSemantic(idea);
    const composite = rankScore(idea);
    const summary = firstSentence(idea.description);
    const points = dailySignalSeries(detail, idea.recent_signal_count);
    const sparkline = sparklinePath(points);
    const signalsTotal = Number(idea.signal_count || detail?.signals?.length || 0);
    const sourcesCount = Number(idea.recent_signal_count || 0);

    return `
      <article class="signal-card" data-idea-id="${escapeHtml(idea.id)}" data-rank="${rank}" tabindex="${tabIndex}">
        <div class="eyebrow-row">
          <span>${escapeHtml(chapterTitle(chapter).toUpperCase())} · ${escapeHtml(formatAge(idea.created_at || idea.last_signal_at))} · ${sourcesCount} SOURCES</span>
        </div>
        <h3 class="signal-title">${escapeHtml(idea.title)}</h3>
        <p class="signal-summary">${escapeHtml(summary)}</p>
        <div class="score-strip">
          <span class="score-composite count-up" data-count-target="${composite.toFixed(1)}" style="color:${dominant.css}">${composite.toFixed(1)}</span>
          <div class="score-subscores">
            <span class="score-sub">P ${scoreText(idea.pain)}</span>
            <span class="score-sub">B ${scoreText(idea.buildability)}</span>
          </div>
        </div>
        <div class="sparkline-wrap">
          <svg class="sparkline" viewBox="0 0 320 28" preserveAspectRatio="none" role="img" aria-label="Momentum over 14 days">
            <path class="sparkline-line" d="${sparkline}" style="stroke:${dominant.css}"></path>
          </svg>
        </div>
        <div class="metadata-footer">
          <button class="metadata-toggle" type="button" aria-expanded="false">
            ${signalsTotal} signals · last seen ${escapeHtml(relativeTime(idea.last_signal_at || idea.updated_at))}
          </button>
          <div class="metadata-expanded" hidden>
            <span>Novelty ${scoreText(idea.novelty)} · Buildability ${scoreText(idea.buildability)}</span>
            <span>Computed ${scoreText(idea.computed_score)} · Override ${idea.user_score === null || idea.user_score === undefined ? "none" : scoreText(idea.user_score)}</span>
            <span>Status ${escapeHtml(idea.user_status || "active")}</span>
          </div>
        </div>
      </article>
    `;
  }

  function compactCard(idea) {
    return `
      <article class="compact-card" data-idea-id="${escapeHtml(idea.id)}">
        <h4 class="compact-title">${escapeHtml(idea.title)}</h4>
        <p class="compact-summary">${escapeHtml(firstSentence(idea.description))}</p>
        <div class="compact-score">${scoreText(rankScore(idea))}</div>
      </article>
    `;
  }

  function moversCard({ idea, delta, detail, rangeLabel }) {
    const points = dailySignalSeries(detail, idea.recent_signal_count);
    const recentPath = sparklinePath(points.slice(-7), 160, 36);
    const fullPath = sparklinePath(points, 320, 36);
    const deltaClass = delta >= 0 ? "up" : "down";
    const deltaLabel = `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}%`;

    return `
      <article class="mover-card signal-card" data-idea-id="${escapeHtml(idea.id)}">
        <div class="eyebrow-row">
          <span>MOVERS · ${escapeHtml(rangeLabel)} · ${escapeHtml(formatAge(idea.created_at || idea.last_signal_at))}</span>
          <span class="mover-delta ${deltaClass}">${deltaLabel}</span>
        </div>
        <h3 class="signal-title">${escapeHtml(idea.title)}</h3>
        <p class="signal-summary">${escapeHtml(firstSentence(idea.description))}</p>
        <div class="sparkline-wrap">
          <svg class="sparkline is-movers" viewBox="0 0 320 36" preserveAspectRatio="none" role="img" aria-label="Recent momentum trend">
            <path class="sparkline-line dimmed" d="${fullPath}" style="stroke:var(--text-muted)"></path>
            <path class="sparkline-line" d="${recentPath}" style="stroke:${delta >= 0 ? "var(--sem-momentum)" : "var(--sem-pain)"}"></path>
          </svg>
        </div>
      </article>
    `;
  }

  function scoreBarRow(label, value, colorVar) {
    const width = Math.max(0, Math.min((score(value) / 10) * 100, 100));
    return `
      <div class="score-bar">
        <span class="score-bar-label">${escapeHtml(label)}</span>
        <span class="score-bar-track">
          <span class="score-bar-fill" data-width="${width.toFixed(2)}" style="background:${colorVar}"></span>
        </span>
        <span class="score-bar-value" style="color:${colorVar}">${scoreText(value)}</span>
      </div>
    `;
  }

  function inspectView({ idea, detail, relatedIdeas }) {
    const dominant = dominantSemantic(idea);
    const composite = rankScore(idea);
    const signals = Array.isArray(detail?.signals) ? detail.signals : [];
    const whyNow = idea.why_now ? String(idea.why_now).trim() : "";
    const mvpItems = String(idea.mvp_scope || "")
      .split(/\n|•|-/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
      .slice(0, 6);

    const excerpts = signals
      .filter((signal) => signal.text)
      .slice(0, 5)
      .map((signal) => `
        <article>
          <p class="source-quote">${escapeHtml(String(signal.text).slice(0, 240))}</p>
          <p class="source-attribution">${escapeHtml((signal.source || "SOURCE").toUpperCase())} · ${escapeHtml(formatDate(signal.timestamp))}</p>
        </article>
      `)
      .join("");

    const timelineChips = signals
      .slice(0, 10)
      .map((signal) => `<span class="timeline-chip">${escapeHtml(formatDate(signal.timestamp))}</span>`)
      .join("");

    const timelinePath = sparklinePath(dailySignalSeries(detail, idea.recent_signal_count), 320, 88);

    const relatedCards = relatedIdeas
      .slice(0, 8)
      .map((related) => `
        <button class="related-card" type="button" data-related-id="${escapeHtml(related.id)}">
          ${escapeHtml(related.title)}
        </button>
      `)
      .join("");

    return `
      <article class="inspect-header">
        <h2 class="inspect-title">${escapeHtml(idea.title)}</h2>
        <p class="inspect-score count-up" data-count-target="${composite.toFixed(1)}" style="color:${dominant.css}">${composite.toFixed(1)}</p>
        <div class="inspect-band" style="background:${dominant.css}"></div>
      </article>

      ${whyNow ? `
      <section class="inspect-section">
        <p class="inspect-copy dropcap" style="color:${dominant.css}">${escapeHtml(whyNow)}</p>
      </section>` : ""}

      ${signals.length ? `
      <section class="inspect-section">
        <h3 class="eyebrow-row"><span>SIGNAL TIMELINE</span></h3>
        <div class="sparkline-wrap" style="margin-top:14px;">
          <svg class="sparkline" viewBox="0 0 320 88" preserveAspectRatio="none" role="img" aria-label="Signal timeline momentum">
            <path class="sparkline-line" d="${timelinePath}" style="stroke:${dominant.css}"></path>
          </svg>
        </div>
        <div class="timeline-chips">${timelineChips}</div>
      </section>` : ""}

      <section class="inspect-section">
        <h3 class="eyebrow-row"><span>SCORE COMPOSITION</span></h3>
        <div class="score-bars" style="margin-top:16px;">
          ${scoreBarRow("Pain", idea.pain, "var(--sem-pain)")}
          ${scoreBarRow("Momentum", Math.min(10, idea.recent_signal_count || 0), "var(--sem-momentum)")}
          ${scoreBarRow("Build", idea.buildability, "var(--sem-build)")}
        </div>
      </section>

      ${excerpts ? `
      <section class="inspect-section">
        <h3 class="eyebrow-row"><span>SOURCE EXCERPTS</span></h3>
        <div class="source-list" style="margin-top:16px;">${excerpts}</div>
      </section>` : ""}

      ${mvpItems.length ? `
      <section class="inspect-section">
        <h3 class="eyebrow-row"><span>MVP SCOPE</span></h3>
        <ul class="mvp-list" style="margin-top:14px;">
          ${mvpItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
        </ul>
      </section>` : ""}

      ${relatedCards ? `
      <section class="inspect-section">
        <h3 class="eyebrow-row"><span>RELATED IDEAS</span></h3>
        <div class="related-row" style="margin-top:14px;">${relatedCards}</div>
      </section>` : ""}

      <section class="inspect-actions">
        <button class="btn-primary" type="button" data-inspect-action="save">Save</button>
        <button class="btn-ghost" type="button" data-inspect-action="dismiss">Dismiss</button>
      </section>
    `;
  }

  function settingsSheet({ sources, appearance, reducedMotion }) {
    const sourceRows = sources
      .map((source) => {
        const isOn = Number(source.enabled) === 1;
        const dotClass = Number(source.enabled) === 1 ? "ok" : Number(source.consecutive_failures || 0) > 0 ? "fail" : "warn";
        return `
          <div class="settings-row">
            <span><span class="status-dot ${dotClass}"></span>${escapeHtml(source.source_id)}</span>
            <button class="toggle ${isOn ? "is-on" : ""}" type="button" data-source-toggle="${escapeHtml(source.source_id)}" aria-pressed="${isOn ? "true" : "false"}"></button>
          </div>
        `;
      })
      .join("");

    return `
      <h2 class="sheet-heading">Settings</h2>
      <section class="settings-group">
        <h3>Account</h3>
        <div class="settings-row"><span>Email</span><span class="screen-reader-only">Read only account email</span><span style="color:var(--text-muted)">local@idea-radar</span></div>
        <button class="btn-ghost" type="button" data-settings-action="signout">Sign out</button>
      </section>
      <section class="settings-group">
        <h3>Sources</h3>
        ${sourceRows || '<p class="view-subtitle">No sources available.</p>'}
      </section>
      <section class="settings-group">
        <h3>Notifications</h3>
        <div class="chip-scroll" data-notification-frequency>
          <button class="chip is-active" type="button" data-frequency="daily">Daily</button>
          <button class="chip" type="button" data-frequency="twice-daily">Twice daily</button>
          <button class="chip" type="button" data-frequency="weekly">Weekly</button>
        </div>
        <div style="margin-top:12px;">
          <label class="screen-reader-only" for="quietHours">Quiet hours</label>
          <input class="sheet-input" id="quietHours" type="text" value="23:00 - 07:00" aria-label="Quiet hours">
        </div>
      </section>
      <section class="settings-group">
        <h3>Appearance</h3>
        <div class="settings-row">
          <span>Reduced motion override</span>
          <button class="toggle ${reducedMotion ? "is-on" : ""}" type="button" data-settings-toggle="reduced-motion" aria-pressed="${reducedMotion ? "true" : "false"}"></button>
        </div>
        <div class="chip-scroll" style="margin-top:10px;" data-appearance-intensity>
          <button class="chip ${appearance === "subtle" ? "is-active" : ""}" type="button" data-appearance="subtle">Subtle</button>
          <button class="chip ${appearance === "default" ? "is-active" : ""}" type="button" data-appearance="default">Default</button>
          <button class="chip ${appearance === "off" ? "is-active" : ""}" type="button" data-appearance="off">Off</button>
        </div>
      </section>
      <section class="settings-group">
        <h3>About</h3>
        <p class="view-subtitle">Version local build</p>
        <p class="view-subtitle">Ingestion schedule follows pipeline runs.</p>
      </section>
    `;
  }

  function sortSheet(currentSort) {
    const options = [
      { value: "score", label: "Score" },
      { value: "momentum", label: "Momentum delta" },
      { value: "recency", label: "Recency" },
      { value: "build", label: "Build complexity" }
    ];
    return `
      <h2 class="sheet-heading">Sort</h2>
      <div class="search-results">
        ${options
          .map((option) => `<button class="compact-card" type="button" data-sort-option="${option.value}" aria-pressed="${currentSort === option.value ? "true" : "false"}">${escapeHtml(option.label)}${currentSort === option.value ? " · active" : ""}</button>`)
          .join("")}
      </div>
    `;
  }

  function searchSheet(query, ideas) {
    const q = String(query || "").trim().toLowerCase();
    const filtered = !q
      ? []
      : ideas
          .filter((idea) => {
            const text = `${idea.title || ""} ${idea.description || ""} ${parseJsonList(idea.keywords).join(" ")}`.toLowerCase();
            return text.includes(q);
          })
          .slice(0, 20);

    return `
      <h2 class="sheet-heading">Search</h2>
      <label class="screen-reader-only" for="searchInput">Search opportunities</label>
      <input id="searchInput" class="sheet-input" placeholder="Search opportunities..." value="${escapeHtml(query || "")}" autocomplete="off">
      ${!q ? '<p class="view-subtitle" style="margin-top:10px;">Start typing to search across all signals.</p>' : ""}
      <div class="search-results">
        ${filtered.map((idea) => compactCard(idea)).join("")}
      </div>
    `;
  }

  function toast(message, tone = "neutral") {
    return `<div class="toast ${escapeHtml(tone)}">${escapeHtml(message)}</div>`;
  }

  function emptyLine(text) {
    return `<div class="empty-line">${escapeHtml(text)}</div>`;
  }

  return {
    score,
    scoreText,
    rankScore,
    parseJsonList,
    firstSentence,
    formatAge,
    formatDate,
    relativeTime,
    chapterForIdea,
    chapterTitle,
    chapterByline,
    chapterStickyLabel,
    chapterDivider,
    dominantSemantic,
    sparklinePath,
    dailySignalSeries,
    radarCard,
    moversCard,
    compactCard,
    inspectView,
    settingsSheet,
    sortSheet,
    searchSheet,
    toast,
    emptyLine,
    escapeHtml
  };
})();
