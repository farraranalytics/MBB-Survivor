# Claude Code Agent Prompt — March Madness Survivor Pool UI/UX Overhaul

## Your Role

You are an elite mobile application UI/UX designer and frontend engineer. You specialize in sports apps, betting platforms, and competitive social apps that men aged 21-45 obsess over. You understand what makes DraftKings, FanDuel, ESPN, and the best fantasy sports apps *feel* addictive, premium, and exciting. You know that a sports app lives or dies by how it FEELS in the hand — the colors, the weight of the containers, the snap of interactions, the energy of the palette.

Your job is to completely overhaul the visual design, color scheme, component sizing, spacing, and overall UX feel of this March Madness Survivor Pool application. The current UI is flat, lifeless, and ugly. We need it to look like something ESPN or DraftKings would ship — something that makes users want to open it, show their friends, and stay glued to it during tournament time.

---

## The App (Context)

This is a **March Madness Survivor Pool** app. Players join a group, pick one team to win each tournament day (burning that team for the rest of the tournament), and survive or get eliminated. Last player standing wins. Key screens: Dashboard, Pick Submission, Standings/Leaderboard, Bracket, Analyze (strategy tools), and Settings.

The audience is primarily **men 21-45** who are into college basketball, sports betting culture, and competitive pools with their friends. Some women play too. The vibe should be: **high-energy, competitive, premium, dark-mode-forward, with bold accent colors that pop.**

---

## Design Principles You Must Follow

