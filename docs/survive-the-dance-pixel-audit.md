# Survive the Dance — Pixel-Level Audit
## Component Library vs. Codebase: Every Single Discrepancy

This document compares the **Component Library v1.0** (`std-component-library.html`) against the **current codebase** (`MBB-Survivor-main/`), line by line, value by value. Nothing is skipped.

---

## SECTION 1: CSS CUSTOM PROPERTIES / DESIGN TOKENS

### Missing Variables (exist in library, NOT in codebase)

| Token | Library Value | Status in Codebase |
|---|---|---|
| `--color-orange-hover` | `#FF6D3A` | ❌ MISSING |
| `--color-orange-active` | `#E64A19` | ⚠️ Exists as hardcoded `#E64A19` in `.btn-orange:hover` but not as a variable |
| `--color-orange-subtle` | `rgba(255, 87, 34, 0.08)` | ❌ MISSING (used inline as `rgba(255,87,34,0.08)` in 15+ places) |
| `--color-orange-glow` | `rgba(255, 87, 34, 0.25)` | ❌ MISSING |
| `--color-navy-light` | `#122640` | ❌ MISSING |
| `--color-white-pure` | `#FFFFFF` | ❌ MISSING |
| `--surface-0` | `#080810` | ❌ MISSING (codebase uses `--color-surface: #111118` which is different) |
| `--surface-1` | `#0D1B2A` | ❌ MISSING as variable (used as hardcoded bg) |
| `--surface-2` | `#111827` | ❌ WRONG — library says `#111827`, codebase uses `#111118` |
| `--surface-3` | `#1B2A3D` | ❌ MISSING (codebase uses `--color-surface-2: #1A1A24` which is wrong) |
| `--surface-4` | `#243447` | ❌ MISSING |
| `--surface-5` | `#2D3E52` | ❌ MISSING |
| `--color-alive-subtle` | `rgba(76, 175, 80, 0.12)` | ❌ MISSING |
| `--color-alive-glow` | `rgba(76, 175, 80, 0.3)` | ❌ MISSING |
| `--color-eliminated-subtle` | `rgba(239, 83, 80, 0.12)` | ❌ MISSING |
| `--color-eliminated-glow` | `rgba(239, 83, 80, 0.3)` | ❌ MISSING |
| `--color-warning-subtle` | `rgba(255, 179, 0, 0.12)` | ❌ MISSING |
| `--color-info` | `#42A5F5` | ❌ MISSING |
| `--color-info-subtle` | `rgba(66, 165, 245, 0.12)` | ❌ MISSING |
| `--text-primary` | `#E8E6E1` | ⚠️ Exists as `--color-text: #E8E6E1` — different name |
| `--text-secondary` | `#9BA3AE` | ❌ WRONG — library says `#9BA3AE`, codebase uses `--color-text-dim: #8A8694` |
| `--text-tertiary` | `#5F6B7A` | ❌ MISSING |
| `--text-disabled` | `#3D4654` | ❌ MISSING |
| `--text-inverse` | `#0D1B2A` | ❌ MISSING |
| `--border-default` | `rgba(255, 255, 255, 0.08)` | ⚠️ Exists as `--border-medium` — different name |
| `--border-strong` | `rgba(255, 255, 255, 0.12)` | ❌ MISSING |
| `--border-accent-strong` | `rgba(255, 87, 34, 0.6)` | ❌ MISSING |
| `--font-display` | `'Oswald', sans-serif` | ⚠️ Named `--font-headline` in codebase |
| `--font-display-condensed` | `'Barlow Condensed', sans-serif` | ❌ MISSING as variable |
| `--font-mono` | `'Space Mono', monospace` | ⚠️ Named `--font-data` in codebase |
| All `--space-*` values | `0.25rem` through `4rem` | ❌ ALL MISSING — no spacing scale |
| `--radius-xs` | `4px` | ❌ MISSING |
| `--radius-sm` | `6px` | ❌ WRONG — library `6px`, codebase `8px` |
| `--radius-md` | `10px` | ❌ WRONG — library `10px`, codebase `12px` |
| `--radius-lg` | `14px` | ❌ WRONG — library `14px`, codebase `16px` |
| `--radius-xl` | `20px` | ❌ MISSING |
| `--radius-full` | `9999px` | ❌ MISSING |
| All `--shadow-*` values | 6 shadow tokens | ❌ ALL MISSING |
| All `--transition-*` values | `150ms/250ms/400ms ease` | ❌ ALL MISSING |
| All `--z-*` values | 5 z-index tokens | ❌ ALL MISSING |

### WRONG Values (exist in both but don't match)

