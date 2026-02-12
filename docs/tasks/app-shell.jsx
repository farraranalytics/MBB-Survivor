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
// MOCK DATA
// ══════════════════════════════════════════════════════════════
const USER = { name: "Marcus", avatar: "M" };

const DAYS = [
  { id: "R64_D1", short: "R64.1", date: "Mar 19", round: "R64" },
  { id: "R64_D2", short: "R64.2", date: "Mar 20", round: "R64" },
  { id: "R32_D1", short: "R32.1", date: "Mar 21", round: "R32" },
  { id: "R32_D2", short: "R32.2", date: "Mar 22", round: "R32" },
  { id: "S16_D1", short: "S16.1", date: "Mar 26", round: "S16" },
  { id: "S16_D2", short: "S16.2", date: "Mar 27", round: "S16" },
  { id: "E8_D1", short: "E8.1", date: "Mar 28", round: "E8" },
  { id: "E8_D2", short: "E8.2", date: "Mar 29", round: "E8" },
  { id: "F4", short: "F4", date: "Apr 5", round: "F4" },
  { id: "CHIP", short: "CHIP", date: "Apr 7", round: "CHIP" },
];

const CURRENT_DAY_IDX = 4; // S16 Day 1

const POOLS = [
  {
    id: "pool1", name: "March Madness Mania", host: "Jake", buyIn: 25, pot: 3200, alive: 47, total: 128,
    entries: [
      { id: "e1", name: "Padres to the Ship", owner: USER.name, ownerId: "me", status: "alive", streak: 4, needsPick: true,
        picks: {
          R64_D1: { team: "Houston", seed: 1, region: "MW", result: "W" },
          R64_D2: { team: "Duke", seed: 1, region: "E", result: "W" },
          R32_D1: { team: "Auburn", seed: 1, region: "S", result: "W" },
          R32_D2: { team: "Alabama", seed: 2, region: "E", result: "W" },
        }},
      { id: "e2", name: "Raiders Suck", owner: USER.name, ownerId: "me", status: "eliminated", streak: 2, eliminatedDay: "R32_D1", needsPick: false,
        picks: {
          R64_D1: { team: "Tennessee", seed: 2, region: "MW", result: "W" },
          R64_D2: { team: "Florida", seed: 1, region: "W", result: "W" },
          R32_D1: { team: "Michigan", seed: 5, region: "S", result: "L" },
        }},
    ],
    field: [
      { id: "f1", name: "Chalk City", owner: "Jake", status: "alive", streak: 4, picks: { R64_D1: { team: "Auburn", seed: 1, result: "W" }, R64_D2: { team: "Florida", seed: 1, result: "W" }, R32_D1: { team: "Houston", seed: 1, result: "W" }, R32_D2: { team: "Duke", seed: 1, result: "W" }}},
      { id: "f2", name: "Upset Special", owner: "Sarah", status: "alive", streak: 4, picks: { R64_D1: { team: "Creighton", seed: 9, result: "W" }, R64_D2: { team: "Oklahoma", seed: 9, result: "W" }, R32_D1: { team: "Florida", seed: 1, result: "W" }, R32_D2: { team: "Auburn", seed: 1, result: "W" }}},
      { id: "f3", name: "Pain Train", owner: "Mike", status: "alive", streak: 4, picks: { R64_D1: { team: "Florida", seed: 1, result: "W" }, R64_D2: { team: "Houston", seed: 1, result: "W" }, R32_D1: { team: "Alabama", seed: 2, result: "W" }, R32_D2: { team: "Mich St", seed: 2, result: "W" }}},
      { id: "f4", name: "First Dance", owner: "Lisa", status: "alive", streak: 4, picks: { R64_D1: { team: "Duke", seed: 1, result: "W" }, R64_D2: { team: "Auburn", seed: 1, result: "W" }, R32_D1: { team: "Tennessee", seed: 2, result: "W" }, R32_D2: { team: "Florida", seed: 1, result: "W" }}},
      { id: "f5", name: "Glass Slipper", owner: "Tommy", status: "eliminated", streak: 1, eliminatedDay: "R64_D2", picks: { R64_D1: { team: "Alabama", seed: 2, result: "W" }, R64_D2: { team: "Iowa St", seed: 3, result: "L" }}},
      { id: "f6", name: "Madness Mode", owner: "Chris", status: "eliminated", streak: 3, eliminatedDay: "R32_D2", picks: { R64_D1: { team: "Tennessee", seed: 2, result: "W" }, R64_D2: { team: "Duke", seed: 1, result: "W" }, R32_D1: { team: "Mich St", seed: 2, result: "W" }, R32_D2: { team: "Oregon", seed: 5, result: "L" }}},
      { id: "f7", name: "Bracketology 101", owner: "Dan", status: "eliminated", streak: 0, eliminatedDay: "R64_D1", picks: { R64_D1: { team: "Memphis", seed: 5, result: "L" }}},
      { id: "f8", name: "Survive This", owner: "Jen", status: "alive", streak: 4, picks: { R64_D1: { team: "Mich St", seed: 2, result: "W" }, R64_D2: { team: "Tennessee", seed: 2, result: "W" }, R32_D1: { team: "Duke", seed: 1, result: "W" }, R32_D2: { team: "Houston", seed: 1, result: "W" }}},
      { id: "f9", name: "Big Dance Energy", owner: "Rachel", status: "alive", streak: 4, picks: { R64_D1: { team: "Houston", seed: 1, result: "W" }, R64_D2: { team: "Alabama", seed: 2, result: "W" }, R32_D1: { team: "Florida", seed: 1, result: "W" }, R32_D2: { team: "Tennessee", seed: 2, result: "W" }}},
      { id: "f10", name: "No Chalk Zone", owner: "Brad", status: "eliminated", streak: 2, eliminatedDay: "R32_D1", picks: { R64_D1: { team: "Lipscomb", seed: 14, result: "W" }, R64_D2: { team: "Colorado St", seed: 12, result: "W" }, R32_D1: { team: "Lipscomb", seed: 14, result: "L" }}},
      { id: "f11", name: "Full Court Press", owner: "Jake", status: "alive", streak: 4, picks: { R64_D1: { team: "Alabama", seed: 2, result: "W" }, R64_D2: { team: "Duke", seed: 1, result: "W" }, R32_D1: { team: "Auburn", seed: 1, result: "W" }, R32_D2: { team: "Mich St", seed: 2, result: "W" }}},
      { id: "f12", name: "Cinderella Story", owner: "Megan", status: "eliminated", streak: 1, eliminatedDay: "R64_D2", picks: { R64_D1: { team: "Florida", seed: 1, result: "W" }, R64_D2: { team: "Grand Canyon", seed: 13, result: "L" }}},
      { id: "f13", name: "Sweet 16 or Bust", owner: "Alex", status: "alive", streak: 4, picks: { R64_D1: { team: "Tennessee", seed: 2, result: "W" }, R64_D2: { team: "St. John's", seed: 2, result: "W" }, R32_D1: { team: "Duke", seed: 1, result: "W" }, R32_D2: { team: "Auburn", seed: 1, result: "W" }}},
      { id: "f14", name: "One Shining Moment", owner: "Tina", status: "eliminated", streak: 2, eliminatedDay: "R32_D1", picks: { R64_D1: { team: "Duke", seed: 1, result: "W" }, R64_D2: { team: "Florida", seed: 1, result: "W" }, R32_D1: { team: "BYU", seed: 6, result: "L" }}},
      { id: "f15", name: "Buzzer Beater SZN", owner: "Nick", status: "alive", streak: 4, picks: { R64_D1: { team: "Florida", seed: 1, result: "W" }, R64_D2: { team: "Tennessee", seed: 2, result: "W" }, R32_D1: { team: "Mich St", seed: 2, result: "W" }, R32_D2: { team: "Alabama", seed: 2, result: "W" }}},
      { id: "f16", name: "Dagger 🗡️", owner: "Omar", status: "eliminated", streak: 3, eliminatedDay: "R32_D2", picks: { R64_D1: { team: "Auburn", seed: 1, result: "W" }, R64_D2: { team: "Houston", seed: 1, result: "W" }, R32_D1: { team: "Florida", seed: 1, result: "W" }, R32_D2: { team: "Marquette", seed: 7, result: "L" }}},
    ],
  },
  {
    id: "pool2", name: "Office Bracket Busters", host: "Work League", buyIn: 10, pot: 640, alive: 23, total: 64,
    entries: [
      { id: "e3", name: "BSU to the Ship", owner: USER.name, ownerId: "me", status: "alive", streak: 4, needsPick: true,
        picks: {
          R64_D1: { team: "Auburn", seed: 1, region: "S", result: "W" },
          R64_D2: { team: "St. John's", seed: 2, region: "W", result: "W" },
          R32_D1: { team: "Houston", seed: 1, region: "MW", result: "W" },
          R32_D2: { team: "Duke", seed: 1, region: "E", result: "W" },
        }},
      { id: "e4", name: "SDSU to the Ship", owner: USER.name, ownerId: "me", status: "alive", streak: 4, needsPick: true,
        picks: {
          R64_D1: { team: "Florida", seed: 1, region: "W", result: "W" },
          R64_D2: { team: "Houston", seed: 1, region: "MW", result: "W" },
          R32_D1: { team: "Alabama", seed: 2, region: "E", result: "W" },
          R32_D2: { team: "Auburn", seed: 1, region: "S", result: "W" },
        }},
    ],
    field: [
      { id: "f9", name: "HR Department", owner: "Amy", status: "alive", streak: 4, picks: { R64_D1: { team: "Houston", seed: 1, result: "W" }, R64_D2: { team: "Duke", seed: 1, result: "W" }, R32_D1: { team: "Auburn", seed: 1, result: "W" }, R32_D2: { team: "Florida", seed: 1, result: "W" }}},
      { id: "f10", name: "Ctrl+Alt+Delete", owner: "Dev Team", status: "eliminated", streak: 2, eliminatedDay: "R32_D1", picks: { R64_D1: { team: "Duke", seed: 1, result: "W" }, R64_D2: { team: "Alabama", seed: 2, result: "W" }, R32_D1: { team: "Marquette", seed: 7, result: "L" }}},
    ],
  },
];

