import { useState, useEffect, useMemo } from "react";

// ══════════════════════════════════════════════════════════════
// DESIGN TOKENS
// ══════════════════════════════════════════════════════════════
const T = {
  orange: "#FF5722", orangeHover: "#FF6D3A",
  orangeSubtle: "rgba(255, 87, 34, 0.08)", orangeGlow: "rgba(255, 87, 34, 0.25)",
  surface0: "#080810", surface1: "#0D1B2A", surface2: "#111827",
  surface3: "#1B2A3D", surface4: "#243447", surface5: "#2D3E52",
  alive: "#4CAF50", aliveSub: "rgba(76, 175, 80, 0.12)",
  eliminated: "#EF5350", elimSub: "rgba(239, 83, 80, 0.12)",
  warning: "#FFB300", warnSub: "rgba(255, 179, 0, 0.12)",
  info: "#42A5F5", infoSub: "rgba(66, 165, 245, 0.12)",
  textPrimary: "#E8E6E1", textSecondary: "#9BA3AE",
  textTertiary: "#5F6B7A", textDisabled: "#3D4654", textInverse: "#0D1B2A",
  borderSubtle: "rgba(255, 255, 255, 0.05)", borderDefault: "rgba(255, 255, 255, 0.08)",
  borderStrong: "rgba(255, 255, 255, 0.12)", borderAccent: "rgba(255, 87, 34, 0.3)",
  fontDisplay: "'Oswald', sans-serif", fontCondensed: "'Barlow Condensed', sans-serif",
  fontBody: "'DM Sans', sans-serif", fontMono: "'Space Mono', monospace",
  radiusSm: 6, radiusMd: 10, radiusLg: 14,
};

// ══════════════════════════════════════════════════════════════
// DATA
// ══════════════════════════════════════════════════════════════
const POOLS = [
  {
    id: "pool1", name: "March Madness Mania", host: "Jake's Pool", buyIn: "$25", alive: 122, total: 128, maxEntries: 3,
    entries: [
      { id: "e1", name: "Padres to the Ship", status: "alive", streak: 0, picks: {} },
      { id: "e2", name: "Raiders Suck", status: "alive", streak: 0, picks: {} },
    ],
  },
  {
    id: "pool2", name: "Office Bracket Busters", host: "Work League", buyIn: "$10", alive: 64, total: 64, maxEntries: 2,
    entries: [
      { id: "e3", name: "BSU to the Ship", status: "alive", streak: 0, picks: {} },
      { id: "e4", name: "SDSU to the Ship", status: "alive", streak: 0, picks: {} },
    ],
  },
];

const DAYS = [
  { id: "R64_D1", label: "R64 Day 1", date: "Mar 19", round: "R64" },
  { id: "R64_D2", label: "R64 Day 2", date: "Mar 20", round: "R64" },
  { id: "R32_D1", label: "R32 Day 1", date: "Mar 21", round: "R32" },
  { id: "R32_D2", label: "R32 Day 2", date: "Mar 22", round: "R32" },
  { id: "S16_D1", label: "S16 Day 1", date: "Mar 26", round: "S16" },
  { id: "S16_D2", label: "S16 Day 2", date: "Mar 27", round: "S16" },
  { id: "E8_D1", label: "E8 Day 1", date: "Mar 28", round: "E8" },
  { id: "E8_D2", label: "E8 Day 2", date: "Mar 29", round: "E8" },
  { id: "F4", label: "Final Four", date: "Apr 5", round: "F4" },
  { id: "CHIP", label: "Championship", date: "Apr 7", round: "CHIP" },
];

const CURRENT_DAY_IDX = 0;
const CURRENT_DAY = DAYS[CURRENT_DAY_IDX];

