# Task 15: Display All Game Times in Eastern Time (ET)

All game times and deadlines must display in Eastern Time regardless of the user's local timezone. This eliminates confusion since March Madness is a US event and all broadcast times are given in ET.

## Files to Read Before Writing Code

- `src/app/pools/[id]/pick/page.tsx` — DeadlineCountdown component, TeamCard, time slot headers
- `src/app/pools/[id]/analyze/page.tsx` — Today's Games module, game time display
- `src/app/pools/[id]/bracket/page.tsx` — game time on bracket cards
- `src/app/dashboard/page.tsx` — formatDeadline function, deadline display on pool cards
- `src/components/pool/PoolDetailView.tsx` — deadline time display
- `src/app/pools/[id]/standings/page.tsx` — round date tooltips

---

## Part 1: Create `src/lib/timezone.ts`

Create a new utility file with all ET formatting functions:

```typescript
/**
 * Format a UTC datetime string as Eastern Time.
 * Always displays ET regardless of user's local timezone.
 *
 * Example: "2026-03-20T16:00:00Z" → "12:00 PM ET"
 */
export function formatET(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }) + ' ET';
}

/**
 * Format as short time without ET suffix (for compact displays like time slot headers).
 *
 * Example: "2026-03-20T16:00:00Z" → "12:00 PM"
 */
export function formatETShort(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Format as "Thu 3/20 · 12:00 PM ET" (for full game datetime display).
 */
export function formatGameDateTime(dateString: string): string {
  const date = new Date(dateString);
  const dayStr = date.toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    month: 'numeric',
    day: 'numeric',
  });
  return `${dayStr} · ${formatET(dateString)}`;
}

/**
 * Format as "Mar 20" (for round date headers/tooltips).
 */
export function formatDateET(dateString: string): string {
  const date = new Date(dateString + (dateString.includes('T') ? '' : 'T00:00:00'));
  return date.toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format deadline as "Picks lock at 11:55 AM ET".
 */
export function formatDeadlineTime(deadlineDateString: string): string {
  return `Picks lock at ${formatET(deadlineDateString)}`;
}
```

---

## Part 2: Update Pick Page — `src/app/pools/[id]/pick/page.tsx`

Add import at the top of the file:
```typescript
import { formatET, formatETShort, formatDeadlineTime } from '@/lib/timezone';
```

### 2A. DeadlineCountdown component — add lock time text

The DeadlineCountdown currently shows only the countdown timer. Add the static deadline time below or beside it.

Find the DeadlineCountdown component (around line 21). After the countdown timer display, add the lock time:

