# Task 10: Visual Pass — Design Token & Component Alignment

This task brings the codebase into alignment with the Component Library (`std-component-library.html`). It covers design tokens, typography classes, component restyling, and visual polish. This is the largest visual task.

**Rule: Do NOT change any functionality, data fetching, or routing. This is purely visual/CSS.**

## Files to Read Before Writing Code

Read ALL of these:
- `src/app/globals.css` — the main file being heavily modified
- `src/components/BottomNav.tsx` — nav styling updates
- `src/components/Header.tsx` — header styling updates
- `src/app/page.tsx` — login page wordmark fixes
- `src/app/pools/[id]/pick/page.tsx` — TeamCard / pick card restyling
- `src/app/pools/[id]/standings/page.tsx` — standings row restyling

Then skim these for inline style patterns:
- `src/app/dashboard/page.tsx`
- `src/app/pools/[id]/analyze/page.tsx`
- `src/app/settings/page.tsx`
- `src/app/pools/join/page.tsx`
- `src/app/pools/create/page.tsx`

---

## Part 1: Design Tokens — Fix `globals.css`

### 1A. Replace `:root` and `@theme` blocks

Replace ALL CSS custom properties with the correct values from the component library. The current values have 6 wrong colors, wrong radii, and 40+ missing tokens.

**Replace the entire `@theme` block and `:root` block with:**

```css
@theme {
  /* Primary */
  --color-orange: #FF5722;
  --color-orange-hover: #FF6D3A;
  --color-orange-active: #E64A19;
  --color-orange-subtle: rgba(255, 87, 34, 0.08);
  --color-orange-glow: rgba(255, 87, 34, 0.25);
  --color-navy: #0D1B2A;
  --color-navy-light: #122640;
  --color-court-white: #E8E6E1;
  --color-white-pure: #FFFFFF;
  --color-deep-blue: #1B3A5C;

  /* Surfaces */
  --surface-0: #080810;
  --surface-1: #0D1B2A;
  --surface-2: #111827;
  --surface-3: #1B2A3D;
  --surface-4: #243447;
  --surface-5: #2D3E52;

  /* Status */
  --color-alive: #4CAF50;
  --color-alive-subtle: rgba(76, 175, 80, 0.12);
  --color-alive-glow: rgba(76, 175, 80, 0.3);
  --color-eliminated: #EF5350;
  --color-eliminated-subtle: rgba(239, 83, 80, 0.12);
  --color-eliminated-glow: rgba(239, 83, 80, 0.3);
  --color-warning: #FFB300;
  --color-warning-subtle: rgba(255, 179, 0, 0.12);
  --color-info: #42A5F5;
  --color-info-subtle: rgba(66, 165, 245, 0.12);

  /* Text */
  --text-primary: #E8E6E1;
  --text-secondary: #9BA3AE;
  --text-tertiary: #5F6B7A;
  --text-disabled: #3D4654;
  --text-inverse: #0D1B2A;

  /* Borders */
  --border-subtle: rgba(255, 255, 255, 0.05);
  --border-default: rgba(255, 255, 255, 0.08);
  --border-strong: rgba(255, 255, 255, 0.12);
  --border-accent: rgba(255, 87, 34, 0.3);
  --border-accent-strong: rgba(255, 87, 34, 0.6);

  /* Fonts */
  --font-display: 'Oswald', sans-serif;
  --font-display-condensed: 'Barlow Condensed', sans-serif;
  --font-body: 'DM Sans', sans-serif;
  --font-mono: 'Space Mono', monospace;

  /* Radius */
  --radius-xs: 4px;
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;
  --radius-xl: 20px;
  --radius-full: 9999px;
  --radius-icon: 22%;

  /* Shadows */
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 8px 32px rgba(0, 0, 0, 0.5);
  --shadow-glow-orange: 0 0 20px rgba(255, 87, 34, 0.2);
  --shadow-glow-alive: 0 0 20px rgba(76, 175, 80, 0.2);
  --shadow-glow-eliminated: 0 0 20px rgba(239, 83, 80, 0.2);

  /* Transitions */
  --transition-fast: 150ms ease;
  --transition-normal: 250ms ease;
  --transition-slow: 400ms ease;

  /* Z-Index */
  --z-nav: 30;
  --z-header: 40;
  --z-modal: 50;
  --z-toast: 60;
  --z-tooltip: 70;

  /* Animations */
  --animate-glow-pulse: glow-pulse 2s ease-in-out infinite;
  --animate-slide-up: slide-up 0.3s ease-out;
  --animate-fade-in: fade-in 0.2s ease-out;
  --animate-shake: shake 0.5s ease-in-out;
  --animate-bounce-in: bounce-in 0.4s cubic-bezier(0.36, 0.07, 0.19, 0.97);
}
```