const roundColors = { R64: T.textTertiary, R32: T.textSecondary, S16: T.info, E8: T.warning, F4: T.eliminated, CHIP: T.orange };



// ══════════════════════════════════════════════════════════════
// THE FIELD
// ══════════════════════════════════════════════════════════════
function TheField({ pools, mob }) {
  const [selectedPoolId, setSelectedPoolId] = useState(pools[0].id);
  const [filter, setFilter] = useState("all");
  const [sortBy, setSortBy] = useState("streak");

  const pool = pools.find(p => p.id === selectedPoolId);
  const allFieldEntries = [...(pool?.entries || []), ...(pool?.field || [])];

  const filtered = useMemo(() => {
    let list = [...allFieldEntries];
    if (filter === "alive") list = list.filter(e => e.status === "alive");
    if (filter === "eliminated") list = list.filter(e => e.status !== "alive");
    list.sort((a, b) => {
      if (sortBy === "streak") return b.streak - a.streak;
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "owner") return (a.owner || "").localeCompare(b.owner || "");
      return 0;
    });
    const mine = list.filter(e => e.ownerId === "me");
    const others = list.filter(e => e.ownerId !== "me");
    return [...mine, ...others];
  }, [selectedPoolId, filter, sortBy, allFieldEntries.length]); // eslint-disable-line

  const aliveCount = allFieldEntries.filter(e => e.status === "alive").length;
  const elimCount = allFieldEntries.filter(e => e.status !== "alive").length;

  // Cell renderer
  const PickCell = ({ pick, isCurrent, isAlive, isElimAfter }) => {
    if (!pick && isElimAfter) {
      return <div style={{ textAlign: "center", padding: "4px 0" }}><span style={{ fontSize: "0.5rem", opacity: 0.25 }}>—</span></div>;
    }
    if (!pick) {
      return (
        <div style={{ textAlign: "center", padding: "4px 0" }}>
          {isCurrent && isAlive ? (
            <span style={{ fontFamily: T.fontMono, fontSize: "0.45rem", color: T.orange, fontWeight: 700 }}>TBD</span>
          ) : (
            <span style={{ fontFamily: T.fontMono, fontSize: "0.45rem", color: T.textDisabled }}>—</span>
          )}
        </div>
      );
    }
    const isWin = pick.result === "W";
    const isLoss = pick.result === "L";
    return (
      <div style={{
        textAlign: "center", padding: mob ? "4px 2px" : "3px 4px",
      }}>
        <div style={{
          fontFamily: T.fontCondensed, fontWeight: 700,
          fontSize: mob ? "0.65rem" : "0.7rem",
          textTransform: "uppercase", lineHeight: 1.1,
          color: isWin ? T.alive : isLoss ? T.eliminated : T.textPrimary,
        }}>{pick.team}</div>
        <div style={{
          fontFamily: T.fontMono, fontSize: "0.38rem",
          color: isWin ? "rgba(76,175,80,0.6)" : isLoss ? "rgba(239,83,80,0.6)" : T.textDisabled,
          lineHeight: 1,
        }}>({pick.seed}){isWin ? " ✓" : isLoss ? " ✗" : ""}</div>
      </div>
    );
  };

  // Column widths
  const nameColW = mob ? 130 : 180;
  const statusColW = mob ? 50 : 64;
  const pickColW = mob ? 72 : 82;

  return (
    <div style={{ padding: mob ? "14px 0 14px 14px" : "20px 0 20px 24px", maxWidth: 960, margin: "0 auto" }}>

      {/* Pool selector */}
      <div style={{ marginBottom: mob ? 10 : 14, paddingRight: mob ? 14 : 24 }}>
        <div style={{ display: "flex", gap: 5, overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          {pools.map(p => {
            const isActive = p.id === selectedPoolId;
            return (
              <button key={p.id} onClick={() => setSelectedPoolId(p.id)} style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: mob ? "8px 12px" : "9px 16px",
                background: isActive ? T.surface3 : T.surface0,
                border: isActive ? `1.5px solid ${T.orange}` : `1px solid ${T.borderDefault}`,
                borderRadius: T.radiusMd, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
              }}>
                <span style={{
                  fontFamily: T.fontDisplay, fontWeight: isActive ? 700 : 500,
                  fontSize: mob ? "0.8rem" : "0.85rem", textTransform: "uppercase",
                  color: isActive ? T.orange : T.textSecondary,
                }}>{p.name}</span>
                <span style={{ fontFamily: T.fontMono, fontSize: "0.38rem", fontWeight: 700, color: T.alive, letterSpacing: "0.06em" }}>{p.alive}/{p.total}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Summary strip */}
      <div style={{ display: "flex", alignItems: "stretch", gap: mob ? 5 : 6, marginBottom: mob ? 10 : 14, paddingRight: mob ? 14 : 24 }}>
        {[
          { v: aliveCount, l: "ALIVE", c: T.alive, bg: T.aliveSub, bc: "rgba(76,175,80,0.15)" },
          { v: elimCount, l: "ELIMINATED", c: T.eliminated, bg: T.elimSub, bc: "rgba(239,83,80,0.15)" },
          { v: `$${pool?.pot}`, l: "POT", c: T.textPrimary, bg: T.surface2, bc: T.borderSubtle },
        ].map((s, i) => (
          <div key={i} style={{ flex: 1, padding: mob ? "8px" : "10px 14px", textAlign: "center", background: s.bg, borderRadius: T.radiusMd, border: `1px solid ${s.bc}` }}>
            <div style={{ fontFamily: T.fontDisplay, fontWeight: 700, fontSize: mob ? "1.2rem" : "1.4rem", color: s.c, lineHeight: 1 }}>{s.v}</div>
            <div style={{ fontFamily: T.fontMono, fontSize: "0.33rem", letterSpacing: "0.15em", color: s.c, marginTop: 2, opacity: 0.7 }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Filter + Sort */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: mob ? 6 : 8, paddingRight: mob ? 14 : 24 }}>
        <div style={{ display: "flex", gap: 4 }}>
          {[
            { key: "all", label: "All", count: allFieldEntries.length },
            { key: "alive", label: "Alive", count: aliveCount },
            { key: "eliminated", label: "Out", count: elimCount },
          ].map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)} style={{
              fontFamily: T.fontDisplay, fontWeight: filter === f.key ? 700 : 500,
              fontSize: mob ? "0.65rem" : "0.72rem", textTransform: "uppercase",
              padding: mob ? "5px 7px" : "5px 12px",
              background: filter === f.key ? T.surface4 : "transparent",
              border: filter === f.key ? `1px solid ${T.borderStrong}` : `1px solid ${T.borderSubtle}`,
              borderRadius: T.radiusSm, cursor: "pointer",
              color: filter === f.key ? T.textPrimary : T.textTertiary,
            }}>
              {f.label} <span style={{ fontFamily: T.fontMono, fontSize: "0.38rem", marginLeft: 2, opacity: 0.6 }}>{f.count}</span>
            </button>
          ))}
        </div>
        <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{
          fontFamily: T.fontMono, fontSize: "0.42rem", letterSpacing: "0.06em",
          background: T.surface2, border: `1px solid ${T.borderDefault}`,
          borderRadius: T.radiusSm, color: T.textSecondary, padding: "5px 8px", cursor: "pointer",
        }}>
          <option value="streak">STREAK</option>
          <option value="name">NAME</option>
          <option value="owner">OWNER</option>
        </select>
      </div>

      {/* ═══ THE GRID ═══ */}
      <div style={{
        position: "relative",
        border: `1px solid ${T.borderDefault}`,
        borderRadius: T.radiusLg, overflow: "hidden",
        background: T.surface0,
      }}>
        {/* Scrollable wrapper */}
        <div style={{
          overflowX: "auto", WebkitOverflowScrolling: "touch",
        }}>
          <table style={{
            borderCollapse: "separate", borderSpacing: 0,
            width: "max-content", minWidth: "100%",
          }}>
            {/* ── Header ── */}
            <thead>
              <tr>
                {/* Sticky: Entry name */}
                <th style={{
                  position: "sticky", left: 0, zIndex: 20,
                  background: T.surface2,
                  padding: mob ? "8px 10px" : "10px 14px",
                  textAlign: "left", minWidth: nameColW, maxWidth: nameColW,
                  fontFamily: T.fontMono, fontSize: "0.38rem", fontWeight: 700,
                  letterSpacing: "0.15em", color: T.textTertiary,
                  borderBottom: `2px solid ${T.borderStrong}`,
                  borderRight: `2px solid ${T.borderStrong}`,
                }}>ENTRY</th>
                {/* Status */}
                <th style={{
                  background: T.surface2,
                  padding: mob ? "8px 4px" : "10px 8px",
                  textAlign: "center", minWidth: statusColW, width: statusColW,
                  fontFamily: T.fontMono, fontSize: "0.35rem", fontWeight: 700,
                  letterSpacing: "0.12em", color: T.textTertiary,
                  borderBottom: `2px solid ${T.borderStrong}`,
                }}>STK</th>
                {/* Day columns */}
                {DAYS.map((d, i) => {
                  const isCurrent = i === CURRENT_DAY_IDX;
                  const isPast = i < CURRENT_DAY_IDX;
                  return (
                    <th key={d.id} style={{
                      background: isCurrent ? "rgba(255,87,34,0.06)" : T.surface2,
                      padding: mob ? "6px 4px" : "8px 6px",
                      textAlign: "center", minWidth: pickColW, width: pickColW,
                      borderBottom: `2px solid ${isCurrent ? T.orange : T.borderStrong}`,
                      borderLeft: `1px solid ${T.borderSubtle}`,
                    }}>
                      <div style={{
                        fontFamily: T.fontDisplay, fontWeight: 700,
                        fontSize: mob ? "0.6rem" : "0.65rem",
                        color: isCurrent ? T.orange : isPast ? T.textSecondary : T.textDisabled,
                        textTransform: "uppercase",
                      }}>{d.short}</div>
                      <div style={{
                        fontFamily: T.fontMono, fontSize: "0.3rem",
                        color: isCurrent ? T.orange : T.textDisabled,
                        letterSpacing: "0.06em", marginTop: 1, opacity: 0.6,
                      }}>{d.date}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            {/* ── Body ── */}
            <tbody>
              {filtered.map((entry, rowIdx) => {
                const isAlive = entry.status === "alive";
                const isMine = entry.ownerId === "me";
                const elimDayIdx = entry.eliminatedDay ? DAYS.findIndex(d => d.id === entry.eliminatedDay) : -1;
                const isEvenRow = rowIdx % 2 === 0;
                const rowBg = isMine ? "rgba(255,87,34,0.04)" : isEvenRow ? "transparent" : "rgba(255,255,255,0.015)";

                return (
                  <tr key={entry.id} style={{ opacity: isAlive ? 1 : 0.45 }}>
                    {/* Sticky: Entry name */}
                    <td style={{
                      position: "sticky", left: 0, zIndex: 10,
                      background: isMine ? T.surface3 : isEvenRow ? T.surface0 : T.surface1,
                      padding: mob ? "8px 10px" : "8px 14px",
                      minWidth: nameColW, maxWidth: nameColW,
                      borderBottom: `1px solid ${T.borderSubtle}`,
                      borderRight: `2px solid ${T.borderStrong}`,
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{
                          width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
                          background: isAlive ? T.alive : T.eliminated,
                          boxShadow: isAlive ? `0 0 4px ${T.alive}44` : "none",
                        }} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{
                            fontFamily: T.fontDisplay, fontWeight: 600,
                            fontSize: mob ? "0.75rem" : "0.8rem",
                            textTransform: "uppercase",
                            color: isAlive ? T.textPrimary : T.textSecondary,
                            textDecoration: isAlive ? "none" : "line-through",
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          }}>{entry.name}</div>
                          <div style={{
                            fontFamily: T.fontMono, fontSize: "0.35rem",
                            color: isMine ? T.orange : T.textTertiary,
                            letterSpacing: "0.06em",
                          }}>{entry.owner}{isMine ? " · YOU" : ""}</div>
                        </div>
                      </div>
                    </td>

                    {/* Status / Streak */}
                    <td style={{
                      background: rowBg,
                      padding: "4px", textAlign: "center",
                      borderBottom: `1px solid ${T.borderSubtle}`,
                      minWidth: statusColW, width: statusColW,
                    }}>
                      {isAlive ? (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 2 }}>
                          <span style={{ fontSize: "0.5rem" }}>🔥</span>
                          <span style={{ fontFamily: T.fontMono, fontWeight: 700, fontSize: mob ? "0.65rem" : "0.7rem", color: T.textPrimary }}>{entry.streak}</span>
                        </div>
                      ) : (
                        <div style={{ fontFamily: T.fontMono, fontSize: "0.45rem", color: T.eliminated }}>
                          ☠ D{elimDayIdx + 1}
                        </div>
                      )}
                    </td>

                    {/* Pick cells */}
                    {DAYS.map((d, i) => {
                      const pick = entry.picks[d.id];
                      const isCurrent = i === CURRENT_DAY_IDX;
                      const isElimAfter = !isAlive && elimDayIdx >= 0 && i > elimDayIdx;
                      const cellBg = pick?.result === "W" ? T.aliveSub
                        : pick?.result === "L" ? T.elimSub
                        : isCurrent ? "rgba(255,87,34,0.04)"
                        : rowBg;
                      return (
                        <td key={d.id} style={{
                          background: cellBg,
                          borderBottom: `1px solid ${T.borderSubtle}`,
                          borderLeft: `1px solid ${T.borderSubtle}`,
                          borderTop: isCurrent ? `none` : "none",
                          minWidth: pickColW, width: pickColW,
                          padding: 0,
                          boxShadow: isCurrent ? `inset 1px 0 0 ${T.borderAccent}, inset -1px 0 0 ${T.borderAccent}` : "none",
                        }}>
                          <PickCell pick={pick} isCurrent={isCurrent} isAlive={isAlive} isElimAfter={isElimAfter} />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Fade hint for mobile scroll */}
        {mob && (
          <div style={{
            position: "absolute", top: 0, right: 0, bottom: 0, width: 24,
            background: "linear-gradient(90deg, transparent, rgba(8,8,16,0.6))",
            pointerEvents: "none", zIndex: 5,
          }} />
        )}
      </div>

      {/* Legend */}
      <div style={{
        display: "flex", gap: mob ? 10 : 16, marginTop: 10,
        paddingRight: mob ? 14 : 24, flexWrap: "wrap",
      }}>
        {[
          { color: T.alive, label: "Survived" },
          { color: T.eliminated, label: "Eliminated" },
          { color: T.orange, label: "Current Day" },
          { color: T.textDisabled, label: "Pending" },
        ].map((l, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: l.color, opacity: l.color === T.textDisabled ? 0.5 : 0.7 }} />
            <span style={{ fontFamily: T.fontMono, fontSize: "0.38rem", color: T.textTertiary, letterSpacing: "0.08em" }}>{l.label}</span>
          </div>
        ))}
      </div>

      <div style={{ height: 80 }} />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// APP SHELL
// ══════════════════════════════════════════════════════════════
export default function App() {
  const [tab, setTab] = useState("home");
  const [mob, setMob] = useState(false);

  useEffect(() => {
    const check = () => setMob(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const TABS = [
    { id: "home", label: "Home", icon: "⌂" },
    { id: "field", label: "The Field", icon: "👥" },
    { id: "pick", label: "Pick", icon: "🏀" },
    { id: "bracket", label: "Bracket", icon: "📊" },
    { id: "analyze", label: "Analyze", icon: "🔍" },
  ];

  return (
    <div style={{ background: T.surface1, color: T.textPrimary, minHeight: "100vh", fontFamily: T.fontBody }}>
      <link href="https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Barlow+Condensed:wght@600;700;800&family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes statusPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
      `}</style>

      {/* ═══ Top Header ═══ */}
      <div style={{
        background: T.surface0, borderBottom: `1px solid ${T.borderDefault}`,
        padding: mob ? "10px 14px" : "12px 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
          <span style={{ fontFamily: T.fontCondensed, fontWeight: 800, fontSize: "0.45rem", letterSpacing: "0.35em", color: "rgba(232,230,225,0.35)" }}>SURVIVE</span>
          <span style={{ fontFamily: T.fontDisplay, fontWeight: 700, fontSize: "0.6rem", letterSpacing: "0.1em", color: T.orange }}>THE</span>
          <span style={{ fontFamily: T.fontDisplay, fontWeight: 700, fontSize: "0.9rem", letterSpacing: "-0.01em", color: T.textPrimary }}>DANCE</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            fontFamily: T.fontMono, fontSize: "0.38rem", letterSpacing: "0.1em",
            color: T.textTertiary, padding: "3px 8px", background: T.surface3,
            borderRadius: 9999, border: `1px solid ${T.borderDefault}`,
          }}>S16 · DAY 5</div>
          <div style={{
            width: 28, height: 28, borderRadius: "50%",
            background: `linear-gradient(135deg, ${T.orange}, ${T.warning})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: T.fontDisplay, fontWeight: 700, fontSize: "0.65rem", color: T.textInverse,
          }}>M</div>
        </div>
      </div>

      {/* ═══ Page Content ═══ */}
      <div style={{ paddingBottom: 60 }}>
        {tab === "home" && <HomeDashboard pools={POOLS} mob={mob} onNavigate={setTab} />}
        {tab === "field" && <TheField pools={POOLS} mob={mob} />}
        {tab === "pick" && (
          <div style={{ padding: mob ? "40px 14px" : "60px 24px", textAlign: "center", maxWidth: 500, margin: "0 auto" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>🏀</div>
            <div style={{ fontFamily: T.fontDisplay, fontWeight: 700, fontSize: "1.3rem", textTransform: "uppercase", color: T.textPrimary, marginBottom: 6 }}>Pick Tab</div>
            <div style={{ fontFamily: T.fontBody, fontSize: "0.85rem", color: T.textSecondary }}>See the standalone pick-tab.jsx for the full pick experience</div>
          </div>
        )}
        {tab === "bracket" && (
          <div style={{ padding: mob ? "40px 14px" : "60px 24px", textAlign: "center", maxWidth: 500, margin: "0 auto" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>📊</div>
            <div style={{ fontFamily: T.fontDisplay, fontWeight: 700, fontSize: "1.3rem", textTransform: "uppercase", color: T.textPrimary, marginBottom: 6 }}>Bracket View</div>
            <div style={{ fontFamily: T.fontBody, fontSize: "0.85rem", color: T.textSecondary }}>See bracket-viewer.jsx for the full bracket experience</div>
          </div>
        )}
        {tab === "analyze" && (
          <div style={{ padding: mob ? "40px 14px" : "60px 24px", textAlign: "center", maxWidth: 500, margin: "0 auto" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>🔍</div>
            <div style={{ fontFamily: T.fontDisplay, fontWeight: 700, fontSize: "1.3rem", textTransform: "uppercase", color: T.textPrimary, marginBottom: 6 }}>Bracket Planner</div>
            <div style={{ fontFamily: T.fontBody, fontSize: "0.85rem", color: T.textSecondary }}>See survivor-grid.jsx for the full planner experience</div>
          </div>
        )}
      </div>

      {/* ═══ Bottom Nav ═══ */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        background: T.surface0, borderTop: `1px solid ${T.borderDefault}`,
        display: "flex", justifyContent: "space-around", alignItems: "center",
        padding: mob ? "6px 0 10px" : "8px 0 12px",
        zIndex: 500,
      }}>
        {TABS.map(t => {
          const isActive = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
              background: "none", border: "none", cursor: "pointer",
              padding: "4px 8px", minWidth: 48,
              transition: "all 150ms ease",
            }}>
              <span style={{
                fontSize: mob ? "1rem" : "1.1rem",
                filter: isActive ? "none" : "grayscale(1) opacity(0.5)",
                transition: "filter 200ms ease",
              }}>{t.icon}</span>
              <span style={{
                fontFamily: T.fontDisplay, fontWeight: isActive ? 700 : 500,
                fontSize: "0.55rem", textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: isActive ? T.orange : T.textTertiary,
              }}>{t.label}</span>
              {isActive && <div style={{
                width: 16, height: 2, borderRadius: 1, background: T.orange,
                marginTop: 1,
              }} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