**Current** (around line 47-57):
```tsx
<span className={`${urgencyBg} text-[#E8E6E1] rounded-[6px] px-2.5 py-1 inline-flex items-center gap-1.5`}>
  {expired ? (
    <span className="font-bold text-xs" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>Locked</span>
  ) : (
    <>
      <span className="text-[9px] uppercase opacity-70" style={{ fontFamily: "'Space Mono', monospace" }}>in</span>
      <span className="text-sm font-extrabold tracking-wide" style={{ fontFamily: "'Space Mono', monospace" }}>
        {hours > 0 && `${hours}:`}{String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
      </span>
    </>
  )}
</span>
```

**Change to** — wrap in a flex container and add the lock time text:
```tsx
<div className="flex items-center gap-2">
  <span className={`${urgencyBg} text-[#E8E6E1] rounded-[6px] px-2.5 py-1 inline-flex items-center gap-1.5`}>
    {expired ? (
      <span className="font-bold text-xs" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>Locked</span>
    ) : (
      <>
        <span className="text-[9px] uppercase opacity-70" style={{ fontFamily: "'Space Mono', monospace" }}>in</span>
        <span className="text-sm font-extrabold tracking-wide" style={{ fontFamily: "'Space Mono', monospace" }}>
          {hours > 0 && `${hours}:`}{String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </span>
      </>
    )}
  </span>
  {!expired && (
    <span className="text-[10px] text-[#9BA3AE]" style={{ fontFamily: "'Space Mono', monospace" }}>
      {formatDeadlineTime(deadline.deadline_datetime)}
    </span>
  )}
</div>
```

This shows: `[🟢 in 2:34:15] Picks lock at 11:55 AM ET`

### 2B. Compact team card game time (around line 97)

**Current:**
```tsx
{new Date(team.game_datetime).toLocaleTimeString([], {
  hour: 'numeric',
  minute: '2-digit'
})}
```

**Change to:**
```tsx
{formatET(team.game_datetime)}
```

### 2C. Full TeamCard game time (around line 154)

**Current:**
```tsx
const gameTime = new Date(team.game_datetime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true, timeZoneName: 'short' });
```

**Change to:**
```tsx
const gameTime = formatET(team.game_datetime);
```

### 2D. Time slot headers (around line 373)

**Current:**
```tsx
time: new Date(team.game_datetime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
```

**Change to:**
```tsx
time: formatETShort(team.game_datetime)
```

Use `formatETShort` (no "ET" suffix) for the slot headers since "ET" would repeat for every group and get noisy. The header just says "12:00 PM", "2:30 PM", etc. — users already know it's ET from the deadline display.

---

## Part 3: Update Analyze Page — `src/app/pools/[id]/analyze/page.tsx`

Add import:
```typescript
import { formatET } from '@/lib/timezone';
```

### 3A. Today's Games module game time (around line 173)

**Current:**
```tsx
const gameTime = new Date(team1.game_datetime).toLocaleTimeString('en-US', {
  hour: 'numeric',
  minute: '2-digit',
  timeZoneName: 'short',
});
```

**Change to:**
```tsx
const gameTime = formatET(team1.game_datetime);
```

---

## Part 4: Update Bracket Page — `src/app/pools/[id]/bracket/page.tsx`

Add import:
```typescript
import { formatETShort, formatDateET } from '@/lib/timezone';
```

### 4A. Game time display on bracket cards (around line 225)

**Current:**
```tsx
statusText = dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
```

**Change to:**
```tsx
statusText = formatETShort(game.game_datetime);
```

Note: `dt` was created from `new Date(game.game_datetime)` — we don't need that intermediate variable anymore. Use `game.game_datetime` directly with `formatETShort`. Keep the `statusText` assignment pattern.

### 4B. Date formatting helper (around line 231)

**Current:**
```tsx
const formatDate = (dt: string) =>
  new Date(dt).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
```

**Change to:**
```tsx
const formatDate = (dt: string) => formatDateET(dt);
```

Or just use `formatDateET` directly wherever `formatDate` was called.

---

## Part 5: Update Dashboard — `src/app/dashboard/page.tsx`

Add import:
```typescript
import { formatET } from '@/lib/timezone';
```

### 5A. formatDeadline function (around line 12)

The existing `formatDeadline` function shows countdown text like "Deadline in 2h 34m". Update it to also show the ET time:

**Current:**
```typescript
function formatDeadline(deadlineDatetime: string): { text: string; color: string } {
  const diff = new Date(deadlineDatetime).getTime() - Date.now();
  if (diff <= 0) return { text: 'Picks locked', color: 'text-[#EF5350]' };

  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);

  let text: string;
  if (hours > 0) text = `${hours}h ${minutes}m`;
  else text = `${minutes}m`;

  let color: string;
  if (diff < 1800000) color = 'text-[#EF5350]';
  else if (diff < 3600000) color = 'text-[#FF5722]';
  else if (diff < 7200000) color = 'text-[#FFB300]';
  else color = 'text-[#4CAF50]';

  return { text: `Deadline in ${text}`, color };
}
```

**Change to:**
```typescript
function formatDeadline(deadlineDatetime: string): { text: string; color: string } {
  const diff = new Date(deadlineDatetime).getTime() - Date.now();
  if (diff <= 0) return { text: 'Picks locked', color: 'text-[#EF5350]' };

  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);

  let countdown: string;
  if (hours > 0) countdown = `${hours}h ${minutes}m`;
  else countdown = `${minutes}m`;

  const lockTime = formatET(deadlineDatetime);

  let color: string;
  if (diff < 1800000) color = 'text-[#EF5350]';
  else if (diff < 3600000) color = 'text-[#FF5722]';
  else if (diff < 7200000) color = 'text-[#FFB300]';
  else color = 'text-[#4CAF50]';

  return { text: `Locks in ${countdown} · ${lockTime}`, color };
}
```

This shows: `"Locks in 2h 34m · 11:55 AM ET"` on the dashboard pool card.

---

## Part 6: Update PoolDetailView — `src/components/pool/PoolDetailView.tsx`

Add import:
```typescript
import { formatET } from '@/lib/timezone';
```

### 6A. Deadline time display (around line 263)

**Current:**
```tsx
{new Date(deadline.deadline_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
```

**Change to:**
```tsx
{formatET(deadline.deadline_datetime)}
```

---

## Part 7: Update Standings (The Field) — `src/app/pools/[id]/standings/page.tsx`

Add import:
```typescript
import { formatDateET } from '@/lib/timezone';
```

### 7A. Round date tooltip (around line 247-249)

If there's a date formatting for round tooltips, update it:

**Current (approximately):**
```tsx
const d = new Date(round.date + 'T00:00:00');
```

**Change to use `formatDateET`** wherever the round date is rendered as a tooltip or display text. The exact implementation depends on how Task 11 built the tooltips — look for `title` attributes on round column headers and update them to use `formatDateET(round.date)`.

---

## Summary of Changes

| File | Location | Before | After |
|------|----------|--------|-------|
| `pick/page.tsx` | DeadlineCountdown | Timer only | Timer + "Picks lock at 11:55 AM ET" |
| `pick/page.tsx` | Compact team card (~line 97) | `toLocaleTimeString([])` | `formatET(...)` |
| `pick/page.tsx` | TeamCard (~line 154) | `toLocaleTimeString([], {...timeZoneName})` | `formatET(...)` |
| `pick/page.tsx` | Time slot headers (~line 373) | `toLocaleTimeString([], {...})` | `formatETShort(...)` |
| `analyze/page.tsx` | Today's Games (~line 173) | `toLocaleTimeString('en-US', {...timeZoneName})` | `formatET(...)` |
| `bracket/page.tsx` | Game card time (~line 225) | `dt.toLocaleTimeString('en-US', {...})` | `formatETShort(...)` |
| `bracket/page.tsx` | Date formatter (~line 231) | `toLocaleDateString('en-US', {...})` | `formatDateET(...)` |
| `dashboard/page.tsx` | formatDeadline (~line 12) | `"Deadline in 2h 34m"` | `"Locks in 2h 34m · 11:55 AM ET"` |
| `PoolDetailView.tsx` | Deadline display (~line 263) | `toLocaleTimeString([])` | `formatET(...)` |
| `standings/page.tsx` | Round date tooltips | `new Date(...)` formatting | `formatDateET(...)` |

## Files to Create

1. `src/lib/timezone.ts` — ET formatting utility (5 functions)

## Files to Modify

1. `src/app/pools/[id]/pick/page.tsx` — 4 changes
2. `src/app/pools/[id]/analyze/page.tsx` — 1 change
3. `src/app/pools/[id]/bracket/page.tsx` — 2 changes
4. `src/app/dashboard/page.tsx` — 1 change
5. `src/components/pool/PoolDetailView.tsx` — 1 change
6. `src/app/pools/[id]/standings/page.tsx` — 1 change (if applicable)

## What NOT to Do
- Don't change any deadline *logic* (comparison with `Date.now()` stays the same — those work in UTC which is correct)
- Don't change the `isDeadlinePassed()` helper in standings — `new Date(deadline) < new Date()` works correctly regardless of timezone since both are UTC
- Don't add timezone selection or user preferences — it's always ET, period
- Don't change the DeadlineCountdown *timer logic* — only add the static lock time text beside it
- Don't remove any existing countdown or deadline functionality