**Remove the duplicate `:root` block entirely.** The `@theme` block is sufficient. If Tailwind 4 requires `:root` for some values, keep only those that `@theme` doesn't handle, but do not duplicate.

### 1B. Add Typography Classes

Add these after the base styles section:

```css
/* ── Typography Classes ──────────────────────────────────────── */

.text-display {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: clamp(2.5rem, 7vw, 5rem);
  text-transform: uppercase;
  line-height: 0.92;
  letter-spacing: -0.02em;
  color: var(--text-primary);
}

.text-title {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: clamp(1.75rem, 4vw, 2.5rem);
  text-transform: uppercase;
  line-height: 1;
  color: var(--text-primary);
}

.text-heading {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1.35rem;
  text-transform: uppercase;
  line-height: 1.15;
  color: var(--text-primary);
}

.text-subheading {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 1.1rem;
  text-transform: uppercase;
  line-height: 1.2;
  color: var(--text-primary);
}

.text-body {
  font-family: var(--font-body);
  font-weight: 400;
  font-size: 0.95rem;
  line-height: 1.65;
  color: var(--text-secondary);
}

.text-small {
  font-family: var(--font-body);
  font-weight: 400;
  font-size: 0.85rem;
  line-height: 1.5;
  color: var(--text-secondary);
}

.text-data {
  font-family: var(--font-mono);
  font-weight: 700;
  font-size: 1rem;
  letter-spacing: 0.03em;
}

.text-data-lg {
  font-family: var(--font-mono);
  font-weight: 700;
  font-size: 1.75rem;
  letter-spacing: 0.02em;
}

.text-label {
  font-family: var(--font-mono);
  font-weight: 400;
  font-size: 0.65rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--text-tertiary);
}

.text-label-accent {
  font-family: var(--font-mono);
  font-weight: 400;
  font-size: 0.65rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--color-orange);
}
```

### 1C. Fix the existing `.label` class

**CRITICAL:** Change `.label` from orange to gray:

```css
.label {
  font-family: var(--font-mono);
  font-size: 0.65rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--text-tertiary); /* WAS: #FF5722 — WRONG. Most labels should be gray */
}
```

Then **search every file** that uses the `.label` class. For any label that SHOULD be orange (like accented section headers), change the class to `.text-label-accent` or add `text-[#FF5722]` as an override. Most labels should remain gray.

### 1D. Fix Button Base

Update `.btn-orange`:

```css
.btn-orange {
  background: var(--color-orange);
  color: var(--text-primary);
  font-family: var(--font-display);  /* WAS: font-body (DM Sans) */
  font-weight: 600;                  /* WAS: 700 */
  text-transform: uppercase;         /* WAS: missing */
  letter-spacing: 0.05em;            /* WAS: missing */
  border-radius: var(--radius-sm);   /* WAS: hardcoded 12px */
  transition: all var(--transition-fast);
}
.btn-orange:hover {
  background: var(--color-orange-active);
  box-shadow: var(--shadow-glow-orange);
}
.btn-orange:active {
  transform: scale(0.97);
}
```

Add new button variants:

```css
.btn-secondary {
  background: transparent;
  color: var(--text-secondary);
  font-family: var(--font-display);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border: 1.5px solid var(--border-default);
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
}
.btn-secondary:hover {
  border-color: var(--border-accent);
  color: var(--text-primary);
}

.btn-ghost {
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-family: var(--font-display);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  transition: color var(--transition-fast);
}
.btn-ghost:hover {
  color: var(--color-orange);
}

.btn-danger {
  background: var(--color-eliminated);
  color: var(--text-primary);
  font-family: var(--font-display);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-radius: var(--radius-sm);
}
```

### 1E. Fix Card Base

```css
.card {
  background: var(--surface-2);       /* WAS: --color-surface (#111118) */
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);    /* 14px, WAS: 12px */
  transition: border-color var(--transition-normal);
}
```

### 1F. Add Missing Keyframes

```css
@keyframes pulse-dot {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

@keyframes toast-in {
  from { transform: translateY(-20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

@keyframes segment-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}
```

### 1G. Add Badge Classes

