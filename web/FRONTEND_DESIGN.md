# IRS Frontend — Design Specification

## Visual Direction

### Identity

> "Calm editorial intelligence surface"

The IRS frontend is a **mobile-first editorial radar** — not a dashboard, not a chatbot, not an analytics panel. It borrows the intentional typography of Linear, the quiet confidence of Notion, and the information density of Stripe Radar. No decorative symbols, no HUD aesthetics, no emoji. Content speaks for itself.

### Color System

| Token | Value | Purpose |
|-------|-------|---------|
| `surface-0` | `#0b0d10` | Deepest background — near-black, warm undertone |
| `surface-1` | `#12141a` | Card base |
| `surface-2` | `#1a1d25` | Card hover / elevated |
| `surface-3` | `#222530` | Interactive elements |
| `surface-4` | `#2e3140` | Borders, dividers |
| `text-primary` | `#e2e4ea` | Headlines, scores |
| `text-secondary` | `#8b8fa4` | Body text, descriptions |
| `text-tertiary` | `#555872` | Labels, timestamps |
| `text-muted` | `#3a3d52` | Decorative, disabled |
| `accent-primary` | `#7c8cdb` | Blue-violet — scores, active states, links |
| `accent-secondary` | `#5e6abf` | Hover/pressed accent |
| `accent-dim` | `#3d4480` | Borders, glows |
| `color-pain` | `#d4705e` | Pain metric — subdued red-orange |
| `color-up` | `#7c8cdb` | Upward momentum — same as accent |
| `color-down` | `#d4705e` | Downward momentum — same as pain |
| `color-new` | `#9b8aec` | New entry — muted violet |
| `color-build` | `#d4a641` | Buildability / building status — warm amber |

**No rainbow palettes.** Accent is always blue-violet. Pain is always subdued red-orange. New is always violet. Build is always amber.

### Typography

| Role | Font | Weight | Size | Tracking |
|------|------|--------|------|----------|
| Brand / nav | JetBrains Mono | 600 | 12px | +0.12em |
| Rank | JetBrains Mono | 600 | 11px | — |
| Score (card) | JetBrains Mono | 500 | 14px | — |
| Score (inspect) | JetBrains Mono | 700 | 36px | — |
| Metric values | JetBrains Mono | 500 | 10px | +0.02em |
| Card title | Inter | 600 | 14px | -0.01em |
| Section title | Inter | 600 | 20px | -0.03em |
| Body / description | Inter | 400 | 13px | — |
| Problem line | Inter | 400 | 12px | — |
| Labels | Inter | 600 | 11px | +0.08em, uppercase |
| Timestamps | JetBrains Mono | 400 | 11px | +0.02em |

**Rule:** Monospace for numbers, ranks, scores, timestamps, keywords. Sans-serif for titles, descriptions, labels. No emoji, no decorative symbols — text labels only.

### Spacing

4px base unit. Cards use `14px` padding. Sections use `20px` gaps. The signal deck uses `10px` card gaps for density without crowding.

### Borders & Shadows

- **Borders:** 1px `solid var(--surface-4)` — thin, cool-toned, never heavy
- **Shadows:** Only `shadow-md` for toasts and sheets. Cards use borders, not shadows.
- **No box-shadow on cards.** The left-edge accent line replaces shadow as the depth cue.
- **Radii:** Smaller, tighter — 4px sm, 6px md, 8px lg, 12px xl

---

## Layout System

### Mobile-First Single Column

The primary experience is a single-column vertically scrollable **signal deck**. One idea dominates attention at a time. Whitespace creates breathing room.

```
┌─────────────────────┐
│  IRS   Radar | Movers│  ← sticky nav
├─────────────────────┤
│                     │
│ Signal Deck         │  ← view title
│ 10 opportunities    │  ← subtitle
│                     │
│ ┌─────────────────┐│
│ │01 Title         ││  ← rank + title
│ │ Problem line…   ││  ← one-line frustration
│ │ P7.0  5>3  3s   ││  ← pain, momentum, signals
│ └─────────────────┘│
│                     │
│ ┌─────────────────┐│
│ │02 Next idea     ││
│ │ …               ││
│ └─────────────────┘│
│                     │
│ …                   │
│                     │
└─────────────────────┘
```

### Tablet (768px+)

- Nav tabs show labels
- Content max-width: 640px, centered
- System grid: 2 columns

### Desktop (1024px+)

- Content max-width: 720px, centered
- System grid: 3 columns
- Larger type scale for titles

