# Survive the Dance — UX & Flow Architecture Audit

**Companion to:** Pixel-Level Visual Audit (survive-the-dance-pixel-audit.md)
**Purpose:** Every flow, route, state, edge case, and architectural decision — resolved and documented so Claude Code can build the complete, correct app.

---

## 1. Executive Summary

### Top 5 Critical UX Issues

1. **Navigation is structurally broken.** The app has 3 bottom tabs (Home, Bracket, Settings) but needs 5 pool-scoped tabs (Home, Pick, Standings, Bracket, Analyze). The Pick tab is *hidden from the nav* and only accessible via a CTA button — the single most important interaction in the app requires navigating away from the nav bar. This violates the 15-second pick principle.

2. **No pool context propagation.** Tapping "Home" in the nav goes to `/dashboard`. Tapping "Bracket" goes to `/tournament` (a global page, not pool-scoped). The Pick and Standings pages exist at `/pools/[id]/pick` and `/pools/[id]/standings` but aren't linked from the bottom nav at all. There is no concept of an "active pool" that flows through the tab bar.

3. **The Analyze tab doesn't exist.** The competitive differentiator described in the product spec — team inventory, opponent x-ray, path simulator, pick optimizer — has zero code, zero routes, zero components. Not even a placeholder.

4. **The pick flow is a dead end.** The pick page (`/pools/[id]/pick`) explicitly *hides the bottom nav* (`shouldHideNav` returns true for pick routes). After submitting a pick, the user has a back button but no persistent navigation. The most frequent interaction in the app leaves users stranded.

5. **Multi-entry UX is fragile.** The join flow creates one entry. Adding subsequent entries requires re-visiting `/pools/join` and re-entering the pool code. There's no in-pool "add entry" flow, no entry switcher on the pick screen, and the standings page doesn't distinguish your Entry 1 from Entry 2.

### Top 5 UX Strengths

1. **Pick validation is solid.** Server-side deadline enforcement, team-already-used checking, elimination gating, and team-is-playing-today validation are all implemented correctly in `lib/picks.ts`. The validation layer is production-quality.

2. **Pool creation → share flow is clean.** Creating a pool produces a join code, a share button (using Web Share API with clipboard fallback), and a clear next step. This is the smoothest flow in the app.

3. **Standings data model is rich.** The `StandingsPlayer` type includes round-by-round results, survival streaks, longest streaks, and elimination metadata. The data is there; it just needs better presentation.

4. **Real-time refresh pattern exists.** `usePoolDetail` polls every 30 seconds. The countdown timer updates every second. The infrastructure for live-feeling updates is in place.

5. **The pick card already handles urgency well.** The countdown component changes color based on time remaining (green → amber → red → urgent pulse). This is smart UX that should be preserved and extended to the nav bar.

---

## 2. Design Question Resolutions

### Question 1: Home Page & Multi-Pool Navigation

**Recommendation: Home is the pool switcher. Tabs 2–5 are pool-scoped. Add a compact pool pill in the header.**

**Architecture:**

- `/dashboard` (Home tab) shows all pools the user belongs to as cards.
- Tapping a pool card sets it as the **active pool** in client state (React context + localStorage).
- Tabs 2–5 (Pick, Standings, Bracket, Analyze) route to `/pools/[activePoolId]/pick`, `/pools/[activePoolId]/standings`, etc.
- A **pool pill** in the top-left of the header (visible on tabs 2–5) shows the active pool name. Tapping it returns to Home for switching.

**Why not a persistent pool selector dropdown in the header?**
- On mobile, a dropdown adds a tap + scroll + tap to switch — same as going Home.
- A dropdown competing with page content on a 375px screen creates visual noise.
- The pool pill is *passive* context (shows which pool you're in) not an *active* control (doesn't open a picker inline). This keeps tabs 2–5 clean.

**Single-pool user:** Home shows a single card that takes up the width, with prominent "Make Your Pick" and "View Standings" CTAs. The active pool is set automatically. The pool pill still shows in the header for consistency, but there's nothing to switch to.

**Zero-pool user (new signup):** Home shows an empty state with two equal-weight CTAs: "Create a Pool" and "Join a Pool." The bottom nav still shows all 5 tabs, but tabs 2–5 show a contextual empty state: "Join or create a pool to start picking."

**Pool card information density:**
```
┌─────────────────────────────────────────┐
│  MARCH MADNESS 2026          ● ACTIVE   │  ← pool name + status badge
│  Round of 64 · Day 2                    │  ← current round context
│                                         │
│  🟢 Entry 1: Alive · Picked            │  ← per-entry status
│  🔴 Entry 2: Eliminated (Day 3)        │
│                                         │
│  12/20 alive · Deadline in 2h 15m       │  ← pool stats + urgency
│                                         │
│  [Make Pick]  [Standings]               │  ← quick actions
└─────────────────────────────────────────┘
```

**Implementation changes required:**
- New: `ActivePoolContext` provider wrapping the app (React context)
- New: `localStorage` key `std_active_pool` (already partially exists as `std_selected_pool`)
- Change: `BottomNav.tsx` tabs 2–5 href from static paths to dynamic `/pools/${activePoolId}/...`
- Change: BottomNav renders "no pool selected" state for tabs 2–5 when no active pool

---

### Question 2: Entry Creation Timing & Multi-Entry Flow

**Recommendation: Option A — entry creation during the join flow. Additional entries created from a pool-scoped "Your Entries" section accessible from the Home pool card.**

**Rationale:**
- Option B (create entry on Pick tab) means a new user joins, lands on Home, taps Pick, and hits a "create entry first" wall. That's a redirect sandwich — join → Home → Pick → entry creation → back to Pick. Three screens before they can do the one thing they joined to do.
- Option A: join flow collects the entry name in the same form that collects the display name. User lands on Home with an active entry, taps Pick, and picks. Two screens to first pick.

**The join flow (revised):**
1. User enters pool code (or arrives via `/join/MADNESS2026`)
2. Pool lookup → shows pool card (name, players, admin name)
3. Form: Display name (pre-filled from auth), Entry name (default: "[Display Name]'s Bracket")
4. Submit → pool_player record created → redirect to Home with this pool as active → success toast

