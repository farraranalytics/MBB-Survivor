# Task 11: Rename Standings → "The Field" + Redesign Grid

The Standings page has two conceptual problems: (1) it ranks players, but alive players are all equal — there's no "2nd place" in survivor, you're alive or dead; (2) the grid shows streak counts which are meaningless since all alive players have the same streak. This task renames the tab, removes rankings, and rebuilds the grid to show each player's team picks per round using team logos.

## Files to Read Before Writing Code

Read ALL of these fully:
- `src/app/pools/[id]/standings/page.tsx` — the main file being rewritten
- `src/types/standings.ts` — RoundResult, StandingsPlayer, PoolLeaderboard types
- `src/lib/standings.ts` — getPoolLeaderboard function (how data is built)
- `src/components/BottomNav.tsx` — tab label to rename

---

## Part 1: Rename "Standings" → "The Field"

### 1A. BottomNav tab label

In `src/components/BottomNav.tsx`, change the Standings tab:
```tsx
// Change:
label: 'Standings',
// To:
label: 'The Field',
```

The route stays `/pools/[id]/standings` — no URL change needed. Just the display label.

### 1B. Page title

In `src/app/pools/[id]/standings/page.tsx`, change any "Standings" heading text to "The Field".

---

## Part 2: Remove Rankings

### 2A. Remove rank numbers from both views

In the **list view**, remove the rank number column (`{index + 1}` in the `<span>` with Space Mono). Players should not have numbers next to their names.

In the **grid view**, remove the rank number column from the player name cell.

### 2B. Remove "Streak" column from grid

Remove the "Streak" column header and the streak cell from every row in the grid view. It's pointless — all alive players have the same streak count.

### 2C. Remove streak display from list view

Remove the streak number and "STREAK" label from the right side of each player row in the list view. Keep the expand chevron.

### 2D. Sort order (keep as-is but remove visual ranking)

Keep the current sort: alive first, then by name alphabetically. Just don't display numbers.

### 2E. Section headers instead of rank numbers

Replace rank numbers with section grouping. Show a header above each group:

```
ALIVE · 5 remaining
  [player rows]

ELIMINATED · 3
  [player rows, dimmed]
```

Use the label/text-label style for section headers.

---

## Part 3: Grid View — Team Logos + Deadline Privacy

This is the main redesign. The grid should show which team each player picked for each round, using team logos.

### 3A. Add `team_logo_url` to RoundResult

In `src/types/standings.ts`, add to the `RoundResult` interface:
```typescript
team_logo_url: string | null;
```

In `src/lib/standings.ts`, update the picks query to include logo_url:
```typescript
team:team_id(id, name, abbreviation, seed, logo_url)
```

And in the roundResults mapping, add:
```typescript
team_logo_url: (team as any)?.logo_url || null,
```

### 3B. Add `deadline_datetime` to rounds_played

In `src/types/standings.ts`, update the `rounds_played` array type in `PoolLeaderboard`:
```typescript
rounds_played: {
  id: string;
  name: string;
  date: string;
  deadline_datetime: string;
}[];
```

In `src/lib/standings.ts`, update the roundsPlayed mapping:
```typescript
const roundsPlayed = allRounds
  .filter(r => roundsWithPicks.has(r.id))
  .map(r => ({ id: r.id, name: r.name, date: r.date, deadline_datetime: r.deadline_datetime }));
```

### 3C. Grid column headers — round numbers

Each column represents one pick deadline (one game day). Use short labels:

```
R1  R2  R3  R4  R5  R6
```

Where R1 = first round/game day that has picks, R2 = second, etc.

On hover/tap, show a tooltip or title attribute with the full date: `title="Round of 64 · Mar 20"`

### 3D. Grid cells — team logos

Each cell shows the team logo the player picked for that round:

**If the round's deadline has passed** (`new Date(round.deadline_datetime) < new Date()`):
- Show the team logo as a small circle (24×24px or `w-6 h-6`)
- Use `<img src={result.team_logo_url} />` with `rounded-full` and `object-cover`
- Fallback if no logo_url: show the seed number in a small circle (same as current ResultBadge pending state)
- **Result overlay:**
  - If `is_correct === true`: green ring/border around the logo (`ring-2 ring-[#4CAF50]`)
  - If `is_correct === false`: red ring + slight opacity reduction (`ring-2 ring-[#EF5350] opacity-60`)
  - If `is_correct === null` and `game_status === 'in_progress'`: amber pulsing ring (`ring-2 ring-[#FFB300] animate-pulse`)
  - If `is_correct === null` and `game_status === 'scheduled'`: neutral border (`ring-1 ring-[rgba(255,255,255,0.12)]`)

**If the round's deadline has NOT passed** (current/future round):
- Show a lock icon or `—` dash. Do NOT reveal the team.
- This is the same privacy rule from Task 9: you can't see what others picked until picks are locked.

**If the player has no pick for that round:**
- Show `—` in muted text, or an empty cell with subtle bg

### 3E. Remove the Streak column entirely

No streak column in the grid. The columns are: Player name + R1 + R2 + R3 + etc.

### 3F. Sticky player name column

Keep the player name column sticky on horizontal scroll (it already has `sticky left-0`). This is important for mobile when there are 6+ rounds.

---

## Part 4: List View Updates

### 4A. Remove rank numbers

Remove the `{index + 1}` rank display.

### 4B. Remove streak from right side

Remove the streak number and "STREAK" label block.

### 4C. Keep "TODAY" pick display

Keep the current round pick display on the right side, but **only show it if the deadline has passed**. Before the deadline, don't reveal what anyone picked today.

### 4D. Update the detail line

Change from: `"3 picks · 2 W"`
To: `"Survived X rounds"` where X = `player.correct_picks`

For eliminated players: `"Eliminated in round X"` using `player.elimination_round_name` if available, otherwise `"Eliminated"`.

### 4E. Expandable pick history — respect deadline

In the `PlayerPickHistory` expanded section, only show picks for rounds where the deadline has passed. Hide the current round pick if deadline hasn't passed.

---

## Part 5: Filter Updates

The current filter has "All", "Alive", "Eliminated". Keep these — they still make sense. Just rename any "Standings" references in the filter labels.

---

## Audit Cross-Reference Checklist

| Audit Item | Requirement | Where Addressed |
|---|---|---|
| UX Audit §5 Standings | No ranking for survivor format | Part 2: remove all rank numbers |
| Pixel Audit §8 | Standings row redesign | Part 2E (section headers), Part 4 |
| UX Audit §5 Standings | Post-deadline pick reveal | Part 3D (deadline check) |
| N3 (task tracker) | Pin your entries at top | NOT in this task — defer |
| N4 (task tracker) | Post-deadline pick reveal | Part 3D ✅ |
| User request | Rename to "The Field" | Part 1 |
| User request | Grid shows team logos | Part 3D |
| User request | Only show after deadline | Part 3D, 4C, 4E |
| User request | Remove streak | Part 2B, 2C, 3E |

---

## Files to Modify

1. `src/components/BottomNav.tsx` — rename tab label
2. `src/types/standings.ts` — add team_logo_url to RoundResult, deadline to rounds_played
3. `src/lib/standings.ts` — add logo_url to picks query, deadline to rounds_played
4. `src/app/pools/[id]/standings/page.tsx` — major rewrite of both views

## What NOT to Do
- Don't change the URL route (keep `/standings`)
- Don't change the data fetching logic beyond adding logo_url and deadline
- Don't add new Supabase tables or columns
- Don't change other pages
- Don't pin "Your entries" at top (that's a separate task N3)
- Don't change the sort algorithm (alive first is correct)
