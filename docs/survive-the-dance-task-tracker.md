# Survive the Dance — Master Task Tracker

**Last updated:** 2026-02-07 (evening session)
**Codebase version:** MBB-Survivor-main v5

---

## Status Summary

| Metric | Count |
|--------|-------|
| ✅ Completed tasks | 15 (Tasks 1-12, 15 + multiple sub-items) |
| 🔨 Ready for Claude Code (no setup needed) | Tasks 16, 17, 18, 19, 20, 22, 23 |
| ⚙️ Requires Dillon setup first | Tasks 13, 14 (env vars + migration SQL) |
| 📋 Needs scoping discussion | Tasks 21, 24, 25 |
| 🏗️ Total remaining before launch | ~12 tasks |

---

## Completed Tasks (1-12, 15)

| # | Task | Status | What Was Done |
|---|------|--------|---------------|
| 1 | Navigation restructure (3→5 tabs) | ✅ Done | BottomNav: Home, Pick, The Field, Bracket, Analyze. Pool-scoped routes. Settings removed from nav. |
| 2 | ActivePoolContext + pool pill header | ✅ Done | `ActivePoolContext.tsx`, `useActivePool` hook, localStorage persistence, header pool pill + gear icon |
| 3 | Pick page as persistent tab | ✅ Done | Nav no longer hidden on pick page. Entry switcher for multi-entry. Inline confirmation. |
| 4 | Analyze tab (Modules 1-2) | ✅ Done | Today's Games with seed-based win probs, Team Inventory grid. Opponent inventories. |
| 5 | Dashboard pool cards redesign | ✅ Done | Card-based layout with per-entry status, deadline, CTAs. Replaced PoolDetailView flat list. |
| 6 | Pool-scoped bracket | ✅ Done | Moved from `/tournament` to `/pools/[id]/bracket`. Region tabs preserved. |
| 7 | Join flow consolidation | ✅ Done | Single `/pools/join` route. URL param `?code=` support. Pool preview before joining. |
| 8 | Multi-entry creation flow | ✅ Done | In-pool "Add Entry" from dashboard. Entry switcher on pick tab. Entry name editing. |
| 9 | Pick privacy + deadline enforcement | ✅ Done | Picks hidden before deadline. Server-side enforcement. RLS policy. |
| 10 | Visual pass — design tokens | ✅ Done | CSS variables, font classes, surface colors updated toward component library. |
| 11 | The Field (Standings rename + grid) | ✅ Done | Renamed to "The Field". Grid with seed+abbrev circles. Deadline privacy. Section headers. |
| 12 | Pool-scoped settings (unified) | ✅ Done | `/pools/[id]/settings` — creator/member adaptive. Leave pool (open only). Redirects from old routes. |
| 15 | ET timezone display | ✅ Done | `src/lib/timezone.ts` utility. All `toLocaleTimeString` replaced with `formatET`. Deadline shows lock time. |

---

## Phase 3: Backend Automation (CRITICAL — Before Tournament)

### Task 13: Deadline Automation, Round Management & Game Results
**⚙️ Requires Dillon setup: env vars + migration SQL**

| Sub-task | What | Claude Code Solo? |
|----------|------|-------------------|
| 13A | `src/lib/supabase/admin.ts` — service role client | ✅ Yes |
| 13B | `src/lib/cron-auth.ts` — cron auth helper | ✅ Yes |
| 13C | `src/app/api/cron/sync-games/route.ts` — ESPN game sync | ✅ Yes |
| 13D | `src/app/api/cron/activate-rounds/route.ts` — round activation | ✅ Yes |
| 13E | `src/app/api/cron/process-results/route.ts` — scores + eliminations | ✅ Yes |
| 13F | `src/app/api/admin/trigger-sync/route.ts` — manual admin trigger | ✅ Yes |
| 13G | `vercel.json` — cron configuration | ✅ Yes |
| 13H | `supabase/migrations/002_game_odds_columns.sql` — DB migration | ✅ Yes (create file) |