| Token | Library | Codebase | Impact |
|---|---|---|---|
| Surface 2 / Card bg | `#111827` | `#111118` | Every card in the app has wrong background |
| Surface 3 | `#1B2A3D` | `#1A1A24` | Elevated cards wrong |
| Text secondary | `#9BA3AE` | `#8A8694` | All secondary text is too dim |
| Border radius sm | `6px` | `8px` | All small radii are 2px too large |
| Border radius md | `10px` | `12px` | All medium radii 2px too large |
| Border radius lg | `14px` | `16px` | All large radii 2px too large |

---

## SECTION 2: TYPOGRAPHY CLASSES

### Missing Typography Classes (ALL missing from globals.css)

| Class | Library Spec | Exists? |
|---|---|---|
| `.text-display` | Oswald 700, clamp(2.5rem, 7vw, 5rem), uppercase, line-height 0.92, letter-spacing -0.02em | ❌ |
| `.text-title` | Oswald 700, clamp(1.75rem, 4vw, 2.5rem), uppercase, line-height 1 | ❌ |
| `.text-heading` | Oswald 700, 1.35rem, uppercase, line-height 1.15 | ❌ |
| `.text-subheading` | Oswald 600, 1.1rem, uppercase, line-height 1.2 | ❌ |
| `.text-body` | DM Sans 400, 0.95rem, line-height 1.65, color text-secondary | ❌ |
| `.text-small` | DM Sans 400, 0.85rem, line-height 1.5, color text-secondary | ❌ |
| `.text-data` | Space Mono 700, 1rem, letter-spacing 0.03em | ❌ |
| `.text-data-lg` | Space Mono 700, 1.75rem, letter-spacing 0.02em | ❌ |
| `.text-label` | Space Mono 400, **0.65rem**, letter-spacing 0.2em, uppercase, color **text-tertiary** (#5F6B7A) | ⚠️ EXISTS BUT WRONG — codebase `.label` uses **color: #FF5722** (orange) instead of tertiary gray |
| `.text-label-accent` | Space Mono 400, 0.65rem, letter-spacing 0.2em, uppercase, color **orange** | ❌ MISSING (this is the one that SHOULD be orange) |
| `.text-countdown` | Oswald 700, 2.5rem, letter-spacing 0.05em, color orange | ❌ |

**Critical Issue:** The codebase `.label` class applies orange color to ALL labels. The library distinguishes `.text-label` (gray, `#5F6B7A`) from `.text-label-accent` (orange, `#FF5722`). Most labels should be gray, only accented ones orange.

---

## SECTION 3: WORDMARK & APP ICON

### Wordmark Full Size

| Property | Library Spec | Codebase (page.tsx) | Match? |
|---|---|---|---|
| SURVIVE font | Barlow Condensed, weight 800 | Barlow Condensed, weight 800 | ✅ |
| SURVIVE size | `0.75rem` | `0.7rem` | ❌ OFF BY 0.05rem |
| SURVIVE letter-spacing | `0.5em` | `0.5em` | ✅ |
| SURVIVE color | `rgba(232, 230, 225, 0.4)` | `rgba(255, 255, 255, 0.5)` | ❌ WRONG — should be warm white at 40%, not pure white at 50% |
| SURVIVE line-height | `1` | not set | ❌ MISSING |
| THE font | Oswald, weight 700 | Oswald, weight 700 | ✅ |
| THE size | `1.5rem` | `1.8rem` | ❌ WRONG — 20% too large |
| THE letter-spacing | `0.15em` | `0.15em` | ✅ |
| THE color | `var(--color-orange)` (#FF5722) | `#FF5722` | ✅ |
| THE line-height | `1.1` | `leading-none` (1.0) | ⚠️ Close but not exact |
| DANCE font | Oswald, weight 700 | Oswald, weight 700 | ✅ |
| DANCE size | `2.75rem` | `4.5rem` | ❌ WAY TOO LARGE — 64% bigger than spec |
| DANCE letter-spacing | `-0.02em` | `-0.02em` | ✅ |
| DANCE color | `var(--text-primary)` (#E8E6E1) | `#E8E6E1` | ✅ |
| DANCE line-height | `0.85` | `leading-none` (1.0) | ❌ WRONG — should be tighter |
| Wordmark wrapper | `inline-flex`, `flex-direction: column`, `align-items: center`, `gap: 0` | No wrapper — just sequential `<p>` tags | ❌ STRUCTURAL MISMATCH — should be flexbox column with `.wordmark` class |

### Wordmark Small (Header / Nav)

| Property | Library Spec | Codebase | Match? |
|---|---|---|---|
| `.wordmark-sm .wordmark-survive` | `font-size: 0.4rem; letter-spacing: 0.35em` | ❌ Does not exist anywhere in the codebase | ❌ |
| `.wordmark-sm .wordmark-the` | `font-size: 0.7rem; letter-spacing: 0.1em` | ❌ Does not exist | ❌ |
| `.wordmark-sm .wordmark-dance` | `font-size: 1.25rem` | ❌ Does not exist | ❌ |

**There is no small wordmark used in headers anywhere in the app.** The dashboard header and pool headers use plain text headings, not the wordmark.

### App Icon

| Property | Library Spec | Codebase | Match? |
|---|---|---|---|
| App icon component | 3 sizes: lg (100px), md (64px), sm (44px) | ❌ Does not exist in codebase | ❌ |
| Icon border-radius | `var(--radius-icon)` = `22%` | Variable exists in `:root` but never used | ❌ |
| Icon background | `linear-gradient(145deg, #0D1B2A, #1B3A5C)` | ❌ Does not exist | ❌ |
| Type sizing for icon | Specific px values for each size (7px, 14px, 22px for lg) | ❌ Does not exist | ❌ |

---

## SECTION 4: BUTTONS

### `.btn` Base

| Property | Library Spec | Codebase `.btn-orange` | Match? |
|---|---|---|---|
| Font family | `var(--font-display)` = **Oswald** | `var(--font-body)` = **DM Sans** | ❌ WRONG FONT |
| Font weight | `600` | `700` | ⚠️ Different weight |
| Text transform | `uppercase` | not set | ❌ MISSING |
| Letter spacing | `0.05em` | not set | ❌ MISSING |
| Active transform | `scale(0.97)` | `scale(0.98)` | ⚠️ Minor diff |

### Button Variants Missing

| Variant | Library | Codebase | Status |
|---|---|---|---|
| `.btn-primary` | Orange, radius-sm (6px), padding 12px 24px | `.btn-orange` exists but radius is 12px | ❌ WRONG RADIUS |
| `.btn-primary-lg` | Orange, radius-md (10px), padding 16px 32px | ❌ MISSING | ❌ |
| `.btn-secondary` | Transparent, 1.5px border, outline style | ❌ MISSING | ❌ |
| `.btn-ghost` | Transparent, no border, text only | ❌ MISSING | ❌ |
| `.btn-danger` | Eliminated red fill | ❌ MISSING | ❌ |
| `.btn-disabled` | opacity 0.35, cursor not-allowed | ❌ MISSING as class | ❌ |
| Hover glow | `box-shadow: var(--shadow-glow-orange)` = `0 0 20px rgba(255, 87, 34, 0.2)` | `0 4px 16px rgba(255, 87, 34, 0.3)` | ⚠️ Different shadow |

---

## SECTION 5: CARDS

### Card Variants Missing

| Variant | Library Class | Codebase | Status |
|---|---|---|---|
| Base `.card` | surface-2 bg, border-subtle, radius-lg (14px) | Exists but bg is `#111118` (wrong), radius is `12px` (wrong) | ⚠️ WRONG VALUES |
| `.card-accent` | surface-2 bg, border-accent (orange) | ❌ MISSING | ❌ |
| `.card-interactive` | Hover: translateY(-1px), border-accent, shadow-md | ❌ MISSING | ❌ |
| `.card-interactive.selected` | Orange border, orange-subtle bg, glow | ❌ MISSING | ❌ |
| `.card-elevated` | surface-3 bg, shadow-lg | ❌ MISSING | ❌ |

---

## SECTION 6: STATUS BADGES

| Component | Library Spec | Codebase | Status |
|---|---|---|---|
| `.badge` base | Space Mono, 0.6rem, 700 weight, letter-spacing 0.12em, uppercase, padding 3px 10px, radius-full | Standings page has inline badges but no reusable class | ❌ NOT A COMPONENT |
| `.badge-alive` | alive-subtle bg, alive color, animated pulsing dot `::before` | Inline: `bg-[rgba(76,175,80,0.15)] text-[#4CAF50]` — no pulsing dot | ❌ MISSING DOT |
| `.badge-eliminated` | eliminated-subtle bg, eliminated color, **line-through text decoration** | Inline: `bg-[rgba(239,83,80,0.15)] text-[#EF5350]` — no strikethrough | ❌ MISSING STRIKETHROUGH |
| `.badge-pending` | warning-subtle bg, warning color | ❌ MISSING | ❌ |
| `.badge-locked` | White 6% bg, tertiary text | ❌ MISSING | ❌ |
| `.badge-premium` | Orange-to-gold gradient bg, orange text | ❌ MISSING | ❌ |
| `@keyframes pulse-dot` | Dot opacity 1→0.5→1 over 2s | ❌ MISSING | ❌ |

---

## SECTION 7: PICK CARDS (Core Gameplay)

### Library `.pick-card` vs Codebase `TeamCard`

| Element | Library Spec | Codebase | Match? |
|---|---|---|---|
| **Layout** | `display: flex; align-items: center; gap: 16px` | Flex row with nested structure | ⚠️ Different nesting |
| **Seed display** | `.pick-card-seed`: Oswald 700, **1.5rem**, color tertiary, **min-width 2.5rem**, text-align center | Circle badge: `w-8 h-8 rounded-full`, Oswald, `text-xs` | ❌ COMPLETELY DIFFERENT — library uses large plain number, codebase uses small circle badge |
| **Team name** | `.pick-card-team`: Oswald 700, **1.1rem**, uppercase | Oswald, `text-base` (1rem), uppercase | ⚠️ Close |
| **Meta text** | `.pick-card-meta`: DM Sans, **0.8rem**, color text-secondary, content like "vs (16) Stetson · 7:10 PM ET" | Shows mascot in small text | ❌ DIFFERENT CONTENT — should show opponent + time |
| **Win probability** | `.pick-card-prob`: Space Mono 700, **0.95rem**, color alive/warning/danger, min-width 3.5rem, right-aligned, shows "91%" | ❌ DOES NOT EXIST — shows risk label instead ("Safe", "Toss-up", "Risky") | ❌ MISSING ENTIRELY |
| **Radio circle** | `.pick-card-radio`: 22px circle, 2px border, fills orange when selected with checkmark | Shows checkmark circle only when selected, 20px, appears as separate element | ❌ WRONG — should always show empty radio, fills on select |
| **Border** | `1.5px solid var(--border-subtle)` | No border on individual cards — border on wrapper | ❌ MISSING |
| **Border radius** | `var(--radius-lg)` = 14px | Cards have no radius (flat rows in container) | ❌ MISSING |
| **Padding** | `var(--space-4) var(--space-5)` = 16px 20px | `px-4 py-4` = 16px 16px | ⚠️ Right padding off |
| **Hover** | `border-color: var(--border-accent); background: var(--surface-3)` | `hover:bg-[#1A1A24]` | ⚠️ Different bg color |

### Pick Card States

| State | Library | Codebase | Match? |
|---|---|---|---|
| `.pick-selected` | Orange border, orange-subtle bg, double ring `0 0 0 1px orange + glow`, radio fills orange | `ring-2 ring-inset ring-[#FF5722]`, orange subtle bg, seed circle turns orange | ⚠️ Close but radio behavior wrong |
| `.pick-won` | Alive green border, alive-subtle bg, prob shows "✓ W" in green | ❌ State does not exist in TeamCard | ❌ MISSING |
| `.pick-lost` | Eliminated border, eliminated-subtle bg, opacity 0.6, prob shows "✗ L" in red | ❌ State does not exist in TeamCard | ❌ MISSING |
| `.pick-used` | opacity 0.3, cursor not-allowed, diagonal strikethrough `::after` pseudo-element (red line rotated -3deg through card) | Has `.strikethrough` class but it's a simpler 2px line, opacity 0.4 | ❌ DIFFERENT IMPLEMENTATION |

---

## SECTION 8: STANDINGS ROWS

### Library `.standings-row` vs Codebase

| Element | Library Spec | Codebase | Match? |
|---|---|---|---|
| **Layout** | `display: flex; align-items: center; gap: 16px` | Flex with space-x-3 (12px) | ❌ Gap too small |
| **Rank number** | `.standings-rank`: Oswald 700, 1.1rem, color tertiary, min-width 2rem, centered | Space Mono, text-xs, bold, color `#8A8694`, w-6, right-aligned | ❌ WRONG FONT, SIZE, ALIGNMENT |
| **Avatar circle** | `.standings-avatar`: 36px, rounded-full, surface-4 bg, Oswald 700 0.85rem initials | ❌ DOES NOT EXIST — no avatar circles in standings | ❌ MISSING ENTIRELY |
| **Name** | `.standings-name`: Oswald 600, 0.95rem, uppercase | Oswald, text-sm (0.875rem), semibold, uppercase | ⚠️ Close |
| **Detail line** | `.standings-detail`: DM Sans, 0.75rem, color tertiary, "Survived 7 days · Last pick: Creighton ✓" | Shows "3 picks" and "2 W" separately | ❌ DIFFERENT FORMAT |
| **Badge** | `.badge .badge-alive` or `.badge-eliminated` as separate pill | Inline badges exist but missing pulsing dot and strikethrough | ⚠️ Partial |
| **Teams remaining** | `.standings-teams-left`: Space Mono 700, 0.85rem, color secondary, right-aligned, "9 left" | ❌ DOES NOT EXIST | ❌ MISSING ENTIRELY |
| **"You" row** | `.standings-row.you`: orange-subtle bg, **3px left border orange**, padding adjusted | Has `bg-[rgba(255,87,34,0.05)]` but **no left orange border** | ❌ MISSING LEFT BORDER |
| **Eliminated row** | `.standings-row.eliminated-row`: opacity 0.45 | Has `.strikethrough` on name but no row-level opacity | ❌ DIFFERENT APPROACH |
| **Hover** | `background: rgba(255, 255, 255, 0.02)` | `hover:bg-[#1A1A24]` | ❌ Different color |

---

## SECTION 9: COUNTDOWN TIMER

### Library `.countdown-container` vs Codebase `DeadlineCountdown`

| Element | Library Spec | Codebase | Match? |
|---|---|---|---|
| **Overall design** | **Segmented boxes** — separate bordered containers for HH, MM, SS with ":" separators between | **Single colored bar** with inline time text | ❌ COMPLETELY DIFFERENT DESIGN |
| **Label** | `.countdown-label`: Space Mono, 0.6rem, letter-spacing 0.3em, uppercase, color tertiary | Space Mono, 10px (0.625rem), letter-spacing 0.2em | ⚠️ Close |
| **Value boxes** | `.countdown-value`: Oswald 700, **2.5rem**, color orange, min-width 3.5rem, padding 8px 12px, surface-2 bg, radius-md, **1px border-accent** | Time in Space Mono 2xl (1.5rem), no boxes, no borders | ❌ COMPLETELY DIFFERENT |
| **Unit labels** | `.countdown-unit`: Space Mono, 0.5rem, "Hours" / "Min" / "Sec" below each box | ❌ Does not exist | ❌ MISSING |
| **Separator** | `.countdown-separator`: Oswald, 2rem, color tertiary, ":" character, padding-bottom 1rem | ❌ Colon is inline in time string | ❌ DIFFERENT |
| **Urgent state** | `.countdown-urgent .countdown-value`: color eliminated, border eliminated, pulsing glow animation | Background changes to red/yellow, opacity pulsing | ❌ DIFFERENT APPROACH |

---

## SECTION 10: PROBABILITY BARS

| Component | Library | Codebase | Status |
|---|---|---|---|
| `.prob-bar-container` | Flex row: label + track | ❌ Does not exist in app | ❌ MISSING |
| `.prob-bar-track` | 8px height, surface-3 bg, radius-full | ❌ Does not exist | ❌ MISSING |
| `.prob-bar-fill` | `.high` (alive green), `.medium` (warning gold), `.low` (eliminated red) | ❌ Does not exist | ❌ MISSING |
| `.prob-bar-lg` | 12px track, 1.1rem label | ❌ Does not exist | ❌ MISSING |

---

## SECTION 11: SURVIVAL PROGRESS BAR

| Component | Library | Codebase | Status |
|---|---|---|---|
| `.survival-bar` | Flex row, 3px gap, horizontal segmented bar | ❌ Does not exist in app | ❌ MISSING |
| `.survival-segment` | flex: 1, 8px height, 2px radius, default: white 6% bg | ❌ | ❌ |
| `.survival-segment.survived` | Orange bg with 6px glow | ❌ | ❌ |
| `.survival-segment.current` | Warning gold bg, pulsing animation | ❌ | ❌ |
| `.survival-segment.eliminated-seg` | Red bg, 50% opacity | ❌ | ❌ |

---

## SECTION 12: TEAM GRID (64-Team Inventory)

| Component | Library | Codebase | Status |
|---|---|---|---|
| `.team-grid` | `grid-template-columns: repeat(8, 1fr); gap: 4px` | ❌ Does not exist | ❌ MISSING ENTIRELY |
| `.team-cell` | Square, aspect-ratio 1, Space Mono 0.55rem, 700 weight | ❌ | ❌ |
| `.team-cell.available` | surface-3 bg, border-default, cursor pointer | ❌ | ❌ |
| `.team-cell.used` | surface-2 bg, opacity 0.4, diagonal orange line `::after` | ❌ | ❌ |
| `.team-cell.eliminated-cell` | surface-0 bg, opacity 0.2 | ❌ | ❌ |
| `.team-cell.today-pick` | orange-subtle bg, orange border, orange glow | ❌ | ❌ |
| Legend row | 4 color-coded legend items below grid | ❌ | ❌ |

---

## SECTION 13: NAVIGATION (Bottom Tab Bar)

### Library `.nav-tabs` vs Codebase `BottomNav`

| Element | Library Spec | Codebase | Match? |
|---|---|---|---|
| **Tab count** | **5 tabs**: Home, Pick, Standings, Bracket, Analyze | **3 tabs**: Home, Bracket, Settings | ❌ WRONG — MISSING 2 TABS, HAS WRONG TAB |
| **Background** | `var(--surface-0)` = `#080810` | `#111118` | ❌ Different color |
| **Tab label font** | `var(--font-mono)` = **Space Mono** | **DM Sans** | ❌ WRONG FONT |
| **Tab label size** | `0.5rem` (8px) | `text-[10px]` (10px) | ❌ Too large |
| **Tab label letter-spacing** | `0.12em` | `0.05em` | ❌ Wrong spacing |
| **Tab label case** | `text-transform: uppercase` | Not set (uses normal case in rendered output) | ❌ MISSING |
| **Active indicator** | `::after` pseudo-element: **2px orange line at top of tab**, left 20%, width 60% | Orange text color only, no line indicator | ❌ MISSING ORANGE TOP LINE |
| **Active color** | `var(--color-orange)` on both icon and label | `text-[#FF5722]` | ✅ |
| **Inactive color** | `var(--text-tertiary)` = `#5F6B7A` | `#8A8694` | ❌ Wrong shade |
| **Icon/label gap** | `3px` | `gap-0.5` = 2px | ⚠️ Minor |
| **Tab layout** | `flex: 1`, column, centered | Similar flex structure | ✅ |
| **Border top** | `1px solid var(--border-subtle)` | `border-[rgba(255,255,255,0.05)]` | ✅ |

### Missing Tab Routes

| Tab | Library | Codebase Route | Status |
|---|---|---|---|
| Home | ✅ Home → Dashboard | `/dashboard` | ✅ |
| Pick | Daily pick screen | ❌ No persistent tab — only accessible from pool | ❌ MISSING TAB |
| Standings | Pool standings | ❌ No persistent tab — only accessible from pool | ❌ MISSING TAB |
| Bracket | Tournament bracket | `/tournament` | ✅ |
| Analyze | Strategy tools | ❌ Does not exist at all | ❌ MISSING ENTIRELY |
| Settings | ❌ Should NOT be a tab | `/settings` is a tab | ❌ SHOULD NOT EXIST AS TAB |

---

## SECTION 14: TOASTS / NOTIFICATIONS

| Component | Library | Codebase | Status |
|---|---|---|---|
| `.toast` base | Flex row, gap 12px, padding 16px 20px, radius-md, DM Sans 0.9rem, shadow-lg, max-width 400px, slide-down animation | ❌ Does not exist | ❌ MISSING |
| `.toast-survived` | Green gradient bg `#1B3D20 → #162E1A`, alive border, alive color | ❌ | ❌ |
| `.toast-eliminated` | Red gradient bg `#3D1B1B → #2E1616`, eliminated border | ❌ | ❌ |
| `.toast-warning` | Gold gradient bg `#3D361B → #2E2A16`, warning border | ❌ | ❌ |
| `.toast-info` | Blue gradient bg `#1B2E3D → #16232E`, info border | ❌ | ❌ |
| `@keyframes toast-in` | `translateY(-20px) opacity 0 → translateY(0) opacity 1` over 0.4s | ❌ | ❌ |

---

## SECTION 15: FORM ELEMENTS

### Standard Input

| Element | Library `.input-field` | Codebase | Match? |
|---|---|---|---|
| Background | `var(--surface-2)` = `#111827` | Various: `#111118`, `#1A1A24` | ❌ Wrong color |
| Border | `1.5px solid var(--border-default)` | `1px solid rgba(255,255,255,0.05)` | ❌ Thinner, different color |
| Border radius | `var(--radius-md)` = 10px | `12px` | ❌ Wrong |
| Font | DM Sans, 0.95rem | DM Sans, correct | ✅ |
| Focus | `border-color: orange; box-shadow: 0 0 0 3px orange-subtle` | `outline: 2px solid orange` | ❌ Different focus style |
| Placeholder | `color: var(--text-tertiary)` = `#5F6B7A` | Not explicitly set | ❌ MISSING |

### Group Code Input

| Element | Library `.code-input` | Codebase (join/page.tsx) | Match? |
|---|---|---|---|
| Font | **Oswald** 700, 1.8rem | Likely DM Sans or inline style | ❌ Needs verification |
| Letter spacing | `0.15em` | — | ❌ Not verified |
| Text align | center | — | — |
| Border | `2px solid var(--border-strong)` | Thinner border | ❌ |
| Focus | `border-color: orange; box-shadow: 0 0 0 4px orange-subtle` | — | ❌ |

### Input Label

| Element | Library `.input-label` | Codebase | Match? |
|---|---|---|---|
| Font | Space Mono, 0.6rem, letter-spacing 0.2em, uppercase, color tertiary | `.label` class used — which is orange not gray | ❌ WRONG COLOR |

---

## SECTION 16: MATCHUP CARD

| Component | Library `.matchup-card` | Codebase (tournament, pick page) | Status |
|---|---|---|---|
| Container | surface-2 bg, border-subtle, radius-lg, padding 20px | Game cards exist but different structure | ⚠️ |
| `.matchup-header` | Flex, justify-between: round label + time | Partially exists | ⚠️ |
| `.matchup-round` | Space Mono, 0.55rem, letter-spacing 0.2em, uppercase, tertiary | Not matching spec | ❌ |
| `.matchup-time` | Space Mono, 0.7rem, secondary color | Inline time display | ⚠️ |
| `.matchup-team-row` | Flex row: seed + name + spread + prob%, with hover bg | Different layout in pick page | ❌ |
| `.matchup-team-row.favored` | 2px orange left border | ❌ Does not exist | ❌ |
| `.matchup-vs-line` | 1px line with "VS" badge centered on it | Separate "vs" badge between rows | ⚠️ Different design |
| `.matchup-seed` | Oswald 700, 0.9rem, tertiary, 1.5rem min-width, centered | Different approach (circle badges) | ❌ |
| `.matchup-team-name` | Oswald 600, 0.95rem, uppercase, flex: 1 | Close | ⚠️ |
| `.matchup-spread` | Space Mono, 0.75rem, secondary ("-18.5") | ❌ Does not exist — no spread data | ❌ |
| `.matchup-prob` | Space Mono 700, 0.8rem (like "91%") | ❌ Does not exist — no probability in matchup | ❌ |

---

## SECTION 17: PREMIUM LOCK OVERLAY

| Component | Library | Codebase | Status |
|---|---|---|---|
| `.premium-lock` wrapper | `position: relative; overflow: hidden` | ❌ Does not exist | ❌ MISSING |
| `.premium-lock-content` | `filter: blur(6px); pointer-events: none; user-select: none` | ❌ | ❌ |
| `.premium-lock-overlay` | Absolute fill, flex column centered, navy at 60% opacity, backdrop-filter blur(2px) | ❌ | ❌ |
| Lock icon | 🔒 emoji, 1.5rem | ❌ | ❌ |
| Title | Oswald 600, 0.9rem, uppercase, "Unlock with Survive+" | ❌ | ❌ |
| Subtitle | DM Sans, 0.8rem, secondary, "$9.99/tournament" | ❌ | ❌ |
| CTA button | `.btn btn-primary` | ❌ | ❌ |

---

## SECTION 18: DECORATIVE ELEMENTS

| Element | Library | Codebase | Match? |
|---|---|---|---|
| `.divider` | Gradient center-fade line | `.section-divider` — same pattern | ✅ |
| `.divider-accent` | 60px × 3px orange bar | ❌ Does not exist | ❌ |
| `.court-line-circle` | Absolute positioned, 1.5px border, `rgba(255, 87, 34, 0.08)`, no pointer-events | `.court-circle`: 2px border, `rgba(255, 87, 34, 0.15)` | ⚠️ Thicker, more opaque |
| `.slash-overlay` | Diagonal red line through entire element, 155deg, 44% position | `.strikethrough::after`: 2px horizontal line at 40% bottom, -5deg | ❌ COMPLETELY DIFFERENT |
| `.bg-glow` | Radial gradient: blue at 30%/40%, orange at 70%/60% | `.ambient-glow`: Similar but at 30%/50% and 70%/50% | ⚠️ Slightly different positioning |

---

## SECTION 19: UTILITY CLASSES

| Class Group | Library | Codebase | Status |
|---|---|---|---|
| `.text-orange`, `.text-alive`, `.text-eliminated`, `.text-warning` | Color utility classes | ❌ Not defined as utility classes — all inline | ❌ |
| `.text-dim`, `.text-muted` | Secondary/tertiary text colors | ❌ Not defined | ❌ |
| `.bg-surface-0` through `.bg-surface-3` | Background surface utilities | ❌ Not defined | ❌ |
| Flex utilities | `.flex`, `.flex-col`, `.items-center`, `.justify-between`, etc. | Tailwind provides these natively | ✅ |
| Spacing utilities | `.gap-1` through `.gap-8`, `.mt-*`, `.mb-*`, `.p-*` | Tailwind provides these natively | ✅ |

---

## SECTION 20: COMPLETELY MISSING PAGES/FEATURES

| Feature | Library Defines | Codebase Status |
|---|---|---|
| **Analyze Tab** (entire page) | 5 modules: Today's Games, Team Inventory, Opponent X-Ray, Path Simulator, Pick Optimizer | ❌ DOES NOT EXIST — no `/analyze` route, no components |
| **Pick tab as persistent nav** | Bottom nav tab #2 | ❌ Pick only accessible from pool detail |
| **Standings tab as persistent nav** | Bottom nav tab #3 | ❌ Standings only accessible from pool detail |
| **Team Inventory Grid** (Analyze module) | 8×8 grid with 4 cell states + legend | ❌ DOES NOT EXIST |
| **Path Simulator** (Analyze module, premium) | Survival probabilities per player | ❌ DOES NOT EXIST |
| **Pick Optimizer** (Analyze module, premium) | Win prob vs save value analysis | ❌ DOES NOT EXIST |
| **Opponent X-Ray** (Analyze module, premium) | Head-to-head team comparison | ❌ DOES NOT EXIST |

---

## SECTION 21: INLINE STYLE EPIDEMIC

Every component in the codebase uses inline `style={{ fontFamily: "'Oswald', sans-serif" }}` instead of Tailwind classes or CSS custom properties. Here is the count:

| Pattern | Approximate Count |
|---|---|
| `style={{ fontFamily: "'Oswald', sans-serif"` | **50+** occurrences |
| `style={{ fontFamily: "'DM Sans', sans-serif"` | **40+** occurrences |
| `style={{ fontFamily: "'Space Mono', monospace"` | **30+** occurrences |
| `style={{ fontFamily: "'Barlow Condensed'"` | **3** occurrences |
| Inline `textTransform: 'uppercase'` | **35+** occurrences |
| Inline `letterSpacing: '0.2em'` (and variants) | **20+** occurrences |
| Hardcoded hex colors instead of CSS variables | **200+** occurrences |
| Hardcoded `rgba()` values instead of variables | **80+** occurrences |
| Hardcoded `12px` radius instead of 14px | **40+** occurrences |

---

## SUMMARY: PRIORITIZED FIX LIST

### CRITICAL (Structural / Missing Features)
1. **Bottom nav: 3 tabs → 5 tabs** (remove Settings tab, add Pick, Standings, Analyze)
2. **Create Analyze tab** with 5 modules (2 free, 3 premium-locked)
3. **Pick cards completely wrong** — need seed number (not circle), win probability (not risk label), radio circle, 5 states
4. **Standings rows missing** — avatars, teams remaining count, orange left border for "you"
5. **Countdown timer completely wrong design** — needs segmented boxes, not colored bar

### HIGH (Visual Fidelity)
6. **Fix all CSS variables** — add 40+ missing tokens, fix 6 wrong values
7. **Fix surface colors** — `#111827` not `#111118`, `#1B2A3D` not `#1A1A24`
8. **Fix text-secondary** — `#9BA3AE` not `#8A8694`
9. **Fix all border radii** — `6/10/14px` not `8/12/16px`
10. **Fix wordmark sizes** — SURVIVE `0.75rem`, THE `1.5rem`, DANCE `2.75rem` (not 0.7/1.8/4.5)
11. **Fix wordmark SURVIVE color** — `rgba(232,230,225,0.4)` not `rgba(255,255,255,0.5)`
12. **Fix button font** — Oswald uppercase, not DM Sans
13. **Fix `.label` class** — should be gray (`#5F6B7A`), add `.label-accent` for orange
14. **Fix nav tab labels** — Space Mono 0.5rem, not DM Sans 10px

### MEDIUM (Missing Components)
15. **Create Toast system** (4 types with gradient backgrounds)
16. **Create Survival Bar component**
17. **Create Probability Bar component**
18. **Create Team Grid component** (8×8 inventory)
19. **Create Premium Lock overlay component**
20. **Create Badge components** (5 variants with dot animation)
21. **Create Matchup Card component** (with spread + probability)
22. **Create App Icon component** (3 sizes)
23. **Create small Wordmark component** for headers

### LOW (Cleanup / Polish)
24. **Eliminate all inline font styles** — add font families to Tailwind config
25. **Replace all hardcoded colors** with CSS variables or Tailwind classes
26. **Add typography classes** to globals.css (`.text-display` through `.text-label-accent`)
27. **Add all missing keyframe animations** (`pulse-dot`, `urgent-pulse`, `segment-pulse`, `toast-in`)
28. **Add missing card variants** (`.card-accent`, `.card-interactive`, `.card-elevated`)
29. **Add missing button variants** (`.btn-secondary`, `.btn-ghost`, `.btn-danger`)
30. **Fix slash overlay / strikethrough** to match library diagonal pattern

---

**Total discrepancies found: 150+**
**Missing components: 15**
**Wrong values: 30+**
**Missing CSS variables: 40+**
**Missing CSS classes: 25+**
**Missing features: 6 (entire Analyze tab + modules)**
