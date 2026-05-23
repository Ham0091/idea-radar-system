const IRSComponents = (() => {
  "use strict";

  /* ---- Utilities ---- */

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "\x26amp;")
      .replace(/</g, "\x26lt;")
      .replace(/>/g, "\x26gt;")
      .replace(/"/g, "\x26quot;")
      .replace(/'/g, "\x26#39;");
  }

  function score(value) {
    return Number(value || 0);
  }

  function scoreText(value, digits = 1) {
    return score(value).toFixed(digits);
  }

  function rankScore(idea) {
    if (idea.user_score !== null && idea.user_score !== undefined) return score(idea.user_score);
    if (idea.ranking_score !== null && idea.ranking_score !== undefined) return score(idea.ranking_score);
    return score(idea.computed_score);
  }

  function parseJsonList(value) {
    if (Array.isArray(value)) return value;
    if (typeof value !== "string" || value.trim() === "") return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function firstSentence(text) {
    if (!text) return "";
    const normalized = String(text).replace(/\s+/g, " ").trim();
    const period = normalized.indexOf(".");
    const sentence = period > 0 ? normalized.slice(0, period + 1) : normalized;
    return sentence.length > 180 ? sentence.slice(0, 177) + "\u2026" : sentence;
  }

  /* ---- Time / Date ---- */

  function formatAge(iso) {
    if (!iso) return "\u2014";
    const value = new Date(iso).getTime();
    if (Number.isNaN(value)) return "\u2014";
    const hours = Math.floor(Math.max(Date.now() - value, 0) / 3600000);
    if (hours < 24) return hours + "h";
    const days = Math.floor(hours / 24);
    if (days < 7) return days + "d";
    return Math.floor(days / 7) + "w";
  }

  function formatDate(iso) {
    if (!iso) return "\u2014";
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  function relativeTime(iso) {
    if (!iso) return "\u2014";
    const hours = Math.floor((Date.now() - new Date(iso).getTime()) / 3600000);
    if (hours < 1) return "now";
    if (hours < 24) return hours + "h ago";
    const days = Math.floor(hours / 24);
    if (days < 7) return days + "d ago";
    return Math.floor(days / 7) + "w ago";
  }

  /* ---- Chapters ---- */

  function chapterForIdea(idea) {
    const anchor = idea.created_at || idea.last_signal_at || idea.updated_at;
    if (!anchor) return "long-tail";
    const ageHours = (Date.now() - new Date(anchor).getTime()) / 3600000;
    if (ageHours <= 24) return "today";
    if (ageHours <= 168) return "this-week";
    return "long-tail";
  }

  function chapterTitle(chapter) {
    if (chapter === "today") return "Today";
    if (chapter === "this-week") return "This Week";
    return "Long Tail";
  }

  function chapterByline(chapter) {
    if (chapter === "today") return "What surfaced in the last 24 hours.";
    if (chapter === "this-week") return "Signals that continued gathering weight.";
    return "Older opportunities that remain active.";
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

  /* ---- Sparkline ---- */

  function normalizePoints(points, minLength) {
    const list = Array.isArray(points) ? points.slice(0, minLength) : [];
    while (list.length < minLength) list.push(0);
    return list;
  }

  function sparklinePath(points, width, height) {
    if (width === undefined) width = 320;
    if (height === undefined) height = 28;
    const values = normalizePoints(points, 14);
    const maxVal = Math.max(...values, 1);
    const step = width / Math.max(values.length - 1, 1);
    return values
      .map(function (v, i) {
        var x = i * step;
        var y = height - (v / maxVal) * (height - 3) - 1.5;
        return (i === 0 ? "M" : "L") + x.toFixed(2) + " " + y.toFixed(2);
      })
      .join(" ");
  }

  function dailySignalSeries(detail, fallbackCount) {
    if (!fallbackCount) fallbackCount = 0;
    var days = 14;
    var buckets = new Array(days).fill(0);
    var signals = Array.isArray(detail && detail.signals) ? detail.signals : [];
    var now = new Date();
    var start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (days - 1));

    for (var i = 0; i < signals.length; i++) {
      var time = new Date(signals[i].timestamp || signals[i].created_at || signals[i].updated_at);
      var offset = Math.floor((time - start) / 86400000);
      if (offset >= 0 && offset < days) buckets[offset] += 1;
    }

    if (!signals.length && fallbackCount > 0) {
      var seeded = Math.max(1, Math.round(fallbackCount / days));
      for (var j = 0; j < days; j++) buckets[j] = seeded + ((j % 3) - 1);
    }

    return buckets.map(function (v) { return Math.max(v, 0); });
  }

  /* ---- Semantic Dominant ---- */

  function dominantSemantic(idea) {
    var p = score(idea.pain);
    var b = score(idea.buildability);
    var m = Math.min(10, score(idea.recent_signal_count));
    if (p >= b && p >= m) return { key: "pain", css: "var(--sem-pain)" };
    if (b >= p && b >= m) return { key: "build", css: "var(--sem-build)" };
    return { key: "momentum", css: "var(--sem-momentum)" };
  }

  function inferProjectFormat(idea) {
    var blob = [idea.title, idea.description, idea.mvp_scope || "", (idea.tags || []).join(" "), (idea.keywords || []).join(" ")].join(" ").toLowerCase();
    /* Specific format indicators — ordered most-to-least specific */
    if (/\bchrome\s+ext/.test(blob)) return "Chrome Extension";
    if (/\bextension\b/.test(blob) || /\bbrowser\s+(ext|plug)/.test(blob)) return "Browser Extension";
    if (/\bmobile\s+app\b/.test(blob) || (/\bios\b/.test(blob) && /\bandroid\b/.test(blob)) || /\bapp\s+store\b/.test(blob)) return "Mobile App";
    if (/\bcli\b/.test(blob) || /\bcommand[\s-]line\b/.test(blob) || /\bterminal\b/.test(blob)) return "CLI Tool";
    if (/\bapi\b.*\bsdk\b/.test(blob) || /\bdeveloper\s+(tool|sdk|library)\b/.test(blob)) return "API / SDK";
    if (/\bmarketplace\b/.test(blob) || /\bmatchmaker\b/.test(blob) || /\bmatching\s+platform\b/.test(blob)) return "Marketplace";
    if (/\btoolkit\b/.test(blob) || /\bframework\b/.test(blob)) return "Toolkit";
    if (/\bnavigator\b/.test(blob) || /\bguide\b/.test(blob) || /\bplaybook\b/.test(blob)) return "Guide / Tool";
    if (/\bdashboard\b/.test(blob) || /\banalyzer\b/.test(blob) || /\bmonitor(ing)?\b/.test(blob)) return "Dashboard";
    if (/\bsaas\b/.test(blob)) return "SaaS Platform";
    if (/\bchatbot\b/.test(blob) || /\bai[\s-]assistant\b/.test(blob) || /\bagent\b/.test(blob)) return "AI Agent";
    if (/\bnewsletter\b/.test(blob) || /\bcontent\b.*\bplatform\b/.test(blob)) return "Content Platform";
    if (/\bkit\b/.test(blob) || /\bstarter\b/.test(blob) || /\btemplate\b/.test(blob)) return "Starter Kit";
    return "Web App";
  }

  function buildPitch(idea) {
    var fmt = inferProjectFormat(idea);
    var title = String(idea.title || "");
    var verb = "Build";
    if (/^(A|An|The)\s/i.test(title)) {
      return verb + " " + title;
    }
    var article = /^[aeiou]/i.test(fmt) ? "an" : "a";
    return verb + " " + article + " " + fmt.toLowerCase() + " \u2014 " + title;
  }

  /* ---- Shared Templates ---- */

  function viewActions(actions) {
    return '<div class="view-actions">' +
      actions.map(function (a) {
        return '<button class="view-action ' + (a.variant || "") + '" type="button" data-action="' + escapeHtml(a.id) + '">' + escapeHtml(a.label) + '</button>';
      }).join("") +
      '</div>';
  }

  function loadingState(title, subtitle) {
    if (!title) title = "Loading signals";
    if (!subtitle) subtitle = "Building the next view from the pipeline.";
    return '<section class="empty-state">' +
      '<div><div class="view-kicker">' + escapeHtml(title) + '</div>' +
      '<p class="empty-state-copy" style="margin-top:8px">' + escapeHtml(subtitle) + '</p></div>' +
      '<div class="loading-stack" aria-hidden="true">' +
      '<article class="loading-card"><div class="skeleton-line"></div><div class="skeleton-line"></div><div class="skeleton-line"></div><div class="skeleton-pill"></div></article>' +
      '<article class="loading-card"><div class="skeleton-line"></div><div class="skeleton-line"></div><div class="skeleton-line"></div><div class="skeleton-pill"></div></article>' +
      '<article class="loading-card"><div class="skeleton-line"></div><div class="skeleton-line"></div><div class="skeleton-line"></div><div class="skeleton-pill"></div></article>' +
      '</div></section>';
  }

  function emptyState(title, copy) {
    return '<section class="empty-state">' +
      '<div class="view-kicker">' + escapeHtml(title) + '</div>' +
      '<p class="empty-state-title">' + escapeHtml(copy) + '</p>' +
      '</section>';
  }

  function emptyLine(text) {
    return '<div class="empty-line">' + escapeHtml(text) + '</div>';
  }

  function toast(message, tone) {
    if (!tone) tone = "neutral";
    return '<div class="toast ' + escapeHtml(tone) + '">' + escapeHtml(message) + '</div>';
  }

  /* ---- Radar Card ---- */

  function radarCard(opts) {
    var idea = opts.idea;
    var chapter = opts.chapter;
    var rank = opts.rank;
    var detail = opts.detail;
    var tabIndex = opts.tabIndex !== undefined ? opts.tabIndex : -1;

    var dominant = dominantSemantic(idea);
    var composite = rankScore(idea);
    var summary = firstSentence(idea.description);
    var fmt = inferProjectFormat(idea);
    var pitch = buildPitch(idea);
    var points = dailySignalSeries(detail, idea.recent_signal_count);
    var sparkline = sparklinePath(points);
    var signalsTotal = Number(idea.signal_count || (detail && detail.signals && detail.signals.length) || 0);
    var sourcesCount = Number(idea.recent_signal_count || 0);

    return '<article class="signal-card" data-idea-id="' + escapeHtml(idea.id) + '" data-rank="' + rank + '" tabindex="' + tabIndex + '">' +
      '<div class="eyebrow-row">' +
        '<span class="format-chip">' + escapeHtml(fmt.toUpperCase()) + '</span>' +
        '<span>' + escapeHtml(chapterTitle(chapter).toUpperCase()) + ' \u00b7 ' + escapeHtml(formatAge(idea.created_at || idea.last_signal_at)) + ' \u00b7 ' + sourcesCount + ' sources</span>' +
      '</div>' +
      '<h3 class="signal-title">' + escapeHtml(idea.title) + '</h3>' +
      '<p class="build-pitch">' + escapeHtml(pitch) + '</p>' +
      '<p class="signal-summary">' + escapeHtml(summary) + '</p>' +
      '<div class="score-strip">' +
        '<span class="score-composite count-up" data-count-target="' + composite.toFixed(1) + '" style="color:' + dominant.css + '">' + composite.toFixed(1) + '</span>' +
        '<div class="score-subscores">' +
          '<span class="score-sub">P ' + scoreText(idea.pain) + '</span>' +
          '<span class="score-sub">B ' + scoreText(idea.buildability) + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="sparkline-wrap">' +
        '<svg class="sparkline" viewBox="0 0 320 28" preserveAspectRatio="none" role="img" aria-label="Momentum over 14 days">' +
          '<path class="sparkline-line" d="' + sparkline + '" style="stroke:' + dominant.css + '"></path>' +
        '</svg>' +
      '</div>' +
      '<div class="metadata-footer">' +
        '<button class="metadata-toggle" type="button" aria-expanded="false">' +
          signalsTotal + ' signals \u00b7 last seen ' + escapeHtml(relativeTime(idea.last_signal_at || idea.updated_at)) +
        '</button>' +
        '<div class="metadata-expanded" hidden>' +
          '<span>Novelty ' + scoreText(idea.novelty) + ' \u00b7 Buildability ' + scoreText(idea.buildability) + '</span>' +
          '<span>Computed ' + scoreText(idea.computed_score) + ' \u00b7 Override ' + (idea.user_score == null ? "none" : scoreText(idea.user_score)) + '</span>' +
          '<span>Status ' + escapeHtml(idea.user_status || "active") + '</span>' +
        '</div>' +
      '</div>' +
    '</article>';
  }

  /* ---- Compact Card (search results) ---- */

  function compactCard(idea) {
    var fmt = inferProjectFormat(idea);
    return '<article class="compact-card" data-idea-id="' + escapeHtml(idea.id) + '">' +
      '<span class="format-chip format-chip--sm">' + escapeHtml(fmt.toUpperCase()) + '</span>' +
      '<h4 class="compact-title">' + escapeHtml(idea.title) + '</h4>' +
      '<p class="compact-summary">' + escapeHtml(firstSentence(idea.description)) + '</p>' +
      '<div class="compact-score">' + scoreText(rankScore(idea)) + '</div>' +
    '</article>';
  }

  /* ---- Movers Card ---- */

  function moversCard(opts) {
    var idea = opts.idea;
    var delta = opts.delta;
    var detail = opts.detail;
    var rangeLabel = opts.rangeLabel;
    var fmt = inferProjectFormat(idea);

    var points = dailySignalSeries(detail, idea.recent_signal_count);
    var recentPath = sparklinePath(points.slice(-7), 160, 36);
    var fullPath = sparklinePath(points, 320, 36);
    var deltaClass = delta >= 0 ? "up" : "down";
    var deltaLabel = (delta >= 0 ? "+" : "") + delta.toFixed(1) + "%";

    return '<article class="mover-card signal-card" data-idea-id="' + escapeHtml(idea.id) + '">' +
      '<div class="eyebrow-row">' +
        '<span class="format-chip">' + escapeHtml(fmt.toUpperCase()) + '</span>' +
        '<span>MOVERS \u00b7 ' + escapeHtml(rangeLabel) + ' \u00b7 ' + escapeHtml(formatAge(idea.created_at || idea.last_signal_at)) + '</span>' +
        '<span class="mover-delta ' + deltaClass + '">' + deltaLabel + '</span>' +
      '</div>' +
      '<h3 class="signal-title">' + escapeHtml(idea.title) + '</h3>' +
      '<p class="build-pitch">' + escapeHtml(buildPitch(idea)) + '</p>' +
      '<p class="signal-summary">' + escapeHtml(firstSentence(idea.description)) + '</p>' +
      '<div class="sparkline-wrap">' +
        '<svg class="sparkline is-movers" viewBox="0 0 320 36" preserveAspectRatio="none" role="img" aria-label="Recent momentum trend">' +
          '<path class="sparkline-line dimmed" d="' + fullPath + '" style="stroke:var(--ink-faint)"></path>' +
          '<path class="sparkline-line" d="' + recentPath + '" style="stroke:' + (delta >= 0 ? "var(--sem-momentum)" : "var(--sem-pain)") + '"></path>' +
        '</svg>' +
      '</div>' +
    '</article>';
  }

  /* ---- Score Bar Row ---- */

  function scoreBarRow(label, value, colorVar) {
    var width = Math.max(0, Math.min((score(value) / 10) * 100, 100));
    return '<div class="score-bar">' +
      '<span class="score-bar-label">' + escapeHtml(label) + '</span>' +
      '<span class="score-bar-track"><span class="score-bar-fill" data-width="' + width.toFixed(2) + '" style="background:' + colorVar + '"></span></span>' +
      '<span class="score-bar-value" style="color:' + colorVar + '">' + scoreText(value) + '</span>' +
    '</div>';
  }

  /* ---- Inspect Detail View ---- */

  function inspectView(opts) {
    var idea = opts.idea;
    var detail = opts.detail;
    var relatedIdeas = opts.relatedIdeas;

    var dominant = dominantSemantic(idea);
    var composite = rankScore(idea);
    var signals = Array.isArray(detail && detail.signals) ? detail.signals : [];
    var whyNow = idea.why_now ? String(idea.why_now).trim() : "";
    var mvpItems = String(idea.mvp_scope || "").split(/\n|\u2022|-/).map(function (s) { return s.trim(); }).filter(function (s) { return s.length > 0; }).slice(0, 6);

    var excerpts = signals.filter(function (s) { return s.text; }).slice(0, 5).map(function (s) {
      return '<article>' +
        '<p class="source-quote">' + escapeHtml(String(s.text).slice(0, 240)) + '</p>' +
        '<p class="source-attribution">' + escapeHtml((s.source || "SOURCE").toUpperCase()) + ' \u00b7 ' + escapeHtml(formatDate(s.timestamp)) + '</p>' +
      '</article>';
    }).join("");

    var timelineChips = signals.slice(0, 10).map(function (s) {
      return '<span class="timeline-chip">' + escapeHtml(formatDate(s.timestamp)) + '</span>';
    }).join("");

    var timelinePath = sparklinePath(dailySignalSeries(detail, idea.recent_signal_count), 320, 88);

    var relatedCards = relatedIdeas.slice(0, 8).map(function (r) {
      return '<button class="related-card" type="button" data-related-id="' + escapeHtml(r.id) + '">' + escapeHtml(r.title) + '</button>';
    }).join("");

    var fmt = inferProjectFormat(idea);
    var pitch = buildPitch(idea);

    var html = '';

    // Header
    html += '<article class="inspect-header">';
    html += '<span class="format-chip">' + escapeHtml(fmt.toUpperCase()) + '</span>';
    html += '<h2 class="inspect-title">' + escapeHtml(idea.title) + '</h2>';
    html += '<p class="build-pitch">' + escapeHtml(pitch) + '</p>';
    html += '<p class="inspect-score count-up" data-count-target="' + composite.toFixed(1) + '" style="color:' + dominant.css + '">' + composite.toFixed(1) + '</p>';
    html += '<div class="inspect-band" style="background:' + dominant.css + '"></div>';
    html += '</article>';

    // Why Now
    if (whyNow) {
      html += '<section class="inspect-section">';
      html += '<p class="inspect-copy" style="border-left:2px solid ' + dominant.css + '; padding-left:16px;">' + escapeHtml(whyNow) + '</p>';
      html += '</section>';
    }

    // Signal Timeline
    if (signals.length) {
      html += '<section class="inspect-section">';
      html += '<h3 class="eyebrow-row"><span>SIGNAL TIMELINE</span></h3>';
      html += '<div class="sparkline-wrap" style="margin-top:14px"><svg class="sparkline" viewBox="0 0 320 88" preserveAspectRatio="none" role="img" aria-label="Signal timeline momentum"><path class="sparkline-line" d="' + timelinePath + '" style="stroke:' + dominant.css + '"></path></svg></div>';
      html += '<div class="timeline-chips">' + timelineChips + '</div>';
      html += '</section>';
    }

    // Score Composition
    html += '<section class="inspect-section">';
    html += '<h3 class="eyebrow-row"><span>SCORE COMPOSITION</span></h3>';
    html += '<div class="score-bars" style="margin-top:16px">';
    html += scoreBarRow("Pain", idea.pain, "var(--sem-pain)");
    html += scoreBarRow("Momentum", Math.min(10, idea.recent_signal_count || 0), "var(--sem-momentum)");
    html += scoreBarRow("Build", idea.buildability, "var(--sem-build)");
    html += '</div></section>';

    // Source Excerpts
    if (excerpts) {
      html += '<section class="inspect-section">';
      html += '<h3 class="eyebrow-row"><span>SOURCE EXCERPTS</span></h3>';
      html += '<div class="source-list" style="margin-top:16px">' + excerpts + '</div>';
      html += '</section>';
    }

    // MVP Scope
    if (mvpItems.length) {
      html += '<section class="inspect-section">';
      html += '<h3 class="eyebrow-row"><span>MVP SCOPE</span></h3>';
      html += '<ul class="mvp-list" style="margin-top:14px">';
      html += mvpItems.map(function (item) { return '<li>' + escapeHtml(item) + '</li>'; }).join("");
      html += '</ul></section>';
    }

    // Related Ideas
    if (relatedCards) {
      html += '<section class="inspect-section">';
      html += '<h3 class="eyebrow-row"><span>RELATED IDEAS</span></h3>';
      html += '<div class="related-row" style="margin-top:14px">' + relatedCards + '</div>';
      html += '</section>';
    }

    // Actions
    html += '<section class="inspect-actions">';
    html += '<button class="btn-primary" type="button" data-inspect-action="save">Save</button>';
    html += '<button class="btn-ghost" type="button" data-inspect-action="dismiss">Dismiss</button>';
    html += '</section>';

    return html;
  }

  /* ---- Settings Sheet ---- */

  function settingsSheet(opts) {
    var sources = opts.sources;
    var appearance = opts.appearance;
    var reducedMotion = opts.reducedMotion;

    var sourceRows = sources.map(function (s) {
      var isOn = Number(s.enabled) === 1;
      var dotClass = isOn ? "ok" : (Number(s.consecutive_failures || 0) > 0 ? "fail" : "warn");
      return '<div class="settings-row">' +
        '<span><span class="status-dot ' + dotClass + '"></span>' + escapeHtml(s.source_id) + '</span>' +
        '<button class="toggle ' + (isOn ? "is-on" : "") + '" type="button" data-source-toggle="' + escapeHtml(s.source_id) + '" aria-pressed="' + (isOn ? "true" : "false") + '"></button>' +
      '</div>';
    }).join("");

    return '' +
      '<h2 class="sheet-heading">Settings</h2>' +
      '<section class="settings-group">' +
        '<h3>Account</h3>' +
        '<div class="settings-row"><span>Email</span><span style="color:var(--ink-muted)">local@idea-radar</span></div>' +
        '<button class="btn-ghost" type="button" data-settings-action="signout">Sign out</button>' +
      '</section>' +
      '<section class="settings-group">' +
        '<h3>Sources</h3>' +
        (sourceRows || '<p class="view-subtitle">No sources available.</p>') +
      '</section>' +
      '<section class="settings-group">' +
        '<h3>Notifications</h3>' +
        '<div class="chip-scroll" data-notification-frequency>' +
          '<button class="chip is-active" type="button" data-frequency="daily">Daily</button>' +
          '<button class="chip" type="button" data-frequency="twice-daily">Twice daily</button>' +
          '<button class="chip" type="button" data-frequency="weekly">Weekly</button>' +
        '</div>' +
        '<div style="margin-top:12px"><label class="sr-only" for="quietHours">Quiet hours</label><input class="sheet-input" id="quietHours" type="text" value="23:00 \u2013 07:00" aria-label="Quiet hours"></div>' +
      '</section>' +
      '<section class="settings-group">' +
        '<h3>Appearance</h3>' +
        '<div class="settings-row">' +
          '<span>Reduced motion override</span>' +
          '<button class="toggle ' + (reducedMotion ? "is-on" : "") + '" type="button" data-settings-toggle="reduced-motion" aria-pressed="' + (reducedMotion ? "true" : "false") + '"></button>' +
        '</div>' +
      '</section>' +
      '<section class="settings-group">' +
        '<h3>About</h3>' +
        '<p class="view-subtitle">Version local build</p>' +
        '<p class="view-subtitle">Ingestion schedule follows pipeline runs.</p>' +
      '</section>';
  }

  /* ---- Sort Sheet ---- */

  function sortSheet(currentSort) {
    var options = [
      { value: "score", label: "Score" },
      { value: "momentum", label: "Momentum delta" },
      { value: "recency", label: "Recency" },
      { value: "build", label: "Build complexity" }
    ];
    return '<h2 class="sheet-heading">Sort</h2>' +
      '<div class="search-results">' +
      options.map(function (o) {
        return '<button class="compact-card" type="button" data-sort-option="' + o.value + '" aria-pressed="' + (currentSort === o.value ? "true" : "false") + '">' +
          escapeHtml(o.label) + (currentSort === o.value ? ' \u00b7 active' : '') +
        '</button>';
      }).join("") +
      '</div>';
  }

  /* ---- Search Sheet ---- */

  function searchSheet(query, ideas) {
    var q = String(query || "").trim().toLowerCase();
    var filtered = !q ? [] : ideas.filter(function (idea) {
      var text = (idea.title || "") + " " + (idea.description || "") + " " + parseJsonList(idea.keywords).join(" ");
      return text.toLowerCase().indexOf(q) !== -1;
    }).slice(0, 20);

    return '<h2 class="sheet-heading">Search</h2>' +
      '<label class="sr-only" for="searchInput">Search opportunities</label>' +
      '<input id="searchInput" class="sheet-input" placeholder="Search opportunities\u2026" value="' + escapeHtml(query || "") + '" autocomplete="off">' +
      (!q
        ? '<p class="view-subtitle" style="margin-top:10px">Start typing to search across all signals.</p>'
        : '<p class="view-subtitle" style="margin-top:10px">' + filtered.length + ' result' + (filtered.length === 1 ? "" : "s") + ' found.</p>') +
      '<div class="search-results">' +
      (filtered.length
        ? filtered.map(function (idea) { return compactCard(idea); }).join("")
        : q ? emptyState("No matches yet.", "Try a broader keyword or clear part of the query.") : "") +
      '</div>';
  }

  /* ---- Public API ---- */

  return {
    score: score,
    scoreText: scoreText,
    rankScore: rankScore,
    parseJsonList: parseJsonList,
    firstSentence: firstSentence,
    formatAge: formatAge,
    formatDate: formatDate,
    relativeTime: relativeTime,
    chapterForIdea: chapterForIdea,
    chapterTitle: chapterTitle,
    chapterByline: chapterByline,
    chapterDivider: chapterDivider,
    viewActions: viewActions,
    loadingState: loadingState,
    emptyState: emptyState,
    dominantSemantic: dominantSemantic,
    sparklinePath: sparklinePath,
    dailySignalSeries: dailySignalSeries,
    radarCard: radarCard,
    moversCard: moversCard,
    compactCard: compactCard,
    inspectView: inspectView,
    settingsSheet: settingsSheet,
    sortSheet: sortSheet,
    searchSheet: searchSheet,
    toast: toast,
    emptyLine: emptyLine,
    escapeHtml: escapeHtml
  };
})();