```css
.badge {
  font-family: var(--font-mono);
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  padding: 3px 10px;
  border-radius: var(--radius-full);
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.badge-alive {
  background: var(--color-alive-subtle);
  color: var(--color-alive);
}
.badge-alive::before {
  content: '';
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-alive);
  animation: pulse-dot 2s ease-in-out infinite;
}

.badge-eliminated {
  background: var(--color-eliminated-subtle);
  color: var(--color-eliminated);
  text-decoration: line-through;
}

.badge-pending {
  background: var(--color-warning-subtle);
  color: var(--color-warning);
}

.badge-locked {
  background: rgba(255, 255, 255, 0.06);
  color: var(--text-tertiary);
}
```

### 1H. Fix Strikethrough / Used Team Overlay

```css
.strikethrough::after {
  content: '';
  position: absolute;
  top: 44%;
  left: -2%;
  width: 104%;
  height: 2px;
  background: rgba(239, 83, 80, 0.4);
  transform: rotate(-3deg);
  pointer-events: none;
}
```

### 1I. Fix Decorative Elements

```css
.court-line-circle {
  border: 1.5px solid rgba(255, 87, 34, 0.08);  /* WAS: 2px, 0.15 */
  border-radius: 50%;
  pointer-events: none;
}

.divider-accent {
  width: 60px;
  height: 3px;
  background: var(--color-orange);
  border-radius: var(--radius-full);
}
```

---

## Part 2: BottomNav Restyling

Update `src/components/BottomNav.tsx`:

### 2A. Background color
Change nav background from `bg-[#111118]` to `bg-[#080810]` (surface-0).

### 2B. Tab labels
Change all tab label styling from:
```
style={{ fontFamily: "'DM Sans', sans-serif", letterSpacing: '0.05em' }}
className="text-[10px] font-semibold"
```
To:
```
style={{ fontFamily: "'Space Mono', monospace", letterSpacing: '0.12em', textTransform: 'uppercase' }}
className="text-[8px] font-semibold"
```

### 2C. Inactive color
Change inactive tab color from `text-[#8A8694]` to `text-[#5F6B7A]` (text-tertiary).

### 2D. Active indicator — orange top line
Add a 2px orange line at the top of the active tab. Use a conditional `::after` pseudo-element or a div:
```tsx
{tab.match && (
  <span className="absolute top-0 left-[20%] w-[60%] h-[2px] bg-[#FF5722]" />
)}
```
Make the tab container `relative` for this to work.

### 2E. Icon/label gap
Change from `gap-0.5` (2px) to `gap-[3px]`.

---

## Part 3: Login Page Wordmark Fix

Update `src/app/page.tsx`:

Fix the full-size wordmark values:

| Element | Current | Should Be |
|---------|---------|-----------|
| SURVIVE font-size | `0.7rem` | `0.75rem` |
| SURVIVE color | `rgba(255, 255, 255, 0.5)` | `rgba(232, 230, 225, 0.4)` |
| SURVIVE line-height | not set | `1` |
| THE font-size | `1.8rem` | `1.5rem` |
| THE line-height | `leading-none` (1.0) | `1.1` |
| DANCE font-size | `4.5rem` | `2.75rem` |
| DANCE line-height | `leading-none` (1.0) | `0.85` |

Also wrap the wordmark elements in a flexbox column container instead of sequential `<p>` tags:
```tsx
<div className="inline-flex flex-col items-center" style={{ gap: 0 }}>
  <span ...>SURVIVE</span>
  <span ...>THE</span>
  <span ...>DANCE</span>
</div>
```

---

## Part 4: Pick Card Restyling

Update the `TeamCard` component in `src/app/pools/[id]/pick/page.tsx`:

### 4A. Seed display — remove circle badge, use plain number
Change from: `w-8 h-8 rounded-full bg-[rgba(255,255,255,0.08)]` circle with tiny text
To: Oswald 700, `1.5rem`, color `text-tertiary` (#5F6B7A), `min-width: 2.5rem`, text-align center, no background, no border-radius.

When selected: seed text turns orange (`#FF5722`), no background change.

### 4B. Meta text — show opponent + game time instead of mascot
Change from: `{team.mascot}`
To: `vs ({team.opponent.seed}) {team.opponent.abbreviation} · {formatted game time}`

Format game time as: `7:10 PM ET` using `new Date(team.game_datetime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true, timeZoneName: 'short' })`

### 4C. Win probability — replace risk label with percentage
Remove the `riskColors` and `riskLabels` objects entirely.

Import `getSeedWinProbability` from `@/lib/analyze`:
```typescript
import { getSeedWinProbability } from '@/lib/analyze';
```

Replace the risk badge with a win probability number:
```tsx
<span
  className={`text-sm font-bold min-w-[3.5rem] text-right ${
    prob >= 0.8 ? 'text-[#4CAF50]' :
    prob >= 0.6 ? 'text-[#FFB300]' :
    'text-[#EF5350]'
  }`}
  style={{ fontFamily: "'Space Mono', monospace" }}
>
  {Math.round(prob * 100)}%
</span>
```

Where `prob = getSeedWinProbability(team.seed, team.opponent.seed)`.

### 4D. Radio circle — always visible
Add an empty circle on the right side of every card that fills orange when selected:
```tsx
<span className={`w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
  isSelected
    ? 'border-[#FF5722] bg-[#FF5722]'
    : 'border-[rgba(255,255,255,0.12)] bg-transparent'
}`}>
  {isSelected && (
    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
    </svg>
  )}
</span>
```

