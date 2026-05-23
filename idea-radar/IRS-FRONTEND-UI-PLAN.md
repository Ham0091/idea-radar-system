# IRS V3.5 — Vectorheart Mobile Frontend UI Plan

> **For AI Implementation**  
> This document specifies the complete frontend rebuild for Idea Radar System (IRS) V3.5.  
> The backend API already exists. Focus solely on the mobile-first UI implementation.

---

## Table of Contents

1. [Design Direction: Vectorheart](#1-design-direction-vectorheart)
2. [Design Tokens](#2-design-tokens)
3. [Typography System](#3-typography-system)
4. [Screen Specifications](#4-screen-specifications)
   - [4.1 Bottom Navigation](#41-bottom-navigation)
   - [4.2 Radar View (Home)](#42-radar-view-home)
   - [4.3 Inspect View (Detail Overlay)](#43-inspect-view-detail-overlay)
5. [Component Library](#5-component-library)
6. [Motion System](#6-motion-system)
7. [Implementation Notes](#7-implementation-notes)
8. [Workshop Questions](#8-workshop-questions)

---

## 1. Design Direction: Vectorheart

### What is Vectorheart?

Vectorheart is a design movement from the early 2000s (peak: 2000–2006) pioneered by firms like **Bionic Systems** and **The Designers Republic**. It combines:

- **2D vector graphics** with industrial, utilitarian precision
- **Swiss modernism** typography and grid systems
- **High-contrast** compositions with restrained color palettes
- **Futuristic forms** without being cyberpunk or neon
- **Technical grids** and perspective lines as visual motifs
- **Geometric sans-serif** and segmented/modular typefaces

### Vectorheart Applied to IRS

| Vectorheart Principle | IRS Application |
|----------------------|-----------------|
| High-contrast typography | Large bold headlines against dark surfaces |
| Swiss grid composition | Strict vertical rhythm, modular spacing |
| Industrial precision | Sharp corners, technical borders, no soft shadows |
| Vector line art | Grid overlays, technical annotation marks, hairline dividers |
| Restrained color | Near-monochrome base + single accent family |
| Futuristic optimism | Forward-leaning angles, momentum indicators |

### What Vectorheart is NOT

- Cyberpunk neon glow
- Soft gradients or glassmorphism
- Rounded, friendly, "app-like" UI
- Dark mode for its own sake
- Retro pixel art or skeuomorphism

---

## 2. Design Tokens

### 2.1 Color Palette

```css
:root {
  /* === BACKGROUND LAYERS === */
  --bg-void: #050608;           /* Deepest layer, true dark */
  --bg-base: #0a0c10;           /* Primary background */
  --bg-elevated: #10131a;       /* Cards, surfaces */
  --bg-interactive: #161a24;    /* Hover states, active elements */

  /* === VECTOR GRID OVERLAYS === */
  --grid-line: rgba(120, 140, 180, 0.06);   /* Subtle grid lines */
  --grid-accent: rgba(120, 140, 180, 0.12); /* Emphasized grid */

  /* === TYPOGRAPHY === */
  --text-primary: #e8ecf4;      /* Headlines, primary content */
  --text-secondary: #a0a8b8;    /* Body text, descriptions */
  --text-tertiary: #5c6370;     /* Metadata, timestamps */
  --text-ghost: #3a3f4a;        /* Disabled, inactive */

  /* === ACCENT: COLD INDIGO === */
  --accent-primary: #6b7cdb;    /* Primary interactive */
  --accent-muted: #4a5a9a;      /* Secondary accent */
  --accent-ghost: rgba(107, 124, 219, 0.15); /* Accent backgrounds */

  /* === SEMANTIC SIGNALS === */
  --signal-pain: #d4715a;       /* Pain intensity */
  --signal-build: #c9a654;      /* Buildability */
  --signal-momentum: #5a9e78;   /* Momentum/growth */
  --signal-neutral: #6b7280;    /* Neutral state */

  /* === BORDERS & DIVIDERS === */
  --border-hairline: rgba(255, 255, 255, 0.04);
  --border-subtle: rgba(255, 255, 255, 0.08);
  --border-emphasis: rgba(107, 124, 219, 0.3);

  /* === RADIUS === */
  --radius-none: 0px;
  --radius-sm: 2px;
  --radius-md: 4px;
  --radius-lg: 6px;
}
```

### 2.2 Spacing Scale (8px Base)

```css
:root {
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;
}
```

### 2.3 Shadows (Minimal, Technical)

```css
:root {
  /* Vectorheart avoids soft shadows. Use sharp, offset shadows sparingly. */
  --shadow-card: 0 1px 0 0 var(--border-hairline);
  --shadow-elevated: 0 4px 0 0 rgba(0, 0, 0, 0.4);
  --shadow-inset: inset 0 1px 0 0 var(--border-subtle);
}
```

---

## 3. Typography System

### 3.1 Font Stack

```css
:root {
  /* Primary: Geometric sans-serif for headlines */
  --font-display: 'Geist', 'SF Pro Display', -apple-system, sans-serif;
  
  /* Secondary: Clean sans for body */
  --font-body: 'Inter', 'SF Pro Text', -apple-system, sans-serif;
  
  /* Technical: Monospace for data, scores, timestamps */
  --font-mono: 'JetBrains Mono', 'SF Mono', monospace;
}
```

### 3.2 Type Scale (Mobile)

| Token | Size | Weight | Line Height | Letter Spacing | Usage |
|-------|------|--------|-------------|----------------|-------|
| `--text-display` | 28px | 700 | 1.1 | -0.02em | View titles |
| `--text-headline` | 22px | 600 | 1.2 | -0.015em | Card titles |
| `--text-title` | 18px | 600 | 1.25 | -0.01em | Section headers |
| `--text-body` | 15px | 400 | 1.5 | 0 | Body text |
| `--text-caption` | 13px | 500 | 1.4 | 0.01em | Metadata |
| `--text-micro` | 11px | 500 | 1.3 | 0.02em | Timestamps, IDs |
| `--text-data` | 14px | 500 | 1.2 | 0.05em | Scores (mono) |

### 3.3 Typography CSS

```css
.text-display {
  font-family: var(--font-display);
  font-size: 28px;
  font-weight: 700;
  line-height: 1.1;
  letter-spacing: -0.02em;
  color: var(--text-primary);
}

.text-headline {
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 600;
  line-height: 1.2;
  letter-spacing: -0.015em;
  color: var(--text-primary);
}

.text-body {
  font-family: var(--font-body);
  font-size: 15px;
  font-weight: 400;
  line-height: 1.5;
  color: var(--text-secondary);
}

.text-data {
  font-family: var(--font-mono);
  font-size: 14px;
  font-weight: 500;
  line-height: 1.2;
  letter-spacing: 0.05em;
  font-variant-numeric: tabular-nums;
}
```

---

## 4. Screen Specifications

### 4.1 Bottom Navigation

#### Layout

```
┌────────────────────────────────────┐
│  [RADAR]    [MOVERS]    [SYSTEM]   │  ← 3 destinations
│   ●active    ○           ○         │
└────────────────────────────────────┘
     ↑ 56px height + safe-area-inset-bottom
```

#### Specifications

| Property | Value |
|----------|-------|
| Height | 56px + `env(safe-area-inset-bottom)` |
| Background | `var(--bg-base)` with `backdrop-filter: blur(12px)` |
| Border Top | 1px solid `var(--border-hairline)` |
| Position | Fixed bottom |
| Z-index | 100 |

#### Nav Item States

| State | Icon Color | Label Color | Background |
|-------|------------|-------------|------------|
| Default | `var(--text-tertiary)` | `var(--text-tertiary)` | transparent |
| Active | `var(--accent-primary)` | `var(--text-primary)` | `var(--accent-ghost)` |
| Pressed | `var(--accent-muted)` | `var(--text-secondary)` | `var(--bg-interactive)` |

#### Nav Item Dimensions

- Icon: 20px × 20px
- Label: `--text-micro` (11px)
- Gap (icon to label): 4px
- Item padding: 8px horizontal, 6px vertical
- Active indicator: 2px bar below icon, `var(--accent-primary)`

---

### 4.2 Radar View (Home)

The primary discovery experience. A vertically scrolling feed of opportunity cards.

#### View Structure

```
┌─────────────────────────────────────┐
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │  ← Status bar (system)
├─────────────────────────────────────┤
│                                     │
│  RADAR                              │  ← View Header
│  ──────────────────────────         │     28px title
│  47 opportunities · Updated 2m ago  │     13px metadata
│                                     │
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │ │  ← Grid overlay (decorative)
│ │                                 │ │
│ │  TITLE OF OPPORTUNITY           │ │  ← Card Title (22px)
│ │  ─────────────────────          │ │
│ │  Pain summary in one line...    │ │  ← Pain (15px)
│ │                                 │ │
│ │  ▲ 12 signals · 3d momentum     │ │  ← Momentum row (13px mono)
│ │                                 │ │
│ │  ┌──────┐ ┌──────┐ ┌──────┐     │ │
│ │  │ 0.82 │ │ HIGH │ │ 4/5  │     │ │  ← Score pills
│ │  │score │ │ pain │ │build │     │ │
│ │  └──────┘ └──────┘ └──────┘     │ │
│ │                                 │ │
│ │  #ai  #automation  #workflow    │ │  ← Tags (11px)
│ └─────────────────────────────────┘ │
│                                     │
│         ┌─ 16px gap ─┐              │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │         [ NEXT CARD ]           │ │
│ └─────────────────────────────────┘ │
│                                     │
├─────────────────────────────────────┤
│      [ BOTTOM NAVIGATION ]          │
└─────────────────────────────────────┘
```

#### View Header

| Property | Value |
|----------|-------|
| Padding | 20px horizontal, 16px top, 12px bottom |
| Background | `var(--bg-base)` |
| Position | Sticky top (below status bar) |
| Title | `--text-display` (28px/700) |
| Metadata | `--text-caption` (13px) in `var(--text-tertiary)` |
| Border Bottom | 1px solid `var(--border-hairline)` |

#### Signal Card

**Container:**

| Property | Value |
|----------|-------|
| Background | `var(--bg-elevated)` |
| Border | 1px solid `var(--border-subtle)` |
| Border Radius | `var(--radius-md)` (4px) |
| Padding | 20px |
| Margin | 0 16px 16px 16px |

**Card Header (Title Area):**

| Element | Spec |
|---------|------|
| Title | `--text-headline` (22px/600), max 2 lines, `line-clamp: 2` |
| Title Margin Bottom | 8px |

**Pain Summary:**

| Element | Spec |
|---------|------|
| Text | `--text-body` (15px/400), `var(--text-secondary)` |
| Max Lines | 2, with ellipsis |
| Margin Bottom | 12px |

**Momentum Row:**

```
▲ 12 signals · 3d momentum · rising
```

| Element | Spec |
|---------|------|
| Font | `--font-mono`, 13px |
| Color | `var(--text-tertiary)` |
| Icon | 12px arrow, color based on trend |
| Trend Colors | Rising: `var(--signal-momentum)`, Falling: `var(--signal-pain)`, Stable: `var(--text-tertiary)` |
| Margin Bottom | 16px |

**Score Pills Row:**

Three horizontal pills showing key metrics.

| Property | Value |
|----------|-------|
| Layout | `display: flex; gap: 8px;` |
| Pill Background | `var(--bg-interactive)` |
| Pill Border | 1px solid `var(--border-hairline)` |
| Pill Padding | 8px 12px |
| Pill Border Radius | `var(--radius-sm)` (2px) |

**Individual Pill Structure:**

```
┌─────────────┐
│   0.82      │  ← Value: --font-mono, 14px, --text-primary
│   score     │  ← Label: 10px, --text-tertiary, uppercase
└─────────────┘
```

**Score Pill Semantic Colors:**

| Metric | Value Color Condition |
|--------|----------------------|
| Overall Score | > 0.7: `var(--accent-primary)`, else `var(--text-primary)` |
| Pain Level | HIGH: `var(--signal-pain)`, else `var(--text-primary)` |
| Buildability | >= 4: `var(--signal-build)`, else `var(--text-primary)` |

**Tags Row:**

| Property | Value |
|----------|-------|
| Margin Top | 12px |
| Layout | `display: flex; flex-wrap: wrap; gap: 6px;` |
| Tag Font | `--text-micro` (11px), `var(--text-tertiary)` |
| Tag Prefix | `#` character |

**Vectorheart Grid Overlay (Optional Decoration):**

A subtle technical grid pattern overlaid on the card background.

```css
.card-grid-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image: 
    linear-gradient(var(--grid-line) 1px, transparent 1px),
    linear-gradient(90deg, var(--grid-line) 1px, transparent 1px);
  background-size: 24px 24px;
  opacity: 0.5;
}
```

#### Tap Interaction

- On tap: Navigate to Inspect View
- Visual feedback: Card background briefly shifts to `var(--bg-interactive)`
- Transition duration: 100ms

---

### 4.3 Inspect View (Detail Overlay)

The deep-dive layer. Slides up from bottom as a near-fullscreen sheet.

#### View Structure

```
┌─────────────────────────────────────┐
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │  ← Status bar
├─────────────────────────────────────┤
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │  ← Drag handle (40px × 4px)
│                                     │
│  ← Back                             │  ← Back button (left aligned)
│                                     │
│  ═══════════════════════════════    │
│  OPPORTUNITY TITLE HERE             │  ← Display title (28px)
│  ═══════════════════════════════    │
│                                     │
│  ID: IR-0847 · Created 2d ago       │  ← Technical metadata
│                                     │
├─────────────────────────────────────┤
│                                     │
│  ┌─ SCORE BREAKDOWN ──────────────┐ │
│  │                                │ │
│  │  ████████████████░░░░  0.82    │ │  ← Overall score bar
│  │                                │ │
│  │  Pain        ████████░░  0.25  │ │
│  │  Frequency   ██████░░░░  0.20  │ │
│  │  Novelty     ████████░░  0.20  │ │
│  │  Timeliness  ██████░░░░  0.15  │ │
│  │  Buildable   ████░░░░░░  0.10  │ │
│  │  Openness    ████░░░░░░  0.10  │ │
│  │                                │ │
│  └────────────────────────────────┘ │
│                                     │
│  ┌─ PROBLEM ──────────────────────┐ │
│  │                                │ │
│  │  Full problem description      │ │
│  │  spanning multiple lines...    │ │
│  │                                │ │
│  └────────────────────────────────┘ │
│                                     │
│  ┌─ WHY NOW ──────────────────────┐ │
│  │                                │ │
│  │  Timeliness analysis and       │ │
│  │  momentum context...           │ │
│  │                                │ │
│  └────────────────────────────────┘ │
│                                     │
│  ┌─ SIGNALS ──────────────────────┐ │
│  │                                │ │
│  │  ┌─────────────────────────┐   │ │
│  │  │ r/startup · 2d ago      │   │ │
│  │  │ "User complaint about..." │  │ │
│  │  └─────────────────────────┘   │ │
│  │                                │ │
│  │  ┌─────────────────────────┐   │ │
│  │  │ HN · 4d ago             │   │ │
│  │  │ "Discussion thread..."  │   │ │
│  │  └─────────────────────────┘   │ │
│  │                                │ │
│  └────────────────────────────────┘ │
│                                     │
│  ┌─ MVP SCOPE ────────────────────┐ │
│  │                                │ │
│  │  • Core feature 1              │ │
│  │  • Core feature 2              │ │
│  │  • Core feature 3              │ │
│  │                                │ │
│  └────────────────────────────────┘ │
│                                     │
│         [ 80px bottom padding ]     │
│                                     │
└─────────────────────────────────────┘
```

#### Sheet Specifications

| Property | Value |
|----------|-------|
| Position | Fixed, full viewport |
| Background | `var(--bg-base)` |
| Border Top Left/Right Radius | 12px (top corners only) |
| Entry Animation | Slide up from bottom, 300ms ease-out |
| Exit Animation | Slide down, 250ms ease-in |
| Backdrop | `var(--bg-void)` at 60% opacity |
| Z-index | 200 |

#### Drag Handle

| Property | Value |
|----------|-------|
| Width | 40px |
| Height | 4px |
| Background | `var(--text-ghost)` |
| Border Radius | 2px |
| Margin | 12px auto 16px |

#### Back Button

| Property | Value |
|----------|-------|
| Position | Top left, below drag handle |
| Padding | 8px 16px |
| Font | `--text-caption` (13px), `var(--text-secondary)` |
| Icon | 16px chevron-left |
| Tap Area | Minimum 44px × 44px |

#### Header Section

| Element | Spec |
|---------|------|
| Title | `--text-display` (28px/700), full width, no truncation |
| Technical ID | `--font-mono`, 11px, `var(--text-ghost)` |
| Padding | 0 20px |
| Margin Bottom | 24px |

#### Section Component

Reusable container for each content block.

```
┌─ SECTION LABEL ────────────────────┐
│                                    │
│  [ Section Content ]               │
│                                    │
└────────────────────────────────────┘
```

| Property | Value |
|----------|-------|
| Label Font | `--text-micro` (11px), uppercase, `letter-spacing: 0.1em` |
| Label Color | `var(--text-tertiary)` |
| Label Border | 1px solid `var(--border-subtle)` extending right |
| Content Padding | 16px 0 |
| Section Margin | 0 20px 24px |
| Section Border Bottom | 1px solid `var(--border-hairline)` |

#### Score Breakdown Section

**Overall Score Bar:**

| Property | Value |
|----------|-------|
| Height | 8px |
| Background (track) | `var(--bg-interactive)` |
| Background (fill) | `var(--accent-primary)` |
| Border Radius | 2px |
| Value Label | `--font-mono`, 18px, positioned right |

**Component Score Rows:**

| Property | Value |
|----------|-------|
| Layout | Label left, bar center, value right |
| Bar Height | 4px |
| Bar Width | Flex 1 (fills available space) |
| Label | `--text-caption`, `var(--text-secondary)` |
| Value | `--font-mono`, 13px, `var(--text-tertiary)` |
| Row Gap | 8px vertical |

#### Signal Item Component

```
┌─────────────────────────────────────┐
│  r/startup · 2 days ago             │  ← Source + time
│  ───────────────────────────────    │
│  "Original signal text excerpt      │  ← Quote text
│   that sparked this idea..."        │
└─────────────────────────────────────┘
```

| Property | Value |
|----------|-------|
| Background | `var(--bg-elevated)` |
| Border | 1px solid `var(--border-hairline)` |
| Padding | 12px 16px |
| Border Radius | `var(--radius-sm)` |
| Source Font | `--text-micro`, `var(--text-tertiary)` |
| Quote Font | `--text-body`, `var(--text-secondary)`, italic |
| Quote Prefix | 2px left border in `var(--accent-muted)` |
| Item Gap | 8px |

#### MVP Scope Section

Bullet list format.

| Property | Value |
|----------|-------|
| List Style | Custom bullet: `▸` character |
| Bullet Color | `var(--accent-muted)` |
| Item Font | `--text-body` |
| Item Gap | 8px |

---

## 5. Component Library

### 5.1 Core Components to Implement

| Component | File Path | Purpose |
|-----------|-----------|---------|
| `BottomNav` | `components/navigation/bottom-nav.tsx` | Fixed bottom navigation |
| `NavItem` | `components/navigation/nav-item.tsx` | Individual nav destination |
| `ViewHeader` | `components/layout/view-header.tsx` | Sticky view title + metadata |
| `SignalCard` | `components/radar/signal-card.tsx` | Opportunity card |
| `ScorePill` | `components/radar/score-pill.tsx` | Metric display pill |
| `MomentumIndicator` | `components/radar/momentum-indicator.tsx` | Trend arrow + text |
| `TagList` | `components/shared/tag-list.tsx` | Horizontal tag row |
| `InspectSheet` | `components/inspect/inspect-sheet.tsx` | Detail overlay container |
| `SectionBlock` | `components/inspect/section-block.tsx` | Labeled content section |
| `ScoreBreakdown` | `components/inspect/score-breakdown.tsx` | Score visualization |
| `SignalItem` | `components/inspect/signal-item.tsx` | Source signal display |
| `GridOverlay` | `components/shared/grid-overlay.tsx` | Vectorheart decorative grid |

### 5.2 Shared Primitives

| Primitive | Purpose |
|-----------|---------|
| `cn()` | Class name utility (already exists) |
| `formatRelativeTime()` | "2d ago" formatter |
| `formatScore()` | Score decimal formatting |

---

## 6. Motion System

### 6.1 Timing Functions

```css
:root {
  --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
  --spring: cubic-bezier(0.34, 1.56, 0.64, 1);
}
```

### 6.2 Transition Specifications

| Interaction | Duration | Easing | Properties |
|-------------|----------|--------|------------|
| Card tap feedback | 100ms | ease-out | background-color |
| Card hover/focus | 150ms | ease-in-out | border-color, transform |
| Inspect sheet open | 300ms | ease-out-expo | transform (translateY) |
| Inspect sheet close | 250ms | ease-in-out | transform (translateY) |
| Nav item switch | 200ms | ease-out | color, background-color |
| Backdrop fade | 200ms | ease-out | opacity |

### 6.3 Scroll Behavior

```css
html {
  scroll-behavior: smooth;
  -webkit-overflow-scrolling: touch;
}

.scroll-container {
  overscroll-behavior: contain;
}
```

### 6.4 Gestures (Inspect Sheet)

- **Drag down to dismiss**: If dragged > 100px down, dismiss sheet
- **Velocity dismiss**: If drag velocity > threshold, dismiss regardless of position
- **Snap back**: If released < 100px, animate back to open position

---

## 7. Implementation Notes

### 7.1 Mobile Safari Requirements

```css
/* Required in globals.css */
html {
  height: 100%;
  height: 100dvh;
}

body {
  min-height: 100%;
  min-height: 100dvh;
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
  -webkit-text-size-adjust: 100%;
}
```

### 7.2 Font Loading

```tsx
// layout.tsx
import { Geist, JetBrains_Mono } from 'next/font/google'

const geist = Geist({
  subsets: ['latin'],
  variable: '--font-display',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
})
```

### 7.3 API Endpoints (Existing Backend)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/ideas` | GET | List all opportunities |
| `/api/ideas/:id` | GET | Single opportunity detail |
| `/api/movers` | GET | Top momentum ideas |
| `/api/system/status` | GET | System health |

### 7.4 State Management

- Use **SWR** for data fetching and caching
- Use **URL state** for current view (Radar/Movers/System)
- Use **React state** for Inspect sheet open/close + selected idea ID

### 7.5 File Structure

```
app/
├── layout.tsx
├── page.tsx              # Redirects to /radar
├── radar/
│   └── page.tsx          # Radar view
├── globals.css
components/
├── navigation/
│   ├── bottom-nav.tsx
│   └── nav-item.tsx
├── layout/
│   └── view-header.tsx
├── radar/
│   ├── signal-card.tsx
│   ├── score-pill.tsx
│   └── momentum-indicator.tsx
├── inspect/
│   ├── inspect-sheet.tsx
│   ├── section-block.tsx
│   ├── score-breakdown.tsx
│   └── signal-item.tsx
├── shared/
│   ├── tag-list.tsx
│   └── grid-overlay.tsx
lib/
├── utils.ts
├── format.ts             # formatRelativeTime, formatScore
└── api.ts                # SWR fetchers
```

---

## 8. Workshop Questions

Before implementation, please confirm the following decisions:

### Q1: Grid Overlay Intensity

The Vectorheart grid overlay is a signature visual element. How prominent should it be?

- **A) Barely visible** — 3-5% opacity, only on cards
- **B) Subtle but present** — 5-8% opacity, on cards and view backgrounds
- **C) Technical/prominent** — 10-15% opacity, creates clear "blueprint" feel
- **D) Skip entirely** — Rely on other Vectorheart elements (typography, borders)

---

### Q2: Card Entry Animation

When scrolling the Radar feed, should cards have an entrance animation?

- **A) None** — Cards are static, scroll is the motion
- **B) Subtle fade-in** — Opacity 0→1 as cards enter viewport
- **C) Stagger reveal** — Cards animate in sequence on initial load only
- **D) Parallax depth** — Slight Y-offset that resolves as card enters center

---

### Q3: Inspect Sheet Behavior

How should the Inspect sheet be triggered and dismissed?

- **A) Full sheet** — Covers entire screen, swipe down or back button to close
- **B) Partial sheet** — Shows 85% height, peek of Radar visible behind
- **C) Page navigation** — Inspect is a separate route, not an overlay
- **D) Side panel** — Slides in from right (less common for mobile)

