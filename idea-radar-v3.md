 # PROJECT: Idea Radar System (IRS) — V3.5

## Core Purpose

IRS is a personal intelligence system for discovering emerging opportunities, unmet needs, and build-worthy problems before they become obvious.

It continuously ingests signals from curated sources, compresses and interprets them with LLMs, ranks opportunities with deterministic scoring, and presents them through a mobile-first intelligence interface designed for rapid scanning and deep dives.

### IRS is NOT:
- A chatbot
- A generic AI wrapper
- A productivity dashboard
- An enterprise analytics tool

### IRS IS:
> A personal opportunity discovery + ranking engine with a mobile-native intelligence interface

---

# V3.5 PRODUCT SHIFT

## Previous Direction (V3)
IRS was primarily:
- A backend pipeline
- A scheduled intelligence system
- A Telegram digest engine
- An optional frontend

## New Direction (V3.5)
IRS is now:
- A mobile-first intelligence product
- A personal opportunity terminal
- A visually immersive discovery interface
- A tactile scanning experience

The backend still matters, but the product experience is now equally important. The UI is no longer “just a dashboard.”

**It is:**
> The primary way the system is experienced.

---

# PRIMARY PLATFORM

### PRIMARY TARGET:
- iPhone Safari
- Mobile browsers
- Portrait orientation

### SECONDARY TARGET:
- Desktop browsers

The experience must feel:
- Native to mobile
- Smooth at 60fps
- Thumb-friendly
- Readable outdoors
- Visually layered
- Emotionally engaging

*Desktop is adaptive. Mobile is primary.*

---

# CORE USER FLOW

The intended user behavior:
1. IRS sends a notification/digest.
2. User opens IRS on phone.
3. User rapidly scans opportunities.
4. One item creates intrigue.
5. User dives deeper into details.
6. User transitions to laptop to research/build.

Therefore, the UI must optimize for:
- Curiosity
- Fast scanning
- Emotional salience
- Information hierarchy
- Momentum
- Progressive disclosure

**NOT:**
- Dense dashboards
- Admin tooling
- Spreadsheets
- Data overload

---

# DESIGN PHILOSOPHY

## Emotional Goal
The product should feel:
- Intelligent
- Calm
- Cinematic
- Tactile
- Restrained
- Premium
- Focused

**NOT:**
- Corporate
- Cyberpunk
- Gimmicky
- Noisy
- Generic AI
- Tailwind demo aesthetic
- Enterprise SaaS sludge

---

# VISUAL LANGUAGE

## Inspirations (directional, not copies)
The UI should take inspiration from:
- Premium mobile operating systems
- Editorial news apps
- Music player interfaces
- High-end finance apps
- Persona-style information presentation
- Tactile mobile interaction systems

---

# COLOR SYSTEM

## Base Palette

**Background:**
- Near-black graphite
- Deep blue-gray surfaces
- Layered dark tones

**Accent:**
- Restrained indigo/violet
- Muted blue-violet
- Subtle ambient gradients

**Semantic:**
- Muted amber = buildability
- Muted red/orange = pain
- Soft green = momentum
- Subdued neutral grays for metadata

*Avoid: Bright neon cyan, hacker aesthetics, rainbow accents, glowing effects.*

### Current Palette Direction
```css
--bg-primary: #0b0d10;
--bg-secondary: #111318;
--surface-primary: #171a21;
--surface-secondary: #1d2129;

--accent-primary: #7c8cdb;
--accent-secondary: #94a3ff;

--text-primary: #f3f5f7;
--text-secondary: #b6bcc8;
--text-muted: #7d8593;

--pain: #c97b63;
--build: #c7a76b;
--momentum: #6ea58b;

```

*No pure black. No hard white. No aggressive contrast spikes.*

---

# TYPOGRAPHY

Typography is a primary visual element.

**Use:**

* Large confident headings
* Editorial spacing
* Clean sans-serif body text
* Monospaced numerics only where useful

The UI should feel readable and elegant before it feels “technical.”

**Avoid:**

* Tiny dashboard fonts
* Overusing monospace
* Excessive labels
* Information density

### Current Direction

