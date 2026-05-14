# PROJECT: Idea Radar System (IRS) — V4 UI Guide

> **Audience.** This document is written for a language model (or designer) tasked with building IRS user-interface components. It is a specification, not an implementation. It contains no folder structures, no stylesheet code, and no framework snippets. Every value is given as data so that the implementer can translate it into whatever stack they prefer.
>
> **Scope.** This guide supersedes `idea-radar-v3-rEQv0.md` for *all visual and interaction design*. V3.5 still governs product purpose, ingestion pipeline, scoring engine, and delivery model — and where V4 ever appears to contradict V3.5 on those, V3.5 wins.

---

## 0. How to use this guide

When asked to build any IRS component, the implementer must:

1. **Locate the screen or component in §6–§12.** Each entry is self-contained and prescriptive.
2. **Apply the global systems from §1–§5** (motion, atmosphere, color, typography, effects) without re-deriving them.
3. **Consult §13 (adaptive tiers)** to decide which visual effects are active on the target device.
4. **Consult §15 (choreography library)** when a motion pattern is named (e.g. "cascade-in", "mask-cut", "kinetic-emphasis"). Named choreographies must behave identically wherever they appear.
5. **Treat §17 (anti-patterns) as hard constraints**, not suggestions.

If a requirement is missing from this guide, the implementer should reach for the closest analogous component and ask before inventing a new pattern.

---

## 1. Inherited foundations (do not relitigate)

The following are carried forward from V3.5 verbatim:

- **Product identity** — personal opportunity discovery + ranking engine; mobile-native; not a chatbot, dashboard, or enterprise tool.
- **Primary platform** — iPhone Safari and mobile browsers, portrait. Desktop is adaptive, never the design target.
- **Anti-patterns** — no emojis in chrome, no neon, no decorative blurs, no dashboard card soup, no admin layouts, no excessive badges, no tiny dashboard fonts.
- **Mobile-first viewport rules** — safe-area insets respected on all fixed UI; `100dvh` for full-screen surfaces; momentum scrolling preserved.

V4 adds: full color and typography systems, a complete animation vocabulary, a glitch/scanline/CA effects layer with adaptive tiers, full specs for every screen, a state catalog, and a named choreography library.

---

## 2. Motion philosophy — Persona 3 Reload, reconciled

### 2.1 What we are actually borrowing (research-backed)