### View Switching

Three primary views + one overlay:

1. **Radar** — Signal deck (default)
2. **Movers** — Rank changes
3. **System** — Operational status
4. **Inspect** — Idea detail (overlay, replaces radar)

Views transition with opacity + translateY. Inspect enters from below with a scale effect.

---

## Component Hierarchy

```
App
├── NavBar ← sticky top
│   ├── NavBrand ← "IRS" monospace
│   ├── NavTabs ← Radar | Movers | System
│   └── NavMeta ← last updated timestamp
│
├── ViewContainer
│   ├── ViewRadar
│   │   ├── RadarHeader ← title + subtitle
│   │   └── SignalDeck ← scrollable card list
│       └── SignalCard ×10
│           ├── Rank (mono)
│           ├── Title (sans)
│           ├── Score (mono, secondary)
│           ├── Problem line
│           └── Metrics row
│               ├── PainPill ← "P7.0"
│               ├── MomentumPill ← "5 > 3" or "NEW"
│               ├── SignalsPill ← "3s"
│               └── BuildabilityPill ← "B6.5"
│
│   ├── ViewInspect
│   │   ├── BackButton
│   │   └── InspectContent
│   │       ├── RankBadge
│   │       ├── Title
│   │       ├── ScoreLarge
│   │       ├── Description
│   │       ├── ScoreBreakdown
│   │       │   └── ScoreBar ×6 (pain, freq, novelty, timeliness, build, openness)
│   │       ├── MVPScope
│   │       ├── WhyNow
│   │       ├── Keywords
│   │       ├── SignalTimeline
│   │       │   └── SignalItem ×N
│   │       └── ScoreOverride
│   │
│   ├── ViewMovers
│   │   ├── MoversHeader
│   │   └── MoversList
│   │       └── MoverItem ×N
│   │           ├── DirectionIndicator ← "+" or "-"
│   │           ├── RankChange
│   │           ├── Title
│   │           └── Context
│   │
│   └── ViewSystem
│       ├── SystemHeader
│       └── SystemGrid
│           ├── OverviewPanel
│           ├── LastRunPanel
│           └── SourcesPanel
│
├── ActionSheet ← mobile context menu
│   ├── Handle
│   ├── Title
│   └── ActionItems
│       ├── Build ← "Mark as Building"
│       ├── Dismiss ← "Dismiss"
│       └── Revert ← "Restore" / "Unmark Building"
│
└── ToastContainer ← notification stack
    └── Toast ×N
```

---

## Motion Language

### Principles

1. **Intentional** — every animation communicates meaning (rank change, new entry, state transition)
2. **Calm** — durations 150–500ms, easing curves that decelerate naturally
3. **Restrained** — staggered reveals, layered entrances, no excess
4. **60fps** — CSS transforms and opacity only, no layout thrashing
5. **Never distracting** — motion guides attention, never competes with content

### Easing Catalog