// R64 Day 1 = Top Half (games 0-3) of each region: 1v16, 8v9, 5v12, 4v13
const REGIONS = ["South", "East", "West", "Midwest"];
const TODAYS_GAMES = {
  South: [
    { top: [1, "Auburn", "28-5"], bot: [16, "Ala St/SFU", "16-17"], time: "12:15P", net: "TBS" },
    { top: [8, "Louisville", "22-11"], bot: [9, "Creighton", "22-12"], time: "2:45P", net: "TBS" },
    { top: [5, "Michigan", "21-12"], bot: [12, "UC San Diego", "28-6"], time: "7:10P", net: "TNT" },
    { top: [4, "Texas A&M", "22-10"], bot: [13, "Yale", "24-8"], time: "9:40P", net: "TNT" },
  ],
  East: [
    { top: [6, "BYU", "24-9"], bot: [11, "VCU", "22-12"], time: "12:15P", net: "CBS" },
    { top: [3, "Wisconsin", "24-10"], bot: [14, "Montana", "26-8"], time: "2:45P", net: "CBS" },
    { top: [7, "St. Mary's", "26-7"], bot: [10, "Vanderbilt", "21-13"], time: "7:10P", net: "TBS" },
    { top: [2, "Alabama", "24-9"], bot: [15, "Robert Morris", "22-12"], time: "9:40P", net: "TBS" },
  ],
  West: [
    { top: [1, "Florida", "30-4"], bot: [16, "Norfolk St", "24-10"], time: "12:15P", net: "TNT" },
    { top: [8, "UConn", "21-12"], bot: [9, "Oklahoma", "20-13"], time: "2:45P", net: "TNT" },
    { top: [5, "Memphis", "22-9"], bot: [12, "Colorado St", "25-9"], time: "7:10P", net: "CBS" },
    { top: [4, "Maryland", "25-8"], bot: [13, "Grand Canyon", "27-6"], time: "9:40P", net: "CBS" },
  ],
  Midwest: [
    { top: [6, "Illinois", "21-12"], bot: [11, "Texas/Xavier", ""], time: "12:15P", net: "TBS" },
    { top: [3, "Kentucky", "22-10"], bot: [14, "Troy", "26-8"], time: "2:45P", net: "TBS" },
    { top: [7, "UCLA", "22-10"], bot: [10, "Utah St", "27-7"], time: "7:10P", net: "TNT" },
    { top: [2, "Tennessee", "27-7"], bot: [15, "Wofford", "27-7"], time: "9:40P", net: "TNT" },
  ],
};

// Top 6 biggest favorites by spread (mock Odds API data)
const BIGGEST_FAVS = [
  { seed: 1, team: "Houston", region: "Midwest", spread: -23.5, opponent: "SIU-E", oppSeed: 16 },
  { seed: 1, team: "Auburn", region: "South", spread: -20.5, opponent: "Ala St/SFU", oppSeed: 16 },
  { seed: 1, team: "Duke", region: "East", spread: -20.0, opponent: "American", oppSeed: 16 },
  { seed: 2, team: "Alabama", region: "East", spread: -18.5, opponent: "Robert Morris", oppSeed: 15 },
  { seed: 2, team: "Tennessee", region: "Midwest", spread: -17.0, opponent: "Wofford", oppSeed: 15 },
  { seed: 1, team: "Florida", region: "West", spread: -16.5, opponent: "Norfolk St", oppSeed: 16 },
];

const roundColors = { R64: T.textTertiary, R32: T.textSecondary, S16: T.info, E8: T.warning, F4: T.eliminated, CHIP: T.orange };

