# March Madness Survivor Pool App — Project Prompt

## Overview

Build a web application for running a **March Madness Survivor Pool** (also called a "Suicide Pool" or "Elimination Pool") tied to the NCAA Men's Division I Basketball Tournament. The app manages groups of players who each pick one team to win per tournament day. A correct pick advances you (but burns that team for the rest of the tournament); a wrong pick, a missed pick, or running out of available teams eliminates you. Last player standing wins.

---

## Tournament Structure (Context for Development)

The NCAA Tournament features **68 teams** (commonly referenced as "the 64" after four play-in games). The tournament unfolds across roughly **three weeks** with the following structure:

| Round | Days | Games per Day | Notes |
|---|---|---|---|
| First Four (Play-in) | 2 days (Tue–Wed) | 2 games/day | Optional — many pools exclude these |
| Round of 64 | 2 days (Thu–Fri) | **16 games/day** | Heaviest action — tons of options |
| Round of 32 | 2 days (Sat–Sun) | **8 games/day** | Still lots of choices |
| Sweet 16 | 2 days (Thu–Fri) | **4 games/day** | Choices narrow significantly |
| Elite Eight | 2 days (Sat–Sun) | **2 games/day** | Very limited options |
| Final Four | 1 day (Sat) | **2 games** | Critical — most survivors face tough picks |
| Championship | 1 day (Mon) | **1 game** | Only 2 teams to choose from |

Key insight: Players have up to 16 possible picks on Day 1 but options shrink fast — and each team can only be used once. Managing your remaining team pool across the full tournament is the core strategic challenge.

---

## Core Rules Engine