### 4E. Card border + radius
Add `border: 1.5px solid var(--border-subtle)` and `border-radius: 14px` to each individual card. Remove the container-level grouping border if present.

### 4F. Card layout
Each pick card should be: `flex items-center gap-4 px-4 py-4 pr-5` (16px padding, 20px right padding for the radio circle).

---

## Part 5: Standings Row Restyling

Update player rows in `src/app/pools/[id]/standings/page.tsx`:

### 5A. Rank number
Change from: Space Mono text-xs → Oswald 700, `1.1rem`, color `#5F6B7A`, `min-width: 2rem`, text-center.

### 5B. Avatar circle (NEW)
Add an avatar circle before the player name: 36px circle, `bg-[#243447]` (surface-4), Oswald 700 0.85rem, showing player's first initial. Color: `text-primary`.

### 5C. "You" row — add orange left border
For the user's own row, add `border-l-[3px] border-l-[#FF5722]` in addition to the existing orange-subtle background.

### 5D. Eliminated row opacity
For eliminated players, add `opacity-[0.45]` to the entire row.

### 5E. Detail line format
Change from: "3 picks · 2x" to: "Survived X days · Last pick: Team ✓/✗"

### 5F. Gap between elements
Change from `space-x-3` (12px gap) to `gap-4` (16px gap).

---

## Part 6: Global Inline Style Cleanup

This is the most tedious part. Search and replace inline font styles across ALL files.

### 6A. Add Tailwind font utilities to `tailwind.config.ts` (or the Tailwind 4 equivalent)

If using Tailwind 4 with `@theme`, the font families are already available via CSS variables. But ensure these utility classes work:
- `font-display` → Oswald
- `font-body` → DM Sans
- `font-mono` → Space Mono
- `font-display-condensed` → Barlow Condensed

### 6B. Replace inline styles across all files

Do a project-wide search and replace for these patterns:

| Find | Replace With |
|------|-------------|
| `style={{ fontFamily: "'Oswald', sans-serif" }}` | `className="font-display"` (and remove the style prop) |
| `style={{ fontFamily: "'DM Sans', sans-serif" }}` | `className="font-body"` (or remove entirely since body is the default font) |
| `style={{ fontFamily: "'Space Mono', monospace" }}` | `className="font-mono"` |
| `style={{ fontFamily: "'Barlow Condensed', sans-serif" ... }}` | keep as inline for now (only 3 occurrences) |

**Where style props contain BOTH fontFamily AND other properties** (like `textTransform`, `letterSpacing`), extract the fontFamily to a className and keep the remaining properties in the style prop. Example:

```tsx
// Before:
style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}
// After (if uppercase is part of the typography class):
className="font-display uppercase"
// Or (if other props remain):
className="font-display" style={{ letterSpacing: '0.15em' }}
```

### 6C. Replace hardcoded colors with CSS variables

Do a project-wide replacement for the most common hardcoded values:

| Find (hardcoded) | Replace (variable) |
|---|---|
| `#111118` (as card bg) | `var(--surface-2)` or change to `#111827` |
| `#1A1A24` (as elevated bg) | `var(--surface-3)` or change to `#1B2A3D` |
| `#8A8694` (as secondary text) | `var(--text-secondary)` or change to `#9BA3AE` |
| `bg-[#111118]` | `bg-[#111827]` |
| `bg-[#1A1A24]` | `bg-[#1B2A3D]` |
| `text-[#8A8694]` | `text-[#9BA3AE]` |
| `rounded-[12px]` (on cards/buttons) | `rounded-[14px]` (for cards, radius-lg) or `rounded-[6px]` (for buttons, radius-sm) |
| `rounded-[8px]` (on small elements) | `rounded-[6px]` |
| `rounded-[16px]` | `rounded-[14px]` |

**Important:** Not every `rounded-[12px]` should become the same value. Cards use `radius-lg` (14px). Buttons use `radius-sm` (6px). Small elements use `radius-xs` (4px). Judge by context.

