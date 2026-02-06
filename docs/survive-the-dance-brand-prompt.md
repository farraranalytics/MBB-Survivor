# Survive the Dance — Brand Identity & Design System Prompt

You are building a March Madness Survivor Pool web application called **"Survive the Dance."** Below is the complete brand identity and design system. Apply these specifications consistently across every screen, component, and interaction you build.

---

## App Overview

A March Madness Survivor Pool app where players join groups, pick one NCAA tournament team to win each day (each team can only be used once), and survive or get eliminated. Last one standing wins. Key differentiator is a strategic "Analyze" tab with data-driven insights.

- **Name:** Survive the Dance
- **Tagline:** "Every pick could be your last."
- **Target audience:** College basketball fans running pools with friends — mix of hardcore analytics nerds and casual social players. Think fantasy football league energy.
- **Tone:** High-stakes, intense, but fun. ESPN broadcast booth meets group chat.

---

## Color Palette

### Primary Colors
| Name | Hex | RGB | Usage |
|------|-----|-----|-------|
| **Tournament Orange** | `#FF5722` | rgb(255, 87, 34) | Primary brand color. CTAs, buttons, highlights, active states, accent text, "THE" in wordmark. The dominant action color. |
| **Midnight Navy** | `#0D1B2A` | rgb(13, 27, 42) | Primary background. Deep, dark, broadcast-quality. The "field" of the app. Use for main app background, headers, and hero areas. |
| **Court White** | `#E8E6E1` | rgb(232, 230, 225) | Primary text color on dark backgrounds. Warm white — not sterile #FFFFFF. Like hardwood court paint. |

### Secondary / Surface Colors
| Name | Hex | Usage |
|------|-----|-------|
| **Deep Court Blue** | `#1B3A5C` | Secondary surfaces, cards, subtle elevation layers, hover states on navy backgrounds. The "depth" layer. |
| **Surface Dark** | `#111118` | Card backgrounds, secondary panels, modals. Slightly lighter than the main navy. |
| **Surface Elevated** | `#1A1A24` | Tertiary surfaces, inner card elements, nested content areas. |

### Accent / Status Colors
| Name | Hex | Usage |
|------|-----|-------|
| **Alive Green** | `#4CAF50` | "Alive" status indicators, successful picks, positive states, survival confirmations. |
| **Eliminated Red** | `#EF5350` | Elimination markers, wrong picks, danger states, loss indicators. |
| **Gold/Amber** | `#FFB300` | Warnings, deadline countdowns approaching, special highlights. |

### Opacity Patterns
- Dimmed/secondary text: `rgba(232, 230, 225, 0.5)` or use `#8A8694`
- Subtle borders: `rgba(255, 255, 255, 0.05)` to `rgba(255, 255, 255, 0.08)`
- Hover border emphasis: `rgba(255, 87, 34, 0.3)`
- Background glows: `rgba(21, 101, 192, 0.08)` (blue) and `rgba(255, 87, 34, 0.06)` (orange) for subtle radial gradients

---

## Typography

### Font Stack

**1. Headline / Display — Oswald**
- Google Fonts: `family=Oswald:wght@400;500;600;700`
- Usage: ALL headings, the wordmark/logo, countdown timers, score displays, section titles, player names in standings
- Style: **Always uppercase.** Bold (700) for primary headings, Semi-Bold (600) for secondary.
- Letter-spacing: `-0.02em` for large display, `0.02em` for smaller headings

**2. Body / UI — DM Sans**
- Google Fonts: `family=DM+Sans:wght@400;500;600;700`
- Usage: Body copy, pick cards, analysis text, navigation labels, buttons, descriptions, tooltips, form inputs
- Style: Sentence case. Highly legible at small sizes on mobile. Clean and neutral.
- Line-height: `1.6` for body text, `1.4` for UI elements

**3. Data / Accent — Space Mono**
- Google Fonts: `family=Space+Mono:wght@400;700`
- Usage: Statistics, probabilities, countdown timers, data labels, dates, monospaced emphasis, small caps labels
- Style: Uppercase for labels. Used sparingly for "analytical" voice moments — win probabilities, team counts, day counters.
- Letter-spacing: `0.1em` to `0.3em` for labels, tighter for inline data
- Font-size: Typically `0.6rem` to `0.75rem` for labels

### Typography Scale (suggested)
```
Hero/Display:    clamp(3rem, 8vw, 7rem)  — Oswald 700
Page Title:      clamp(2rem, 4vw, 3rem)  — Oswald 700
Section Title:   clamp(1.5rem, 3vw, 2rem) — Oswald 700
Card Title:      1.1rem - 1.5rem          — Oswald 600
Body:            0.95rem - 1rem            — DM Sans 400/500
Small/Caption:   0.85rem                   — DM Sans 400
Label:           0.6rem - 0.7rem           — Space Mono 400/700
```