* **Headings:** Inter, SF Pro Display, Geist, Plus Jakarta Sans
* **Numerics / Score data:** JetBrains Mono, IBM Plex Mono

---

# INTERACTION DESIGN

The system should feel fluid, tactile, responsive, and alive.

**Interactions should include:**

* Layered transitions
* Smooth momentum scrolling
* Subtle depth
* Spring motion
* Progressive reveal
* Gesture-friendly navigation

**Avoid:**

* Excessive bounce
* Flashy motion
* Constant animation
* Distracting effects

*Motion should guide attention, not demand it.*

---

# UI ARCHITECTURE

IRS should behave more like a mobile operating system than a dashboard.

## Primary Navigation

Bottom navigation with 3–5 core destinations max. Suggested structure:

* Radar
* Movers
* Explore
* System
* Settings/Profile

Navigation should:

* Feel native on mobile
* Be thumb reachable
* Persist across views

## PRIMARY EXPERIENCE: RADAR

Radar is the home experience. It is:

* Immersive
* Scroll-driven
* Editorial
* Focused on discovery

Each opportunity should feel important, intriguing, and alive. NOT like another database row or SaaS card.

---

# SIGNAL CARD DESIGN

Cards should prioritize:

* Problem clarity
* Emotional weight
* Why it matters now
* Momentum
* Buildability

Cards should NOT contain giant metadata walls, too many pills, or excessive badges.

**Cards should feel:**

* Atmospheric
* Readable
* Focused
* Cinematic

### CURRENT CARD DIRECTION

**Visual Structure:**
Cards should feel like editorial story fragments or intelligence dossiers. Not Kanban tasks or analytics widgets.

**Card Layout Priority:**

1. Title
2. One-line pain summary
3. Momentum context
4. Score / confidence
5. Metadata (subdued)

---

# INFORMATION HIERARCHY

The user should understand in under 5 seconds:

* What is the opportunity?
* Why does it matter?
* Is the pain real?
* Is momentum growing?
* Could I realistically build this?

*Everything else is secondary.*

---

# INSPECT VIEW

Inspect is the deep dive layer. It should:

* Slide naturally from the current context
* Feel immersive
* Support long-form reading
* Progressively reveal detail

**Include:**

* Problem breakdown
* Signal timeline
* Source excerpts
* Score composition
* Why-now analysis
* MVP scope
* Related ideas
* Keyword graph
* Market saturation
* Build complexity

*The inspect layer should feel like opening a case file.*

---

# UX PRINCIPLES

### Progressive Disclosure

Do NOT show everything immediately. Surface intrigue first, detail second, and analysis third.

### One Strong Idea > Ten Weak Ones

The UI should create focus. Avoid overwhelming grids or dense dashboards.

### Scanning First

Everything should support quick reading, visual hierarchy, and effortless filtering.

---

# MOBILE-FIRST REQUIREMENTS

### Safari Optimization

The app must work exceptionally well in iOS Safari and mobile Chrome.

* Support safe area insets and notch devices
* Smooth momentum scrolling and touch interactions

### Required CSS

```css
padding-top: env(safe-area-inset-top);
padding-bottom: env(safe-area-inset-bottom);
height: 100dvh;
-webkit-overflow-scrolling: touch;

```

---

# TECHNICAL FRONTEND DIRECTION

## Frontend Philosophy

The frontend is lightweight, fast, app-like, and animation-aware. Avoid bloated component libraries or generic templates.

## Frontend Stack

* **Preferred:** Next.js, React, Framer Motion, Tailwind (heavily customized)
* **UI:** shadcn/ui only as low-level primitives (Do NOT ship default aesthetics)

---

# CURRENT IMPLEMENTATION STATUS

## Existing Prototype

* Flask API backend
* Mobile-first frontend prototype
* Vanilla JS architecture
* SQLite integration
* Radar / Movers / System views
* Inspect overlay
* Animated transitions + gesture support

## Current Redesign Goals

The existing prototype is functional but not yet emotionally compelling.

* **Problems:** Feels too "generated," weak typography hierarchy, cards resemble dashboards, lacks depth.
* **Goal:** Elevate IRS to feel like a premium mobile product.

