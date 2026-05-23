# IRS V5 - Vectorheart Field UI Plan

> This replaces the old Fieldglass/editorial direction. The app should feel like a handheld punk signal instrument for opportunity hunting: tactile, angular, data-rich, and mobile-first. It must not read as a recolor of the old editorial theme.

## Product Direction

Idea Radar is now a **Vectorheart field unit**. The user scans opportunity vectors, pulls one into a lens, and routes it into build or archive. Keep the punk idea through angular cuts, exposed rails, stamped labels, compressed mono metadata, and visible signal circuitry. The visual reference is closer to high-contrast mecha/vector poster work and Mirror's Edge-style wayfinding: white/black mechanical linework, red-pink signal blocks, cyan route ribbons, and bubblegum-pink Vectorheart accents. Avoid the old editorial rhythm, beige magazine layouts, green hazard UI, and generic SaaS dashboards.

## Visual Language

- **Base:** bright white `#f7f8ff`, black ink `#0c0f18`, cool mechanical gray `#e7ebf4`.
- **Accents:** runner red `#ff1616`, bubblegum pink `#ff0a77`, electric cyan `#65b8ff`, violet `#ab70ff`, chrome-gold sparingly `#ffd26a`.
- **Lines:** diagonal cyan ribbons, red vector blocks, thin black/white mechanical ticks, dense micro-grid overlays.
- **Shapes:** clipped corners, hard mitered lines, exposed left rails, irregular specimen cells.
- **Texture:** faint scan grid, contour rings, and low-opacity noise. No decorative orbs.
- **Typography:** Archivo for blunt labels/titles; Chivo Mono for ranks, scores, metadata, and controls. No serif headers.

## Mobile Shell

1. **Top signal bar:** compact brand mark, settings chip, progress line.
2. **Signal field:** scrollable cluster surface with alternating offsets and specimen cells.
3. **Thumb tray:** floating clipped bottom tray with Field, Movers, Build, and Archive modes.

The tray must be icon-first, thumb reachable, and never become a standard rectangular tab bar.

## Primary Screen: Signal Field

Replace uniform cards with **Opportunity Cells**:

- left score rail with rank and composite score
- main title, pain summary, keywords, freshness, and signal count bead
- right mini-plot with Pain / Novelty / Build slivers
- every fourth item becomes a wider specimen with a short evidence/why-now preview
- selected cell opens the Lens Sheet; no page jump

## Lens Sheet

The detail view is a clipped bottom sheet, 92% viewport height on mobile.

Required sections:

- large uppercase title
- floating angular score gauge
- status/signal/freshness stamps
- score constellation, not standard progress-only analytics
- horizontal evidence lanes for latest signals, pain phrases, and source links
- visible Build and Dismiss actions

## Secondary Views

- **Movers:** timeline-like momentum list with rank current language and slanted deltas.
- **Build queue:** only ideas marked `building`; operational and calmer, but still angular.
- **Archive:** dismissed/archived list first, then pipeline controls and source health.

## Interaction Rules

- Tap a cell to open Lens.
- Long press still opens Lens, but visible buttons are always present.
- Pull to refresh remains available.
- All hover/press/focus states must use transform, opacity, border, and background only.
- Text must remain readable at 360px width.

## Acceptance Checklist

- [x] The mobile first viewport is not a stacked editorial feed.
- [x] Navigation is a floating thumb tray, not a normal tab bar.
- [x] Main cells have score rails and mini-plots.
- [x] Detail view uses a Lens Sheet with score constellation and evidence lanes.
- [x] Vectorheart/punk identity remains through angular forms, rails, tactile labels, and heart-signal color.
- [x] Palette avoids editorial beige, green hazard UI, and default SaaS neutrals.
- [x] Existing Flask API fields map directly into the UI.