**Multi-entry creation:**
- On the Home pool card, if `max_entries_per_user > 1` and the user has fewer than max entries, show a subtle "+ Add Entry" link below their entry list.
- Tapping it opens a bottom sheet (not a full page): "Name your entry" → Submit → new pool_player record → entry appears on card.
- On the Pick tab, an **entry switcher** appears above the pick cards when the user has 2+ entries: horizontal pills showing "Entry 1 · ✅ Picked" and "Entry 2 · ⏳ Needs pick". Tapping switches which entry you're picking for.

**Current code gap:** The join page at `/pools/join/page.tsx` already handles multi-entry detection (checks `existingEntries?.length` against `maxEntries`). But there's no in-pool entry creation. The user has to re-visit `/pools/join`, re-enter the code, and the flow re-checks capacity. This needs to become a simpler in-context action.

---

### Question 3: Pool Creator Settings (Admin)

**Recommendation: Admin settings get a dedicated section within the pool context, not buried behind a secondary icon in global Settings.**

**Current problem:** Admin settings live at `/pools/[id]/admin`, but the only way to reach them is from the global `/settings` page, which lists pools you've created with "Manage" links. This means the admin has to: leave the pool context → go to Settings tab → find the pool → tap Manage → edit → go back. The admin is never "inside" their pool when managing it.

**New architecture:**

```
Home pool card (for pools you created):
  [⚙ Manage Pool]  ← visible only to creator, alongside Make Pick / Standings

Tapping opens: /pools/[id]/admin (same page, but now reachable from pool context)
```

**Admin panel structure (revised):**
```
Pool Settings
├── Pool Info (name, status badge)
├── Join Code + Share button (prominent — admin shares constantly)
├── Pool Notes (free-text, rendered as markdown-lite)
│   └── "Visible to all members" label
├── ── separator ──
├── Rules
│   ├── Include Play-in Games: toggle
│   ├── Tiebreaker: dropdown (co-champions / most picks correct / ...)
│   └── Entry Fee: $ amount (display only if > 0)
├── Capacity
│   ├── Max Players: number input
│   └── Max Entries per Player: number input
│       └── Warning if reducing below current max: "3 players already have 2 entries"
├── Access
│   ├── Public / Private toggle
│   └── Player list with [Remove] per player (admin cannot remove self)
├── ── separator ──
├── Danger Zone
│   └── [End Pool Early] (confirmation required)
```

**Pool Notes surfacing for regular players:**
- On the Home pool card: If pool notes exist, show a collapsed "Pool Notes" row with first line preview. Tapping expands.
- In Pool Info (accessible from header pool pill → "Pool Info"): Full pool notes rendered.
- NOT on every tab — that's too intrusive.

**Settings that affect active players:**
- Reducing `max_entries_per_user` below current usage → block with error message listing affected players.
- Changing pool name → immediate, no impact.
- Toggling public/private → immediate, affects future joins only.
- Reducing `max_players` below current count → block.
- These are server-side validations in `updatePoolSettings`.

---

### Question 4: Player Settings

**Recommendation: Split "Settings" into two concerns — the global Settings tab handles account-level things; pool-specific settings live in pool context.**

**Global Settings tab (tab position 5 in nav → actually, see navigation restructure below):**
```
Settings
├── Account
│   ├── Email: display + [Edit]
│   ├── Password: [Change Password]
│   └── Display Name: editable (updates across all pools)
├── Notifications
│   ├── Pick Reminders: toggle (2hr, 1hr, 30min, 15min)
│   ├── Results: toggle ("Your pick won/lost")
│   ├── Pool Activity: toggle ("New player joined")
│   └── Channel: Push / Email / Both
├── About
│   ├── App version
│   └── [Sign Out]
```

**But wait — the nav only has 5 slots.** Settings shouldn't be one of them. Here's why:

Settings is visited maybe once a month. Pick is visited every game day. The 5 bottom nav tabs must be the 5 most-used screens. Settings moves to a **gear icon in the header** (top-right), always accessible but not consuming a primary nav slot.

**The join code / invite link:**
- NOT in Settings. The share action belongs on the Home pool card (prominent share button) and in the admin panel.
- Players (non-admins) see the join code on the Home pool card with a Copy + Share button. This is already partially implemented in `PoolDetailView.tsx`'s `JoinCodeCard` component — it just needs to be moved to the Home card.

**Per-pool notification preferences (multi-pool user):**
- Inside each pool's info (accessible from header pill → "Pool Info"), add a "Notifications for this pool" section with toggles.
- Global notification settings are the default; per-pool overrides only if the user bothers to customize.
- Implementation: `notification_preferences` JSON column on `pool_players` table, falling back to user-level preferences.

---

## 3. Navigation Architecture (Complete Restructure)

### Current Navigation
```
Bottom Nav (3 tabs):
  Home (/dashboard)        — pool list + pool detail view
  Bracket (/tournament)    — global bracket, not pool-scoped
  Settings (/settings)     — account + admin pool list

Hidden routes (no nav):
  /pools/[id]/pick         — pick screen (nav explicitly hidden)
  /pools/[id]/standings    — standings (no nav link)
  /pools/[id]/admin        — admin settings (linked from /settings)
```

### Target Navigation
```
Bottom Nav (5 tabs):
  Home (/dashboard)                          — pool list, switcher
  Pick (/pools/[activePoolId]/pick)          — daily pick submission
  Standings (/pools/[activePoolId]/standings) — leaderboard
  Bracket (/pools/[activePoolId]/bracket)    — bracket view
  Analyze (/pools/[activePoolId]/analyze)    — strategic insights

Header (persistent):
  Left: Pool pill (active pool name, tap → Home)
  Right: Gear icon → /settings (account, notifications)

Accessible from context (not in nav):
  /pools/[id]/admin        — admin panel (from Home card or header)
  /pools/[id]/info         — pool info sheet (from header pill)
  /auth/login              — login (no nav shown)
  /auth/signup             — signup (no nav shown)
  /join/[code]             — join flow (no nav shown)
  /pools/create            — create flow (no nav shown)
```

### Routing Logic for Bottom Nav