// ══════════════════════════════════════════════════════════════
// COMPACT GAME CARD
// ══════════════════════════════════════════════════════════════
function CompactGameCard({ game, selectedTeam, onSelect, usedTeams, mob }) {
  const [ts, tName, tRec] = game.top;
  const [bs, bName, bRec] = game.bot;

  const TeamRow = ({ seed, name, record, isTop }) => {
    const isSelected = selectedTeam === name;
    const isUsed = usedTeams.has(name);
    const canSelect = !isUsed;

    return (
      <button
        onClick={() => canSelect && onSelect(isSelected ? null : name)}
        disabled={isUsed}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 6,
          padding: mob ? "9px 10px" : "7px 10px",
          background: isSelected ? T.orangeSubtle : "transparent",
          borderLeft: isSelected ? `2.5px solid ${T.orange}` : "2.5px solid transparent",
          border: "none", borderBottom: isTop ? `1px solid ${T.borderSubtle}` : "none",
          cursor: isUsed ? "not-allowed" : "pointer",
          opacity: isUsed ? 0.25 : 1,
          transition: "all 150ms ease",
          textAlign: "left",
        }}
      >
        <span style={{
          fontFamily: T.fontDisplay, fontWeight: 700,
          fontSize: mob ? "0.7rem" : "0.6rem",
          color: isSelected ? T.orange : T.textTertiary,
          minWidth: mob ? 18 : 16, textAlign: "center",
        }}>{seed}</span>
        <span style={{
          fontFamily: T.fontDisplay, fontWeight: isSelected ? 700 : 600,
          fontSize: mob ? "0.85rem" : "0.78rem",
          textTransform: "uppercase",
          color: isSelected ? T.orange : T.textPrimary,
          flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          textDecoration: isUsed ? "line-through" : "none",
        }}>{name}</span>
        {record && !isUsed && (
          <span style={{
            fontFamily: T.fontMono, fontSize: "0.4rem",
            color: T.textDisabled, letterSpacing: "0.06em", flexShrink: 0,
          }}>{record}</span>
        )}
        {isUsed && (
          <span style={{
            fontFamily: T.fontMono, fontSize: "0.35rem", fontWeight: 700,
            color: T.eliminated, letterSpacing: "0.1em", flexShrink: 0,
          }}>USED</span>
        )}
        {isSelected && (
          <span style={{
            fontFamily: T.fontMono, fontSize: "0.45rem", fontWeight: 700,
            color: T.orange, flexShrink: 0,
          }}>✓</span>
        )}
      </button>
    );
  };

  return (
    <div style={{
      background: T.surface2, borderRadius: T.radiusSm,
      border: selectedTeam && (selectedTeam === tName || selectedTeam === bName)
        ? `1px solid ${T.borderAccent}`
        : `1px solid ${T.borderSubtle}`,
      overflow: "hidden",
      boxShadow: selectedTeam && (selectedTeam === tName || selectedTeam === bName)
        ? "0 0 12px rgba(255,87,34,0.08)" : "none",
      transition: "all 200ms ease",
    }}>
      {/* Time strip */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "3px 10px", background: T.surface3,
      }}>
        <span style={{
          fontFamily: T.fontMono, fontSize: "0.4rem", fontWeight: 700,
          color: T.textTertiary, letterSpacing: "0.08em",
        }}>{game.time} ET</span>
        <span style={{
          fontFamily: T.fontMono, fontSize: "0.35rem", fontWeight: 700,
          color: T.textDisabled, letterSpacing: "0.08em",
        }}>{game.net}</span>
      </div>
      <TeamRow seed={ts} name={tName} record={tRec} isTop />
      <TeamRow seed={bs} name={bName} record={bRec} isTop={false} />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// PICK TIMELINE
