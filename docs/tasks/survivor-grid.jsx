import { useState, useMemo, useCallback, useEffect } from "react";

// ══════════════════════════════════════════════════════════════
// DESIGN TOKENS (Survive the Dance)
// ══════════════════════════════════════════════════════════════
const T = {
  orange: "#FF5722", orangeHover: "#FF6D3A", orangeActive: "#E64A19",
  orangeSubtle: "rgba(255, 87, 34, 0.08)", orangeGlow: "rgba(255, 87, 34, 0.25)",
  navy: "#0D1B2A",
  surface0: "#080810", surface1: "#0D1B2A", surface2: "#111827",
  surface3: "#1B2A3D", surface4: "#243447", surface5: "#2D3E52",
  alive: "#4CAF50", aliveSub: "rgba(76, 175, 80, 0.12)",
  eliminated: "#EF5350", elimSub: "rgba(239, 83, 80, 0.12)",
  warning: "#FFB300", warnSub: "rgba(255, 179, 0, 0.12)",
  info: "#42A5F5", infoSub: "rgba(66, 165, 245, 0.12)",
  textPrimary: "#E8E6E1", textSecondary: "#9BA3AE",
  textTertiary: "#5F6B7A", textDisabled: "#3D4654", textInverse: "#0D1B2A",
  borderSubtle: "rgba(255, 255, 255, 0.05)", borderDefault: "rgba(255, 255, 255, 0.08)",
  borderStrong: "rgba(255, 255, 255, 0.12)",
  borderAccent: "rgba(255, 87, 34, 0.3)", borderAccentStrong: "rgba(255, 87, 34, 0.6)",
  fontDisplay: "'Oswald', sans-serif", fontCondensed: "'Barlow Condensed', sans-serif",
  fontBody: "'DM Sans', sans-serif", fontMono: "'Space Mono', monospace",
  radiusSm: 6, radiusMd: 10, radiusLg: 14,
};

// ── Bracket Data ─────────────────────────────────────────────
const BRACKET = {
  East: [
    { seed: 1, team: "Duke" }, { seed: 2, team: "Alabama" }, { seed: 3, team: "Wisconsin" }, { seed: 4, team: "Arizona" },
    { seed: 5, team: "Oregon" }, { seed: 6, team: "BYU" }, { seed: 7, team: "St. Mary's" }, { seed: 8, team: "Miss St" },
    { seed: 9, team: "Baylor" }, { seed: 10, team: "Vanderbilt" }, { seed: 11, team: "VCU" }, { seed: 12, team: "Liberty" },
    { seed: 13, team: "Akron" }, { seed: 14, team: "Montana" }, { seed: 15, team: "Robert Morris" }, { seed: 16, team: "American" },
  ],
  South: [
    { seed: 1, team: "Auburn" }, { seed: 2, team: "Mich St" }, { seed: 3, team: "Iowa St" }, { seed: 4, team: "Texas A&M" },
    { seed: 5, team: "Michigan" }, { seed: 6, team: "Ole Miss" }, { seed: 7, team: "Marquette" }, { seed: 8, team: "Louisville" },
    { seed: 9, team: "Creighton" }, { seed: 10, team: "New Mexico" }, { seed: 11, team: "SDSU/UNC" }, { seed: 12, team: "UC San Diego" },
    { seed: 13, team: "Yale" }, { seed: 14, team: "Lipscomb" }, { seed: 15, team: "Bryant" }, { seed: 16, team: "Ala St/SFU" },
  ],
  West: [
    { seed: 1, team: "Florida" }, { seed: 2, team: "St. John's" }, { seed: 3, team: "Texas Tech" }, { seed: 4, team: "Maryland" },
    { seed: 5, team: "Memphis" }, { seed: 6, team: "Missouri" }, { seed: 7, team: "Kansas" }, { seed: 8, team: "UConn" },
    { seed: 9, team: "Oklahoma" }, { seed: 10, team: "Arkansas" }, { seed: 11, team: "Drake" }, { seed: 12, team: "Colorado St" },
    { seed: 13, team: "Grand Canyon" }, { seed: 14, team: "UNCW" }, { seed: 15, team: "Omaha" }, { seed: 16, team: "Norfolk St" },
  ],
  Midwest: [
    { seed: 1, team: "Houston" }, { seed: 2, team: "Tennessee" }, { seed: 3, team: "Kentucky" }, { seed: 4, team: "Purdue" },
    { seed: 5, team: "Clemson" }, { seed: 6, team: "Illinois" }, { seed: 7, team: "UCLA" }, { seed: 8, team: "Gonzaga" },
    { seed: 9, team: "Georgia" }, { seed: 10, team: "Utah St" }, { seed: 11, team: "Texas/Xavier" }, { seed: 12, team: "McNeese" },
    { seed: 13, team: "High Point" }, { seed: 14, team: "Troy" }, { seed: 15, team: "Wofford" }, { seed: 16, team: "SIU-E" },
  ],
};

const REGIONS = ["East", "South", "West", "Midwest"];
const R64_SEEDS = [[1,16],[8,9],[5,12],[4,13],[6,11],[3,14],[7,10],[2,15]];
const R32_FEEDERS = [[0,1],[2,3],[4,5],[6,7]];
const S16_FEEDERS = [[0,1],[2,3]];
const E8_FEEDERS = [[0,1]];
const HALF_A = { R64: [0,1,2,3], R32: [0,1], S16: [0] };
const HALF_B = { R64: [4,5,6,7], R32: [2,3], S16: [1] };
const PREV_ROUND = { R32: "R64", S16: "R32", E8: "S16", F4: "E8" };
const FEEDERS_MAP = { R32: R32_FEEDERS, S16: S16_FEEDERS, E8: E8_FEEDERS };

const DAYS = [
  { id: "R64_D1", label: "R64 Day 1", date: "Mar 19", round: "R64", half: "A", allRegions: true },
  { id: "R64_D2", label: "R64 Day 2", date: "Mar 20", round: "R64", half: "B", allRegions: true },
  { id: "R32_D1", label: "R32 Day 1", date: "Mar 21", round: "R32", half: "A", allRegions: true },
  { id: "R32_D2", label: "R32 Day 2", date: "Mar 22", round: "R32", half: "B", allRegions: true },
  { id: "S16_D1", label: "S16 Day 1", date: "Mar 26", round: "S16", half: "A", allRegions: true },
  { id: "S16_D2", label: "S16 Day 2", date: "Mar 27", round: "S16", half: "B", allRegions: true },
  { id: "E8_D1", label: "E8 Day 1", date: "Mar 28", round: "E8", fixedRegions: ["East", "South"] },
  { id: "E8_D2", label: "E8 Day 2", date: "Mar 29", round: "E8", fixedRegions: ["West", "Midwest"] },
  { id: "F4", label: "Final Four", date: "Apr 4", round: "F4", allRegions: true },
  { id: "CHIP", label: "Championship", date: "Apr 6", round: "CHIP", allRegions: true },
];