```typescript
// BottomNav.tsx - target implementation
const { activePoolId } = useActivePool(); // from context

const tabs = [
  {
    label: 'Home',
    href: '/dashboard',
    icon: HomeIcon,
    match: (path) => path === '/dashboard',
  },
  {
    label: 'Pick',
    href: activePoolId ? `/pools/${activePoolId}/pick` : '/dashboard',
    icon: TargetIcon,
    match: (path) => /\/pools\/[^/]+\/pick/.test(path),
    requiresPool: true,
  },
  {
    label: 'Standings',
    href: activePoolId ? `/pools/${activePoolId}/standings` : '/dashboard',
    icon: TrophyIcon,
    match: (path) => /\/pools\/[^/]+\/standings/.test(path),
    requiresPool: true,
  },
  {
    label: 'Bracket',
    href: activePoolId ? `/pools/${activePoolId}/bracket` : '/dashboard',
    icon: BracketIcon,
    match: (path) => /\/pools\/[^/]+\/bracket/.test(path),
    requiresPool: true,
  },
  {
    label: 'Analyze',
    href: activePoolId ? `/pools/${activePoolId}/analyze` : '/dashboard',
    icon: ChartIcon,
    match: (path) => /\/pools\/[^/]+\/analyze/.test(path),
    requiresPool: true,
  },
];

// If no active pool and user taps a pool-scoped tab → redirect to Home
// If pool-scoped tab but pool doesn't exist → redirect to Home with error toast
```

### Nav Visibility Rules (Revised)

```typescript
function shouldHideNav(pathname: string): boolean {
  if (pathname === '/') return true;          // Landing page
  if (pathname.startsWith('/auth')) return true; // Login/signup
  if (pathname.startsWith('/join')) return true;  // Join flow
  if (pathname === '/pools/create') return true;  // Create flow
  return false;
}

// REMOVED: Pick page no longer hides nav. It's a primary tab.
```

### Active Pool Context Provider

```typescript
// src/contexts/ActivePoolContext.tsx
interface ActivePoolContextValue {
  activePoolId: string | null;
  activePoolName: string | null;
  setActivePool: (poolId: string, poolName: string) => void;
  clearActivePool: () => void;
}

// Persisted to localStorage as 'std_active_pool'
// Auto-set when user has exactly 1 pool
// Auto-cleared when user leaves their only pool
// Validated on mount — if stored poolId not in user's pools, clear it
```

---

## 4. Flow-by-Flow Audit

### Flow 1: First-Time User → Signup → Join Pool → First Pick

**Current flow (7 steps, 2 dead ends):**
```
1. Landing (/) → "Sign Up" button
2. /auth/signup → email, password, display name → submit
3. Redirect to /dashboard → empty state (no pools)
4. Tap "Join Pool" → /pools/join
5. Enter code, lookup pool, enter bracket name → submit
6. Redirect to /pools/[id] → pool detail view (standings-like)
7. Tap "Make Your Pick" button → /pools/[id]/pick (nav disappears)
   → Submit pick → ??? (back button only, no nav, dead end)
```

**Problems:**
- Step 6→7: The "Make Your Pick" CTA is a button *inside* the pool detail view, not in the nav. Users must discover it.
- Step 7: After picking, the user is on a page with no bottom nav. They must tap the browser/app back button or the in-page back arrow. If they came from a deep link, back may leave the app entirely.
- Step 3→4: The empty state has "Create Pool" and "Join Pool" as equal-weight options. For a user who received a join code, "Join Pool" should be primary.

**Target flow (5 steps, zero dead ends):**
```
1. Landing (/) → "Sign Up" button
   OR: /join/MADNESS2026 → sign up prompt with pool preview
2. /auth/signup → email, password, display name → submit
3. If user arrived via join link:
     Auto-redirect to join flow with pool pre-loaded → enter entry name → submit
     Redirect to /dashboard with pool active
   If user arrived organically:
     Redirect to /dashboard → empty state → tap "Join Pool" → /pools/join → flow continues
4. /dashboard → pool card visible, active pool auto-set
5. Tap "Pick" tab in bottom nav → /pools/[activePoolId]/pick → submit pick → 
   success state shown on same page, nav persists, tap "Standings" to see results
```

**Key changes:**
- Join link (`/join/MADNESS2026`) preserves the pool code through signup, so the user doesn't have to re-enter it.
- Pick tab is always in the nav; no hidden routes.
- After picking, the user stays on the Pick tab with a confirmation state and can navigate anywhere via tabs.

**Implementation requirements:**
- Store pending join code in `sessionStorage` during signup redirect
- After auth callback, check for pending join code and redirect to `/pools/join?code=PENDING_CODE`
- `/pools/join` auto-populates code field from query param

---

### Flow 2: Returning User on Game Day → Make Pick (15-Second Target)

**Current flow (too many taps):**
```
1. Open app → /dashboard
2. If multiple pools, select pool (1 tap)
3. Dashboard shows pool detail with "Make Your Pick" button
4. Tap button → navigate to /pools/[id]/pick (page load)
5. Pick screen loads teams (API call)
6. Scroll to find team, tap team card
7. Confirm pick in modal/bottom sheet
```
**Time estimate: 20–30 seconds** (2 navigation steps + API load + scroll)

**Target flow (15-second budget):**
```
1. Open app → /dashboard (0s — cached, instant)
   If 1 pool: active pool auto-set
   If multiple: pool cards show "⏳ Needs Pick" badge — tap card (1s)
2. Tap "Pick" in bottom nav (0.5s — no page navigation, tab switch)
3. Pick screen shows teams (pre-fetched during step 1 via background request) (0s load)
4. Teams sorted by game time, favorites at top, used teams at bottom grayed out
   Tap team card (1s — no scrolling for likely picks)
5. Card expands to show confirm state: "Lock in [Team]?" with [Confirm] button
   Tap confirm (0.5s)
6. Success animation, card turns green: "✓ Locked: [Team] vs [Opponent]"
   Total: ~3–5 seconds for single-pool user, ~5–7 for multi-pool
```

**Key optimizations:**
- **Pre-fetch pick data.** When the dashboard loads, also fetch `getPickableTeams` for the active pool in the background. By the time the user taps Pick, data is cached.
- **No full-page navigation.** Pick is a tab, not a separate route that requires a page load.
- **Smart sort order.** Available teams sorted by: (1) strong favorites first (low seed vs high seed), (2) game time ascending. Users most likely pick the biggest favorite — put it at the top.
- **Inline confirmation.** No modal. The card itself becomes the confirmation UI. Tap team → card expands → tap "Confirm" → done. Two taps total.
- **Change pick without friction.** After confirming, the card shows the pick with a subtle "Change" link. Tapping it returns the card to selection mode. No "are you sure?" to change — only to submit. The deadline is the real lock, not the UI.

---

### Flow 3: User Gets Eliminated → Post-Elimination Experience

**Current state:** The pick page shows "You are eliminated and cannot make picks." The standings page shows the user with an X badge. There's no dedicated elimination moment, no transition, and no spectator features.