### Picking Rules
- Each player submits **one pick per tournament day** — a team they believe will win one of that day's games.
- A team can only be picked **once per player** for the entire tournament. Once used (win or lose), that team is burned.
- Picks lock **30 minutes before the first game of the day** (based on the earliest scheduled tip-off for that day's games).
- If a player's picked team **wins**, the player advances to the next day.
- If a player's picked team **loses**, the player is **eliminated**.
- If a player **fails to submit a pick** before the deadline, the player is **eliminated**.
- If a player has **no remaining eligible teams** playing on a given day (all teams they haven't used have already been knocked out of the tournament), the player is **eliminated**.

### Winning Conditions
- **Last player standing wins.** If all remaining players are eliminated on the same day, the pool is a tie among those players (or the pool admin can define a tiebreaker).
- If a player survives through the Championship game, they win outright (or tie with others who also survived every day).

### Edge Cases to Handle
- **Multiple players eliminated on the same day**: Treat as a tie for the last surviving position unless an admin-defined tiebreaker is in place.
- **Player has teams left but none are playing today**: This shouldn't happen in the main draw (every surviving team plays each round), but handle gracefully if schedule quirks arise — the player should not be penalized if no valid pick exists.
- **Tournament schedule changes / postponements**: Admin should be able to manually adjust game times and deadlines.

---

## User Roles

### Pool Admin (Creator)
- Creates a pool, receives a **unique group code** and a **shareable join link**.
- Configures pool settings (name, optional entry fee tracking, whether to include play-in games, tiebreaker rules).
- Can manually update game results if needed (backup for any API lag).
- Can set or adjust pick deadlines.
- Can remove players if needed.
- Views a full admin dashboard with all picks, eliminations, and standings.

### Player (Member)
- Joins a pool via **group code** or **direct URL link**.
- Creates a display name / profile for the pool.
- Submits one pick per tournament day before the deadline.
- Views their own pick history, remaining available teams, and elimination status.
- Views pool standings, leaderboard, and other players' picks (picks become visible after the day's deadline passes — no peeking).
- Accesses the **Analyze tab** for strategic insights.

---

## Core Features

### 1. Pool Creation & Joining
- Admin creates a pool → app generates a **unique alphanumeric group code** (e.g., `MADNESS2026`) and a **join URL** (e.g., `app.com/join/MADNESS2026`).
- Players join by entering the code or clicking the link.
- Optional: Admin can set a pool to public (anyone with code can join) or private (invite-only / approval required).
- Optional: Admin can set a max number of participants.

### 2. Tournament Data Integration
- Pull the tournament bracket, team seedings, game schedule, and tip-off times from a reliable source (e.g., NCAA API, ESPN API, or a sports data provider).
- Automatically update game results in real-time or near-real-time.
- Display the full bracket within the app for reference.
- Fallback: Admin can manually enter/update game results and schedules.

### 3. Daily Pick Submission
- Each day with games, players see a **pick screen** showing:
  - All games scheduled for that day (matchups, seeds, tip-off times).
  - Which teams the player has **already used** (grayed out / unavailable).
  - Which teams are still **available** to pick.
  - A clear countdown to the pick deadline (30 minutes before first tip-off).
- Player selects one team and confirms.
- Players can **change their pick** any time before the deadline.
- After the deadline, picks are locked and become visible to the pool.
- Push notification / email reminders before the deadline (configurable).

### 4. Standings & Leaderboard
- Live-updating standings showing:
  - Which players are **still alive** vs. **eliminated**.
  - Each player's pick history (team, result) — visible after each day's deadline.
  - How many teams each surviving player has remaining.
  - Which day a player was eliminated and on what pick.
- Sort by: Status (alive first), days survived, alphabetical.

### 5. Analyze Tab (Strategic Insights) ⭐
This is a key differentiator. The Analyze tab helps surviving players assess their strategic position by considering:

**A. Personal Team Inventory Analysis**
- How many of the player's unused teams are still alive in the tournament?
- What upcoming matchups do those teams face?
- Win probability for each available team in their next game (based on seed, betting odds, or a rating system).
- Flag "must-use" situations: if a team only has one more game before the player would lose access to that favorable pick.

**B. Comparative Pool Analysis**
- For each surviving player in the pool, show which teams they have already used and which they have remaining.
- Highlight **overlapping picks**: teams that multiple survivors still have available (popular future picks = less differentiation).
- Highlight **unique picks**: teams that only one survivor has remaining (potential edges or risks).
- Show a "collision" forecast: if 3 of 5 survivors all need to pick the same strong team on a given day, that's a strategic bottleneck.

**C. Path-to-Victory Projection**
- Model the remaining tournament days and estimate each surviving player's probability of making it through, based on:
  - Their remaining team pool and those teams' win probabilities.
  - What teams other survivors have left.
  - How many days/rounds remain.
- Simple visualization: "You have a 35% chance of surviving to the Final Four based on your remaining team pool."

**D. Pick Recommendation Engine**
- Suggest an optimal pick for the current day considering:
  - Highest win probability among available teams.
  - "Save value" — whether a strong team should be saved for a harder upcoming round.
  - Contrarian value — if most other survivors are likely to pick the same team, a loss by that team would eliminate multiple opponents, so pivoting to a different pick could be strategic.
- Show trade-offs: "Team A has a 90% win chance today but you'll need them more in the Elite 8. Team B has a 75% win chance today but won't be useful later."

---

## Screens & Navigation

### Main Navigation Tabs
1. **Home / Dashboard** — Pool status at a glance: alive count, today's games, your current pick status, countdown to deadline.
2. **Pick** — Daily pick submission screen.
3. **Standings** — Full leaderboard with pick history.
4. **Bracket** — Visual bracket showing tournament results and remaining teams.
5. **Analyze** — Strategic analysis tools (described above).
6. **Settings / Pool Info** — Group code, invite link, pool rules, notifications.

### Additional Screens
- **Join Pool** — Landing page for group code or URL entry.
- **Pool Lobby** — Pre-tournament waiting room showing who has joined.
- **Player Profile** — Pick history, teams used, teams remaining.
- **Admin Panel** — Pool management (visible only to the admin).

---

## Technical Considerations

### Data & Backend
- **Real-time game data**: Integrate a sports data API for live scores and game schedules. Consider: ESPN API, NCAA live stats, SportsDataIO, The Odds API (for win probabilities), or similar.
- **Pick deadline enforcement**: Server-side deadline validation. The client shows a countdown, but the server rejects any pick submitted after the cutoff.
- **Pick visibility**: Picks are stored immediately but only exposed to other players after the deadline. No early peeking.
- **Elimination processing**: After all games for a day are final, run elimination logic. Mark players whose pick lost (or who didn't pick) as eliminated. Update standings.

### Frontend
- Mobile-first responsive design (most users will pick from their phones).
- Clean, sports-themed UI. Think ESPN bracket-style visuals.
- The pick screen should make it dead simple to see what's available and submit quickly (users often pick last-minute).
- The Analyze tab should present complex data in intuitive visualizations (charts, color-coded tables, simple probability bars).

### Notifications
- Configurable reminders:
  - "Games start in 2 hours — submit your pick!"
  - "Your pick is in: [Team]. Good luck!"
  - "You survived Day 3! Pick for Day 4 opens now."
  - "You've been eliminated. [Team] lost."
- Channels: Push notifications (mobile), email, or in-app.

### Authentication & Security
- Simple sign-up / login (email or social auth).
- Each pool is isolated — players in one pool can't see another pool's data.
- Admin actions are protected (only the pool creator can manage settings).
- Rate limiting on pick submissions to prevent abuse.

---

## Nice-to-Have Features (Post-MVP)

- **Multiple pool support**: A player can participate in multiple pools simultaneously, each with independent picks.
- **Chat / Trash Talk**: In-pool messaging or comment threads per day.
- **Entry fee tracking**: Integrate with Venmo/PayPal or just track who has paid.
- **Historical stats**: "In 2025, 12-seeds won X% of first-round games" — context for picks.
- **Pick streaks & achievements**: Badges for consecutive correct picks, upset picks, etc.
- **Spectator mode**: Eliminated players (or non-participants) can follow the pool without picking.
- **Multiple entries**: Allow players to have 2+ entries in the same pool (with separate pick tracks).
- **Export**: CSV export of standings and pick history.
- **Dark mode**.

---

## Summary of Key Differentiators

1. **Dead-simple group joining** via code or link — no friction to get friends into the pool.
2. **Automated deadline enforcement** tied to real game start times (30-minute cushion).
3. **Analyze tab** that turns raw pick data into strategic intelligence — this is what sets the app apart from spreadsheet-based pools.
4. **Mobile-first UX** designed for the last-minute picker checking their phone before tip-off.
5. **Full transparency after deadlines** — everyone can see everyone's picks and remaining teams, fueling strategy and trash talk.