const roundColors = { R64: T.textTertiary, R32: T.textSecondary, S16: T.info, E8: T.warning, F4: T.eliminated, CHIP: T.orange };

const sty = {
  label: { fontFamily: T.fontMono, fontSize: "0.6rem", letterSpacing: "0.2em", textTransform: "uppercase", color: T.textTertiary },
  labelAccent: { fontFamily: T.fontMono, fontSize: "0.6rem", letterSpacing: "0.2em", textTransform: "uppercase", color: T.orange },
  heading: { fontFamily: T.fontDisplay, fontWeight: 700, textTransform: "uppercase", lineHeight: 1.15 },
  subheading: { fontFamily: T.fontDisplay, fontWeight: 600, textTransform: "uppercase", lineHeight: 1.2 },
  body: { fontFamily: T.fontBody, fontSize: "0.95rem", lineHeight: 1.65, color: T.textSecondary },
  data: { fontFamily: T.fontMono, fontWeight: 700, letterSpacing: "0.03em" },
  card: { background: T.surface2, border: `1px solid ${T.borderSubtle}`, borderRadius: T.radiusLg, padding: "24px" },
};

// ══════════════════════════════════════════════════════════════
// TUTORIAL STEPS (shared between demo & planner onboarding)
// ══════════════════════════════════════════════════════════════
const TUTORIAL_STEPS = [
  {
    id: "predict",
    title: "PREDICT WINNERS",
    body: "Click a team name to predict they'll win — they advance into the next round's matchup. Try calling an upset.",
    expandDay: "R64_D1",
    highlightId: "day-R64_D1",
  },
  {
    id: "pin",
    title: "LOCK YOUR PICK",
    body: "Hit the ✎ button next to a team to pin it as your survivor pick for this day. That team is burned — crossed out everywhere else.",
    expandDay: "R64_D1",
    highlightId: "day-R64_D1",
  },
  {
    id: "flow",
    title: "WATCH IT FLOW FORWARD",
    body: "Your predicted winners from R64 are now the teams in the R32 matchups. Pinned picks are struck through — gone for the rest of the tournament.",
    expandDay: "R32_D1",
    highlightId: "day-R32_D1",
  },
  {
    id: "tracker",
    title: "WATCH YOUR REGIONS",
    body: "The region bars track how many picks you've used from each region. Too heavy in one and you'll run out of options in the Elite 8.",
    expandDay: null,
    highlightId: "region-tracker",
  },
  {
    id: "danger",
    title: "THE ELITE 8 TRAP",
    body: "The Bracket Flow shows your full projected path. Teams you've already burned appear red with a strikethrough. If your E8 contender is red — you're stuck.",
    expandDay: null,
    highlightId: "bracket-flow",
  },
];