| Name | Curve | Use |
|------|-------|-----|
| `ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` | Card reveals, view transitions |
| `ease-in` | `cubic-bezier(0.7, 0, 0.84, 0)` | Exits, dismissals |
| `ease-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Toasts, score bumps |
| `ease-smooth` | `cubic-bezier(0.25, 0.1, 0.25, 1)` | Hover states, color transitions |

### Duration Catalog

| Name | Duration | Use |
|------|----------|-----|
| `instant` | 80ms | Hover color, focus ring |
| `fast` | 150ms | Button press, tab switch |
| `normal` | 250ms | Card reveal, view switch |
| `slow` | 500ms | Score bars, inspect enter |
| `cinema` | 800ms | Page-level transitions |

### Animation Inventory

| Animation | Trigger | Duration | Easing | Details |
|-----------|---------|----------|--------|---------|
| **Card stagger reveal** | View load | 250ms + 60ms stagger | ease-out | Cards fade up sequentially, 60ms apart, max 600ms total stagger |
| **View switch** | Tab click | 250ms | ease-out | Outgoing fades up (exit-up), incoming fades down from 12px |
| **Inspect enter** | Card tap | 500ms | ease-out | Content slides up 24px + scales from 0.98 |
| **Score bar fill** | Inspect open | 500ms + 80ms stagger | ease-out | Bars grow from 0% to target width, staggered |
| **Mover slide** | Movers view | 250ms + 60ms stagger | ease-out | Up-movers slide from below, down-movers from above |
| **Action sheet** | Long press | 250ms | ease-out | Overlay fades in, sheet slides up from bottom |
| **Toast** | Action complete | 250ms enter / 200ms exit | ease-spring | Pops up with scale, exits with fade |
| **Card press** | Touch | 150ms | ease-out | Scale to 0.985 on active |
| **Rank flash** | New data | 1.5s | ease-out | Inset glow pulse on cards with rank changes |

### Reduced Motion

All animations respect `prefers-reduced-motion: reduce`. When active, transitions become instant (0ms) and staggered reveals happen simultaneously.

---

## Mobile-First Interaction Model

### Primary: Tap to Inspect

Tapping a signal card opens the inspect view with a slide-up transition. The back button (or Escape key) returns to the radar.

### Secondary: Long-Press for Actions

Holding a card for 500ms opens the action sheet with context-appropriate options:
- **Active ideas:** Mark as Building, Dismiss
- **Building ideas:** Unmark Building
- **Dismissed ideas:** Restore

### Tertiary: Swipe to Refresh

Pulling down from the top of the page triggers a data refresh with skeleton loading states.

### Keyboard Navigation

| Key | Action |
|-----|--------|
| `1` | Switch to Radar view |
| `2` | Switch to Movers view |
| `3` | Switch to System view |
| `Escape` | Back from inspect / close action sheet |

### Progressive Disclosure

The card shows only what's needed for the 5-second decision:
1. **What?** → Title + problem line
2. **How painful?** → Pain pill ("P7.0")
3. **Momentum?** → Momentum pill ("5 > 3" or "NEW")
4. **Buildable?** → Buildability pill ("B6.5", only shown if ≥ 6)

Everything else (score breakdown, MVP scope, signals, keywords, why now) lives in the inspect view.

---

## Data Flow

```
SQLite → Flask API (/api/*) → IRSApi (fetch) → IRSState (store) → IRSComponents (render) → DOM
↑                                                                    ↓
└── IRSMotion (animate) ←────────────────────────────────────────────┘
```

- **API layer** reads from the same SQLite database the pipeline writes to
- **State store** is the single source of truth; components are pure renderers
- **Motion module** triggers CSS animations after DOM insertion
- **No virtual DOM** — direct innerHTML updates, appropriate for this scale

---

## File Structure

```
web/
├── api.py              ← Flask API serving SQLite data
├── requirements.txt    ← flask, flask-cors
├── FRONTEND_DESIGN.md  ← This document
└── static/
    ├── index.html      ← Shell with view structure
    ├── css/
    │   ├── design-system.css  ← Tokens, reset, typography, utilities
    │   ├── layout.css         ← App shell, nav, views, responsive
    │   ├── components.css     ← Cards, pills, bars, panels, sheets
    │   └── motion.css         ← Keyframes, animation classes
    └── js/
        ├── state.js       ← Reactive state store
        ├── api.js         ← Fetch wrapper for Flask endpoints
        ├── motion.js      ← Animation orchestration
        ├── components.js  ← Pure HTML render functions
        └── app.js         ← Controller: events, routing, rendering
```

---

## Running

```bash
cd idea-radar-system/web
pip install -r requirements.txt
python api.py
# Opens at http://localhost:5000
```

The API serves static files from `static/` (configured with `static_folder="static"`, `static_url_path="/static"`) and provides JSON endpoints at `/api/*`.

---

## Design Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2025-05 | Removed all emoji/symbol references | Editorial aesthetic — text labels are clearer and more professional than decorative symbols |
| 2025-05 | Removed radar sweep ambient | HUD aesthetic removed in favor of clean editorial surface; background is flat near-black |
| 2025-05 | Accent changed from cyan to blue-violet | Warmer, more editorial feel; cyan read as "terminal/HUD" |
| 2025-05 | Surface-0 changed to `#0b0d10` | Warmer near-black with subtle blue undertone vs cold `#08090d` |
| 2025-05 | Reduced border radii | Tighter radii (4/6/8/12px) feel more editorial, less "bubble UI" |
| 2025-05 | Score demoted on signal cards | Title-first hierarchy; score is secondary info, not the primary visual |
| 2025-05 | Metric pills use text labels | "P7.0" instead of emoji prefixes; clearer, more scannable |
| 2025-05 | Momentum uses text indicators | "NEW", "5 > 3" instead of arrow symbols; more informative |
| 2025-05 | Movers use +/- instead of arrows | Text-only direction indicators match editorial tone |
| 2025-05 | Action sheet uses text labels | "Build", "Dismiss", "Revert" instead of emoji icons |