**Target experience:**

**Elimination moment (push notification + in-app):**
```
Notification: "💀 [Team] lost 72–68. You've been eliminated from [Pool Name]."
```

**Next app open after elimination:**
```
/dashboard pool card shows:
  🔴 Eliminated (Round of 32, Day 4)
  "Your run: 3 correct picks · Best: [Team] upset win"
  [View Pool] [Share Result]
```

**Pick tab when eliminated:**
- Shows the current day's games as a read-only view (no pick UI)
- Header: "You're watching from the sidelines"
- Your pick history displayed below the games: "Your run" timeline showing each pick with W/L

**Standings tab when eliminated:**
- Full access, identical to alive players
- Your row is visually distinct (dimmed, with skull emoji or elimination badge)
- Sort: alive players first, but eliminated users can filter to "just alive" or "just eliminated"

**Spectator engagement hooks:**
- "Shadow picks" — eliminated users can make non-binding picks for fun, tracked separately. Adds "what if I'd picked differently" engagement.
- Pool chat/reactions per day (post-MVP)
- "Watch [Friend] sweat" — subscribe to notifications for a specific alive player's results

**Implementation:** Add `spectator_mode` boolean to UI state. When eliminated, Pick tab renders `SpectatorPickView` instead of `ActivePickView`. Both consume the same `getPickableTeams` data but render differently.

---

### Flow 4: Admin Creates Pool → Configures → Shares → Monitors

**Current flow:**
```
1. /pools/create → name, entry fee, max players → submit
2. Success screen with join code + share button ✓
3. Admin goes to... /settings? /dashboard? (unclear next step)
4. To manage pool: Settings tab → find pool → "Manage" → /pools/[id]/admin
5. Admin panel has pool settings form
6. To see who joined: back to dashboard → select pool → pool detail view
```

**Problems:**
- After creating, there's no pre-tournament lobby showing who has joined.
- Monitoring requires bouncing between dashboard (see players), settings (manage pool), and admin page.
- No way to see the pool from the "admin" perspective and "player" perspective in one place.

**Target flow:**
```
1. /pools/create → name, entry fee, max players, play-in toggle, notes → submit
2. Success screen with join code + share button + "Go to Pool" CTA
3. Redirect to /dashboard with new pool as active pool
4. Pool card shows: "Pre-Tournament Lobby · 0 players joined"
   As players join, card updates: "3/20 players joined" with avatar stack
5. Admin sees [⚙ Manage] button on their pool card
   Tapping → /pools/[id]/admin (full admin panel)
6. Admin panel includes: settings + player list + share tools all in one page
7. During tournament: admin uses same tabs as everyone (Pick, Standings, etc.)
   Plus the [⚙ Manage] button for admin-only actions
```

**Pre-tournament Home card for admin:**
```
┌─────────────────────────────────────────┐
│  MARCH MADNESS 2026           YOU ADMIN │
│  Pre-Tournament · Starts Mar 19         │
│                                         │
│  👤 👤 👤 +5 more · 8/20 players       │
│                                         │
│  Join Code: MADNESS                     │
│  [Copy] [Share Link] [⚙ Manage]        │
└─────────────────────────────────────────┘
```

---

### Flow 5: Multi-Pool User → Switching Between Pools

**Current state:** Dashboard has a horizontal pill switcher (`PoolSwitcher` component) that filters the pool detail view. This is functional but doesn't propagate to other tabs.

**Target behavior:**

```
User is in Pool A (active) and Pool B

1. Home tab shows two pool cards
   Pool A card: highlighted border (active indicator)
   Pool B card: standard border, "⏳ Needs Pick" badge

2. User is on Pick tab for Pool A, submits pick
3. Taps Home tab → both cards visible
   Pool A card: "✓ Pick submitted" 
   Pool B card: "⏳ Needs Pick" — tap this card

4. Tapping Pool B card:
   - Sets Pool B as active pool (context + localStorage)
   - Pool pill in header updates to "Pool B"
   - All tabs now scoped to Pool B
   - Pick tab now shows Pool B's games and teams

5. User taps Pick tab → sees Pool B's pick screen
```

**Cognitive safety:** When switching pools, the Pick tab should show a brief transition — pool name in large text for 0.5s — so the user is confident they're picking for the right pool. This prevents the nightmare scenario of submitting a pick in the wrong pool.

**Badge system for Home cards:**
- 🟢 "Alive · Picked" — all good
- ⏳ "Needs Pick · 2h left" — action required, amber urgency  
- 🔴 "Needs Pick · 12m left" — critical urgency
- ☠️ "Eliminated" — no action needed
- ✓ "Pick Submitted" — confirmed, waiting for results

---

### Flow 6: Mid-Tournament Entry

**Rule decision needed:** Can someone join a pool after the tournament starts?

**Recommendation:** Allow joining but with clear consequences.

**Behavior:**
- If pool status is `active` (tournament has started), the join flow shows a warning:
  ```
  ⚠️ This pool is already in progress (Round of 32, Day 4).
  You'll start with 0 picks and will need to pick starting from the next game day.
  You will NOT be credited for previous rounds.
  ```
- The player starts with `is_eliminated: false` but `picks_count: 0`.
- On the standings page, late joiners show "Joined Day 4" instead of showing missed rounds.
- Whether late joiners can win (vs. established players with clean records) is an admin-configurable rule: "Late entries can/cannot win the pool."

**Implementation:** Already mostly supported — `pool_players` has `joined_at` and the elimination logic only eliminates for missed picks on rounds *after* the player joined. Need to add: a `joined_round_id` column to track when they became active, and skip elimination processing for rounds before their join.

---

## 5. Screen-by-Screen Recommendations

### Home / Dashboard (`/dashboard`)

**What should be on it:**
- Pool cards (1 per pool, with per-entry status lines)
- "Create Pool" and "Join Pool" CTAs (floating action button or inline if 0-1 pools)
- Active pool highlighted (if multi-pool)
- Countdown to next deadline (on active pool card)
- Quick stats: alive count, total players