---

# MOTION SYSTEM

Motion is part of the product identity.

* **Use:** Spring physics, layered transitions, subtle parallax, contextual animations.
* **Avoid:** Excessive durations, flashy entrance effects, "look at me" motion.

### CURRENT MOTION DIRECTION

Animations should feel restrained, "expensive," and physical.

* **Examples:** Soft card elevation, layered blur transitions, subtle scroll-linked motion.
* **Avoid:** Giant scale animations, neon pulses, radar sweeps, fake sci-fi HUD motion.

---

# BACKEND ARCHITECTURE

The intelligence pipeline remains the foundation of IRS:

* Scheduled signal ingestion
* LLM compression + Signal matching
* Deterministic scoring
* SQLite WAL persistence
* Saturation tracking + Archival system

## System Architecture

Sources → Collectors → Pre-filter → LLM Compression → Signal Matching → Idea Creation → Scoring Engine → SQLite WAL → Mobile Web Interface

---

# DELIVERY MODEL

IRS runs locally (Raspberry Pi), desktop host, or cloud.

* **Frontend:** Accessible via LAN, Tailscale, or reverse proxy.
* **Telegram:** Notification layer, not primary interface.

### Local-First Philosophy

IRS should feel personal, private, and persistent. Designed for single-user ownership and long-term idea memory.

---

# FRONTEND EXPERIENCE GOALS

The frontend should make the user feel:

* “There’s something interesting here.”
* “I want to keep scrolling.”
* “This feels intelligent and personal.”
* “I found something before everyone else.”

---

# WHAT THE UI MUST AVOID

* **DO NOT** use emojis in UI.
* **DO NOT** use cyberpunk aesthetics or neon glow.
* **DO NOT** use giant shadows or generic AI visuals.
* **DO NOT** use dashboard card soup or admin panel layouts.

---

# MCP + AI WORKFLOW

* Generate UI concepts in v0.
* Use GLM / Llama for implementation.
* Use MCP tools for refinement.
* Iterate directly against mobile Safari.

**Current Priority:** Redesign frontend completely to remove the “AI-generated dashboard” feeling.

---

# BACKEND PIPELINE (DETAILED)

## Source Ingestion

Signals from: Reddit, Hacker News, GitHub, Stack Overflow, IndieHackers, curated RSS.

* **Principles:** Prioritize unmet needs, repeated frustrations, and workflow pain.

## Signal Pipeline

Fetch → Sort → Clean → Dedup → Pre-filter → LLM Compression → Matching → Idea Generation → Scoring → Persistence.

## LLM System

Uses LLMs for compression, matching, and idea creation. Does NOT use them for ranking or scoring.

* **Budget:** Max 3 calls per run (Compression, Matching, Idea Creation).

## Scoring Engine (Deterministic)

`score = (pain * 0.25) + (signal_frequency * 0.20) + (novelty * 0.20) + (timeliness * 0.15) + (buildability * 0.10) + (openness * 0.10)`

---

# FINAL PRODUCT DIRECTION SUMMARY

IRS V3.5 is the convergence of a high-quality **Intelligence Engine** and an **Immersive Mobile Interface**.

> The user experience is defined by the mobile interface, not the pipeline.

### System Behavior Model

IRS is a living system that continuously extracts signals, evolves ideas, and ranks opportunities. It is a continuously updating map of opportunity space.

### Attention Design Principles

1. **Focus Amplification:** One idea feels dominant at a time.
2. **Noise Suppression:** Secondary info fades away.
3. **Curiosity Hooks:** Every card implies more depth.
4. **Cognitive Load Control:** Respect short-term memory.

### Scroll Experience Model

Scrolling should feel intentional and weighted. Each scroll reveals another candidate opportunity.

### Inspect Layer (Final Definition)

A structured intelligence dossier containing problem decomposition, signal origin, idea history, and MVP outlines. It feels like an intelligence report, not a modal.

---

# CLOSING STATEMENT

IRS is not a dashboard. IRS is not a tool.

**IRS is:**

> A personal intelligence system that shapes what you notice, what you build, and what you ignore."""