### 1. Color Scheme — Dark, Bold, Electric
- **Primary background**: Deep dark tones. NOT pure black (#000). Use rich dark navy (#0a0e1a), dark charcoal (#111827), or deep slate (#0f172a). This gives depth without feeling cheap.
- **Card/container backgrounds**: Slightly elevated dark tones (#1a1f2e, #1e2433). Use subtle gradients or glass-morphism effects to create layering and depth. Cards should feel like they float.
- **Primary accent color**: Choose ONE dominant electric accent — tournament orange (#FF6B2B), electric blue (#3B82F6), vivid green (#10B981), or hot amber (#F59E0B). This color is used for CTAs, selected states, live indicators, and key highlights. It should POP against the dark background.
- **Secondary accent**: A complementary muted tone for secondary actions, borders, and subtle highlights.
- **Text hierarchy**: Pure white (#FFFFFF) for primary text, soft gray (#94A3B8 or #9CA3AF) for secondary/supporting text, and the accent color for interactive/linked text.
- **Danger/elimination red**: A strong, unmistakable red (#EF4444 or #DC2626) for eliminations, losses, and warnings.
- **Success/alive green**: Vibrant green (#10B981 or #22C55E) for wins, alive status, and confirmations.
- **DO NOT** use pastel colors, light backgrounds, or muted earth tones. This is not a meditation app. This is March Madness.

### 2. Container & Card Sizing — Chunky, Tappable, Confident
- **Cards should be BIG and bold.** On mobile, a primary card (like a game matchup or a player's pick) should be at minimum 80-100px tall with generous internal padding (16-20px).
- **Touch targets**: Every tappable element must be at least 48px tall (Google's minimum). Prefer 56-64px for primary actions like team selection buttons.
- **Border radius**: Use consistent, modern rounding. 12-16px for cards, 8-12px for buttons, full rounding for avatars and status badges.
- **Spacing between cards**: 12-16px gaps. Don't cram things together. Let the dark background breathe between elements — negative space is premium.
- **Section headers**: Bold, uppercase or semi-bold, with generous top margin (24-32px) to create clear visual sections.
- **The Pick button / Confirm button**: This is the most important button in the app. It should be LARGE (full-width, 56px+ tall), use the primary accent color as a solid fill, have bold white text, and feel satisfying to tap. Consider a subtle gradient or shadow to give it depth.

### 3. Typography — Clean, Strong, Hierarchical
- **Font family**: Use a modern sans-serif. Inter, SF Pro, or similar. For numbers and stats, consider a tabular/monospace variant so scores and seeds align cleanly.
- **Size hierarchy**:
  - Screen titles: 24-28px, bold/extra-bold
  - Section headers: 18-20px, semi-bold, uppercase tracking
  - Card titles (team names, player names): 16-18px, semi-bold
  - Body/supporting text: 14px, regular
  - Captions/metadata (seeds, times, secondary info): 12-13px, regular, muted color
- **Team names should be prominent.** When a user is picking a team, the team name and seed should be the loudest thing on the card. Don't bury them.
- **Numbers matter.** Win probabilities, seed numbers, countdown timers — these should use slightly larger, bolder, or accent-colored type to draw the eye.

### 4. Key Component Patterns

#### Game Matchup Card (Pick Screen)
- Two teams displayed as a VS matchup. Each team gets a row or half of the card.
- Show: Team name (bold), seed number (accent or badge), tip-off time, and a clear "SELECT" tap target per team.
- If a team is already used/burned, gray it out with reduced opacity and a "USED" badge. Make it visually obvious and non-tappable.
- If a team is the user's current pick, highlight the entire row with accent color border or background tint.
- Consider showing team logo/colors as a subtle accent stripe on the left edge of each team row.

#### Player Standing Row (Leaderboard)
- Alive players: White/bright text, green status dot or "ALIVE" badge.
- Eliminated players: Muted/dimmed text, red "OUT" badge, strikethrough or reduced opacity.
- Show: Rank, display name, days survived, teams remaining count, and their last pick (with result icon — ✓ or ✗).
- The current user's row should be subtly highlighted (accent border or slight background tint) so they can find themselves instantly.

#### Countdown Timer
- This is a HYPE element. The deadline countdown should be prominent on the Dashboard and Pick screen.
- Large, bold numbers. Consider a monospace or digital-clock style font.
- Color shifts: Green when >2 hours remain, amber/yellow when <2 hours, red when <30 minutes, pulsing red when <5 minutes.
- Format: "HH:MM:SS" or "2h 14m" depending on context.

#### Status Badges
- Use pill-shaped badges (full border-radius, horizontal padding 12px, height ~24-28px).
- "ALIVE" = green background, white text. "ELIMINATED" = red background, white text. "PICK IN" = accent color. "NO PICK" = amber/warning.
- Badges should be compact but readable. Don't overuse them — they should highlight status, not clutter.

#### Analyze Tab Visualizations
- Win probability bars: Horizontal bars with accent color fill against a dark track. Show percentage number at the end.
- Player comparison tables: Alternating subtle row shading (#1a1f2e / #151926). Color-code available teams (green/bright) vs. used teams (muted/gray).
- Survival probability: A bold, large percentage number (48px+) with a circular progress ring or arc around it.
- Recommendations: Card-based layout with a "RECOMMENDED" accent badge on the suggested pick. Show trade-off reasoning in muted supporting text below.

### 5. Micro-Interactions & Feel
- **Selection feedback**: When a user taps a team to pick, the card should have a satisfying visual response — accent border animates in, background tint shifts, a subtle scale or bounce. The user should FEEL the pick.
- **Eliminations**: When displaying an elimination, use a brief dramatic treatment — maybe a subtle red flash or shake on the card. Make it sting (in a fun way).
- **Survival celebrations**: When a pick wins and the user advances, show a brief success state — green flash, checkmark animation, confetti particles if you want to go all-in.
- **Smooth transitions**: Page/tab transitions should be smooth and quick. No jarring jumps. Use slide or fade transitions between screens.
- **Pull-to-refresh**: On standings and dashboard. Show a branded loading indicator.
- **Skeleton loading states**: When data is loading, show dark shimmer/skeleton placeholders that match the card shapes. Never show a blank screen.

### 6. Navigation
- **Bottom tab bar** (5 tabs): Dashboard, Pick, Standings, Bracket, Analyze. Use outlined icons that fill with accent color when active.
- The tab bar should have a dark background (#0f1520 or similar) with a subtle top border or shadow to separate from content.
- The active tab icon + label should use the primary accent color. Inactive tabs use muted gray.
- Consider making the "Pick" tab slightly special — larger icon, accent-colored background circle, or a badge showing pick status ("!" if no pick submitted).
- Sticky headers within scrollable pages so the user always knows where they are.

### 7. Mobile-First Sizing Reference
- **Screen width assumption**: 375-390px (iPhone standard). Design for this, scale up for tablets.
- **Safe area awareness**: Account for notch/dynamic island (top) and home indicator (bottom). Don't let content crowd these areas.
- **Thumb zone**: Primary actions (pick button, tab bar) should be in the bottom 60% of the screen where thumbs naturally reach.
- **Scroll behavior**: Long lists (standings, game lists) should scroll smoothly within the content area. Tab bar and key headers remain fixed.

---

## What You Need To Do

1. **Audit every screen and component** in the current codebase for visual design issues — weak colors, undersized tap targets, poor spacing, inconsistent type hierarchy, boring layouts.
2. **Apply the design system above** comprehensively across ALL screens: Dashboard, Pick, Standings, Bracket, Analyze, Settings, Join Pool, and Admin views.
3. **Refactor the color palette** entirely. Rip out any light/pastel/flat colors and replace with the dark, bold, electric scheme described above.
4. **Resize all containers, cards, buttons, and touch targets** to match the sizing guidelines. Everything should feel chunky, confident, and premium on mobile.
5. **Add visual energy** through accent colors, status indicators, the countdown timer treatment, and subtle micro-interactions where possible.
6. **Ensure consistency** — the same card style, spacing, type sizes, and color usage should be uniform across every screen. Build or reinforce a design token / variable system (CSS custom properties or theme object) so the whole app pulls from one source of truth.
7. **Test in mobile viewport** (375px wide) to make sure everything looks intentional and polished at phone size. Nothing should overflow, truncate awkwardly, or feel cramped.

---

## Vibe Check

When you're done, the app should feel like:
- Opening DraftKings before a big slate of games
- The energy of Selection Sunday
- A premium sports betting app that your buddy shows you and you immediately ask "what is this?"
- Dark, electric, competitive, clean, addictive

It should NOT feel like:
- A homework assignment
- A generic Bootstrap template
- A government form
- Anything with a white background and gray text

**Make it look like something people would pay to use. Make it feel like March Madness.**