**What shouldn't be on it:**
- Full standings (that's the Standings tab)
- Full bracket (that's the Bracket tab)
- Admin settings (those are in the admin panel)
- The `PoolDetailView` component currently renders standings, join code, pick status, and player list all on the Home screen. This is too much. Home should be *cards*, not detail views.

**What's missing:**
- Pool cards (currently shows a flat detail view, not distinct cards)
- Empty state for zero pools
- Pre-tournament lobby state
- Post-tournament "Final Results" state on the card
- Entry management (add entry, rename entry)
- The share/invite action (currently buried in pool detail view)

**Current code that needs to change:** `dashboard/page.tsx` currently uses `PoolSwitcher` (horizontal pills) + `PoolDetailView` (full standings). Replace with `PoolCardList` (vertical card stack) where each card is a summary with CTAs.

---

### Pick Tab (`/pools/[id]/pick`)

**What should be on it:**
- Deadline countdown (persistent top banner)
- Entry switcher (if multi-entry, horizontal pills above games)
- Today's games grouped by matchup
- Each matchup shows both teams as pick cards side-by-side
- Clear states: available, used/burned (grayed), selected (highlighted), confirmed (locked)
- After confirming: confirmation banner + "Change Pick" option
- After deadline: read-only view of your pick, awaiting results
- After games: result shown (win/loss with score)

**Pick card structure (per team):**
```
┌──────────────────────────┐
│  (1) DUKE                │  ← seed + team name
│  Blue Devils             │  ← mascot
│  vs (16) Norfolk St.     │  ← opponent context
│                          │
│  Win Prob: 97%           │  ← from odds/seed model
│  ○ Select                │  ← radio-style selector
│  Tip: 12:15 PM ET        │  ← game time
└──────────────────────────┘

Used/burned state:
┌──────────────────────────┐
│  (3) BAYLOR              │
│  Bears                   │  ← dimmed, strikethrough
│  Used Day 1 ✓            │  ← when they were used
│  ██████████████████████  │  ← fully grayed overlay
└──────────────────────────┘
```

**Mobile layout for 16 games (32 teams):**
- Group by matchup (16 matchup cards, each showing 2 teams)
- Sort: available matchups first, then burned-out matchups
- Within available: sort by game time, then seed differential (biggest favorites first)
- Collapsible sections: "Available Picks (14)" and "Already Used (2)"
- Each matchup card is ~100px tall → 16 cards = scrollable but manageable

**Multi-entry picking:**
```
Entry pills: [Entry 1 ✓ Picked] [Entry 2 ⏳ Pick Now]

When on Entry 2:
- Different used teams (Entry 2's history, not Entry 1's)
- Different available teams
- Submission goes to Entry 2's pool_player_id
```

**Pick change flow:**
1. After confirming a pick, the confirmed team's card shows: "✓ Your Pick — [Change]"
2. Tapping "Change" un-highlights the pick and returns to selection mode.
3. User selects a different team, confirms again.
4. No "are you sure you want to change?" modal — the confirmation step is the safeguard.
5. Server-side: `submitPick` already handles this (deletes existing pick, inserts new one).

**What's missing in current code:**
- Entry switcher component
- Win probability display (data exists as `risk_level` but no percentage)
- Matchup grouping (current code shows teams in a flat list)
- Post-confirmation state on the same page (currently shows a toast then nothing)
- Post-deadline read-only state
- Post-game result state

---

### Standings Tab (`/pools/[id]/standings`)

**What should be on it:**
- Filter bar: All / Alive / Eliminated
- Sort options: Rank / Name / Streak
- Player rows showing: rank, name, status (alive/eliminated), round-by-round result dots, current pick (post-deadline only)
- Your entry(ies) pinned at top with highlight
- Expandable player detail: tap a row to see full pick history with team names, seeds, scores

**Round-by-round result dots:**
```
Player Name    R1  R2  R3  R4
─────────────────────────────
You (Entry 1)  ✓   ✓   ✓   ⏳   ← green checks, amber pending
Mike           ✓   ✓   ✗        ← red X on elimination round
Sarah          ✓   ✓   ✓   ✓   ← all green
```

**Pre-deadline vs post-deadline:**
- Before deadline: current round column shows "—" for all players (no peeking)
- After deadline: current round column shows team abbreviation + seed for all players
- After games: column shows ✓ or ✗ with result

**What's missing in current code:**
- The standings page at `/pools/[id]/standings/page.tsx` exists and is well-built, but it's orphaned from the nav. It needs to become a bottom nav tab destination.
- Pinned "Your entries" section at top
- Post-deadline reveal transition (could be a subtle animation when data flips from hidden to visible)

---

### Bracket Tab (`/pools/[id]/bracket`)

**Current state:** `/tournament/page.tsx` shows a global bracket with region tabs and schedule/bracket view toggle. It's functional but not pool-scoped.

**What should change:**
- Move from `/tournament` to `/pools/[id]/bracket`
- Add pool context: overlay which teams your pool members have picked on the bracket
- Highlight teams you've used (burned), teams you have available, teams that are eliminated
- Keep the region tab navigation (East, West, South, Midwest, Final Four)

**Pool-scoped bracket overlay:**
- Each team node on the bracket shows a small indicator: "3 picks" if 3 pool members picked that team in some round
- Your picked teams show with a highlighted border or badge
- Teams you can still pick show with an "available" indicator

**What's not needed:** This is a reference/exploration screen, not an action screen. No pick submission happens here. Keep it clean and informational.

---

### Analyze Tab (`/pools/[id]/analyze`) — New

**This screen doesn't exist yet. Full specification:**

**Module 1: Today's Games (top of page)**
```
┌─────────────────────────────────────────┐
│  TODAY'S GAMES · Round of 64, Day 2     │
│                                         │
│  (1) Duke 97% vs (16) Norfolk St. 3%   │
│  (2) Iowa 89% vs (15) Colgate 11%      │
│  (3) Baylor 82% vs (14) UC Santa B 18% │
│  ... 13 more games                      │
└─────────────────────────────────────────┘
```
Win probabilities from seed-based model or The Odds API integration.

**Module 2: Team Inventory Grid**
```
Your remaining teams (8×8 grid or list):
┌──────────────────────────────────────────┐
│  AVAILABLE (12)     USED (4)   GONE (48) │
│                                          │
│  🟢 (1) Kansas      ⬛ (3) Baylor        │
│  🟢 (2) Duke        ⬛ (8) Memphis       │
│  🟢 (4) Purdue      ⬛ (5) San Diego St  │
│  🟢 (5) Gonzaga     ⬛ (12) VCU          │
│  🟢 (7) Texas                            │
│  🟢 (8) FAU         ELIMINATED (48)      │
│  ...                 (collapsed)          │
└──────────────────────────────────────────┘
```
Color-coded: green = available and still in tournament, gray = used by you, red = eliminated from tournament.

**Module 3: Opponent X-Ray**
```
┌──────────────────────────────────────────┐
│  OPPONENT COMPARISON                     │
│                                          │
│  5 survivors remain                      │
│                                          │
│  Team         You  Mike  Sarah  Jay  Pat │
│  (1) Kansas    ✓    ✓     ✓     ✓    ✗  │
│  (2) Duke      ✓    ✗     ✓     ✓    ✓  │
│  (4) Purdue    ✓    ✓     ✗     ✓    ✓  │
│                                          │
│  ⚠ Kansas: 4/5 survivors still have it  │
│  ⭐ Duke: Only you and Sarah have it    │
│                                          │
│  Legend: ✓ = available  ✗ = used/gone    │
└──────────────────────────────────────────┘
```
This is the strategic gold. Shows which teams are shared (high collision risk) and which are unique edges.

**Module 4: Path Simulator**
```
┌──────────────────────────────────────────┐
│  PATH TO VICTORY                         │
│                                          │
│  Based on remaining teams and win probs: │
│                                          │
│  Survival to Sweet 16:  78%  ████████░░ │
│  Survival to Elite 8:   52%  █████░░░░░ │
│  Survival to Final 4:   31%  ███░░░░░░░ │
│  Win the pool:          18%  ██░░░░░░░░ │
│                                          │
│  You: 18% → Mike: 22% → Sarah: 25%     │
│  Jay: 20% → Pat: 15%                    │
└──────────────────────────────────────────┘
```
Simple Monte Carlo or probability chain. Doesn't need to be perfect — directionally correct is valuable.

**Module 5: Pick Optimizer**
```
┌──────────────────────────────────────────┐
│  TODAY'S RECOMMENDATION                  │
│                                          │
│  🏆 Best pick: (1) Kansas — 96% win     │
│     But 4 opponents also have Kansas.    │
│     If Kansas loses, they're all out too.│
│                                          │
│  🎯 Smart pick: (4) Purdue — 85% win    │
│     Only 2 opponents have Purdue left.   │
│     Saves Kansas for Round of 32.        │
│                                          │
│  🎲 Contrarian: (7) Texas — 72% win     │
│     No other survivor has Texas.         │
│     Win = guaranteed differentiation.    │
│                                          │
│  ⚠ This is strategy analysis, not a     │
│  guarantee. Trust your gut.              │
└──────────────────────────────────────────┘
```

**Progressive disclosure:** Modules 1 and 5 are visible on load. Modules 2, 3, 4 are collapsed with summary headers that expand on tap.

**Timing behavior:**
- Pre-pick (before deadline, no pick submitted): All modules active, recommendation prominent
- Post-pick (before deadline, pick submitted): Modules show "You picked [Team]" context, recommendation de-emphasized
- Post-deadline: Opponent X-Ray reveals all picks, recommendation hidden
- Post-games: Results overlay on all modules

**Trust calibration:** The disclaimer ("This is strategy analysis, not a guarantee") is important. Frame recommendations as "considerations" not "answers." Use language like "worth considering" not "you should pick."

**Data requirements (not yet in backend):**
- Win probabilities per game (new: `win_probability` column on `games` table, populated from odds API or seed model)
- Per-survivor team inventory (derivable from existing data: `getUsedTeams` for each alive `pool_player`)
- Monte Carlo path simulation (new: utility function, client-side computation)

**Monetization gate point:** Modules 1-2 free. Modules 3-5 could be premium ("Unlock Advanced Analysis" upsell). The free modules are useful; the premium modules are *strategic*. This is a natural freemium split.

---

### Settings (Header gear icon → `/settings`)

**Simplified from current implementation:**
```
Account
  Display Name: [editable]
  Email: [display + edit]
  Password: [Change Password]

Notifications
  Pick Reminders: [2hr / 1hr / 30min / 15min] multi-select
  Results: [on/off]
  Pool Activity: [on/off]

App
  Dark Mode: [on/off] (default on)
  [Sign Out]
  [Delete Account]
  
  v1.0.0 · © 2026 Survive the Dance
```

**What was removed from Settings:**
- Pool management (moved to per-pool admin panel)
- Join code display (moved to Home pool card)
- Pool list (that's the Home tab)
- Created pools list (admin badge on Home cards)

---

### Admin Panel (`/pools/[id]/admin`)

Already detailed in Question 3. Key additions vs. current code:

**Missing from current `admin/page.tsx`:**
- Pool notes (free-text field)
- Play-in game toggle
- Tiebreaker selection
- Player list with remove capability
- Manual result entry (fallback for API lag)
- Deadline override per round
- "End pool early" action

**Manual result entry flow (admin):**
```
Admin Panel → Game Results (visible only during active rounds)
  Shows today's games
  Each game: [Team A] [score] — [score] [Team B] [Mark Final]
  Tapping "Mark Final" → sets winner, triggers elimination processing
  Warning: "This will eliminate players who picked [Losing Team]"
```

---

### Join Flow (`/join/[code]` and `/pools/join`)

**Two entry points, one flow:**

1. **Direct URL:** `/join/MADNESS2026` → shows pool preview + "Join" CTA
   - If logged in: shows join form (entry name)
   - If not logged in: shows "Sign up to join" → signup flow → auto-return with code preserved

2. **Manual code entry:** `/pools/join` → code input → lookup → same join form

**Current code has both** (`/join/page.tsx` and `/pools/join/page.tsx`) but they're disconnected. `/join/page.tsx` uses `code` column; `/pools/join/page.tsx` uses `join_code` column. This is a bug — they should query the same column.

**Consolidation:** Delete `/join/page.tsx`. Use `/pools/join/page.tsx` as the single join handler. Support URL param: `/pools/join?code=MADNESS2026` auto-fills the code field.

---

## 6. State & Edge Case Matrix

| Screen | Empty State | Loading | Error | Pre-Tournament | Active Tournament | Post-Tournament | Eliminated | Winner |
|--------|------------|---------|-------|----------------|-------------------|-----------------|------------|--------|
| **Home** | "No pools yet" + Create/Join CTAs | Skeleton pool cards | "Failed to load pools" + retry | Pool card: "Starts Mar 19 · 8 players joined" | Pool card: round name, deadline, pick status | Pool card: "🏆 Complete · Winner: Sarah" | Pool card: "Eliminated Day 3" with spectate CTA | Pool card: "🏆 You Won!" with share CTA |
| **Pick** | "Join a pool to start" | Skeleton team cards + countdown | "Failed to load games" + retry, preserved countdown | "Tournament starts Mar 19. Check back then!" | Full pick UI (described above) | "Tournament complete. [View Final Bracket]" | Read-only game view + "Your run" history | "You survived every round! 🏆" |
| **Standings** | "No pool selected" | Skeleton rows | "Failed to load" + retry | "Waiting for tournament to start. [n] players joined." | Full standings with filters | Final standings, locked, with champion banner | Same view, your row dimmed | Your row highlighted with trophy |
| **Bracket** | "No pool selected" | Skeleton bracket | "Failed to load" + retry | Empty bracket with team names + seeds | Progressive fill as games complete | Complete bracket | Same view | Same view |
| **Analyze** | "No pool selected" | Skeleton modules | "Analysis unavailable" | "Pre-tournament analysis coming soon" or seed-based preview | Full analysis modules | "Final analysis: your path through the tournament" retrospective | Limited modules (no pick optimizer) | Winning path visualization |

**Deadline-specific states (Pick tab):**

| Time to Deadline | Visual Treatment |
|-----------------|------------------|
| > 2 hours | Green countdown, relaxed |
| 1-2 hours | Amber countdown, "Don't forget!" |
| 30 min - 1 hour | Orange countdown, subtle pulse |
| 5-30 minutes | Red countdown, pulse, "Last chance!" |
| < 5 minutes | Red urgent countdown, strong pulse, full-width banner |
| Deadline passed | Red "Deadline Passed" banner, pick UI disabled, if no pick: "You missed the deadline. You've been eliminated." |

**Network error during pick submission:**
```
1. User taps Confirm
2. Request fails (network error / server error)
3. Show inline error: "Pick failed to submit. Trying again..."
4. Auto-retry once after 2 seconds
5. If retry fails: "Could not submit pick. Check your connection and try again."
   [Retry] button, pick remains selected (not cleared)
6. If deadline passes during retries: "Deadline passed before we could submit. Contact your pool admin."
```

---

## 7. Backend & Schema Gaps

### Missing Tables/Columns

| Table | Column/Change | Purpose |
|-------|--------------|---------|
| `games` | `win_probability_team1` DECIMAL | Analyze tab: win probabilities |
| `games` | `win_probability_team2` DECIMAL | Analyze tab: win probabilities |
| `games` | `broadcast_network` TEXT | Pick screen: TV info |
| `pool_players` | `joined_round_id` UUID FK | Mid-tournament join tracking |
| `pools` | `pool_notes` TEXT | Admin free-text field |
| `pools` | `include_play_in` BOOLEAN DEFAULT false | Play-in game toggle |
| `pools` | `tiebreaker_rule` TEXT DEFAULT 'co_champions' | Tiebreaker config |
| `pools` | `allow_late_entry` BOOLEAN DEFAULT true | Mid-tournament join setting |
| `pools` | `late_entry_can_win` BOOLEAN DEFAULT false | Late entry winning eligibility |
| `users` | `notification_preferences` JSONB | Global notification settings |
| `pool_players` | `notification_overrides` JSONB | Per-pool notification overrides |
| NEW: `shadow_picks` | pool_player_id, round_id, team_id | Eliminated user shadow picks |

### Missing API Functions

| Function | Location | Purpose |
|----------|----------|---------|
| `getPoolInfo(poolId)` | `lib/pool.ts` (new) | Lightweight pool metadata for header pill |
| `getAnalysisData(poolId, userId)` | `lib/analyze.ts` (new) | Team inventory, opponent matrix, probabilities |
| `runPathSimulation(poolId, userId)` | `lib/analyze.ts` (new) | Monte Carlo survival projection |
| `getPickRecommendation(poolId, userId)` | `lib/analyze.ts` (new) | Pick optimizer logic |
| `submitShadowPick(poolPlayerId, roundId, teamId)` | `lib/picks.ts` | Spectator shadow picks |
| `addEntry(poolId, userId, entryName)` | `lib/pool.ts` (new) | In-pool entry creation |
| `updatePoolNotes(poolId, notes)` | `lib/admin.ts` | Admin pool notes |
| `getWinProbabilities(roundId)` | `lib/odds.ts` (new) | Fetch/calculate win probabilities |
| `processEliminations(roundId)` | `lib/elimination.ts` (new) | Server-side elimination batch job |

### Missing Hooks

| Hook | Purpose |
|------|---------|
| `useActivePool()` | Context hook for active pool ID/name |
| `usePickStatus(poolId, userId)` | Quick pick status (picked/not/eliminated) for Home card badges |
| `useAnalysis(poolId, userId)` | Lazy-loaded analysis data for Analyze tab |
| `useCountdown(deadline)` | Reusable countdown with urgency levels |

---

## 8. Competitive Gap Analysis

### Must Have (Before Launch)
- 5-tab pool-scoped navigation (Home, Pick, Standings, Bracket, Analyze)
- Active pool context propagation
- 15-second pick flow
- Deadline countdown with urgency escalation
- Post-deadline pick reveal
- Elimination processing and notification
- Join via code and URL
- Admin pool management
- Basic Analyze tab (Modules 1-2: Today's Games, Team Inventory)

### Should Have (Launch Quality)
- Entry switcher for multi-entry users
- Pool notes from admin
- Pre-tournament lobby state
- Post-elimination spectator mode
- Analyze Modules 3-4 (Opponent X-Ray, Path Simulator)
- Share button on Home cards
- Network error handling on pick submission
- Smart sort on pick screen (favorites first)

### Would Delight (Post-Launch)
- Analyze Module 5 (Pick Optimizer) — premium
- Shadow picks for eliminated users
- Pool chat / reactions
- Push notifications
- Pick streak badges and achievements
- "Winning path" visualization for champion
- Dark/light mode toggle
- Export standings to CSV
- Multiple pool support (full, not just data model)

---

## 9. Priority Recommendations (Ranked)

### P0: Must Fix Before Launch

1. **Restructure bottom nav to 5 tabs** — Home, Pick, Standings, Bracket, Analyze. Remove Settings from nav; add as header gear icon.
2. **Implement ActivePoolContext** — all pool-scoped tabs must know which pool is active.
3. **Stop hiding nav on Pick page** — remove `shouldHideNav` for pick routes. Pick is a tab, not a modal.
4. **Build Analyze tab (Modules 1-2)** — Today's Games with win probabilities, Team Inventory grid. This is the product's differentiator.
5. **Fix pick flow to support inline confirmation** — no page navigation, no modal. Tap team → confirm on same card → done.
6. **Add pool-scoped bracket route** — move from `/tournament` to `/pools/[id]/bracket`.
7. **Consolidate join flows** — one route (`/pools/join`), support URL param for code, preserve code through signup.
8. **Implement Home pool cards** — replace `PoolDetailView` on dashboard with summary cards with CTAs.

### P1: Should Fix Before Launch

9. **Entry switcher on Pick tab** for multi-entry users.
10. **Admin panel enhancements** — pool notes, play-in toggle, tiebreaker, player management.
11. **Deadline urgency in nav** — Pick tab icon shows red dot or pulse when deadline is close.
12. **Post-elimination spectator experience** — read-only games view, "Your Run" timeline.
13. **Pre-tournament lobby state** — player list, countdown to tournament start.
14. **Network error handling** — retry logic on pick submission, graceful degradation.
15. **Pool pill in header** — shows active pool name, tap to return to Home.

### P2: Nice to Have for Launch

16. **Analyze Modules 3-5** — Opponent X-Ray, Path Simulator, Pick Optimizer.
17. **Shadow picks** for eliminated users.
18. **Push notification infrastructure** — reminders, results, pool activity.
19. **Mid-tournament join handling** — warning UI, `joined_round_id` tracking.
20. **Win probability data pipeline** — odds API or seed model populating `games` table.
21. **Post-tournament closing experience** — champion celebration, final stats, share results.

### P3: Post-Launch

22. Pool chat/reactions.
23. Pick streak badges.
24. CSV export.
25. Dark/light mode toggle.
26. Monetization gating on Analyze premium modules.
27. Integrated payment tracking.

---

## 10. Monetization Readiness Assessment

| Question | Assessment |
|----------|-----------|
| Can premium Analyze features be gated? | **Yes.** Modules 1-2 (Today's Games, Team Inventory) are self-contained and valuable for free users. Modules 3-5 (Opponent X-Ray, Path Simulator, Pick Optimizer) are cleanly separable as premium. Gate with "Unlock Pro Analysis" CTA where Module 3 would appear. |
| Is pool creation structured for paid tiers? | **Partially.** Pool creation is a single flow. To support tiers, add a step: "Free pool (10 players max)" vs "Pro pool (unlimited, advanced stats, $X/season)." The `pools` table needs a `tier` column. |
| Is entry fee tracking payment-ready? | **No.** Currently `entry_fee` is a display-only number. To evolve, need: `payment_status` per pool_player, payment link generation, receipt tracking. The pool notes field is a good interim (admin writes "Venmo @handle"). |
| Are there natural sponsorship surfaces? | **Yes.** The Bracket tab (high dwell time, visual), the Analyze tab loading state, and the post-pick confirmation moment are all natural sponsor surfaces. "Today's analysis powered by [Brand]" or "Bracket presented by [Brand]" would be non-intrusive. |

---

## Appendix: File-by-File Change Map

This maps every source file to the changes needed from both this audit and the pixel audit.

| File | Visual Changes (from pixel audit) | Flow/Architecture Changes (from this audit) |
|------|-----------------------------------|---------------------------------------------|
| `src/app/layout.tsx` | Fix font loading, add CSS variables | Add `ActivePoolContext` provider, add header component |
| `src/components/BottomNav.tsx` | Rebuild: 5 tabs, correct icons, Space Mono labels, correct colors | Dynamic hrefs from `useActivePool()`, remove `shouldHideNav` for pick, add urgency badge |
| `src/app/dashboard/page.tsx` | Restyle pool cards per component library | Replace `PoolDetailView` with `PoolCardList`, implement pool card with entry status lines, CTAs |
| `src/app/pools/[id]/pick/page.tsx` | Rebuild pick cards per library spec (5 states, seed number, win prob, radio circle) | Remove nav hiding, add entry switcher, inline confirmation, post-deadline/post-game states |
| `src/app/pools/[id]/standings/page.tsx` | Restyle per component library | Pin "Your entries" at top, add post-deadline reveal logic |
| `src/app/tournament/page.tsx` | Restyle bracket components | Move to `/pools/[id]/bracket`, add pool overlay (picked teams, available teams) |
| `src/app/pools/[id]/analyze/page.tsx` | **NEW FILE** | Build all 5 modules, progressive disclosure, timing-based visibility |
| `src/app/settings/page.tsx` | Restyle per library | Remove pool management, simplify to account + notifications |
| `src/app/pools/[id]/admin/page.tsx` | Restyle per library | Add pool notes, play-in toggle, tiebreaker, player management, manual results |
| `src/app/pools/join/page.tsx` | Restyle per library | Support `?code=` param, preserve code through signup, consolidate with `/join/page.tsx` |
| `src/app/join/page.tsx` | — | **DELETE** — consolidate into `/pools/join` |
| `src/app/pools/create/page.tsx` | Restyle per library | Add pool notes, play-in toggle, tiebreaker fields |
| `src/components/pool/PoolDetailView.tsx` | — | **Deprecate** — split into `PoolCard` (for Home) and remove standalone detail view |
| `src/contexts/ActivePoolContext.tsx` | — | **NEW FILE** — active pool state management |
| `src/components/Header.tsx` | — | **NEW FILE** — pool pill + gear icon |
| `src/components/pick/EntrySwitch.tsx` | — | **NEW FILE** — multi-entry switcher |
| `src/components/pick/PickCard.tsx` | — | **NEW FILE** — single team pick card with 5 states |
| `src/components/pick/MatchupGroup.tsx` | — | **NEW FILE** — two teams in a matchup |
| `src/components/analyze/*.tsx` | — | **NEW FILES** — 5 analysis modules |
| `src/lib/analyze.ts` | — | **NEW FILE** — analysis data fetching + computation |
| `src/lib/odds.ts` | — | **NEW FILE** — win probability data |
| `src/hooks/useActivePool.ts` | — | **NEW FILE** — context consumer hook |
| `src/hooks/useAnalysis.ts` | — | **NEW FILE** — lazy analysis data hook |
| `src/hooks/useCountdown.ts` | — | **NEW FILE** — reusable countdown hook |
| `src/app/globals.css` | 40+ missing CSS variables, all missing component classes | — (visual audit covers this) |

---

*This audit is designed to be consumed alongside the pixel-level visual audit. Together, they provide complete instructions for every file: what it should look like AND how it should behave.*