### 6D. Replace hardcoded rgba values

| Find | Replace |
|---|---|
| `rgba(255,87,34,0.08)` | Use variable `var(--color-orange-subtle)` or keep inline |
| `rgba(76,175,80,0.15)` | `rgba(76,175,80,0.12)` (match library's subtle value) |
| `rgba(239,83,80,0.15)` | `rgba(239,83,80,0.12)` (match library's subtle value) |
| `rgba(255,179,0,0.15)` | `rgba(255,179,0,0.12)` |
| `rgba(255,255,255,0.05)` | Keep as-is (this is border-subtle) |
| `rgba(255,255,255,0.08)` | Keep as-is (this is border-default) |

---

## Audit Cross-Reference Checklist

| Pixel Audit Section | Requirement | Where Addressed |
|---|---|---|
| §1 CSS Properties | Add 40+ missing tokens, fix 6 wrong values | Part 1A |
| §1 Wrong Values | Surface colors, text-secondary, radii | Part 1A + Part 6C |
| §2 Typography | 11 missing typography classes | Part 1B |
| §2 .label class | Gray not orange, add .text-label-accent | Part 1C |
| §3 Wordmark Full | Fix SURVIVE/THE/DANCE sizes and colors | Part 3 |
| §3 Wordmark Small | Already built in Task 3 Header | ✅ Already done |
| §4 Buttons | Wrong font, missing uppercase, wrong radius | Part 1D |
| §4 Button Variants | Add secondary, ghost, danger | Part 1D |
| §5 Cards | Wrong bg, wrong radius | Part 1E + Part 6C |
| §6 Status Badges | Missing badge component classes | Part 1G |
| §7 Pick Cards | Seed circle→number, missing win prob, radio | Part 4 |
| §8 Standings Rows | Wrong font/size/gap, missing avatar, missing left border | Part 5 |
| §9 Countdown | Completely different design | DEFERRED — separate task |
| §10 Probability Bars | Missing | Already built in Task 9 Analyze |
| §11 Survival Bar | Missing | DEFERRED — Phase 3 |
| §12 Team Grid | Missing | Already built in Task 9 Analyze |
| §13 Navigation | Wrong bg, font, size, spacing, missing active line | Part 2 |
| §14 Toasts | Missing toast system | DEFERRED — Task 16 |
| §15 Form Elements | Wrong bg, border, radius, focus | Part 6C covers most |
| §16 Matchup Card | Different structure | DEFERRED — not critical |
| §17 Premium Lock | Missing | DEFERRED — monetization task |
| §18 Decorative | Court lines, strikethrough fixes | Part 1H, 1I |
| §19 Utility Classes | Missing color utilities | Part 1A tokens provide vars |
| §20 Missing Features | Nav tabs, Analyze tab | ✅ Already done (Tasks 2, 9) |
| §21 Inline Styles | 200+ hardcoded values | Part 6 |
| UX Audit §5 Standings | "You" row orange left border | Part 5C |
| UX Audit §5 Standings | Eliminated row opacity | Part 5D |
| UX Audit Tracker | Deadline urgency red dot on Pick tab | DEFERRED — Task 11+ |
| UX Audit Tracker | Pin "Your entries" at top of Standings | DEFERRED — Task 11+ |

### Items Intentionally Deferred

These are in the pixel audit but NOT addressed in this task because they require new functionality or are lower priority:

1. **Countdown timer redesign** (segmented boxes) — separate small task, the current bar works fine
2. **Toast notification system** — needs a React context/provider, not just CSS
3. **Survival progress bar component** — Phase 3 polish
4. **Premium lock overlay** — monetization phase
5. **Matchup card component** — the bracket page has its own card style that works
6. **App Icon component** — only needed for marketing/PWA, not in-app
7. **Form element restyling** — low visual impact, defer to polish phase

---

## Files to Modify

1. `src/app/globals.css` — massive update (Part 1)
2. `src/components/BottomNav.tsx` — nav restyling (Part 2)
3. `src/app/page.tsx` — wordmark fix (Part 3)
4. `src/app/pools/[id]/pick/page.tsx` — TeamCard restyling (Part 4)
5. `src/app/pools/[id]/standings/page.tsx` — standings rows (Part 5)
6. ALL `.tsx` files — inline style cleanup (Part 6)

## What NOT to Do
- Don't change any routing, data fetching, or business logic
- Don't rename components or files
- Don't delete any components
- Don't change the Analyze tab layout (it was just built in Task 9)
- Don't build the countdown timer redesign (defer)
- Don't build the toast system (defer)
- Don't modify any Supabase queries or types