**⚠️ Before deploying, Dillon must:**
1. Run migration SQL in Supabase SQL Editor
2. Add `SUPABASE_SERVICE_ROLE_KEY` to Vercel env vars
3. Add `CRON_SECRET` to Vercel env vars (generate with `openssl rand -hex 32`)
4. Add `ODDS_API_KEY=eef96f98f903e4af4bfdeb928295dec5` to Vercel env vars
5. Decide: Vercel Pro ($20/mo for per-minute cron) OR free external cron service

**Task file:** `claude-code-task-13-automation.md` ✅ Written

---

### Task 14: The Odds API Integration
**⚙️ Requires Dillon setup: ODDS_API_KEY env var (done with Task 13)**

| Sub-task | What | Claude Code Solo? |
|----------|------|-------------------|
| 14A | `src/lib/odds.ts` — TypeScript Odds API client (server-side only) | ✅ Yes |
| 14B | `src/app/api/odds/route.ts` — server-side odds proxy | ✅ Yes |
| 14C | `src/app/api/cron/sync-odds/route.ts` — daily odds sync to DB | ✅ Yes |
| 14D | Update `src/lib/analyze.ts` — real odds fallback to seed model | ✅ Yes |
| 14E | Update pick page + analyze tab — display real probabilities | ✅ Yes |

**Task file:** Not yet written (write after Task 13 ships)

---

### Task 16: Admin Test Mode (Tournament Simulator)
**🔨 Claude Code can do this solo**

| Sub-task | What | Claude Code Solo? |
|----------|------|-------------------|
| 16A | `src/app/api/admin/test/complete-game/route.ts` — mark a game final with chosen winner | ✅ Yes |
| 16B | `src/app/api/admin/test/complete-round/route.ts` — complete all games in active round | ✅ Yes |
| 16C | `src/app/api/admin/test/reset-round/route.ts` — rewind a round (un-eliminate, clear results) | ✅ Yes |
| 16D | Test Controls UI section on settings page (creator-only, dev/staging only) | ✅ Yes |

**Purpose:** Lets you test round advancement, eliminations, and the full game flow without waiting for real ESPN data. Calls the same `process-results` logic the real cron uses.

**Task file:** Not yet written

---

## Phase 4: UX Polish & Missing Experiences

### Task 17: Elimination & Spectator Experience
**🔨 Claude Code can do this solo**

UX Audit refs: §4 Flow 3, §5 Pick Tab (eliminated state), §6 State Matrix

| What | Details |
|------|---------|
| Pick tab when eliminated | Read-only game view. Header: "You're watching from the sidelines." Your pick history timeline below. |
| Dashboard card when eliminated | 🔴 badge, "Eliminated (Round X)". "Your run: X correct picks." |
| Standings when eliminated | Your row dimmed with elimination badge. Full access to view others. |
| Analyze when eliminated | Limited modules — no pick optimizer. Team inventory still useful for spectating. |

---

### Task 18: Pre-Tournament Lobby State
**🔨 Claude Code can do this solo**

UX Audit refs: §4 Flow 4, §5 Home (pre-tournament), §6 State Matrix

| What | Details |
|------|---------|
| Dashboard pool card | "Pre-Tournament · Starts [date]" with player count |
| Pick tab pre-tournament | "Tournament starts [date]. Check back then!" |
| Standings pre-tournament | "Waiting for tournament to start. [N] players joined." Player list visible. |
| Bracket pre-tournament | Empty bracket with team names + seeds |
| Analyze pre-tournament | Seed-based preview or "Pre-tournament analysis coming soon" |

---

### Task 19: Post-Tournament & Winner Experience
**🔨 Claude Code can do this solo**

UX Audit refs: §6 State Matrix (post-tournament column)

| What | Details |
|------|---------|
| Dashboard pool card (winner) | 🏆 "You Won!" with share CTA |
| Dashboard pool card (others) | "🏆 Complete · Winner: [Name]" |
| Standings final | Locked, champion banner at top, final stats |
| Pick tab post-tournament | "Tournament complete. [View Final Bracket]" |

---

### Task 20: Network Error Handling & Toast System
**🔨 Claude Code can do this solo**

UX Audit refs: §6 (network error during pick), Pixel Audit §14

