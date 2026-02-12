# Plan: Entry soft-delete (`entry_deleted` on pool_players)

## Problem

- **Symptom:** User has 4 entries in the DB but "deleted" 2 in the UI. Those 2 rows still exist, so they hit max entries (e.g. 4) when trying to add another. The DB has no way to tell which entries were removed.
- **Root cause:** Either (1) DELETE on `pool_players` is failing (e.g. RLS or migration 003 not applied), or (2) we want to avoid hard-deletes so we can audit and enforce limits correctly. Either way, the fix is to **treat "remove entry" as soft-delete** and make all logic count only active entries.

## Approach: Soft-delete with `entry_deleted`

- Add **`entry_deleted`** (and optionally **`deleted_at`**) to `pool_players`.
- "Remove entry" → **UPDATE** `entry_deleted = true` (and `deleted_at = now()`) instead of DELETE.
- All reads and limits count only rows where **`entry_deleted IS NOT TRUE`** (treat NULL as active for backfill).

---

## 1. Schema / migration

**New columns on `pool_players`:**

- `entry_deleted BOOLEAN NOT NULL DEFAULT false`
- `deleted_at TIMESTAMPTZ` (optional, for audit)

**Migration (new file, e.g. `004_pool_players_entry_deleted.sql`):**

- `ALTER TABLE pool_players ADD COLUMN entry_deleted BOOLEAN NOT NULL DEFAULT false;`
- `ALTER TABLE pool_players ADD COLUMN deleted_at TIMESTAMPTZ;`
- Backfill: `UPDATE pool_players SET entry_deleted = false WHERE entry_deleted IS NULL;` (only if we add as nullable first then set default; with NOT NULL DEFAULT false, no backfill needed.)
- Optional index for common filter: `CREATE INDEX idx_pool_players_active ON pool_players(pool_id, user_id) WHERE (entry_deleted IS NOT TRUE);`

---

## 2. Trigger: max entries per user

**Current:** `enforce_max_entries_per_user()` counts `COUNT(*)` from `pool_players` for `(pool_id, user_id)`.

**Change:** Count only active entries:

```sql
SELECT COUNT(*) INTO current_count
FROM pool_players
WHERE pool_id = NEW.pool_id AND user_id = NEW.user_id
  AND (entry_deleted IS NOT TRUE);
```

Update the function in the same migration (or a follow-up) and keep the same trigger.

---

## 3. App: "Remove entry" → soft-delete

**`src/lib/admin.ts` – `removePoolMember(poolPlayerId)`**

- Replace **DELETE** with **UPDATE**:
  - `update({ entry_deleted: true, deleted_at: new Date().toISOString() }).eq('id', poolPlayerId)` (if we have `deleted_at`).
  - Or just `update({ entry_deleted: true }).eq('id', poolPlayerId)`.
- Ensure RLS allows UPDATE on your own row (and/or creator can update members). Existing "Pool creators can remove members" is DELETE; we may need an UPDATE policy for creators on `pool_players` (e.g. creator can set `entry_deleted` for rows in their pool). Same for "users can update their own entries" (e.g. allow `auth.uid() = user_id` for UPDATE of `entry_deleted`).

**Leave pool – `leavePool(poolId, userId)`**

- **Option A (recommended):** Keep as **hard DELETE** for all of that user’s rows in the pool (user is leaving the pool; we can keep soft-delete only for "remove one entry").
- **Option B:** Change to soft-delete all entries for that user in the pool: `UPDATE pool_players SET entry_deleted = true, deleted_at = now() WHERE pool_id = ? AND user_id = ?`.

---

## 4. App: All reads of pool_players must exclude deleted

Add filter **`entry_deleted` is false** (or `is.not.true` if we allow nulls) everywhere we select "active" entries.

**Places to update (filter active only):**

| Location | What to add |
|----------|-------------|
| `src/app/pools/[id]/pick/page.tsx` | Load entries: `.eq('entry_deleted', false)` (or `.or('entry_deleted.is.null,entry_deleted.eq.false')` if nullable during rollout). |
| `src/lib/picks.ts` | Any `pool_players` select used for "my entries" or active player list: same filter. |
| `src/lib/admin.ts` | `getPoolPlayers`, `getPoolWithPlayers`: filter `entry_deleted = false`. |
| `src/lib/standings.ts` | Standings / leaderboard queries that read `pool_players`: exclude deleted. |
| `src/app/pools/[id]/settings/page.tsx` | Entry list / member list: exclude deleted. |
| `src/app/api/pools/[id]/most-picked/route.ts` | Exclude deleted. |
| `src/app/api/pools/[id]/standings/route.ts` | Exclude deleted. |
| `src/app/pools/join/page.tsx` | Count of players / entries: count only non-deleted (e.g. `pool_players(count)` with filter or a view). |
| `src/app/pools/create/page.tsx` | Creator’s first entry insert: no change; later entry lists: filter. |
| `src/lib/settings.ts` | Pool + player count: count only non-deleted. |
| `src/lib/game-processing.ts` | Any pool_players usage: exclude deleted. |
| `src/lib/activity.ts` | Exclude deleted. |
| `src/lib/analyze.ts` | Exclude deleted. |
| `src/components/SplashOverlay.tsx` | Counts: exclude deleted. |
| `src/components/TournamentInProgress.tsx` | Same. |
| Admin/test APIs | Exclude deleted where they list or count entries. |

Use a single convention: **`.eq('entry_deleted', false)`** if column is NOT NULL DEFAULT false; otherwise **`.or('entry_deleted.is.null,entry_deleted.eq.false')`** until backfilled.

---

## 5. App: Add entry (pick page)

- **Next `entry_number`:** Query existing **active** entries for this pool + user, then `entry_number = max(entry_number) + 1` (or 1 if none). This avoids unique constraint issues and respects gaps from soft-deleted entries.
- **Max-entries check:** Either rely on DB trigger (counts non-deleted) or in app: count only rows with `entry_deleted = false` before inserting.
- After successful insert: **`await loadData()`** and **`refreshPools()`** so pick page and dashboard/settings show the new entry (as in the reverted fix).

---

## 6. RLS

- **SELECT:** No change needed if we filter in app. Optionally add a single policy that only exposes rows where `entry_deleted IS NOT TRUE` (then app doesn’t need to filter; but then "deleted" rows are invisible everywhere).
- **UPDATE:** Ensure users (and/or pool creators) can UPDATE `pool_players` to set `entry_deleted = true` for their own entry or for members in pools they created. Add or adjust UPDATE policy if currently only INSERT/DELETE exist.

---

## 7. Order of work

1. **Migration:** Add `entry_deleted` (and optional `deleted_at`), update `enforce_max_entries_per_user()` to count only non-deleted.
2. **RLS:** Add/update UPDATE policy so remove-entry and (if we keep it) leave-pool soft-delete are allowed.
3. **admin.ts:** Change `removePoolMember` to soft-delete; decide leavePool (hard delete vs soft-delete all).
4. **All reads:** Add `entry_deleted = false` (or equivalent) everywhere we list/count active entries (see table above).
5. **Pick page add-entry:** Use max(entry_number)+1 for active entries, await loadData(), refreshPools(), and surface errors.

---

## 8. Optional: "Restore entry"

If we ever want to allow undeleting, we’d add a flow that does `UPDATE pool_players SET entry_deleted = false, deleted_at = NULL WHERE id = ?` (and enforce max_entries in trigger or app). Not required for initial fix.