The P3R UI is widely studied for its kinetic confidence. Independent recreations and design breakdowns (see for example deltea.space/blog/p3r-pause-menu, adrian-kowalik.com, ultipuk.xyz, and the Bootcamp analysis of P3R's battle UI) converge on a small set of recurring devices. V4 adopts the choreography techniques and rejects the surface chrome.

| P3R device                                                                                                              | V4 disposition       | Rationale                                                                                            |
| ----------------------------------------------------------------------------------------------------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------- |
| **Layered, slightly-rotated italic text** with crooked random offsets (the pause menu's signature look)                  | **Borrow, muted**    | Used as kinetic-emphasis on hero titles only; rotation amplitude reduced 4×.                          |
| **Mask transitions** — one shape wipes another in/out                                                                    | **Borrow**           | Used for chapter cuts and Inspect open as a transition-as-content moment.                              |
| **Animated, looping backdrop video / texture behind UI**                                                                 | **Borrow, abstract** | Replaced by a slow indigo drift gradient + grain (see §4). Same role, restrained surface.              |
| **Three-color text stacks** (e.g. P3R uses `#16cffb`, `#7de6fd`, `#77fefc` for its menu items)                            | **Borrow, recolored**| V4 uses one indigo + the three semantic colors instead; the *technique* of layering three tints carries. |
| **Pulsing highlight behind the active item** (selector backgrounds that throb)                                            | **Borrow, dim**      | Only on the bottom-nav active indicator and on the Inspect "Save" CTA. 6–10% opacity amplitude.        |
| **SVG-masked overlapping text** producing "broken letter" silhouettes                                                    | **Borrow, sparing**  | Used exactly once on the splash/onboarding wordmark and on the empty-Radar state.                      |
| **Heavy decorative chrome** (tarot, kanji, character art)                                                                 | Reject               | Off-brand for IRS.                                                                                   |
| **Sound design dependency** — many P3R animations land with a sting                                                       | Reject               | The web app is silent. Visual rhythm carries the same role.                                            |
| **Anime speed lines / impact frames**                                                                                     | Reject               | Too loud for an intelligence product.                                                                  |

### 2.2 The three motion laws

Every animation in V4 obeys all three:

1. **Rhythm.** Multi-element reveals stagger on a beat. Base interval 60ms, dense interval 40ms. Never a simultaneous mass appearance — except for the one named exception, "the chord", which is reserved for score-composition bars.
2. **Direction.** Elements enter along a meaningful axis. Cards rise from below and slightly left. Metadata slides in from the right. Scores count up in place. Chapter labels enter from lower-left and exit upper-right. **Fade-only entries are forbidden** outside of numeral sub-scores and the reduced-motion fallback.
3. **Weight.** Springs are critically damped on small UI and only slightly underdamped on hero moments. Motion must settle in one perceptible bounce, never two. A second bounce is a bug.

### 2.3 The fourth, optional law — *Cut as content*

A small set of transitions are themselves the story (the chapter cut on the Radar feed, the Inspect open, the splash wipe). These get a named choreography in §15 and may briefly violate Law 1 or 2 in service of a deliberate moment. Outside those named moments, the three laws are absolute.

---

## 3. Motion tokens

Five durations, three easings, three springs, three stagger intervals. The implementer may not introduce new motion values without first demoting an existing one.

### 3.1 Durations

| Token              | Value | Use                                                          |
| ------------------ | ----- | ------------------------------------------------------------ |
| `motion/instant`   | 120ms | Press feedback, color shifts, hover weight                   |
| `motion/quick`     | 180ms | Hover/focus weight changes, chip selection                   |
| `motion/base`      | 320ms | Chapter cuts, section reveals, hairline draws                |
| `motion/hero`      | 480ms | Score reveal, shared-layout Inspect open, splash logo settle |
| `motion/dismiss`   | 520ms | Inspect close, full reverse choreography                     |

### 3.2 Easings (described as Bézier curve intent, not as code)

| Token            | Bézier control points         | Use                                                       |
| ---------------- | ----------------------------- | --------------------------------------------------------- |
| `ease/editorial` | `0.2, 0.7, 0.1, 1`            | Default for any non-spring motion                         |
| `ease/out-soft`  | `0.16, 1, 0.3, 1`             | Press release; settled, expensive release                 |
| `ease/in-soft`   | `0.7, 0, 0.84, 0`             | Exits and dismissals; commits to leaving                  |

### 3.3 Springs

| Token         | Stiffness | Damping | Use                                                  |
| ------------- | --------- | ------- | ---------------------------------------------------- |
| `spring/ui`   | 380       | 32      | Default for all small-UI motion; critically damped   |
| `spring/hero` | 220       | 22      | Inspect morph, score reveal; one perceptible settle  |
| `spring/pull` | 160       | 18      | Pull-to-refresh, long-press peek; elastic but quick  |

### 3.4 Stagger intervals

| Token            | Value | Use                                              |
| ---------------- | ----- | ------------------------------------------------ |
| `stagger/base`   | 60ms  | Card list reveals, Inspect section cascade       |
| `stagger/dense`  | 40ms  | Long lists, chip rows, signal-timeline strips    |
| `stagger/exit`   | 40ms  | Dismiss cascades; always top-down                |

---

## 4. Atmospheric system

The backdrop is a three-layer composition that produces depth without ornament.

### 4.1 Base (Layer 1)

Solid `#0b0d10`. Fixed. Never gradient on the base layer itself.

### 4.2 Ambient drift (Layer 2)

A single soft indigo radial wash centered roughly at the upper-left third of the viewport. Indigo `#7c8cdb` at approximately 6% opacity at the center, fading to 0% by 70% of its radius. The radial center drifts slowly between two anchor points (upper-left and upper-right thirds) over a 24-second cycle, easing in and out. Subliminal — the user should not consciously notice it, but the room must feel alive.

### 4.3 Grain (Layer 3)

Static SVG fractal-noise grain at 4% opacity, applied as a fixed overlay with overlay blend mode. Mandatory on OLED to prevent near-black banding. Static (not animated) — animated grain reads as TV-static and breaks the editorial register.

### 4.4 Card surfaces

| Property        | Value                                              |
| --------------- | -------------------------------------------------- |
| Background      | `rgba(23, 26, 33, 0.72)` over the drift layer      |
| Backdrop blur   | 14px                                               |
| Border          | 1px solid `rgba(255, 255, 255, 0.04)`              |
| Radius          | 16px                                               |
| Drop shadow     | None (mobile); inner 1px highlight only on desktop |

The cards are panes of treated glass, not floating chiclets. No outer drop shadow on any surface.

### 4.5 Depth planes

Only four z-levels exist in V4. Anything that demands a fifth is rejected and folded into an existing plane.

| Plane    | Order | Used by                                                                              |
| -------- | ----- | ------------------------------------------------------------------------------------ |
| Backdrop | 0     | Base + drift + grain                                                                 |
| Content  | 1     | All feeds, all cards, all screen content                                             |
| Nav      | 2     | Bottom navigation (glass), Top bar (glass)                                           |
| Inspect  | 3     | Inspect panel + its tinted blur scrim `rgba(11,13,16,0.55)` with 18px backdrop blur  |

### 4.6 Time-rhythm progress line

A 1px line directly under the top bar that fills horizontally as the user scrolls through the current chapter or section. Color indigo `rgba(148, 163, 255, 0.55)`. This carries information (read-through position) — it is never purely decorative. The line is V4's translation of P3R's "time-pressure" motif.

---

## 5. Visual effects layer — glitches, scanlines, chromatic aberration (adaptive)

These effects are deliberately rationed. They exist in V4 because they signal "this is an intelligence system reading signal" — but unmanaged they become cyberpunk noise. The implementer must respect both **when** they trigger (§5.1) and **how strongly** they render per device tier (§13).

### 5.1 Allowed effect occasions

A glitch, scanline pass, or chromatic-aberration shift may appear **only** in the following moments. Anywhere else, they are an anti-pattern.

| Effect                    | Allowed occasions                                                                                                       |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Micro-glitch**          | Splash wordmark assembly; new-signal arrival on Radar (≤180ms); error state header; System pipeline-failure indicator. |
| **Scanline pass**         | Inspect open (one downward sweep, ≤240ms); System screen background (continuous, dim); refresh complete (one sweep).   |
| **Chromatic aberration** | Kinetic-emphasis on hero titles (≤120ms split); Inspect score-numeral reveal (≤80ms split that resolves to crisp).      |

### 5.2 Micro-glitch — specification

A *micro-glitch* is a short horizontal-slice displacement of a single element. Not the entire screen. Never on body text.

| Parameter         | Value                                                          |
| ----------------- | -------------------------------------------------------------- |
| Slice count       | 2–3 horizontal bands                                           |
| Displacement      | Each band shifts horizontally by 1–3px in alternating directions |
| Duration          | 120–180ms total                                                |
| Frame count       | 3 keyframes maximum                                            |
| Color treatment   | Each band carries a 0.5px cyan/red separation (see §5.4)        |
| Decay             | Final keyframe must resolve to crisp, untreated element        |

The effect always **resolves to clean**. A glitch that lingers is a bug.

### 5.3 Scanline pass — specification

A scanline pass is a single moving horizontal band of slightly darker pixels that travels down (or up) across a region.

| Parameter         | Value                                                          |
| ----------------- | -------------------------------------------------------------- |
| Band height       | 2px on mobile, 3px on desktop                                  |
| Band tint         | `rgba(255, 255, 255, 0.025)` over content                       |
| Travel direction  | Top-to-bottom by default; bottom-to-top on dismiss             |
| Travel duration   | 240ms (one-shot) or 4.0s loop (System screen ambient)          |
| Easing            | `ease/editorial`                                               |
| Opacity envelope  | 0 → peak at 50% travel → 0                                     |

A continuous scanline (System screen only) runs at 25% of the one-shot opacity to remain ambient.

### 5.4 Chromatic aberration — specification

CA in V4 is a *split*, not a permanent halo. It appears, signals the moment, and resolves.

| Parameter           | Value                                                                  |
| ------------------- | ---------------------------------------------------------------------- |
| Color pair          | Cyan-leaning `rgba(120, 200, 255, x)` + warm-red `rgba(255, 120, 110, x)` |
| Maximum split       | 1.5px on mobile, 2px on desktop, 0 on low tier                          |
| Duration of split   | 80–120ms                                                                |
| Resolution behavior | Always returns to 0 split with `ease/out-soft`                          |
| Allowed targets     | Hero titles, score numerals; never body copy, never icons              |

### 5.5 Hard constraints on effects

- **Never** on body text below 16px.
- **Never** on form inputs while focused (it reads as broken).
- **Never** as ambient decoration outside the System screen.
- **Never** combine all three on the same element in the same moment.
- **Always** resolve to a clean, untreated final state.

---

## 6. Color system

### 6.1 Palette

| Token              | Value                | Role                                                |
| ------------------ | -------------------- | --------------------------------------------------- |
| `bg/base`          | `#0b0d10`            | Root canvas                                         |
| `bg/secondary`    | `#111318`            | Sectional fills, raised pockets                     |
| `surface/1`        | `rgba(23,26,33,.72)` | Default card / nav / chip                           |
| `surface/2`        | `rgba(29,33,41,.78)` | Modals, sheets, raised surfaces                     |
| `accent/indigo`    | `#7c8cdb`            | Primary brand accent                                |
| `accent/violet`    | `#94a3ff`            | Primary CTA fill, active indicator                  |
| `sem/pain`         | `#c97b63`            | Pain signal; error                                  |
| `sem/build`        | `#c7a76b`            | Build complexity                                    |
| `sem/momentum`     | `#6ea58b`            | Momentum signal; success                            |
| `text/primary`     | `#f3f5f7`            | Titles, hero numerals                               |
| `text/secondary`   | `#b6bcc8`            | Body, summaries                                     |
| `text/muted`       | `#7d8593`            | Metadata, eyebrows                                  |
| `hairline`         | `rgba(255,255,255,.06)` | Section dividers                                  |
| `hairline/soft`    | `rgba(255,255,255,.04)` | Card borders, ultra-fine separators              |

### 6.2 Semantic dominance rule

Every Signal Card and Inspect view derives a single **dominant semantic color** from the highest-weighted score dimension (pain, build, or momentum). The composite numeral, the score band, and any kinetic-emphasis CA use this dominant color. Two semantic colors never compete for primacy on the same surface.

### 6.3 Forbidden colors

Pure white (`#ffffff`) and pure black (`#000000`) appear nowhere in chrome. Saturated blue and electric cyan are forbidden — they would pull the design toward generic cyber-AI. Purple/violet hues outside the documented indigo range are forbidden.

---

## 7. Typography system

Two families only. No third.

### 7.1 Families

- **Inter** (or Geist as a permitted substitute) — all UI text, titles, body, labels.
- **JetBrains Mono** — all numerals, eyebrows, technical metadata, keyboard hints.

### 7.2 Scale

| Token         | Size | Family            | Weight | Leading | Use                                          |
| ------------- | ---- | ----------------- | ------ | ------- | -------------------------------------------- |
| `display`     | 44px | Inter             | 600    | 1.05    | Chapter divider, splash wordmark             |
| `title/xl`    | 32px | Inter             | 600    | 1.10    | Sticky chapter label, Inspect title          |
| `title/lg`    | 28px | Inter             | 600    | 1.15    | Inspect morphed header                       |
| `title/md`    | 22px | Inter             | 600    | 1.15    | Signal Card title                            |
| `body/lg`     | 17px | Inter             | 400    | 1.50    | Inspect "Why now", primary prose             |
| `body/md`     | 16px | Inter             | 400    | 1.50    | Source excerpts, modal body                  |
| `body/sm`     | 15px | Inter             | 400    | 1.40    | Card summary, MVP list, footer prose         |
| `label`       | 13px | Inter             | 500    | 1.30    | Mini-card title, ghost action                |
| `caption`     | 12px | Inter             | 400    | 1.30    | Footer metadata, helper text                 |
| `num/xl`      | 44px | JetBrains Mono    | 600    | 1.00    | Inspect composite numeral                    |
| `num/lg`      | 28px | JetBrains Mono    | 600    | 1.00    | Card composite numeral                       |
| `num/md`      | 14px | JetBrains Mono    | 600    | 1.10    | Score-composition values                     |
| `num/sm`      | 11px | JetBrains Mono    | 500    | 1.10    | Sub-scores, profile-chip initials            |
| `eyebrow`     | 12px | JetBrains Mono    | 500    | 1.10    | Eyebrow rows (uppercase, 0.06em tracking)    |

### 7.3 Kinetic typography (the P3R borrow)

Kinetic typography is reserved for **two** moments and is otherwise forbidden:

1. **Card focus / hover (desktop, keyboard).** Title weight steps from 600 to 700 over `motion/quick`. No size change.
2. **Inspect open.** As the card morphs into the Inspect header, the title scales from `title/md` to `title/lg` and weight stays 600; the surrounding metadata fades-and-shifts.

The "crooked layered italic" P3R technique is reserved for **exactly one** location: the splash/onboarding wordmark (§6 wordmark spec). Outside of it, rotation, italic, and layered offsets on UI text are forbidden.

### 7.4 Text-wrap rules

- All `title/*` use balanced wrapping (visually shortest last-line).
- All `body/*` use pretty wrapping (no orphaned words on the last line).
- Single-line summaries (e.g. card summary) ellipsis at one line — never wrap to two.

---

## 8. Iconography

### 8.1 Line system

- 1.5px line weight at 22px nominal size.
- Round caps and joins.
- Monochrome — color inherits from `text/secondary` or, when active, from `accent/violet`.
- No fill icons in chrome.

### 8.2 Icon scale

| Context              | Size |
| -------------------- | ---- |
| Inline body          | 16px |
| Bottom-nav, top-bar  | 22px |
| Section header       | 20px |

### 8.3 Iconography anti-patterns

No emojis, no skeuomorphic icons, no two-tone, no gradient fills, no animated icons except the bottom-nav active-state dot pulse (§9.1).

---

## 9. Global components

These appear across multiple screens. Their specs are normative — any screen that reuses them inherits the spec exactly.

### 9.1 Bottom navigation

| Property             | Value                                                        |
| -------------------- | ------------------------------------------------------------ |
| Items                | 4 (Radar, Movers, Explore, System)                           |
| Height               | 56px + bottom safe-area inset                                |
| Surface              | `surface/1` glass with 14px backdrop blur                    |
| Item icon            | 22px line icon, `text/muted`                                 |
| Active marker        | A single 6px diameter indigo dot `#94a3ff`, 4px below icon   |
| Active dot animation | Subtle opacity pulse 0.85 ↔ 1.0 on a 2.4s ease-in-out loop   |
| Press feedback       | Icon scale 1 → 0.92 on press, returns on `ease/out-soft`     |
| Label                | Hidden by default; tap raises label as 11px caption for 1.2s |

Settings is **not** in the bottom nav. It lives on the profile chip (§9.2).

### 9.2 Top bar (Radar and most screens)

| Region        | Content                                                                  |
| ------------- | ------------------------------------------------------------------------ |
| Left          | App mark, 24px, monochrome `text/secondary`                              |
| Right         | Profile chip — 32px circle, `surface/1`, initials in `num/sm`            |
| Beneath       | 1px time-rhythm progress line (§4.6)                                     |
| Height        | 44px + top safe-area inset                                                |

Tapping the profile chip opens the Settings sheet (§12.5), not a Settings screen.

### 9.3 Buttons

| Variant          | Spec                                                                                                            |
| ---------------- | --------------------------------------------------------------------------------------------------------------- |
| Primary pill     | 44px tall, full container width minus 20px gutter, `accent/violet` fill, `bg/base` text, `Inter 600 15px`.       |
| Ghost            | Text-only, centered, `13px / Inter 500 / text/muted`. Underline appears only on hover (desktop).                  |
| Icon-only        | 40px tap target, transparent surface, 22px icon, `text/muted` → `text/primary` on hover.                          |
| Destructive      | Same as Primary but fill `sem/pain`, text `bg/base`. Requires confirmation step before action.                    |

Pulse highlight (P3R borrow, dim): the Primary pill has a 6% opacity violet pulse behind it on a 2.4s loop. Pulse pauses while pressed and resumes on release.

### 9.4 Inputs

| Property             | Value                                                                |
| -------------------- | -------------------------------------------------------------------- |
| Background           | `surface/1`                                                          |
| Border               | 1px `hairline/soft`; on focus → 1px `accent/indigo` at 60% opacity   |
| Padding              | 12px vertical, 14px horizontal                                       |
| Text                 | `body/md` `text/primary`                                              |
| Placeholder          | `body/md` `text/muted`                                                |
| Caret color          | `accent/violet`                                                       |
| Error state          | Border `sem/pain` at 60% opacity; helper text `caption sem/pain`     |

Inputs never glitch, scanline, or split-color even on focus or error.

### 9.5 Chips

| Property        | Value                                                              |
| --------------- | ------------------------------------------------------------------ |
| Height          | 28px                                                               |
| Padding         | 10px horizontal                                                    |
| Radius          | Pill (full)                                                        |
| Surface         | `surface/1` (default) → `accent/indigo` 14% fill (selected)        |
| Text            | `caption` `text/muted` → `text/primary` (selected)                 |
| Selection motion | Color transitions over `motion/quick` with `ease/editorial`        |

### 9.6 Sheets (bottom)

| Property         | Value                                                                       |
| ---------------- | --------------------------------------------------------------------------- |
| Default height   | 60% viewport                                                                 |
| Expandable       | Drag handle at top, snap points at 60% and 92% viewport                      |
| Surface          | `surface/2` over scrim `rgba(11,13,16,0.55)` + 18px backdrop blur            |
| Open motion      | `spring/hero`, enters from bottom                                            |
| Dismiss          | Swipe down with resistance after 30% drag, or scrim tap                      |

### 9.7 Modals

Reserved for confirmation only. Centered. 320px max width on mobile, 480px on desktop. Same surface as sheets. Open uses `spring/ui`; dismiss uses `motion/dismiss` with `ease/in-soft`. Two actions max: Confirm (Primary or Destructive) and Cancel (Ghost).

### 9.8 Toasts

Bottom-anchored, 16px above bottom nav. Single line max, `body/sm`. Surface `surface/2`. Enters from below on `spring/ui`. Auto-dismisses after 3.2s with `motion/dismiss` exit. Toast text never glitches. Tone is determined by a leading 2px vertical bar at left: `sem/momentum` for confirm, `sem/pain` for error, `accent/indigo` for neutral.

### 9.9 Tooltips (desktop only)

`caption` `text/primary` on `surface/2`. 6px radius. Appears 200ms after hover-still; dismisses on hover-out instantly. No tooltip on mobile.

### 9.10 Tabs / segmented controls

Used on Movers (time range) and Explore (filter group). Underline-only indicator at the bottom of the active tab, 2px `accent/violet`. Underline animates its position with `spring/ui` between tabs. No background fills on tabs.

### 9.11 Pull-to-refresh

Pull pulls the chapter label downward elastically with resistance after 60px. Past the threshold, the label gains a 1px `accent/indigo` outline ring and a haptic-feel snap on release (visual only). On release: `spring/pull` settles, a single scanline pass (§5.3) runs top-to-bottom over the feed, and new content cascades in on `stagger/base`.

### 9.12 Loading skeletons

Skeletons in IRS are **muted text-only placeholders**, never blocky shimmer rectangles. A title-position skeleton is a single 22px line of `rgba(243,245,247,0.08)` that breathes between 0.08 and 0.14 opacity over 1.6s ease-in-out alternate. No shimmer sweep, no diagonal gradient.

---

## 10. Splash and onboarding

### 10.1 Splash

Brief, three-beat appearance on cold start.

1. **Backdrop fade-in** (200ms `ease/editorial`) — base + drift, no grain yet.
2. **Wordmark assembly** — the IRS wordmark uses the *one* P3R kinetic-typography moment: three slightly rotated italic copies of the wordmark in `accent/indigo`, `accent/violet`, and `text/primary`, each at rotations between -1.5° and +1.5°, each offset 1–2px from the next. Over 320ms they converge into a single un-rotated `text/primary` wordmark. A micro-glitch (§5.2) runs on the last 120ms of convergence. CA splits to 1.5px at start and resolves to 0 on settle.
3. **Tagline cascade** — *"A system that pays attention."* The tagline appears beneath the settled wordmark using `stagger/dense` per word, each word entering from `translateY(8px) opacity 0` on `spring/ui`.
4. **Hand-off** — at 1100ms total, the wordmark scales down by 6% and translates to its Top-bar resting position; the tagline fades out at `motion/quick`; the Radar feed reveals beneath using its standard first-paint sequence.

Grain Layer 3 enables exactly at the hand-off frame.

### 10.2 Onboarding (first run only)

Three sequential cards, each full-viewport, swipe-advanced. No bottom nav visible during onboarding. A 4-step progress line replaces the time-rhythm line at the top.

| Card  | Headline                          | Body                                                              | Visual moment                                                   |
| ----- | --------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------- |
| 1     | *"This is what surfaced today."*  | One sentence on personal intelligence vs. dashboards.             | A single sample Signal Card animates in using its standard reveal. |
| 2     | *"Score the things worth chasing."* | One sentence on scoring composition.                              | A score-composition chord (§7 Inspect section 4) plays at 50% scale. |
| 3     | *"Pulled from the signals you care about."* | One sentence on sources.                                          | A signal-timeline strip enters on `stagger/dense`.               |

A single Primary pill on card 3 reads *"Open Radar"*. Tapping it triggers a mask-cut choreography (§15) into the Radar first-paint.

### 10.3 Auth surface (if present)

A single bottom sheet (§9.6) at 92% height, containing one email input and one Primary pill *"Send link"*. No social-login chrome. No third-party logos in the body. Magic-link copy in `caption text/muted` under the pill.

---

## 11. Radar screen — full spec

### 11.1 Top region

As §9.2. Time-rhythm line beneath.

### 11.2 Chapter system

Three chapters per session, in order:

1. **Today** — items with first-signal age ≤ 24h.
2. **This Week** — items aged ≤ 7d, excluding Today.
3. **Long Tail** — older but still active.

Chapter label is `title/xl` `text/primary`. Sticky until the next chapter overtakes it, then fades to 40% opacity.

### 11.3 Chapter divider

A 96px tall block between chapters:

- Chapter title at `display` `text/primary`.
- Chapter byline `body/sm` `text/muted` — a single editorial sentence (e.g. *"What surfaced in the last 24 hours."*).
- A 1px `hairline` rule that draws left-to-right over 600ms on `ease/editorial` when scrolled into view. This is the *cut-as-content* moment within a single screen.

### 11.4 Chapter-cut motion (scroll-driven)

As the user scrolls from one chapter to the next:

- Outgoing chapter label translates by `(+24px, -24px)` and fades to 0 over `motion/base` on `ease/editorial`.
- Incoming label translates from `(-24px, +24px)` opacity 0 → 1 over the same window.
- Driven by scroll position, not by tap.

### 11.5 Signal Card anatomy

Vertical, full-bleed minus 20px gutter on mobile, 16px gap between cards, internal padding `20px 20px 16px 20px`.

**Six text styles, in order of visual priority:**

1. **Eyebrow row.** `eyebrow` `text/muted`. Pattern: `CHAPTER · AGE · N SOURCES`. No icons.
2. **Title.** `title/md` `text/primary`, max 3 lines, balanced wrap. States the pain or opportunity as a clause, not a noun phrase.
3. **One-line summary.** `body/sm` `text/secondary`, exactly one line, ellipsis.
4. **Score strip.** Right-aligned in a horizontal row. Composite numeral `num/lg`, color = dominant semantic. Two sub-scores `num/sm` `text/muted`, separated from composite by a 1px vertical rule `hairline`.
5. **Momentum sparkline.** Full card width, 28px tall, single 1.5px stroke in the dominant semantic color, no fill, no axes, no grid, no points. Last 14 days.
6. **Metadata footer.** Collapsed by default to a single `caption text/muted` line: `N signals · last seen Xh ago`. Tappable to expand in-place into a 3-line breakdown. Expansion is not Inspect.

**Density rule.** Never more than six text styles visible on a card. If a seventh is proposed, demote one or cut it.

### 11.6 Card focus / press states

| State                   | Spec                                                                                            |
| ----------------------- | ----------------------------------------------------------------------------------------------- |
| Focus / hover (desktop) | Title weight 600 → 700; composite numeral scale 1 → 1.04 on `spring/ui`; border → `rgba(148,163,255,0.16)`. |
| Press                   | Whole card scale 1 → 0.985 on `motion/instant`; releases on `ease/out-soft`.                      |
| New-signal arrival      | Card enters with one micro-glitch (§5.2) on the eyebrow row only, then resolves clean.            |

### 11.7 Card list reveal

Cards enter from `translateY(16px) translateX(-6px) opacity 0` to rest, on `spring/ui`, staggered `stagger/base` per visible card on first paint. Cards entering on scroll animate independently when first crossing 10% visibility — they do not stagger as a group on subsequent reveals.

### 11.8 Score reveal

On a card's first viewport entry, the composite numeral counts from 0 to final over `motion/hero` on `ease/editorial`. Sub-scores fade in at +120ms and +200ms. CA splits to ~1px on the numeral's first frame and resolves to 0 by settle. A card never re-animates on subsequent scroll passes.

### 11.9 End of feed

A 240px tall calm block:

- Single line `body/lg` at 60% `text/primary` opacity: *"You're caught up. Next ingestion in Xh."*
- No CTA, no illustration, no retry.
- Time-rhythm line is fully filled.

---

## 12. Inspect screen — full spec

Mobile: full-screen. Desktop: right-aligned 720px panel with Radar visible to its left.

### 12.1 Opening choreography (the headline moment)

This is the single most expensive transition in the app and uses choreography `inspect-open` (§15).

1. The tapped Signal Card morphs in place into the Inspect header via shared-layout transition. `motion/hero`, `spring/hero`.
2. Scrim `rgba(11,13,16,0.55)` + 18px backdrop blur fades in over `motion/base`.
3. A single downward scanline pass (§5.3) runs over the panel during the morph.
4. Sections below the header cascade top-down on `stagger/base`, each from `translateY(12px) opacity 0` on `spring/ui`. First section starts at +120ms after morph begins.

Total open-to-last-settle: ~720ms.

### 12.2 Section order

Each section separated by 1px `hairline`, 32px vertical padding.

**1. Header (the morphed card).** Title at `title/lg`. Composite score at `num/xl`, dominant semantic color. A 2px semantic-color band beneath the title spans its exact text width and draws left-to-right over `motion/base` after morph settle.

**2. Why now.** 2–3 sentences explaining timeliness. `body/lg` `text/primary`, max-width 60ch. Drop-cap on the first letter: 28px Inter 600 in dominant semantic. The drop-cap is the only one in the app.

**3. Signal timeline.** Full panel width, sparkline expanded to 88px tall. Beneath, a horizontal scroll-snap row of dated signal chips at 28px height, `eyebrow` text, glass surface. Chips stagger in on `stagger/dense`.

**4. Score composition.** Three horizontal bars — pain, momentum, build.

| Property         | Value                                                  |
| ---------------- | ------------------------------------------------------ |
| Bar height       | 6px                                                    |
| Track color      | `hairline/soft`                                        |
| Fill colors      | `sem/pain`, `sem/momentum`, `sem/build`                |
| Numerals         | `num/md`, color matches bar                            |
| Animation        | Width 0 → value, all three simultaneously over 520ms on `spring/hero`. **This is the chord — the one named exception to the rhythm law.** |

**5. Source excerpts.** Up to 5 quotes. Quote: `body/md` italic `text/secondary`, max-width 60ch. Attribution: `eyebrow` uppercase `text/muted`. Divided by 1px `hairline/soft`, 20px vertical padding between.

**6. MVP scope.** Bulleted list, max 6 items. Custom bullet: 2px × 2px `accent/violet` square at cap-height. Item: `body/sm` `text/primary`. 12px gap.

**7. Related ideas.** Horizontal scroll of mini-cards. Each: 140px × 96px, glass, title only at `label` `text/primary` max 3 lines. **Tapping replaces the current Inspect** — the header morphs to the new card's identity. No back-stack, no breadcrumb.

**8. Footer actions.** Exactly two: Primary pill *"Save"*; Ghost text *"Dismiss"* centered below. No share, no export, no copy-link.

### 12.3 Dismiss choreography

Reverse of open, with one asymmetry:

1. Sections cascade out top-down on `stagger/exit`, each fading and translating `+8px` over `motion/instant`.
2. Header morphs back to its Radar card position over `motion/hero` on `spring/hero`.
3. Scrim fades in parallel with the morph.

Total ≤ 520ms — leaving feels lighter than arriving by design.

### 12.4 Inspect — kinetic emphasis moments

- Title morph: scale `title/md` → `title/lg`; CA split to 2px on first frame, resolves to 0 by 120ms.
- Composite numeral: count-up reveal; CA split to 1.5px on first frame, resolves to 0 by settle.
- Score-composition chord: no CA; the simultaneity is the moment.

### 12.5 Settings sheet (opened from profile chip)

A bottom sheet (§9.6) at 60% height, expandable to 92%. Sections, top to bottom:

| Section          | Contents                                                                       |
| ---------------- | ------------------------------------------------------------------------------ |
| Account          | Email (read-only), Sign out (Ghost button).                                    |
| Sources          | List of ingestion sources with toggle each, source health dot.                 |
| Notifications    | Frequency selector (chips), quiet hours.                                       |
| Appearance       | Reduced motion override toggle; visual-effects intensity (3 chips: Subtle / Default / Off). |
| About            | Version, ingestion schedule, link to privacy.                                  |

Each section is a labelled group with `eyebrow` header at `text/muted`. No tabs. Vertical scroll within the sheet.

---

## 13. Movers screen — full spec

Movers surfaces rising-momentum opportunities. Reuses the Signal Card with a different surface treatment.

### 13.1 Top region

Same Top bar (§9.2). Beneath the time-rhythm line, a segmented control (§9.10) with three tabs: **24h · 7d · 30d**. The active range determines the dataset.

### 13.2 List

A single vertical list of Mover Cards, 16px gap, 20px gutter. **Mover Cards differ from Signal Cards** in three ways only:

1. The eyebrow row carries an additional delta indicator at the right: `+Δ%` in `eyebrow` text, color `sem/momentum` for positive, `sem/pain` for negative.
2. The sparkline is full-width 36px tall (8px taller than on Radar) and the most recent 7-day slice is rendered at full color while older points fade to `text/muted` opacity.
3. The composite numeral on a Mover Card is replaced by the delta percentage, in `num/lg`, color following the delta sign.

### 13.3 Empty state

Single line: *"No movers in this window."* Same treatment as end-of-feed Radar (§11.9).

### 13.4 Tab-change motion

Segmented-control underline moves to the new tab on `spring/ui`. The card list fades out at `motion/quick` then the new list cascades in on `stagger/base`. Sparklines redraw — each line draws left-to-right over `motion/base` on `ease/editorial`.

### 13.5 Card press

Same Inspect open as Radar (§12.1) — Mover Cards share the same `inspect-open` choreography.

---

## 14. Explore screen — full spec

Explore is the browse-and-filter surface. It is intentionally less editorial than Radar — closer to a card grid, but still on V4's atmospheric system.

### 14.1 Top region

Same Top bar. Beneath the time-rhythm line: a sticky **filter row**.

- Filter chips (§9.5) in a horizontally scrollable row: `Pain · Build · Momentum · Saved · Dismissed · New`.
- A search affordance on the right of the filter row: a 32px icon-button (search glyph). Tapping opens the Search sheet (§14.5).

### 14.2 Sort control

Below the filter row, a single right-aligned dropdown button labelled with the current sort, e.g. *"Sort: Score ↓"*. Options: Score, Momentum delta, Recency, Build complexity. Opens a bottom sheet (§9.6) for selection. Sort change re-animates the list using a fade-then-cascade like §13.4.

### 14.3 Grid

- Mobile: single column, identical to Radar's card list spec, but **without** chapter dividers.
- Desktop: two-column responsive grid, 16px gap.

Cards are standard Signal Cards (§11.5). Grid scroll is continuous; no chapters.

### 14.4 Infinite scroll

When the user reaches the last 5 cards, the next batch is loaded. New batch cards enter independently as they cross the 10% visibility threshold. A 24px tall "loading more" pulse line (the time-rhythm line color, breathing 0.3 ↔ 0.7 opacity over 1.4s) appears between the last loaded card and the new batch until resolved.

### 14.5 Search sheet

A bottom sheet (§9.6) at 92% height. Contents:

| Region   | Contents                                                                                |
| -------- | --------------------------------------------------------------------------------------- |
| Top      | Single input (§9.4) with placeholder *"Search opportunities…"*. Auto-focus on open.       |
| Beneath  | Three chips of recent searches as `chip` (§9.5).                                          |
| Body     | Live results list — Signal Cards (compact: title + summary + composite numeral only).    |
| Footer   | None.                                                                                   |

Empty search input shows the recent searches and a single `caption text/muted` line: *"Start typing to search across all signals."*

### 14.6 Filter chip behavior

Tapping a chip toggles it. Multiple chips can be active. List re-animates as in §13.4. Chip toggle motion uses `motion/quick` `ease/editorial`.

---

## 15. System screen — full spec

System is the pipeline-health surface. It is the **only** screen where ambient visual effects (scanlines) run continuously.

### 15.1 Top region

Same Top bar. Time-rhythm line replaced by a 2px wide line that pulses at the rhythm of live ingestion activity — opacity 0.3 ↔ 0.8 over a 2.0s ease-in-out loop while pipelines are healthy; longer 4.0s loop while idle; held flat at 0.3 during a failure.

### 15.2 Ambient scanline

A continuous downward scanline (§5.3) runs across the entire System content region at 25% of the standard one-shot opacity, on a 4.0s loop. This is the only ambient occurrence of any effect in the app.

### 15.3 Sections

**1. Pipeline status.** A row of pipeline cards (one per ingestion source), each 96px tall, glass surface. Each card shows:

- Source name in `label` `text/primary`.
- Status dot (`sem/momentum` healthy, `sem/build` slow, `sem/pain` failed).
- Last-run timestamp in `eyebrow` `text/muted`.
- Mini 12-point sparkline of run durations.

**2. Signal volume.** A 120px tall area chart of signals ingested over the past 7 days, single 1.5px stroke `accent/indigo`, no axes, hourly tick labels in `eyebrow text/muted` along the bottom.

**3. Failures.** A vertical list of recent failures, each a single row: timestamp in `num/sm`, source in `label`, reason in `body/sm` `text/secondary`. Failed rows carry a left 2px `sem/pain` bar.

**4. About the pipeline.** Two-paragraph `body/md text/secondary` description of the ingestion model. No CTA.

### 15.4 Failure-state choreography

When a new failure arrives:

1. The failure row enters from the top of the list with a single micro-glitch (§5.2) on the timestamp.
2. The pipeline status dot for the affected source transitions `sem/momentum` → `sem/pain` over `motion/base`, with a 1.5px CA split that resolves to 0.
3. The top-bar rhythm line holds flat at 0.3 (see §15.1).
4. A neutral-tone toast (§9.8) appears: *"Pipeline failure: <source>. Retrying."*

### 15.5 System screen reduced-motion handling

When reduced motion is set, the ambient scanline is **disabled entirely** (it is the only effect that disappears completely). The rhythm line also stops pulsing and holds at 0.5.

---

## 16. State catalog

| State                       | Treatment                                                                                                                       |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| First-paint loading (Radar) | Top bar and bottom nav render immediately. Drift gradient already animating. Cards replaced by breathing title-line skeletons; eyebrow row shows `LOADING SIGNAL`. |
| Loading (Inspect)           | Shared-layout morph runs immediately on tap. Sections show breathing placeholders until data resolves. The morph never waits.    |
| Empty (Radar, no signals)   | Center-aligned single line: *"Nothing surfaced yet. Next ingestion in Xh."* Identical treatment to end-of-feed. No illustration. |
| Empty (Explore, no results) | Single line: *"No signals match these filters."* A Ghost button *"Reset filters"* sits below.                                    |
| Empty (Movers, no movers)   | *"No movers in this window."*                                                                                                   |
| Error (network)             | A `sem/pain` colored single line at the top of the would-be feed: *"Couldn't reach the pipeline. Retrying in Xs."* No retry button. |
| Error (auth)                | A bottom sheet with the auth surface (§10.3) re-opens with a `caption sem/pain` helper: *"Session expired. Send a new link."*    |
| Offline                     | A toast with neutral leading bar: *"You're offline. Showing the last cached pull."*                                              |
| Focus rings (keyboard)      | 2px solid `rgba(148, 163, 255, 0.6)` outline at 2px offset. Never a glow. Never animated.                                        |

All states must be in-character with the editorial, restrained tone. No generic skeletons, no spinners that look like generic AI loading rings.

---

## 17. Gesture and input map

| Input                                    | Result                                                                |
| ---------------------------------------- | --------------------------------------------------------------------- |
| Vertical scroll                          | Scroll the active feed                                                |
| Tap card                                 | Open Inspect via `inspect-open` choreography (§15 of this section / §12.1) |
| Long-press card (450ms)                  | Open Inspect at 60% sheet height with `spring/pull`                   |
| Swipe down on Inspect                    | Dismiss; resistance engages after 30% drag                            |
| Swipe right from left edge               | Back from Inspect                                                     |
| Pull down at feed top                    | Refresh (§9.11)                                                       |
| Tap profile chip                         | Open Settings sheet                                                   |
| Tap top progress line                    | Scrub to current chapter start                                        |
| Keyboard ↑/↓                             | Move focus card-by-card on desktop                                    |
| Keyboard Enter                           | Open Inspect on focused card                                          |
| Keyboard Esc                             | Dismiss Inspect / close sheet                                         |
| Two-finger horizontal swipe on a card    | (Reserved; not yet defined — implementer must ask before using)        |

The dismiss resistance is deliberate: a dismissal you can do accidentally feels cheap.

---

## 18. Adaptive performance tiers

The visual-effects layer must respect the user's device capability. The implementer determines the active tier from device signals (viewport size, prefers-reduced-motion, the user's Appearance setting, and device pixel-ratio when available) and applies the table below.

### 18.1 Tier table

| Effect                       | Low tier (mobile <360px wide, or low-power, or Appearance=Off) | Standard tier (most mobile + tablets, Appearance=Default) | High tier (desktop ≥1024px, Appearance=Subtle/Default) |
| ---------------------------- | -------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------ |
| Drift gradient (Layer 2)     | Frozen at center anchor; no animation                          | Full 24s cycle                                            | Full 24s cycle                                         |
| Grain (Layer 3)              | Off                                                            | On at 4%                                                  | On at 4%                                               |
| Micro-glitch                 | Disabled                                                       | Enabled at half slice displacement (max 1.5px)            | Enabled at full spec                                   |
| Scanline (one-shot)          | Disabled                                                       | Enabled                                                   | Enabled                                                |
| Scanline (ambient, System)   | Disabled                                                       | Enabled at half opacity                                    | Enabled at full opacity                                |
| Chromatic aberration         | Disabled (split = 0)                                           | Enabled, max split 1.5px                                  | Enabled, max split 2px                                 |
| Pulse highlights (CTA, nav)  | Static (no pulse)                                              | Enabled                                                   | Enabled                                                |
| Backdrop blur on cards/nav   | Reduced to 6px                                                 | 14px                                                      | 14px                                                   |
| Shared-layout Inspect morph  | Cross-fade fallback (160ms)                                     | Full spec                                                 | Full spec                                              |
| Score count-up               | Disabled (final value appears)                                  | Enabled                                                   | Enabled                                                |
| Card reveal stagger          | Disabled (group fade-in)                                       | Full stagger                                              | Full stagger                                           |

### 18.2 Why this tiering matters

- The four most expensive effects on mobile are backdrop blur, the drift animation, the scanline overlay, and chromatic aberration. The Low tier strips all four.
- Glitch, scanline, and CA are visually compelling but cost composite layers and paint area. On Standard tier, displacement and split values are halved to keep them readable without burning frames.
- The Appearance setting in §12.5 (Subtle / Default / Off) lets the user override their detected tier downward — never upward. A user on Low cannot opt into High.

### 18.3 Test obligations for the implementer

For any new component or screen, the implementer must verify three renderings before considering it complete:

1. **Low tier** — must remain useful, readable, and on-brand without any effects.
2. **Standard tier** — the canonical experience.
3. **High tier** — full, unrestrained.

If a component only looks good on High tier, it does not yet meet the V4 bar.

---

## 19. Accessibility

### 19.1 Reduced-motion fallback

When the system prefers-reduced-motion flag is set, regardless of detected device tier:

- All staggers collapse to 0ms; groups appear together.
- All spring entries become 120ms opacity fades.
- Score numerals appear at final value (no count-up).
- Chapter cuts become hard swaps.
- Shared-layout Inspect open becomes a 160ms cross-fade.
- Drift gradient freezes at its current anchor.
- Grain remains (it is static anyway).
- Press states still compress, at scale 0.99 over 60ms — tactile feedback at low motion budgets is accessibility-positive.
- All glitch, scanline, and CA effects are **disabled entirely**.

### 19.2 Contrast

All `text/primary` on `bg/base` and on `surface/1`/`surface/2` must clear 7:1. `text/secondary` and `text/muted` must clear 4.5:1. Semantic colors on their backgrounds must clear 4.5:1 when used for text and 3:1 when used as non-text indicators (bars, dots, sparklines).

### 19.3 Keyboard navigation

Every interactive element is reachable by Tab in DOM order. Focus is always visible (§16 focus rings). Card focus moves with ↑/↓ on Radar, Movers, and Explore. Inspect Esc dismiss is mandatory.

### 19.4 Screen-reader behavior

- Time-rhythm line is decorative, hidden from assistive tech.
- Sparklines must expose a single text summary (e.g. *"Momentum: rising over 14 days, 7 signals."*).
- Score numerals must be paired with their full label (*"Composite score 78 out of 100"*) for screen readers.
- Scanline, glitch, and CA effects are never described — they are purely visual.

### 19.5 Touch target

Minimum 44 × 44 CSS px on all interactive elements. Bottom-nav items meet this even though icons are 22px (the surrounding tap area pads to 44px).

---

## 20. Choreography library (named, reusable)

Whenever a spec elsewhere in this document references a named choreography, it refers to one of these. Each must behave identically wherever it appears.

### 20.1 `cascade-in`

Top-down sequential reveal of a set of children.

- Each child enters from `translateY(12px) opacity 0` on `spring/ui`.
- Stagger interval: `stagger/base` for ≤8 children; `stagger/dense` for >8.
- First child delay: 0ms unless overridden.
- Used in: Inspect section reveal, Settings sheet sections, Onboarding tagline words.

### 20.2 `mask-cut`

A solid color shape wipes the outgoing surface and reveals the incoming one. The mask itself is the transition.

- Mask shape: a tall trapezoid leaning right by 8°, full viewport height, 60% viewport width.
- Color: `accent/indigo` at first frame, `accent/violet` at midpoint.
- Travel: from off-screen left to off-screen right over `motion/base` on `ease/editorial`.
- A 0.5px CA split runs on the trailing edge of the mask only.
- Used in: Onboarding → Radar handoff, Splash → Radar handoff.

### 20.3 `inspect-open`

The headline choreography (§12.1). Combines shared-layout morph + scrim fade + one downward scanline + section cascade.

- Phase 1 (0–480ms): card → header morph on `spring/hero`; scrim fade on `motion/base`; scanline sweep starts at 80ms.
- Phase 2 (120–720ms): sections cascade-in (§20.1) at `stagger/base`.

### 20.4 `inspect-close`

The reverse of `inspect-open`, deliberately ~520ms total.

- Phase 1 (0–280ms): sections cascade out top-down on `stagger/exit`, each fading and translating `+8px` over `motion/instant`.
- Phase 2 (200–520ms): header morphs back to card; scrim fades in parallel.

### 20.5 `kinetic-emphasis`

A short scale/weight beat on a single element to underline a state change.

- Targets: hero title in Inspect header during open; the splash wordmark on settle.
- Scale envelope: 1 → 1.04 → 1 over 320ms.
- Weight envelope (if Inter): 600 → 700 → 600 over the same window.
- CA split: 1.5px on first frame, resolves to 0 by 120ms.
- Never used on body text or labels.

### 20.6 `chord`

Simultaneous animation of N siblings as a single moment. The one named exception to Law 1 (rhythm).

- All children animate width/scale from 0 → final over 520ms on `spring/hero`.
- Used in: Inspect score-composition bars. Reserved for moments where simultaneity *is* the meaning.

### 20.7 `pulse-soft`

A continuous low-amplitude opacity pulse on a static element.

- Opacity envelope: 0.85 ↔ 1.0 over 2.4s on ease-in-out alternate.
- Targets: bottom-nav active dot; Primary pill behind-glow.

### 20.8 `glitch-resolve`

The micro-glitch envelope (§5.2) for any allowed occasion.

- 2–3 horizontal slices, 1–3px alternating displacement, 0.5px CA per slice.
- 3 keyframes max over 120–180ms.
- **Always** resolves to clean.

### 20.9 `scanline-sweep`

A single one-shot scanline pass (§5.3).

- 2px (mobile) / 3px (desktop) band, `rgba(255,255,255,0.025)` tint.
- 240ms top-to-bottom on `ease/editorial`, opacity 0 → peak at 50% → 0.

### 20.10 `count-up`

Numeral reveal.

- Tween a numeric value from 0 to final over `motion/hero` on `ease/editorial`.
- Renders with `JetBrains Mono` and tabular figures so digit width is stable.
- CA split optional (1px), resolves to 0 by settle.

---

## 21. Anti-patterns (hard constraints)

Any of the following found in an implementation is a defect, not a stylistic disagreement.

- Pure white or pure black anywhere in chrome.
- Emojis in any UI region (chrome, cards, empty states, toasts).
- Drop shadows on any surface.
- Glow effects of any kind.
- Saturated cyan, electric blue, or neon greens.
- Purple/violet outside the documented indigo range.
- A third typeface beyond Inter/Geist and JetBrains Mono.
- Fade-only entries on cards or sections.
- Two simultaneous bounces on any spring (a single perceptible settle is the maximum).
- Glitch, scanline, or CA on body text below 16px.
- Glitch or CA on form inputs while focused.
- Continuous ambient scanline anywhere except the System screen.
- Skeletons styled as shimmer rectangles.
- A back-stack on Inspect (Related ideas must replace, never push).
- Settings as a bottom-nav item.
- Drop-cap anywhere other than Inspect "Why now".
- Tarot, kanji, character art, anime speed lines, or impact frames.
- A toolbar in the Inspect footer (only two actions: Save + Dismiss).
- Animated grain or animated drop shadows.
- Two semantic colors competing as primary on the same card.

---

## 22. What this guide does NOT cover

- Real data schemas, API contracts, or backend changes.
- File or folder structure for the implementation.
- Stylesheet code or framework-specific configuration.
- Sound design. The visual rhythm carries the entire experience.
- Notification or external-delivery layer changes (Telegram, email).
- Internationalization beyond the typography rules above.

When an implementer needs any of the above, they should consult V3.5 (for product and pipeline) or ask for an extension to this guide.

---

## 23. Closing

V3.5 told us **what IRS is.** V4 tells us **how IRS looks, moves, and breathes** — across every screen, with a Persona 3 Reload–informed motion vocabulary that has been deliberately reconciled with IRS's restrained, editorial register and tiered for honest mobile performance.

> A personal intelligence system that shapes what you notice — and feels, in every gesture, cut, and quiet glitch, like the system itself is paying attention.