| What | Details |
|------|---------|
| Toast component | 4 types: survived (green), eliminated (red), warning (gold), info (blue). Gradient backgrounds per pixel audit. Slide-down animation. |
| Toast context/provider | `useToast()` hook. Auto-dismiss after 4s. Stack up to 3 toasts. |
| Pick submission error handling | Auto-retry once after 2s. Inline error. Pick preserved (not cleared). |
| Replace all `console.error` user-facing errors | Surface via toasts instead of silent failures |

---

### Task 21: Mid-Tournament Entry Handling
**📋 Needs scoping — rules decision required**

UX Audit refs: §4 Flow 6, §9 P2

| Decision Needed | Options |
|-----------------|---------|
| Can someone join after tournament starts? | Yes with warning / No |
| Can late joiners win? | Yes / No / Admin configurable |
| Schema change | Add `joined_round_id` to `pool_players` |

---

## Phase 5: Visual Fidelity (Component Library Alignment)

### Task 22: Design Token + Typography Overhaul
**🔨 Claude Code can do this solo — BIGGEST VISUAL IMPACT**

Pixel Audit refs: §1, §2, §19, §21

| What | Details |
|------|---------|
| Add 40+ missing CSS variables | All `--surface-*`, `--text-*`, `--border-*`, `--radius-*`, `--shadow-*`, `--space-*`, `--transition-*`, `--z-*` |
| Fix 6 wrong values | Surface-2 (`#111827`), Surface-3 (`#1B2A3D`), text-secondary (`#9BA3AE`), radii (`6/10/14px`) |
| Add all `.text-*` typography classes | `.text-display` through `.text-label-accent` (11 classes) |
| Fix `.text-label` to gray, add `.text-label-accent` for orange | Currently `.label` is orange everywhere — most labels should be gray |
| Add color utility classes | `.text-orange`, `.text-alive`, `.text-eliminated`, `.bg-surface-*` |
| Eliminate inline `style={{ fontFamily }}` epidemic | 120+ occurrences → Tailwind config + CSS classes |
| Add missing keyframe animations | `pulse-dot`, `urgent-pulse`, `segment-pulse`, `toast-in` |

---

### Task 23: Component Library Alignment — Interactive Elements
**🔨 Claude Code can do this solo**

Pixel Audit refs: §4, §5, §6, §7, §15

| What | Details |
|------|---------|
| Button variants | Fix `.btn-primary` (Oswald uppercase 600, radius-sm 6px). Add `.btn-secondary`, `.btn-ghost`, `.btn-danger` |
| Card variants | Fix `.card` base (surface-2, radius-lg 14px). Add `.card-accent`, `.card-interactive`, `.card-elevated` |
| Badge components | Fix `.badge-alive` (add pulsing dot). Fix `.badge-eliminated` (add strikethrough). Add `.badge-pending`, `.badge-locked` |
| Pick card states | Add `.pick-won` (green), `.pick-lost` (red). Fix `.pick-used` (diagonal strikethrough) |
| Form elements | Fix input bg, border thickness (1.5px), radius (10px), focus style (box-shadow) |

---

### Task 24: Countdown Timer Redesign
**📋 Cosmetic — current timer works fine, this is a visual upgrade**

Pixel Audit ref: §9 — Segmented boxes with HH:MM:SS instead of colored bar

---

### Task 25: Analyze Tab — Advanced Modules (3-5)
**📋 Needs premium gating decision**

| Module | What | Decision Needed |
|--------|------|-----------------|
| Module 3: Opponent X-Ray | Team availability comparison matrix | Free or premium? |
| Module 4: Path Simulator | Monte Carlo survival projection | Free or premium? |
| Module 5: Pick Optimizer | Best/smart/contrarian recommendations | Free or premium? |

---

## Nice-to-Have Backlog