---

### Q4: Score Visualization Style

The score breakdown can be visualized in different ways:

- **A) Horizontal bars** — Classic progress bar style (as shown in spec)
- **B) Vertical bars** — Small bar chart visualization
- **C) Radial/gauge** — Circular progress indicators
- **D) Numeric only** — Just numbers in a grid, no visual bars

---

### Q5: Color Accent Preference

The spec uses cold indigo (`#6b7cdb`) as the primary accent. Confirm or adjust:

- **A) Cold indigo** — As specified (blue-violet)
- **B) Steel blue** — Cooler, more technical (`#5a7fa8`)
- **C) Muted teal** — Adds warmth while staying technical (`#4a9a8c`)
- **D) Pure neutral** — No color accent, monochrome only

---

### Q6: Typography Tightness

Vectorheart often uses tight, compressed typography. How tight should IRS go?

- **A) Comfortable** — Standard line heights (as specified)
- **B) Tight** — Reduce line heights by ~10%, feels more "editorial"
- **C) Compressed** — Tight line heights + negative letter-spacing on headlines
- **D) Variable** — Tight for headlines, comfortable for body text

---

### Q7: Empty/Loading States

How should loading and empty states be handled?

- **A) Skeleton loaders** — Gray placeholder shapes matching card layout
- **B) Spinner** — Centered minimal spinner
- **C) Text only** — "Loading..." or "No opportunities found" text
- **D) Vectorheart themed** — Grid animation or technical loading visual

---

> **Next Step**: Answer the workshop questions above, and I will refine this plan with your preferences before implementation begins.