---

## Logo & Wordmark

### Wordmark Structure
The logo is a **stacked typographic lockup** with three lines:

```
SURVIVE        ← Barlow Condensed 800, small, letter-spacing: 0.5em, color: rgba(255,255,255,0.5)
THE            ← Oswald 700, medium, letter-spacing: 0.15em, color: #FF5722 (Tournament Orange)
DANCE          ← Oswald 700, large/dominant, letter-spacing: -0.02em, color: #E8E6E1 (Court White)
```

- "SURVIVE" is deliberately understated — quiet, tracked-out, subdued opacity
- "THE" is the color accent — Tournament Orange, acts as a visual divider
- "DANCE" is the dominant word — largest, boldest, white

### Wordmark Background
- Set against **Midnight Navy (#0D1B2A)** or a gradient: `linear-gradient(145deg, #0D1B2A, #1B3A5C)`
- Optional: a subtle half-court circle behind the wordmark as a background element — a thin circle (`border: 2px solid rgba(255, 87, 34, 0.15); border-radius: 50%`) with a faint horizontal line through center

### Sub-tagline (optional, below wordmark)
- Font: Space Mono, 0.55rem, letter-spacing: 0.35em, uppercase
- Color: Tournament Orange (#FF5722)
- Text: "EVERY PICK COULD BE YOUR LAST"

### App Icon
- Shape: Rounded square (standard iOS/Android radius — `border-radius: 22%`)
- Background: `linear-gradient(145deg, #0D1B2A, #1B3A5C)`
- Content: Stacked text — SURVIVE / THE / DANCE — scaled to fit
- At small sizes: the type hierarchy still reads. "SURVIVE" may become very small but "THE DANCE" remains clear.
- Shadow: `box-shadow: 0 4px 20px rgba(0,0,0,0.5)`

### Size Scaling for App Icon Text
```
Large (100px):   SURVIVE 7px/ls:3px  |  THE 14px/ls:2px  |  DANCE 20px
Medium (60px):   SURVIVE 4.5px/ls:2px  |  THE 9px/ls:1.5px  |  DANCE 12px
Small (40px):    SURVIVE 3px/ls:1.5px  |  THE 6px/ls:1px  |  DANCE 8px
```

---

## Brand Voice & Personality

### Core Attributes

**1. Intense but not Hostile**
We talk about elimination, survival, and stakes — but it's rooted in the fun of competition. The drama IS the entertainment. Never talk down to losing players or make elimination feel cruel.

**2. Knowing, not Nerdy**
We speak fluent basketball. Seeds, chalk, Cinderellas, busted brackets — used naturally, never as gatekeeping. A casual fan should feel welcome, not quizzed. Smart but accessible.

**3. Concise & Punchy**
Short sentences. Active voice. Like a broadcast call, not a press release. "You survived." "Duke goes down. 4 players eliminated." Every word earns its spot.

**4. Friend-Group Energy**
The app is the commissioner of your pool — authoritative but fun. It should feel like the friend who organized the bracket, not a faceless platform. Light trash talk is encouraged. Formality is not.

### Personality Spectrum (where we sit)
- Playful ●●●●●●●○○○ Serious (skews serious, ~70%)
- Casual ●●●●●●○○○○ Premium (slightly premium, ~60%)
- Simple ●●●●●○○○○○ Data-heavy (balanced, ~55%)
- Reserved ●●●●●●●●○○ Bold (skews bold, ~75%)

### Sample Copy (use as reference for writing any in-app text)

**Push notification — Deadline warning:**
> "Tip-off in 2 hours. You haven't picked yet. Don't be that person."

**Push notification — Survived:**
> "Gonzaga holds on. You live to dance another day. Pick for Day 5 is open."

**Push notification — Eliminated:**
> "13-seed Furman pulls the upset. Your run is over. Finished Day 3 of 13."

**Standings page header:**
> "8 entered. 3 remain. The Dance gets harder from here."

**Analyze tab — Pick recommendation:**
> "UConn has a 91% win probability today — but you'll want them for the Elite 8. Creighton at 78% is the smarter burn."

**Empty state — No pick yet:**
> "Clock's ticking. Pick a team or you're done."

**Winner announcement:**
> "You survived The Dance. 13 days. 13 picks. Zero losses. Champion."

---

## Visual Motifs & UI Patterns

### 1. The Strikethrough (from Concept C)
A **diagonal line** drawn through eliminated teams and players. This is the core elimination visual used throughout the app.
- Implementation: A `line` element or CSS `::after` pseudo-element drawn diagonally (bottom-left to top-right) across eliminated items
- Color: `rgba(255, 87, 34, 0.25)` or Eliminated Red at low opacity
- Used on: pick history (lost picks), standings (eliminated players), team selection (burned teams)

### 2. Court Lines
Half-court circles, free-throw arcs, and lane lines used as **subtle background textures and section dividers**.
- Thin strokes: `2px solid rgba(255, 87, 34, 0.1)` to `rgba(255, 87, 34, 0.15)`
- Used as: hero background elements, section separators, card background decoration
- Keep subtle — these are atmospheric, not foreground elements

### 3. The Countdown Bar
A segmented progress bar showing **days survived out of total tournament days**.
- Each segment represents one tournament day
- Segments light up (Tournament Orange) as you advance
- Future segments: `rgba(255, 255, 255, 0.08)`
- Eliminated: segments go dark / get the strikethrough treatment

### 4. The Team Grid
A grid of 64 slots representing all tournament teams.
- Fills up / marks off as you "burn" teams with your picks
- Available teams: Court White or subtle fill
- Used/burned teams: dimmed with strikethrough
- Eliminated teams (lost in tournament): even more dimmed
- Visual metaphor: your "ammo" running out over the tournament

### 5. Section Dividers
Full-width horizontal lines with fade:
```css
background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 50%, transparent 100%);
```

### 6. Card Styling
```css
background: #111118; /* var(--surface) */
border: 1px solid rgba(255, 255, 255, 0.05);
border-radius: 12px;
padding: 2rem;
transition: border-color 0.3s;
```
Hover state: `border-color: rgba(255, 87, 34, 0.3);`

### 7. Labels / Tags
Small uppercase labels used throughout:
```css
font-family: 'Space Mono', monospace;
font-size: 0.65rem;
letter-spacing: 0.2em;
text-transform: uppercase;
color: #FF5722; /* Tournament Orange */
```

### 8. Gradient Backgrounds (for hero/feature areas)
```css
/* Subtle ambient glow */
background: radial-gradient(ellipse at 30% 50%, rgba(21, 101, 192, 0.08) 0%, transparent 50%),
            radial-gradient(ellipse at 70% 50%, rgba(255, 87, 34, 0.06) 0%, transparent 50%);
```

---

## CSS Variables (copy into your global stylesheet)

```css
:root {
  /* Primary */
  --color-orange: #FF5722;
  --color-navy: #0D1B2A;
  --color-white: #E8E6E1;

  /* Surfaces */
  --color-deep-blue: #1B3A5C;
  --color-surface: #111118;
  --color-surface-2: #1A1A24;

  /* Status */
  --color-alive: #4CAF50;
  --color-eliminated: #EF5350;
  --color-warning: #FFB300;

  /* Text */
  --color-text: #E8E6E1;
  --color-text-dim: #8A8694;

  /* Borders */
  --border-subtle: rgba(255, 255, 255, 0.05);
  --border-medium: rgba(255, 255, 255, 0.08);
  --border-accent: rgba(255, 87, 34, 0.3);

  /* Typography */
  --font-headline: 'Oswald', sans-serif;
  --font-body: 'DM Sans', sans-serif;
  --font-data: 'Space Mono', monospace;

  /* Spacing */
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-icon: 22%;
}
```

---

## Design Principles (for decision-making)

1. **Mobile-first.** Most users pick from their phones minutes before tip-off. Every screen must be thumb-friendly and fast.
2. **Dark mode default.** The navy/dark palette is not a "dark mode option" — it IS the brand. There is no light mode in v1.
3. **Information density where it matters.** The Analyze tab can be data-heavy. The Pick screen must be dead simple. Match complexity to context.
4. **Typography does the heavy lifting.** We don't rely on icons or illustrations. Bold type, clear hierarchy, and color accents carry the design.
5. **Status is always visible.** At any point in the app, you should be able to tell: Am I alive? When's the deadline? What's my pick status?
6. **Transparency after deadlines.** Once picks lock, everything is visible. Design for the "reveal" moment — picks appearing, standings updating, the tension of seeing what everyone chose.

---

## Quick Reference

| Element | Value |
|---------|-------|
| App Name | Survive the Dance |
| Tagline | Every pick could be your last. |
| Primary Color | #FF5722 (Tournament Orange) |
| Background | #0D1B2A (Midnight Navy) |
| Text | #E8E6E1 (Court White) |
| Alive Accent | #4CAF50 |
| Eliminated Accent | #EF5350 |
| Headline Font | Oswald (700, uppercase always) |
| Body Font | DM Sans (400/500/700) |
| Data Font | Space Mono (400/700, uppercase labels) |
| Border Radius | 12px cards, 8px inner elements, 16px modals |
| Card Background | #111118 with 1px rgba(255,255,255,0.05) border |
| Logo | Stacked: SURVIVE (small, dim) / THE (orange) / DANCE (large, white) |