// ══════════════════════════════════════════════════════════════
// COACHING BAR (bottom tooltip — no overlay)
// ══════════════════════════════════════════════════════════════
function CoachingBar({ step, stepIndex, totalSteps, onNext, onDismiss, isDemo }) {
  if (!step) return null;
  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0,
      zIndex: 500, animation: "slideUp 0.3s ease",
      pointerEvents: "auto",
    }}>
      <div style={{
        maxWidth: 720, margin: "0 auto",
        background: T.surface3,
        border: `1px solid ${T.borderAccent}`,
        borderBottom: "none",
        borderRadius: `${T.radiusLg}px ${T.radiusLg}px 0 0`,
        padding: "16px 20px",
        boxShadow: "0 -4px 30px rgba(0,0,0,0.5), 0 0 20px rgba(255,87,34,0.08)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <span style={{
                fontFamily: T.fontDisplay, fontWeight: 700, fontSize: "0.7rem",
                color: T.orange, background: T.orangeSubtle,
                padding: "3px 10px", borderRadius: 9999,
                border: `1px solid ${T.borderAccent}`,
              }}>{stepIndex + 1}/{totalSteps}</span>
              <span style={{ ...sty.subheading, fontSize: "0.85rem", color: T.textPrimary }}>{step.title}</span>
            </div>
            <p style={{ fontFamily: T.fontBody, fontSize: "0.85rem", color: T.textSecondary, lineHeight: 1.55, margin: 0 }}>
              {step.body}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0, alignItems: "center" }}>
            <button onClick={onDismiss} style={{
              background: "none", border: `1.5px solid ${T.borderStrong}`,
              color: T.textSecondary, borderRadius: T.radiusSm,
              padding: "8px 14px", cursor: "pointer",
              fontFamily: T.fontDisplay, fontWeight: 600, fontSize: "0.7rem",
              textTransform: "uppercase", letterSpacing: "0.05em",
            }}>{isDemo ? "Skip" : "Got it"}</button>
            <button onClick={onNext} style={{
              background: T.orange, border: "none", color: T.textInverse,
              borderRadius: T.radiusSm, padding: "8px 18px", cursor: "pointer",
              fontFamily: T.fontDisplay, fontWeight: 600, fontSize: "0.7rem",
              textTransform: "uppercase", letterSpacing: "0.05em",
              boxShadow: "0 0 12px rgba(255,87,34,0.2)",
            }}>{stepIndex < totalSteps - 1 ? "Next →" : "Done ✓"}</button>
          </div>
        </div>
        {/* Progress dots */}
        <div style={{ display: "flex", gap: 4, marginTop: 10, justifyContent: "center" }}>
          {Array.from({ length: totalSteps }, (_, i) => (
            <div key={i} style={{
              width: i === stepIndex ? 20 : 6, height: 4, borderRadius: 2,
              background: i === stepIndex ? T.orange : i < stepIndex ? `${T.orange}66` : T.surface5,
              transition: "all 250ms ease",
            }} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Highlight ring ───────────────────────────────────────────
function HighlightRing({ active, children, id }) {
  return (
    <div id={id} style={{
      position: "relative",
      boxShadow: active ? `0 0 0 2px ${T.orange}, 0 0 20px rgba(255,87,34,0.15)` : "none",
      borderRadius: active ? T.radiusLg : 0,
      transition: "box-shadow 300ms ease",
      zIndex: active ? 400 : "auto",
    }}>
      {children}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════
export default function SurvivorPlanner() {
  const [view, setView] = useState("splash"); // splash | demo | planner
  const [picks, setPicks] = useState({});
  const [advancers, setAdvancers] = useState({});
  const [expanded, setExpanded] = useState(null);
  const [regionFlipped, setRegionFlipped] = useState({ East: false, South: false, West: false, Midwest: false });
  const [e8Swapped, setE8Swapped] = useState(false);

  // Tutorial state (shared by demo + planner onboarding)
  const [tutorialStep, setTutorialStep] = useState(0);
  const [tutorialActive, setTutorialActive] = useState(false);
  const [tutorialDismissed, setTutorialDismissed] = useState(false);

  // Demo-only modal states
  const [showDemoWelcome, setShowDemoWelcome] = useState(false);
  const [showDemoCta, setShowDemoCta] = useState(false);

  const isDemo = view === "demo";
  const showTutorial = tutorialActive && !tutorialDismissed;
  const currentStep = showTutorial ? TUTORIAL_STEPS[tutorialStep] : null;

  // Auto-expand days during tutorial
  useEffect(() => {
    if (showTutorial && currentStep?.expandDay) {
      setExpanded(currentStep.expandDay);
    }
  }, [showTutorial, tutorialStep]); // eslint-disable-line

  const usedTeams = useMemo(() => new Set(Object.values(picks).map(p => p.team)), [picks]);
  const regionCounts = useMemo(() => {
    const c = { East: 0, West: 0, South: 0, Midwest: 0 };
    Object.values(picks).forEach(p => c[p.region]++);
    return c;
  }, [picks]);

  const findTeam = useCallback((region, seed) => BRACKET[region].find(t => t.seed === seed), []);

  const getTeamsInGame = useCallback((region, round, gameIdx) => {
    if (round === "R64") {
      const [s1, s2] = R64_SEEDS[gameIdx];
      return [findTeam(region, s1), findTeam(region, s2)];
    }
    return FEEDERS_MAP[round][gameIdx].map(fi => getGameWinner(region, PREV_ROUND[round], fi));
  }, [advancers]); // eslint-disable-line

  const getGameWinner = useCallback((region, round, gameIdx) => {
    const gameId = `${region}_${round}_${gameIdx}`;
    const teams = getTeamsInGame(region, round, gameIdx);
    if (advancers[gameId] && teams.some(t => t && t.team === advancers[gameId].team)) return advancers[gameId];
    const valid = teams.filter(Boolean);
    return valid.length ? valid.reduce((a, b) => a.seed < b.seed ? a : b) : null;
  }, [advancers]); // eslint-disable-line

  const getMatchupsForDay = useCallback((region, day) => {
    const { round } = day;
    if (round === "F4" || round === "CHIP") {
      const champ = getGameWinner(region, "E8", 0);
      return champ ? [{ gameIdx: 0, teams: [champ], label: round === "F4" ? `${region} Champion` : "Title Contender", round }] : [];
    }
    let half = day.half;
    if (half && regionFlipped[region]) half = half === "A" ? "B" : "A";
    const gameIndices = round === "E8" ? [0] : half === "A" ? HALF_A[round] : HALF_B[round];
    return gameIndices.map(gi => ({
      gameIdx: gi,
      teams: getTeamsInGame(region, round, gi),
      label: round === "R64" ? `(${R64_SEEDS[gi][0]}) vs (${R64_SEEDS[gi][1]})` :
        getTeamsInGame(region, round, gi).filter(Boolean).map(t => `(${t.seed}) ${t.team}`).join(" vs "),
      round,
    }));
  }, [advancers, regionFlipped]); // eslint-disable-line

  const toggleAdvancer = (region, round, gameIdx, team) => {
    const gameId = `${region}_${round}_${gameIdx}`;
    if (advancers[gameId]?.team === team.team) {
      const n = { ...advancers }; delete n[gameId]; setAdvancers(n);
    } else {
      setAdvancers({ ...advancers, [gameId]: team });
    }
  };

  const handlePick = (dayId, team, region, round, gameIdx) => {
    if (picks[dayId]?.team === team.team) {
      const n = { ...picks }; delete n[dayId]; setPicks(n);
    } else if (!usedTeams.has(team.team)) {
      setPicks({ ...picks, [dayId]: { ...team, region, dayId } });
      const gameId = `${region}_${round}_${gameIdx}`;
      const teams = getTeamsInGame(region, round, gameIdx);
      const chalk = teams.filter(Boolean).reduce((a, b) => a.seed < b.seed ? a : b, teams[0]);
      if (chalk?.team !== team.team) setAdvancers(prev => ({ ...prev, [gameId]: team }));
    }
  };

  const getRegionsForDay = (day) => {
    if (day.allRegions) return REGIONS;
    if (day.round === "E8") {
      const base = [["East", "South"], ["West", "Midwest"]];
      if (e8Swapped) base.reverse();
      return day.id === "E8_D1" ? base[0] : base[1];
    }
    return REGIONS;
  };

  const resetAll = () => { setPicks({}); setAdvancers({}); setExpanded(null); };

  // ── Navigation / Tutorial Control ─────────────────────────
  const startDemo = () => {
    resetAll();
    setTutorialStep(0);
    setTutorialActive(false);
    setTutorialDismissed(false);
    setShowDemoWelcome(true);
    setShowDemoCta(false);
    setView("demo");
  };

  const startPlanner = () => {
    resetAll();
    setTutorialStep(0);
    setTutorialActive(true);
    setTutorialDismissed(false);
    setShowDemoWelcome(false);
    setShowDemoCta(false);
    setView("planner");
  };

  const advanceTutorial = () => {
    if (tutorialStep < TUTORIAL_STEPS.length - 1) {
      setTutorialStep(tutorialStep + 1);
    } else {
      // Finished last step
      setTutorialActive(false);
      setTutorialDismissed(true);
      if (isDemo) {
        setShowDemoCta(true);
      }
    }
  };

  const dismissTutorial = () => {
    setTutorialActive(false);
    setTutorialDismissed(true);
    if (isDemo) {
      setShowDemoCta(true);
    }
  };

  const goToSplash = () => { setView("splash"); resetAll(); setTutorialActive(false); setTutorialDismissed(false); setShowDemoCta(false); setShowDemoWelcome(false); };

  const restartTutorial = () => {
    setTutorialStep(0);
    setTutorialActive(true);
    setTutorialDismissed(false);
  };

  // ══════════════════════════════════════════════════════════
  // SPLASH PAGE
  // ══════════════════════════════════════════════════════════
  if (view === "splash") {
    return (
      <div style={{ background: T.surface1, color: T.textPrimary, minHeight: "100vh", fontFamily: T.fontBody }}>
        <link href="https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Barlow+Condensed:wght@600;700;800&family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />

        {/* Hero */}
        <div style={{
          position: "relative", overflow: "hidden", padding: "80px 24px 60px",
          textAlign: "center", background: T.surface0, borderBottom: `1px solid ${T.borderDefault}`,
        }}>
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 400, height: 400, borderRadius: "50%", border: "1.5px solid rgba(255, 87, 34, 0.06)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 220, height: 220, borderRadius: "50%", border: "1.5px solid rgba(255, 87, 34, 0.04)", pointerEvents: "none" }} />

          <div style={sty.labelAccent}>ANALYZE TAB</div>
          <h1 style={{
            fontFamily: T.fontDisplay, fontWeight: 700, fontSize: "clamp(2.2rem, 6vw, 3.5rem)",
            textTransform: "uppercase", lineHeight: 0.95, letterSpacing: "-0.02em", margin: "12px 0 0",
          }}>
            <span style={{ color: T.orange }}>BRACKET</span><br />PLANNER
          </h1>
          <div style={{ width: 60, height: 3, background: T.orange, borderRadius: 2, margin: "20px auto 24px" }} />
          <p style={{ ...sty.body, maxWidth: 520, margin: "0 auto 36px", fontSize: "1.05rem" }}>
            Map your entire survivor strategy before tip-off. Predict upsets, plan your picks,
            and see exactly where you'll get stuck — so you won't.
          </p>

          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={startPlanner} style={{
              fontFamily: T.fontDisplay, fontWeight: 600, textTransform: "uppercase",
              letterSpacing: "0.05em", fontSize: "1rem",
              background: T.orange, color: T.textInverse, border: "none",
              padding: "16px 40px", borderRadius: T.radiusMd, cursor: "pointer",
              boxShadow: "0 0 20px rgba(255, 87, 34, 0.2)",
            }}>Start Planning</button>
            <button onClick={startDemo} style={{
              fontFamily: T.fontDisplay, fontWeight: 600, textTransform: "uppercase",
              letterSpacing: "0.05em", fontSize: "1rem",
              background: "transparent", color: T.textPrimary,
              border: `1.5px solid ${T.borderStrong}`,
              padding: "16px 40px", borderRadius: T.radiusMd, cursor: "pointer",
              transition: "all 250ms ease",
            }}
              onMouseOver={e => { e.target.style.borderColor = T.orange; e.target.style.color = T.orange; e.target.style.background = T.orangeSubtle; }}
              onMouseOut={e => { e.target.style.borderColor = T.borderStrong; e.target.style.color = T.textPrimary; e.target.style.background = "transparent"; }}
            >Try Demo</button>
          </div>
          <div style={{
            marginTop: 20, display: "inline-flex", alignItems: "center", gap: 6,
            fontFamily: T.fontMono, fontSize: "0.55rem", letterSpacing: "0.15em", textTransform: "uppercase",
            background: "linear-gradient(135deg, rgba(255, 87, 34, 0.12), rgba(255, 179, 0, 0.08))",
            color: T.orange, padding: "4px 14px", borderRadius: 9999,
          }}>★ SURVIVE+ FEATURE</div>
        </div>

        {/* How It Works */}
        <div style={{ maxWidth: 800, margin: "0 auto", padding: "48px 24px" }}>
          <div style={{ ...sty.labelAccent, marginBottom: 8 }}>HOW IT WORKS</div>
          <h2 style={{ ...sty.heading, fontSize: "1.35rem", marginBottom: 32 }}>Don't Just Pick — Plan the Whole Dance</h2>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            {[
              { num: "01", title: "PREDICT WINNERS", desc: "Click any team to advance them through the bracket. Call upsets early — the bracket adjusts everywhere." },
              { num: "02", title: "PIN YOUR PICKS", desc: "Lock your survivor selection for each day. That team gets burned — it's gone from every other round." },
              { num: "03", title: "SPOT THE TRAPS", desc: "Region tracker and flow chart show exactly where you're overexposed. See it before it kills your run." },
            ].map(item => (
              <div key={item.num} style={sty.card}>
                <div style={{ fontFamily: T.fontDisplay, fontWeight: 700, fontSize: "2rem", color: T.orange, opacity: 0.3, marginBottom: 8 }}>{item.num}</div>
                <div style={{ ...sty.subheading, fontSize: "0.95rem", marginBottom: 8, color: T.textPrimary }}>{item.title}</div>
                <p style={{ ...sty.body, fontSize: "0.85rem", lineHeight: 1.55 }}>{item.desc}</p>
              </div>
            ))}
          </div>

          <div style={{
            background: T.orangeSubtle, border: `1px solid ${T.borderAccent}`,
            borderRadius: T.radiusLg, padding: 24, marginTop: 32,
            display: "flex", gap: 20, alignItems: "flex-start",
          }}>
            <div style={{ fontFamily: T.fontDisplay, fontWeight: 700, fontSize: "2.5rem", color: T.orange, lineHeight: 1, flexShrink: 0 }}>!</div>
            <div>
              <div style={{ ...sty.subheading, fontSize: "1rem", marginBottom: 6, color: T.textPrimary }}>THE ELITE 8 IS WHERE RUNS DIE</div>
              <p style={{ ...sty.body, fontSize: "0.9rem", lineHeight: 1.6, margin: 0 }}>
                By the Elite 8, there's exactly <span style={{ color: T.orange, fontFamily: T.fontMono, fontWeight: 700 }}>1 game per region per day</span>.
                Burn your best teams early and you're stuck picking a long shot to survive the biggest games.
              </p>
            </div>
          </div>

          <div style={{ marginTop: 32 }}>
            <div style={{ ...sty.labelAccent, marginBottom: 8 }}>THE SCHEDULE</div>
            <h2 style={{ ...sty.heading, fontSize: "1.35rem", marginBottom: 20 }}>10 Days. 10 Picks. Zero Margin.</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {[
                { round: "R64", days: "MAR 19–20", games: "32 GAMES/DAY", note: "All 4 regions, bracket halves split across days", danger: false },
                { round: "R32", days: "MAR 21–22", games: "16 GAMES/DAY", note: "Still 4 regions each day, pool shrinking fast", danger: false },
                { round: "S16", days: "MAR 26–27", games: "4 GAMES/DAY", note: "1 game per region per day. Options narrow.", danger: false },
                { round: "E8", days: "MAR 28–29", games: "2 GAMES/DAY", note: "Only 2 regions per day. The kill zone.", danger: true },
              ].map(r => (
                <div key={r.round} style={{ ...sty.card, padding: 16, borderLeft: `3px solid ${r.danger ? T.eliminated : T.borderStrong}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ ...sty.data, fontSize: "1.1rem", color: r.danger ? T.eliminated : T.textPrimary }}>{r.round}</span>
                    <span style={{ ...sty.label, fontSize: "0.55rem" }}>{r.days}</span>
                  </div>
                  <div style={{ ...sty.data, fontSize: "0.75rem", color: T.orange, marginBottom: 4 }}>{r.games}</div>
                  <p style={{ fontFamily: T.fontBody, fontSize: "0.8rem", color: T.textSecondary, margin: 0, lineHeight: 1.5 }}>{r.note}</p>
                </div>
              ))}
            </div>
          </div>

          <div style={{ textAlign: "center", marginTop: 48, paddingBottom: 32 }}>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <button onClick={startPlanner} style={{
                fontFamily: T.fontDisplay, fontWeight: 600, textTransform: "uppercase",
                letterSpacing: "0.05em", fontSize: "0.9rem",
                background: T.orange, color: T.textInverse, border: "none",
                padding: "14px 36px", borderRadius: T.radiusSm, cursor: "pointer",
                boxShadow: "0 0 20px rgba(255, 87, 34, 0.2)",
              }}>Launch Bracket Planner</button>
              <button onClick={startDemo} style={{
                fontFamily: T.fontDisplay, fontWeight: 600, textTransform: "uppercase",
                letterSpacing: "0.05em", fontSize: "0.9rem",
                background: "transparent", color: T.textPrimary,
                border: `1.5px solid ${T.borderStrong}`,
                padding: "14px 36px", borderRadius: T.radiusSm, cursor: "pointer",
              }}>See It in Action</button>
            </div>
            <div style={{ marginTop: 16, fontFamily: T.fontMono, fontSize: "0.55rem", color: T.textTertiary, letterSpacing: "0.12em" }}>
              FULL ACCESS WITH SURVIVE+ · FREE DEMO AVAILABLE
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════
  // PLANNER VIEW (shared by demo + full planner)
  // ══════════════════════════════════════════════════════════
  return (
    <div style={{ background: T.surface1, color: T.textPrimary, minHeight: "100vh", fontFamily: T.fontBody, paddingBottom: showTutorial ? 110 : 0 }}>
      <link href="https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Barlow+Condensed:wght@600;700;800&family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(40px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>

      {/* ── Demo Welcome Modal (demo only, with overlay) ── */}
      {isDemo && showDemoWelcome && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(8, 8, 16, 0.85)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 600, animation: "fadeIn 0.3s ease",
        }}>
          <div style={{
            background: T.surface2, border: `1px solid ${T.borderDefault}`,
            borderRadius: T.radiusLg, padding: "36px", maxWidth: 440, textAlign: "center",
          }}>
            <div style={{ ...sty.labelAccent, marginBottom: 12 }}>INTERACTIVE DEMO</div>
            <div style={{ ...sty.heading, fontSize: "1.35rem", marginBottom: 12 }}>LET'S PLAN YOUR RUN</div>
            <div style={{ width: 40, height: 3, background: T.orange, borderRadius: 2, margin: "0 auto 16px" }} />
            <p style={{ ...sty.body, fontSize: "0.9rem", lineHeight: 1.6, marginBottom: 24 }}>
              We'll walk you through planning 2 picks so you can see how the tool prevents you from getting stuck in later rounds. Takes about 60 seconds.
            </p>
            <button onClick={() => { setShowDemoWelcome(false); setTutorialActive(true); }} style={{
              fontFamily: T.fontDisplay, fontWeight: 600, textTransform: "uppercase",
              letterSpacing: "0.05em", fontSize: "0.9rem",
              background: T.orange, color: T.textInverse, border: "none",
              padding: "12px 36px", borderRadius: T.radiusSm, cursor: "pointer",
              boxShadow: "0 0 20px rgba(255, 87, 34, 0.2)",
            }}>Let's Go →</button>
            <div style={{ marginTop: 12 }}>
              <button onClick={() => { setShowDemoWelcome(false); dismissTutorial(); }} style={{
                background: "none", border: "none", color: T.textTertiary,
                fontFamily: T.fontBody, fontSize: "0.8rem", cursor: "pointer",
              }}>Skip demo</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Demo CTA Modal (demo only, with overlay) ── */}
      {isDemo && showDemoCta && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(8, 8, 16, 0.85)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 600, animation: "fadeIn 0.3s ease",
        }}>
          <div style={{
            background: T.surface2, border: `1px solid ${T.borderAccent}`,
            borderRadius: T.radiusLg, padding: "40px", maxWidth: 480, textAlign: "center",
            boxShadow: "0 0 60px rgba(255, 87, 34, 0.15)",
          }}>
            <div style={{ fontFamily: T.fontCondensed, fontWeight: 800, fontSize: "0.65rem", letterSpacing: "0.5em", textTransform: "uppercase", color: "rgba(232, 230, 225, 0.4)", marginBottom: 2 }}>SURVIVE</div>
            <div style={{ fontFamily: T.fontDisplay, fontWeight: 700, fontSize: "1.3rem", letterSpacing: "0.15em", textTransform: "uppercase", color: T.orange, lineHeight: 1.1 }}>THE</div>
            <div style={{ fontFamily: T.fontDisplay, fontWeight: 700, fontSize: "2.2rem", letterSpacing: "-0.02em", textTransform: "uppercase", color: T.textPrimary, lineHeight: 0.85, marginBottom: 20 }}>DANCE</div>
            <div style={{ width: 60, height: 3, background: T.orange, borderRadius: 2, margin: "0 auto 20px" }} />
            <div style={{ ...sty.heading, fontSize: "1.2rem", marginBottom: 8 }}>YOU'VE SEEN THE PLAYBOOK</div>
            <p style={{ ...sty.body, fontSize: "0.9rem", marginBottom: 24, lineHeight: 1.6 }}>
              The full Bracket Planner lets you map all 10 picks, predict every matchup,
              and see exactly where your strategy breaks — before it costs you your entry.
            </p>
            <button onClick={() => { setShowDemoCta(false); setView("planner"); resetAll(); setTutorialDismissed(true); setTutorialActive(false); }} style={{
              fontFamily: T.fontDisplay, fontWeight: 600, textTransform: "uppercase",
              letterSpacing: "0.05em", fontSize: "1rem", width: "100%",
              background: T.orange, color: T.textInverse, border: "none",
              padding: "16px 32px", borderRadius: T.radiusMd, cursor: "pointer",
              boxShadow: "0 0 20px rgba(255, 87, 34, 0.2)", marginBottom: 12,
            }}>Unlock Full Planner</button>
            <div style={{ fontFamily: T.fontMono, fontSize: "0.6rem", color: T.textTertiary, letterSpacing: "0.1em" }}>
              INCLUDED WITH SURVIVE+ · $9.99/TOURNAMENT
            </div>
            <button onClick={goToSplash} style={{
              background: "none", border: "none", color: T.textTertiary,
              fontFamily: T.fontBody, fontSize: "0.8rem", cursor: "pointer",
              marginTop: 16, padding: "8px", textDecoration: "underline", textUnderlineOffset: 3,
            }}>Maybe later</button>
          </div>
        </div>
      )}

      {/* ── Coaching Bar (no overlay — just the bottom bar) ── */}
      {showTutorial && (
        <CoachingBar
          step={currentStep}
          stepIndex={tutorialStep}
          totalSteps={TUTORIAL_STEPS.length}
          onNext={advanceTutorial}
          onDismiss={dismissTutorial}
          isDemo={isDemo}
        />
      )}

      {/* ═══ Top Bar ═══ */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "16px 24px", borderBottom: `1px solid ${T.borderDefault}`, background: T.surface0,
        position: "relative", zIndex: 450,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button onClick={goToSplash} style={{
            background: "none", border: `1.5px solid ${T.borderStrong}`, color: T.textSecondary,
            borderRadius: T.radiusSm, padding: "6px 16px", cursor: "pointer",
            fontFamily: T.fontDisplay, fontWeight: 600, fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.05em",
          }}>← Back</button>
          <div>
            <div style={{ ...sty.labelAccent, fontSize: "0.5rem" }}>ANALYZE</div>
            <div style={{ ...sty.heading, fontSize: "1.2rem" }}>
              Bracket Planner
              {isDemo && (
                <span style={{
                  fontFamily: T.fontMono, fontSize: "0.5rem", fontWeight: 700,
                  background: T.warnSub, color: T.warning, padding: "2px 8px",
                  borderRadius: 9999, marginLeft: 10, verticalAlign: "middle", letterSpacing: "0.12em",
                }}>DEMO</span>
              )}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* Tutorial restart */}
          {tutorialDismissed && !showDemoCta && (
            <button onClick={restartTutorial} style={{
              background: "none", border: `1px solid ${T.borderDefault}`, color: T.textTertiary,
              borderRadius: T.radiusSm, padding: "4px 10px", cursor: "pointer",
              fontFamily: T.fontMono, fontSize: "0.5rem", letterSpacing: "0.1em",
            }}>? TUTORIAL</button>
          )}
          <div style={{ ...sty.data, fontSize: "0.85rem", color: Object.keys(picks).length === 10 ? T.alive : T.textSecondary }}>
            {Object.keys(picks).length}/10
          </div>
          <span style={{ ...sty.label, fontSize: "0.5rem" }}>PICKS SET</span>
          {(Object.keys(picks).length > 0 || Object.keys(advancers).length > 0) && (
            <button onClick={resetAll} style={{
              background: "none", border: `1.5px solid ${T.borderStrong}`, color: T.textTertiary,
              borderRadius: T.radiusSm, padding: "4px 12px", cursor: "pointer",
              fontFamily: T.fontDisplay, fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase",
            }}>Reset</button>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "20px 24px" }}>

        {/* ═══ Region Trackers ═══ */}
        <HighlightRing active={showTutorial && currentStep?.highlightId === "region-tracker"} id="region-tracker">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 20 }}>
            {REGIONS.map(region => {
              const cnt = regionCounts[region]; const avail = BRACKET[region].filter(t => !usedTeams.has(t.team)).length;
              const danger = cnt >= 4; const warn = cnt >= 3;
              const barColor = danger ? T.eliminated : warn ? T.warning : T.orange;
              return (
                <div key={region} style={{ ...sty.card, padding: "12px 14px", borderLeft: `3px solid ${danger ? T.eliminated : warn ? T.warning : T.borderStrong}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ ...sty.subheading, fontSize: "0.9rem", color: T.textPrimary }}>{region}</span>
                    <span style={{
                      fontFamily: T.fontMono, fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.12em",
                      textTransform: "uppercase", padding: "3px 10px", borderRadius: 9999,
                      background: danger ? T.elimSub : warn ? T.warnSub : T.orangeSubtle, color: barColor,
                    }}>{cnt} USED</span>
                  </div>
                  <div style={{ display: "flex", gap: 3, marginTop: 10 }}>
                    {[...Array(4)].map((_, i) => (
                      <div key={i} style={{
                        flex: 1, height: 6, borderRadius: 2,
                        background: i < cnt ? barColor : "rgba(255,255,255,0.06)",
                        boxShadow: i < cnt ? `0 0 6px ${barColor}33` : "none", transition: "all 250ms ease",
                      }} />
                    ))}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                    <span style={{ fontFamily: T.fontMono, fontSize: "0.6rem", color: T.textTertiary }}>{avail}/16 LEFT</span>
                    <button onClick={() => setRegionFlipped(p => ({ ...p, [region]: !p[region] }))} style={{
                      background: "none", border: `1px solid ${T.borderDefault}`,
                      color: regionFlipped[region] ? T.orange : T.textTertiary,
                      borderRadius: 3, fontSize: "0.55rem", cursor: "pointer", padding: "1px 6px",
                      fontFamily: T.fontMono, letterSpacing: "0.1em",
                    }}>{regionFlipped[region] ? "⇄ FLIPPED" : "⇄ FLIP"}</button>
                  </div>
                </div>
              );
            })}
          </div>
        </HighlightRing>

        {/* ═══ 10 Day Cards ═══ */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {DAYS.map((day, idx) => {
            const isExp = expanded === day.id;
            const pick = picks[day.id];
            const regions = getRegionsForDay(day);
            const rc = roundColors[day.round];
            const isHighlighted = showTutorial && currentStep?.highlightId === `day-${day.id}`;

            return (
              <HighlightRing key={day.id} active={isHighlighted} id={`day-${day.id}`}>
                <div style={{
                  background: isExp ? T.surface2 : T.surface0,
                  border: pick ? `1px solid ${T.borderAccent}` : `1px solid ${isExp ? T.borderDefault : T.borderSubtle}`,
                  borderRadius: T.radiusLg, overflow: "hidden", transition: "all 250ms ease",
                  boxShadow: pick ? "0 0 20px rgba(255, 87, 34, 0.08)" : "none",
                }}>
                  <div onClick={() => setExpanded(isExp ? null : day.id)} style={{
                    display: "flex", alignItems: "center", padding: "12px 20px", cursor: "pointer", gap: 14,
                  }}>
                    <div style={{ fontFamily: T.fontDisplay, fontWeight: 700, fontSize: "0.9rem", color: rc, minWidth: 28, textAlign: "center" }}>{idx + 1}</div>
                    <div style={{ width: 1, height: 32, background: T.borderDefault }} />
                    <div style={{ minWidth: 110 }}>
                      <div style={{ fontFamily: T.fontDisplay, fontWeight: 600, fontSize: "0.95rem", textTransform: "uppercase" }}>{day.date}</div>
                      <div style={{ fontFamily: T.fontMono, fontSize: "0.55rem", color: rc, letterSpacing: "0.15em", marginTop: 2 }}>
                        {day.label}{day.half && <span style={{ color: T.textTertiary }}> · {day.half === "A" ? "TOP" : "BTM"} HALF</span>}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                      {regions.map(r => (
                        <span key={r} style={{
                          fontFamily: T.fontMono, fontSize: "0.5rem", fontWeight: 700, letterSpacing: "0.12em",
                          padding: "3px 7px", borderRadius: 9999,
                          background: T.surface3, color: T.textSecondary, border: `1px solid ${T.borderDefault}`,
                        }}>{r.slice(0, 2)}</span>
                      ))}
                      {day.round === "E8" && (
                        <button onClick={(e) => { e.stopPropagation(); setE8Swapped(!e8Swapped); }} style={{
                          background: "none", border: `1px solid ${T.borderDefault}`, color: T.textTertiary,
                          borderRadius: 4, fontSize: "0.6rem", cursor: "pointer", padding: "2px 5px", fontFamily: T.fontMono,
                        }}>⇄</button>
                      )}
                    </div>
                    <div style={{ flex: 1 }}>
                      {pick ? (
                        <div style={{
                          display: "inline-flex", alignItems: "center", gap: 8,
                          background: T.orangeSubtle, border: `1.5px solid ${T.orange}`,
                          borderRadius: T.radiusSm, padding: "5px 14px",
                          boxShadow: `0 0 0 1px rgba(255,87,34,0.15), 0 0 20px rgba(255,87,34,0.12)`,
                        }}>
                          <span style={{ fontFamily: T.fontDisplay, fontWeight: 700, fontSize: "0.55rem", color: T.textTertiary, minWidth: 16, textAlign: "center" }}>{pick.seed}</span>
                          <span style={{ fontFamily: T.fontDisplay, fontWeight: 700, fontSize: "0.95rem", textTransform: "uppercase", color: T.orange }}>{pick.team}</span>
                          <span style={{ fontFamily: T.fontMono, fontSize: "0.5rem", color: T.textTertiary, letterSpacing: "0.1em" }}>{pick.region.toUpperCase()}</span>
                        </div>
                      ) : (
                        <span style={{ fontFamily: T.fontBody, fontSize: "0.85rem", color: T.textDisabled }}>No pick set</span>
                      )}
                    </div>
                    <span style={{ color: T.textTertiary, fontSize: "0.7rem" }}>{isExp ? "▲" : "▼"}</span>
                  </div>

                  {isExp && (
                    <div style={{ padding: "4px 20px 20px", display: "grid", gridTemplateColumns: `repeat(${regions.length}, 1fr)`, gap: 10 }}>
                      {regions.map(region => {
                        const matchups = getMatchupsForDay(region, day);
                        return (
                          <div key={region} style={{
                            background: T.surface0, borderRadius: T.radiusMd, padding: "12px 14px",
                            border: `1px solid ${T.borderSubtle}`, borderTop: `3px solid ${T.orange}`,
                          }}>
                            <div style={{ ...sty.subheading, fontSize: "0.85rem", marginBottom: 10, display: "flex", justifyContent: "space-between" }}>
                              <span>{region}</span>
                              <span style={{ ...sty.label, fontSize: "0.5rem" }}>{matchups.length} GAME{matchups.length !== 1 ? "S" : ""}</span>
                            </div>
                            {matchups.map((mu, i) => {
                              const winner = (mu.round === "F4" || mu.round === "CHIP") ? mu.teams[0] : getGameWinner(region, mu.round, mu.gameIdx);
                              const adv = advancers[`${region}_${mu.round}_${mu.gameIdx}`];
                              const chalkSeed = mu.teams.filter(Boolean).reduce((min, t) => Math.min(min, t.seed), 99);
                              const hasUpset = mu.round !== "F4" && mu.round !== "CHIP" && adv && adv.seed > chalkSeed;
                              const isSingle = mu.teams.length === 1 || mu.round === "F4" || mu.round === "CHIP";
                              return (
                                <div key={i} style={{
                                  marginBottom: 8, padding: "8px 10px", borderRadius: T.radiusSm,
                                  background: T.surface2, border: hasUpset ? `1px solid ${T.warning}44` : `1px solid ${T.borderSubtle}`,
                                }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                                    <span style={{ ...sty.label, fontSize: "0.5rem" }}>{isSingle ? mu.label : `GAME ${mu.gameIdx + 1}`}</span>
                                    {hasUpset && <span style={{ fontFamily: T.fontMono, fontSize: "0.5rem", fontWeight: 700, color: T.warning, letterSpacing: "0.12em", background: T.warnSub, padding: "2px 6px", borderRadius: 9999 }}>⚡ UPSET</span>}
                                  </div>
                                  {mu.teams.map(team => {
                                    if (!team) return null;
                                    const isUsed = usedTeams.has(team.team);
                                    const isPick = pick?.team === team.team;
                                    const isAdv = winner?.team === team.team;
                                    const canPick = !isUsed || isPick;
                                    return (
                                      <div key={team.team} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                                        <button onClick={(e) => { e.stopPropagation(); if (!isSingle) toggleAdvancer(region, mu.round, mu.gameIdx, team); }} style={{
                                          flex: 1, display: "flex", alignItems: "center", gap: 8, padding: "6px 10px",
                                          borderRadius: T.radiusSm, fontFamily: T.fontDisplay, fontWeight: isAdv ? 700 : 500,
                                          fontSize: "0.9rem", textTransform: "uppercase", textAlign: "left",
                                          background: isPick ? T.orangeSubtle : isAdv && !isSingle ? T.surface3 : "transparent",
                                          color: isPick ? T.orange : isUsed && !isPick ? T.textDisabled : isAdv ? T.textPrimary : T.textSecondary,
                                          border: isPick ? `1.5px solid ${T.orange}` : isAdv && !isSingle ? `1px solid ${T.borderDefault}` : "1px solid transparent",
                                          cursor: isSingle ? "default" : "pointer",
                                          textDecoration: isUsed && !isPick ? "line-through" : "none",
                                          opacity: isUsed && !isPick ? 0.35 : 1, transition: "all 150ms ease",
                                        }}>
                                          <span style={{ fontFamily: T.fontDisplay, fontWeight: 700, fontSize: "0.75rem", color: T.textTertiary, minWidth: 18, textAlign: "center" }}>{team.seed}</span>
                                          <span>{team.team}</span>
                                          {isAdv && !isSingle && <span style={{ fontFamily: T.fontMono, fontSize: "0.55rem", color: T.alive, marginLeft: "auto" }}>✓</span>}
                                        </button>
                                        <button onClick={(e) => { e.stopPropagation(); if (canPick) handlePick(day.id, team, region, mu.round, mu.gameIdx); }} style={{
                                          width: 28, height: 28, borderRadius: T.radiusSm, flexShrink: 0,
                                          display: "flex", alignItems: "center", justifyContent: "center",
                                          background: isPick ? T.orangeSubtle : "transparent",
                                          border: isPick ? `1.5px solid ${T.orange}` : `1.5px solid ${T.borderDefault}`,
                                          color: isPick ? T.orange : canPick ? T.textTertiary : T.textDisabled,
                                          cursor: canPick ? "pointer" : "not-allowed",
                                          opacity: canPick ? 1 : 0.25, transition: "all 150ms ease",
                                          fontFamily: T.fontBody, fontSize: "0.75rem",
                                          boxShadow: isPick ? `0 0 0 1px ${T.orange}, 0 0 12px rgba(255,87,34,0.2)` : "none",
                                        }} title={isPick ? "Remove pick" : `Pick ${team.team}`}>✎</button>
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </HighlightRing>
            );
          })}
        </div>

        {/* ═══ Bracket Flow ═══ */}
        <HighlightRing active={showTutorial && currentStep?.highlightId === "bracket-flow"} id="bracket-flow">
          <div style={{ ...sty.card, marginTop: 20, padding: 20 }}>
            <div style={{ ...sty.labelAccent, marginBottom: 8 }}>PROJECTED PATH</div>
            <div style={{ ...sty.heading, fontSize: "1.1rem", marginBottom: 16 }}>Bracket Flow</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
              {REGIONS.map(region => {
                const r32 = [0,1,2,3].map(gi => getGameWinner(region, "R32", gi));
                const s16t = [0,1].map(gi => getGameWinner(region, "S16", gi));
                const e8W = getGameWinner(region, "E8", 0);
                const Pill = ({ t, big }) => t ? (
                  <span style={{
                    fontFamily: big ? T.fontDisplay : T.fontMono,
                    fontSize: big ? "0.9rem" : "0.6rem",
                    fontWeight: 700, padding: big ? "4px 10px" : "2px 6px",
                    borderRadius: big ? T.radiusSm : 3, letterSpacing: "0.03em",
                    textTransform: big ? "uppercase" : "none", display: "inline-block",
                    background: usedTeams.has(t.team) ? T.elimSub : big ? T.orangeSubtle : T.surface3,
                    color: usedTeams.has(t.team) ? T.eliminated : big ? T.orange : T.textPrimary,
                    border: `1px solid ${usedTeams.has(t.team) ? "rgba(239,83,80,0.3)" : big ? T.borderAccent : T.borderDefault}`,
                    textDecoration: usedTeams.has(t.team) ? "line-through" : "none",
                  }}>({t.seed}) {t.team}</span>
                ) : null;
                return (
                  <div key={region} style={{
                    background: T.surface0, borderRadius: T.radiusMd, padding: "12px 14px",
                    border: `1px solid ${T.borderSubtle}`, borderTop: `3px solid ${T.orange}`,
                  }}>
                    <div style={{ ...sty.subheading, fontSize: "0.85rem", marginBottom: 10 }}>{region}</div>
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ ...sty.label, fontSize: "0.45rem", marginBottom: 4 }}>R32 WINNERS</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>{r32.map((t, i) => <Pill key={i} t={t} />)}</div>
                    </div>
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ ...sty.label, fontSize: "0.45rem", marginBottom: 4 }}>S16 WINNERS</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>{s16t.map((t, i) => <Pill key={i} t={t} />)}</div>
                    </div>
                    <div>
                      <div style={{ ...sty.label, fontSize: "0.45rem", marginBottom: 4 }}>REGION CHAMP</div>
                      <Pill t={e8W} big />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </HighlightRing>

        {/* ═══ Usage Map ═══ */}
        <div style={{ ...sty.card, marginTop: 14, padding: 20 }}>
          <div style={{ ...sty.labelAccent, marginBottom: 8 }}>USAGE MAP</div>
          <div style={{ ...sty.heading, fontSize: "1.1rem", marginBottom: 16 }}>Region × Day</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 3, tableLayout: "fixed" }}>
              <thead><tr>
                <th style={{ ...sty.label, fontSize: "0.5rem", width: 70, textAlign: "left", padding: 4 }}>REGION</th>
                {DAYS.map(d => <th key={d.id} style={{ fontFamily: T.fontMono, fontSize: "0.4rem", color: T.textTertiary, textAlign: "center", padding: 3, fontWeight: 600, letterSpacing: "0.08em" }}>{d.label.replace("Day ", "D")}</th>)}
                <th style={{ ...sty.label, fontSize: "0.5rem", textAlign: "center", padding: 4, width: 36 }}>TOT</th>
              </tr></thead>
              <tbody>
                {REGIONS.map(region => {
                  const dayPicks = {}; Object.values(picks).forEach(p => { if (p.region === region) dayPicks[p.dayId] = true; });
                  const tot = regionCounts[region];
                  return (
                    <tr key={region}>
                      <td style={{ ...sty.subheading, fontSize: "0.8rem", padding: 4 }}>{region}</td>
                      {DAYS.map(day => {
                        const hasPick = dayPicks[day.id]; const hasGames = getRegionsForDay(day).includes(region);
                        return (
                          <td key={day.id} style={{
                            textAlign: "center", padding: 4, borderRadius: 3,
                            background: hasPick ? T.orangeSubtle : !hasGames ? T.surface0 : T.surface2,
                            border: hasPick ? `1px solid ${T.borderAccent}` : "1px solid transparent",
                            fontFamily: T.fontMono, fontSize: "0.7rem", fontWeight: 700,
                            color: hasPick ? T.orange : !hasGames ? T.surface1 : T.textDisabled,
                          }}>{!hasGames ? "—" : hasPick ? "●" : "·"}</td>
                        );
                      })}
                      <td style={{
                        textAlign: "center", padding: 4, borderRadius: 3,
                        fontFamily: T.fontMono, fontSize: "0.85rem", fontWeight: 700,
                        background: tot >= 4 ? T.elimSub : tot >= 3 ? T.warnSub : T.surface2,
                        color: tot >= 4 ? T.eliminated : tot >= 3 ? T.warning : T.textTertiary,
                      }}>{tot}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ═══ Pick Sheet ═══ */}
        <div style={{ ...sty.card, marginTop: 14, padding: 20, marginBottom: 32 }}>
          <div style={{ ...sty.labelAccent, marginBottom: 8 }}>YOUR PLAN</div>
          <div style={{ ...sty.heading, fontSize: "1.1rem", marginBottom: 16 }}>Pick Sheet</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 }}>
            {DAYS.map(day => {
              const p = picks[day.id];
              return (
                <div key={day.id} style={{
                  padding: "8px 10px", borderRadius: T.radiusSm, textAlign: "center",
                  background: p ? T.orangeSubtle : T.surface0,
                  border: p ? `1.5px solid ${T.orange}` : `1px dashed ${T.borderDefault}`,
                  boxShadow: p ? "0 0 12px rgba(255,87,34,0.1)" : "none",
                }}>
                  <div style={{ fontFamily: T.fontMono, fontSize: "0.5rem", letterSpacing: "0.15em", color: T.textTertiary, marginBottom: 4 }}>{day.label}</div>
                  {p ? (
                    <>
                      <div style={{ fontFamily: T.fontDisplay, fontWeight: 700, fontSize: "0.85rem", textTransform: "uppercase", color: T.orange }}>{p.team}</div>
                      <div style={{ fontFamily: T.fontMono, fontSize: "0.5rem", color: T.textTertiary, marginTop: 2 }}>({p.seed}) · {p.region.toUpperCase()}</div>
                    </>
                  ) : (
                    <div style={{ fontFamily: T.fontBody, fontSize: "0.8rem", color: T.textDisabled, padding: "4px 0" }}>—</div>
                  )}
                </div>
              );
            })}
          </div>
          {Object.entries(regionCounts).some(([_, c]) => c >= 4) && (
            <div style={{
              marginTop: 14, padding: "12px 16px", borderRadius: T.radiusMd,
              background: T.elimSub, border: `1px solid ${T.eliminated}`,
              display: "flex", alignItems: "center", gap: 12,
            }}>
              <span style={{ fontSize: "1.2rem" }}>⚠</span>
              <div>
                <div style={{ fontFamily: T.fontBody, fontWeight: 500, fontSize: "0.9rem", color: T.eliminated }}>Heavy regional exposure</div>
                <div style={{ fontFamily: T.fontBody, fontSize: "0.8rem", color: T.textSecondary, marginTop: 2 }}>
                  {Object.entries(regionCounts).filter(([_, c]) => c >= 4).map(([r]) => r).join(", ")} — you're burning through teams in later rounds.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