| # | Item | Audit Ref | Claude Code Solo? |
|---|------|-----------|-------------------|
| N3 | Pin "Your entries" at top of Standings | UX §5 | ✅ Yes |
| N5 | Bracket pool overlay (who picked what) | UX §5 | ✅ Yes |
| N6 | Highlight used/available teams on bracket | UX §5 | ✅ Yes |
| N7 | Deadline urgency indicator (red dot on Pick tab) | UX §6 | ✅ Yes |
| N8 | Smart sort on pick screen (favorites first, by game time) | UX §4 | ✅ Yes |
| N9 | Post-game result states on pick cards (W/L with scores) | Pixel §7 | ✅ Yes |
| N10 | Survival progress bar component | Pixel §11 | ✅ Yes |
| N11 | Premium lock overlay component | Pixel §17 | ✅ Yes |
| N13 | Wordmark fix (sizes + SURVIVE color) | Pixel §3 | ✅ Yes |
| N14 | Small wordmark for headers | Pixel §3 | ✅ Yes |
| N15 | App icon component (3 sizes) | Pixel §3 | ✅ Yes |
| N16 | Matchup card component (spread + probability) | Pixel §16 | ✅ Yes |
| N17 | Probability bar component | Pixel §10 | ✅ Yes |
| N18 | Shadow picks for eliminated users | UX §4 Flow 3 | ✅ Yes |
| N19 | Join link preserves code through signup | UX §4 Flow 1 | ✅ Yes |
| N20 | Standings: avatar circles, teams-remaining, orange left border | Pixel §8 | ✅ Yes |
| N21 | Nav: active top orange line, Space Mono 0.5rem labels | Pixel §13 | ✅ Yes |

---

## Recommended Execution Order

### 🔴 CRITICAL PATH (must ship before tournament)

1. **Task 13** — Backend automation *(Dillon: env vars + migration → Claude Code: all routes)*
2. **Task 16** — Admin test mode *(Claude Code solo — test round advancement)*
3. **Task 14** — Odds API integration *(Claude Code solo after env vars set)*

### 🟡 LAUNCH QUALITY (should ship before tournament)

4. **Task 22** — Design token overhaul *(Claude Code solo — biggest visual bang)*
5. **Task 17** — Elimination experience *(Claude Code solo)*
6. **Task 18** — Pre-tournament lobby *(Claude Code solo)*
7. **Task 20** — Toast system + error handling *(Claude Code solo)*
8. **Task 23** — Component library alignment *(Claude Code solo)*

### 🟢 POLISH (nice for launch)

9. **Task 19** — Post-tournament winner experience *(Claude Code solo)*
10. **N3, N7, N8, N9** — Standings pin, deadline badge, smart sort, post-game states
11. **Task 24** — Countdown timer redesign
12. **N13, N20, N21** — Wordmark fix, standings pixels, nav pixels

### 🔵 POST-LAUNCH

13. **Task 25** — Analyze advanced modules (needs premium decision)
14. **Task 21** — Mid-tournament entry handling (needs rules decision)
15. **N5, N6, N18** — Bracket overlay, shadow picks

---

## UX Audit P0-P1 Scorecard

| # | P0/P1 Item | Status |
|---|-----------|--------|
| P0-1 | 5-tab pool-scoped navigation | ✅ Done |
| P0-2 | ActivePoolContext | ✅ Done |
| P0-3 | Pick page shows nav | ✅ Done |
| P0-4 | Analyze tab (Modules 1-2) | ✅ Done |
| P0-5 | Inline pick confirmation | ✅ Done |
| P0-6 | Pool-scoped bracket | ✅ Done |
| P0-7 | Consolidated join flow | ✅ Done |
| P0-8 | Home pool cards | ✅ Done |
| P1-9 | Entry switcher | ✅ Done |
| P1-10 | Admin panel enhancements | ✅ Done |
| P1-11 | Deadline urgency in nav | ⬜ N7 |
| P1-12 | Elimination spectator mode | ⬜ Task 17 |
| P1-13 | Pre-tournament lobby | ⬜ Task 18 |
| P1-14 | Network error handling | ⬜ Task 20 |
| P1-15 | Pool pill in header | ✅ Done |
| **Score** | **11/15 complete** | **73%** |

---

## Task Files Index

| Task | File | Status |
|------|------|--------|
| Task 11 | `claude-code-task-11-the-field.md` | ✅ Shipped |
| Task 12 | `claude-code-task-12-pool-settings.md` | ✅ Shipped |
| Task 13 | `claude-code-task-13-automation.md` | ✅ Written, ready |
| Task 14 | — | Not yet written |
| Task 15 | `claude-code-task-15-et-timezone.md` | ✅ Shipped |
| Task 16 | — | Not yet written (admin test mode) |
| Tasks 17-25 | — | Not yet written |