// ══════════════════════════════════════════════════════════════
function PickTimeline({ entry, currentDayIdx, mob }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {DAYS.map((day, idx) => {
        const pick = entry.picks[day.id];
        const isCurrent = idx === currentDayIdx;
        const isPast = idx < currentDayIdx;
        const isFuture = idx > currentDayIdx;
        const rc = roundColors[day.round];
        const survived = pick?.result === "survived";
        const eliminated = pick?.result === "eliminated";

        return (
          <div key={day.id} style={{ display: "flex", alignItems: "stretch", gap: mob ? 8 : 12 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 20, flexShrink: 0 }}>
              {idx > 0 && <div style={{ width: 2, flex: 1, background: isPast && survived ? T.alive : T.borderSubtle }} />}
              <div style={{
                width: isCurrent ? 12 : 8, height: isCurrent ? 12 : 8,
                borderRadius: "50%", flexShrink: 0,
                background: survived ? T.alive : eliminated ? T.eliminated : isCurrent ? T.orange : T.surface4,
                border: isCurrent ? `2px solid ${T.orange}` : "none",
                boxShadow: isCurrent ? `0 0 8px ${T.orange}44` : "none",
              }} />
              {idx < DAYS.length - 1 && <div style={{ width: 2, flex: 1, background: T.borderSubtle }} />}
            </div>
            <div style={{ flex: 1, paddingBottom: 4, paddingTop: idx === 0 ? 0 : 2, opacity: isFuture ? 0.3 : 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 1 }}>
                <span style={{ fontFamily: T.fontMono, fontSize: "0.4rem", fontWeight: 700, letterSpacing: "0.1em", color: isCurrent ? T.orange : rc }}>{day.label}</span>
                <span style={{ fontFamily: T.fontMono, fontSize: "0.38rem", color: T.textDisabled, letterSpacing: "0.06em" }}>{day.date}</span>
                {isCurrent && <span style={{ fontFamily: T.fontMono, fontSize: "0.35rem", fontWeight: 700, color: T.orange, background: T.orangeSubtle, padding: "1px 5px", borderRadius: 9999, letterSpacing: "0.1em", border: `1px solid ${T.borderAccent}` }}>NOW</span>}
              </div>
              {pick ? (
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 8px",
                  background: survived ? T.aliveSub : eliminated ? T.elimSub : T.surface3,
                  border: `1px solid ${survived ? "rgba(76,175,80,0.15)" : eliminated ? "rgba(239,83,80,0.15)" : T.borderDefault}`,
                  borderRadius: 4,
                }}>
                  <span style={{ fontFamily: T.fontDisplay, fontWeight: 700, fontSize: "0.5rem", color: T.textTertiary }}>{pick.seed}</span>
                  <span style={{ fontFamily: T.fontDisplay, fontWeight: 700, fontSize: "0.7rem", textTransform: "uppercase", color: survived ? T.alive : eliminated ? T.eliminated : T.textPrimary }}>{pick.team}</span>
                </div>
              ) : isCurrent ? (
                <span style={{ fontFamily: T.fontCondensed, fontWeight: 600, fontSize: "0.6rem", letterSpacing: "0.1em", color: T.orange }}>↑ PICKING NOW</span>
              ) : (
                <span style={{ fontFamily: T.fontCondensed, fontSize: "0.55rem", color: T.textDisabled, letterSpacing: "0.1em" }}>—</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════
export default function PickTab() {
  const [selectedPoolId, setSelectedPoolId] = useState(POOLS[0].id);
  const [selectedEntryId, setSelectedEntryId] = useState(POOLS[0].entries[0].id);
  const [todayPick, setTodayPick] = useState(null);
  const [pickLocked, setPickLocked] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [poolDropdownOpen, setPoolDropdownOpen] = useState(false);
  const [expandedRegion, setExpandedRegion] = useState(null); // mobile: which region is expanded
  const [mob, setMob] = useState(false);

  useEffect(() => {
    const check = () => setMob(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const pool = POOLS.find(p => p.id === selectedPoolId);
  const entry = pool?.entries.find(e => e.id === selectedEntryId);
  const usedTeams = useMemo(() => new Set(entry ? Object.values(entry.picks).map(p => p.team) : []), [entry]);

  const handlePoolSwitch = (pid) => {
    setSelectedPoolId(pid);
    const np = POOLS.find(p => p.id === pid);
    if (np) setSelectedEntryId(np.entries[0].id);
    setTodayPick(null); setPickLocked(false); setShowConfirm(false); setPoolDropdownOpen(false);
  };

  const handleLockPick = () => { if (todayPick) setShowConfirm(true); };
  const confirmPick = () => { setPickLocked(true); setShowConfirm(false); };

  // Find which region the selected team is in
  const selectedRegion = useMemo(() => {
    if (!todayPick) return null;
    for (const [region, games] of Object.entries(TODAYS_GAMES)) {
      for (const g of games) {
        if (g.top[1] === todayPick || g.bot[1] === todayPick) return region;
      }
    }
    return null;
  }, [todayPick]);

  // Find seed of selected pick
  const selectedSeed = useMemo(() => {
    if (!todayPick) return null;
    for (const games of Object.values(TODAYS_GAMES)) {
      for (const g of games) {
        if (g.top[1] === todayPick) return g.top[0];
        if (g.bot[1] === todayPick) return g.bot[0];
      }
    }
    return null;
  }, [todayPick]);

  // Total games today
  const totalGames = Object.values(TODAYS_GAMES).reduce((sum, g) => sum + g.length, 0);

  return (
    <div style={{ background: T.surface1, color: T.textPrimary, minHeight: "100vh", fontFamily: T.fontBody }}>
      <link href="https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Barlow+Condensed:wght@600;700;800&family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />
      <style>{`
        @keyframes statusPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* ═══ TOP BAR ═══ */}
      <div style={{
        background: T.surface0, borderBottom: `1px solid ${T.borderDefault}`,
        padding: mob ? "12px 14px" : "16px 24px",
      }}>
        <div style={{ maxWidth: 740, margin: "0 auto" }}>
          {/* Header row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div>
              <div style={{ fontFamily: T.fontMono, fontSize: "0.42rem", letterSpacing: "0.2em", color: T.orange, marginBottom: 2 }}>PICK TAB</div>
              <div style={{ fontFamily: T.fontDisplay, fontWeight: 700, fontSize: mob ? "1.05rem" : "1.25rem", textTransform: "uppercase" }}>Make Your Pick</div>
            </div>
            <div style={{
              textAlign: "right", padding: mob ? "8px 12px" : "10px 14px",
              background: T.surface1, borderRadius: T.radiusMd,
              border: `1.5px solid ${T.borderStrong}`,
            }}>
              <div style={{
                fontFamily: T.fontMono, fontSize: "0.42rem", fontWeight: 700,
                letterSpacing: "0.15em", color: T.textSecondary, marginBottom: 3,
              }}>ROUND</div>
              <div style={{
                fontFamily: T.fontDisplay, fontWeight: 700,
                fontSize: mob ? "1rem" : "1.1rem",
                color: T.textPrimary, lineHeight: 1.1,
              }}>{CURRENT_DAY.label}</div>
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "flex-end",
                gap: 6, marginTop: 4,
              }}>
                <span style={{
                  fontFamily: T.fontMono, fontSize: "0.42rem", fontWeight: 700,
                  color: T.textPrimary, letterSpacing: "0.06em",
                }}>{totalGames} GAMES</span>
                <span style={{
                  fontFamily: T.fontMono, fontSize: "0.42rem", fontWeight: 700,
                  color: T.orange, background: T.orangeSubtle,
                  padding: "2px 6px", borderRadius: 3,
                  border: `1px solid ${T.borderAccent}`, letterSpacing: "0.06em",
                }}>{CURRENT_DAY.date}</span>
              </div>
            </div>
          </div>

          {/* Pool Selector */}
          <div style={{ position: "relative", marginBottom: 8 }}>
            <button onClick={() => setPoolDropdownOpen(!poolDropdownOpen)} style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: mob ? "8px 12px" : "9px 14px",
              background: T.surface2, border: `1px solid ${poolDropdownOpen ? T.orange : T.borderDefault}`,
              borderRadius: T.radiusMd, cursor: "pointer", transition: "border-color 200ms ease",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <span style={{ fontFamily: T.fontMono, fontSize: "0.38rem", fontWeight: 700, letterSpacing: "0.12em", color: T.textTertiary, background: T.surface4, padding: "2px 5px", borderRadius: 3, flexShrink: 0 }}>POOL</span>
                <span style={{ fontFamily: T.fontDisplay, fontWeight: 600, fontSize: mob ? "0.85rem" : "0.9rem", textTransform: "uppercase", color: T.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pool?.name}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontFamily: T.fontMono, fontSize: "0.38rem", color: T.alive, letterSpacing: "0.06em" }}>{pool?.alive}/{pool?.total}</span>
                <span style={{ color: T.textTertiary, fontSize: "0.5rem", transform: poolDropdownOpen ? "rotate(180deg)" : "none", transition: "transform 200ms ease" }}>▼</span>
              </div>
            </button>
            {poolDropdownOpen && (
              <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 100, marginTop: 3, background: T.surface3, border: `1px solid ${T.borderStrong}`, borderRadius: T.radiusMd, overflow: "hidden", boxShadow: "0 8px 30px rgba(0,0,0,0.4)", animation: "fadeIn 0.15s ease" }}>
                {POOLS.map(p => (
                  <button key={p.id} onClick={() => handlePoolSwitch(p.id)} style={{
                    width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "10px 14px", border: "none", cursor: "pointer",
                    background: p.id === selectedPoolId ? T.orangeSubtle : "transparent",
                    borderLeft: p.id === selectedPoolId ? `3px solid ${T.orange}` : "3px solid transparent",
                  }}>
                    <div style={{ textAlign: "left" }}>
                      <div style={{ fontFamily: T.fontDisplay, fontWeight: 600, fontSize: "0.85rem", textTransform: "uppercase", color: p.id === selectedPoolId ? T.orange : T.textPrimary }}>{p.name}</div>
                      <div style={{ fontFamily: T.fontMono, fontSize: "0.38rem", color: T.textTertiary, letterSpacing: "0.06em", marginTop: 1 }}>{p.host} · {p.buyIn} · {p.entries.length} ENTRIES</div>
                    </div>
                    <span style={{ fontFamily: T.fontMono, fontSize: "0.4rem", color: T.alive, letterSpacing: "0.06em" }}>{p.alive}/{p.total}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Entry Tabs */}
          <div style={{ display: "flex", gap: 5, overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
            {pool?.entries.map(e => {
              const isActive = e.id === selectedEntryId;
              return (
                <button key={e.id} onClick={() => { setSelectedEntryId(e.id); setTodayPick(null); setPickLocked(false); setShowConfirm(false); }} style={{
                  display: "flex", alignItems: "center", gap: 5,
                  padding: mob ? "6px 10px" : "7px 14px",
                  background: isActive ? T.surface3 : "transparent",
                  border: isActive ? `1.5px solid ${T.orange}` : `1px solid ${T.borderDefault}`,
                  borderRadius: T.radiusSm, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
                  transition: "all 200ms ease",
                }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: T.alive, boxShadow: `0 0 4px ${T.alive}44` }} />
                  <span style={{ fontFamily: T.fontDisplay, fontWeight: isActive ? 700 : 500, fontSize: mob ? "0.72rem" : "0.78rem", textTransform: "uppercase", color: isActive ? T.textPrimary : T.textSecondary }}>{e.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ═══ CONTENT ═══ */}
      <div style={{ maxWidth: 740, margin: "0 auto", padding: mob ? "14px" : "20px 24px" }}>

        {/* Status bar */}
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: mob ? "8px 12px" : "10px 16px",
          background: T.aliveSub, border: "1px solid rgba(76,175,80,0.15)",
          borderRadius: T.radiusMd, marginBottom: mob ? 12 : 16,
        }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: T.alive, animation: "statusPulse 2s ease infinite", flexShrink: 0 }} />
          <div style={{ fontFamily: T.fontDisplay, fontWeight: 700, fontSize: "0.75rem", color: T.alive, textTransform: "uppercase" }}>ALIVE</div>
          <div style={{ fontFamily: T.fontMono, fontSize: "0.4rem", color: T.textTertiary, letterSpacing: "0.08em" }}>DAY 1 OF 10 · FIRST PICK</div>
          <div style={{
            marginLeft: "auto", padding: "3px 8px", background: T.warnSub,
            borderRadius: 9999, border: "1px solid rgba(255,179,0,0.15)",
            display: "flex", alignItems: "center", gap: 4,
          }}>
            <span style={{ fontFamily: T.fontMono, fontSize: "0.38rem", fontWeight: 700, letterSpacing: "0.1em", color: T.warning }}>LOCKS</span>
            <span style={{ fontFamily: T.fontMono, fontSize: "0.55rem", fontWeight: 700, color: T.warning }}>4:23</span>
          </div>
        </div>

        {/* ═══ QUICK PICK STRIP ═══ */}
        {!pickLocked && (
          <div style={{ marginBottom: mob ? 14 : 18 }}>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              marginBottom: 8,
            }}>
              <div style={{
                fontFamily: T.fontMono, fontSize: "0.4rem", letterSpacing: "0.15em",
                color: T.textTertiary,
              }}>BIGGEST FAVORITES · TAP TO SELECT</div>
              <div style={{
                fontFamily: T.fontMono, fontSize: "0.35rem", letterSpacing: "0.1em",
                color: T.textDisabled,
              }}>VIA ODDS API</div>
            </div>
            <div style={{
              display: "grid",
              gridTemplateColumns: mob ? "1fr 1fr" : "1fr 1fr 1fr",
              gap: 5,
            }}>
              {BIGGEST_FAVS.map((f, i) => {
                const isSelected = todayPick === f.team;
                const isUsed = usedTeams.has(f.team);
                return (
                  <button key={i} onClick={() => !isUsed && setTodayPick(isSelected ? null : f.team)}
                    disabled={isUsed}
                    style={{
                      display: "flex", alignItems: "center", gap: mob ? 6 : 8,
                      padding: mob ? "8px 10px" : "8px 12px",
                      background: isSelected ? T.orangeSubtle : T.surface2,
                      border: isSelected ? `1.5px solid ${T.orange}` : `1px solid ${T.borderDefault}`,
                      borderRadius: T.radiusSm, cursor: isUsed ? "not-allowed" : "pointer",
                      opacity: isUsed ? 0.25 : 1,
                      boxShadow: isSelected ? `0 0 0 1px ${T.orange}, 0 0 12px rgba(255,87,34,0.1)` : "none",
                      transition: "all 150ms ease", textAlign: "left",
                    }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{
                          fontFamily: T.fontDisplay, fontWeight: 700, fontSize: "0.55rem",
                          color: isSelected ? T.orange : T.textTertiary,
                        }}>{f.seed}</span>
                        <span style={{
                          fontFamily: T.fontDisplay, fontWeight: isSelected ? 700 : 600,
                          fontSize: mob ? "0.78rem" : "0.75rem", textTransform: "uppercase",
                          color: isSelected ? T.orange : T.textPrimary,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>{f.team}</span>
                      </div>
                      <div style={{
                        fontFamily: T.fontMono, fontSize: "0.35rem",
                        color: T.textDisabled, letterSpacing: "0.06em", marginTop: 1,
                      }}>vs ({f.oppSeed}) {f.opponent}</div>
                    </div>
                    <div style={{
                      fontFamily: T.fontMono, fontWeight: 700,
                      fontSize: mob ? "0.7rem" : "0.65rem",
                      color: isSelected ? T.orange : T.alive,
                      flexShrink: 0,
                    }}>{f.spread}</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ═══ LOCKED STATE ═══ */}
        {pickLocked && (
          <div style={{
            padding: mob ? "20px 14px" : "24px 20px", textAlign: "center",
            background: T.aliveSub, border: "1.5px solid rgba(76,175,80,0.25)",
            borderRadius: T.radiusLg, marginBottom: mob ? 14 : 18,
          }}>
            <div style={{ fontFamily: T.fontMono, fontSize: "0.42rem", letterSpacing: "0.2em", color: T.alive, marginBottom: 6 }}>PICK LOCKED IN ✓</div>
            <div style={{ fontFamily: T.fontDisplay, fontWeight: 700, fontSize: mob ? "1.6rem" : "1.8rem", textTransform: "uppercase", color: T.alive }}>{todayPick}</div>
            <div style={{ fontFamily: T.fontMono, fontSize: "0.45rem", color: T.textTertiary, marginTop: 4, letterSpacing: "0.08em" }}>({selectedSeed}) · {selectedRegion?.toUpperCase()}</div>
            <div style={{ fontFamily: T.fontBody, fontSize: "0.8rem", color: T.textSecondary, marginTop: 10 }}>You live to dance another day.</div>
            <button onClick={() => { setPickLocked(false); setShowConfirm(false); }} style={{
              marginTop: 12, fontFamily: T.fontDisplay, fontWeight: 600,
              fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.05em",
              background: "none", border: `1.5px solid ${T.borderStrong}`,
              color: T.textTertiary, borderRadius: T.radiusSm, padding: "7px 18px", cursor: "pointer",
            }}>Change Pick</button>
          </div>
        )}

        {/* ═══ GAMES BY REGION ═══ */}
        {!pickLocked && (
          <div style={{ display: "flex", flexDirection: "column", gap: mob ? 10 : 12 }}>
            {REGIONS.map(region => {
              const games = TODAYS_GAMES[region];
              const isMobExpanded = expandedRegion === region;
              const hasPickInRegion = selectedRegion === region;

              // On mobile: collapsible. On desktop: always open.
              const showGames = !mob || isMobExpanded;

              return (
                <div key={region} style={{
                  background: T.surface0, borderRadius: T.radiusLg,
                  border: hasPickInRegion ? `1px solid ${T.borderAccent}` : `1px solid ${T.borderSubtle}`,
                  overflow: "hidden",
                  boxShadow: hasPickInRegion ? "0 0 16px rgba(255,87,34,0.06)" : "none",
                  transition: "all 250ms ease",
                }}>
                  {/* Region Header */}
                  <div
                    onClick={() => mob && setExpandedRegion(isMobExpanded ? null : region)}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: mob ? "10px 12px" : "10px 16px",
                      background: T.surface2,
                      borderBottom: showGames ? `1px solid ${T.borderSubtle}` : "none",
                      cursor: mob ? "pointer" : "default",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{
                        width: 4, height: 20, borderRadius: 2, background: T.orange, flexShrink: 0,
                      }} />
                      <span style={{
                        fontFamily: T.fontDisplay, fontWeight: 700,
                        fontSize: mob ? "0.9rem" : "0.95rem", textTransform: "uppercase",
                        color: T.textPrimary,
                      }}>{region}</span>
                      <span style={{
                        fontFamily: T.fontMono, fontSize: "0.4rem", fontWeight: 700,
                        letterSpacing: "0.1em", color: T.textTertiary,
                        background: T.surface4, padding: "2px 6px", borderRadius: 3,
                      }}>{games.length} GAMES</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {hasPickInRegion && (
                        <span style={{
                          fontFamily: T.fontMono, fontSize: "0.4rem", fontWeight: 700,
                          color: T.orange, background: T.orangeSubtle,
                          padding: "2px 6px", borderRadius: 9999, letterSpacing: "0.08em",
                          border: `1px solid ${T.borderAccent}`,
                        }}>PICK: {todayPick}</span>
                      )}
                      {mob && (
                        <span style={{
                          color: T.textTertiary, fontSize: "0.55rem",
                          transform: isMobExpanded ? "rotate(180deg)" : "none",
                          transition: "transform 200ms ease",
                        }}>▼</span>
                      )}
                    </div>
                  </div>

                  {/* Games Grid */}
                  {showGames && (
                    <div style={{
                      display: "grid",
                      gridTemplateColumns: mob ? "1fr" : "1fr 1fr",
                      gap: mob ? 5 : 6,
                      padding: mob ? "8px 10px 10px" : "10px 14px 14px",
                      animation: mob ? "fadeIn 0.15s ease" : "none",
                    }}>
                      {games.map((game, i) => (
                        <CompactGameCard
                          key={i}
                          game={game}
                          selectedTeam={todayPick}
                          onSelect={(team) => { setTodayPick(team); setShowConfirm(false); }}
                          usedTeams={usedTeams}
                          mob={mob}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ═══ LOCK BUTTON / CONFIRM ═══ */}
        {!pickLocked && (
          <div style={{ marginTop: mob ? 12 : 16 }}>
            {showConfirm ? (
              <div style={{
                padding: mob ? "16px 14px" : "20px",
                background: T.surface3, border: `1px solid ${T.borderAccent}`,
                borderRadius: T.radiusLg, textAlign: "center", animation: "fadeIn 0.2s ease",
              }}>
                <div style={{ fontFamily: T.fontDisplay, fontWeight: 600, fontSize: "0.85rem", textTransform: "uppercase", color: T.textPrimary, marginBottom: 4 }}>
                  Lock in <span style={{ color: T.orange }}>({selectedSeed}) {todayPick}</span>?
                </div>
                <div style={{ fontFamily: T.fontBody, fontSize: "0.78rem", color: T.textSecondary, marginBottom: 14 }}>
                  This team will be burned for the rest of the tournament. You can change before lock time.
                </div>
                <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                  <button onClick={() => setShowConfirm(false)} style={{
                    fontFamily: T.fontDisplay, fontWeight: 600, fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.05em",
                    background: "none", border: `1.5px solid ${T.borderStrong}`, color: T.textSecondary, borderRadius: T.radiusSm, padding: "10px 22px", cursor: "pointer",
                  }}>Cancel</button>
                  <button onClick={confirmPick} style={{
                    fontFamily: T.fontDisplay, fontWeight: 600, fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.05em",
                    background: T.orange, border: "none", color: T.textInverse, borderRadius: T.radiusSm, padding: "10px 22px", cursor: "pointer",
                    boxShadow: "0 0 20px rgba(255,87,34,0.2)",
                  }}>Lock It In 🔒</button>
                </div>
              </div>
            ) : (
              <button onClick={handleLockPick} disabled={!todayPick} style={{
                width: "100%", padding: mob ? "14px" : "16px",
                fontFamily: T.fontDisplay, fontWeight: 600, fontSize: mob ? "0.9rem" : "1rem",
                textTransform: "uppercase", letterSpacing: "0.05em",
                background: todayPick ? T.orange : T.surface4,
                color: todayPick ? T.textInverse : T.textDisabled,
                border: "none", borderRadius: T.radiusMd,
                cursor: todayPick ? "pointer" : "not-allowed",
                boxShadow: todayPick ? "0 0 20px rgba(255,87,34,0.2)" : "none",
                transition: "all 200ms ease",
              }}>
                {todayPick ? `Lock Pick → (${selectedSeed}) ${todayPick}` : "Select a Team Above"}
              </button>
            )}
          </div>
        )}

        {/* ═══ PICK TIMELINE ═══ */}
        <div style={{ marginTop: mob ? 20 : 28 }}>
          <div style={{ fontFamily: T.fontMono, fontSize: "0.42rem", letterSpacing: "0.18em", color: T.orange, marginBottom: 3 }}>PICK HISTORY</div>
          <div style={{ fontFamily: T.fontDisplay, fontWeight: 700, fontSize: mob ? "0.95rem" : "1.05rem", textTransform: "uppercase", marginBottom: mob ? 10 : 14 }}>Your Run</div>
          <PickTimeline entry={entry} currentDayIdx={CURRENT_DAY_IDX} mob={mob} />
        </div>

        <div style={{ height: 40 }} />
      </div>
    </div>
  );
}
