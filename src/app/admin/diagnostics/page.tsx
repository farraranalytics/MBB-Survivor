'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { supabase } from '@/lib/supabase/client';

// ─── Types ──────────────────────────────────────────────────────

interface TestResult {
  success: boolean;
  data?: any;
  error?: string;
  duration_ms: number;
  quota?: { remaining: number | null; used: number | null };
}

interface ActionResult {
  timestamp: string;
  action: string;
  result: any;
}

// ─── Helpers ────────────────────────────────────────────────────

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric',
      minute: '2-digit',
    }) + ' ET';
  } catch {
    return '—';
  }
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', {
      timeZone: 'America/New_York',
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '—';
  }
}

function formatProb(p: number | null): string {
  if (p === null || p === undefined) return '—';
  return `${(p * 100).toFixed(1)}%`;
}

function formatML(ml: number | null): string {
  if (ml === null || ml === undefined) return '—';
  return ml > 0 ? `+${ml}` : `${ml}`;
}

function formatSpread(sp: number | null): string {
  if (sp === null || sp === undefined) return '—';
  return sp > 0 ? `+${sp}` : `${sp}`;
}

// ─── Status Dot ─────────────────────────────────────────────────

function StatusDot({ color }: { color: 'green' | 'yellow' | 'red' | 'gray' }) {
  const colors = {
    green: '#4CAF50',
    yellow: '#FFB300',
    red: '#EF5350',
    gray: '#5F6B7A',
  };
  return (
    <span
      className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
      style={{ backgroundColor: colors[color] }}
    />
  );
}

// ─── Test Button ────────────────────────────────────────────────

function TestButton({
  label,
  onClick,
  loading,
  variant = 'secondary',
}: {
  label: string;
  onClick: () => void;
  loading: boolean;
  variant?: 'primary' | 'secondary';
}) {
  if (variant === 'primary') {
    return (
      <button
        onClick={onClick}
        disabled={loading}
        className="btn-orange text-xs px-3 py-1.5 disabled:opacity-50"
      >
        {loading ? 'Running...' : label}
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="text-xs px-3 py-1.5 rounded-[6px] border border-[rgba(255,255,255,0.1)] text-[#E8E6E1] hover:border-[rgba(255,255,255,0.2)] hover:bg-[rgba(255,255,255,0.03)] transition-all disabled:opacity-50"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      {loading ? 'Running...' : label}
    </button>
  );
}

// ─── Result Header Bar ──────────────────────────────────────────

function ResultHeader({
  result,
  expanded,
  onToggle,
  label,
}: {
  result: TestResult;
  expanded: boolean;
  onToggle: () => void;
  label?: string;
}) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center gap-1.5 text-xs text-[#9BA3AE] hover:text-[#E8E6E1] transition-colors mb-2 w-full"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      <span className="text-[10px]">{expanded ? '▼' : '▶'}</span>
      {label || 'Result'}
      <span className="text-[#5F6B7A]">|</span>
      <span className={result.success ? 'text-[#4CAF50]' : 'text-[#EF5350]'}>
        {result.success ? 'OK' : 'ERROR'}
      </span>
      <span className="text-[#5F6B7A]">|</span>
      <span>{result.duration_ms}ms</span>
      {result.quota && result.quota.remaining !== null && (
        <>
          <span className="text-[#5F6B7A]">|</span>
          <span>Quota: {result.quota.remaining}</span>
        </>
      )}
      {result.data?.eventCount !== undefined && (
        <>
          <span className="text-[#5F6B7A]">|</span>
          <span>{result.data.eventCount} games</span>
        </>
      )}
    </button>
  );
}

// ─── ESPN Matchup Card ──────────────────────────────────────────

function EspnGameCard({ event }: { event: any }) {
  const comp = event.competitors || [];
  const away = comp.find((c: any) => c.homeAway === 'away') || comp[1];
  const home = comp.find((c: any) => c.homeAway === 'home') || comp[0];
  const isFinal = event.completed;
  const isLive = event.status === 'STATUS_IN_PROGRESS';

  return (
    <div className="bg-[#080810] rounded-[10px] p-3 border border-[rgba(255,255,255,0.04)]">
      {/* Header: time + status */}
      <div className="flex justify-between items-center mb-2">
        <span
          className="text-[10px] tracking-[0.08em] text-[#5F6B7A] uppercase"
          style={{ fontFamily: "'Space Mono', monospace" }}
        >
          {formatTime(event.datetime)}
        </span>
        {isFinal && (
          <span className="text-[9px] tracking-[0.1em] font-bold text-[#5F6B7A] bg-[rgba(255,255,255,0.04)] px-1.5 py-0.5 rounded-[4px] uppercase"
            style={{ fontFamily: "'Space Mono', monospace" }}>FINAL</span>
        )}
        {isLive && (
          <span className="text-[9px] tracking-[0.1em] font-bold text-[#4CAF50] bg-[rgba(76,175,80,0.1)] px-1.5 py-0.5 rounded-[4px] uppercase"
            style={{ fontFamily: "'Space Mono', monospace" }}>LIVE</span>
        )}
        {!isFinal && !isLive && (
          <span className="text-[9px] tracking-[0.1em] text-[#5F6B7A]"
            style={{ fontFamily: "'Space Mono', monospace" }}>{event.statusDetail || ''}</span>
        )}
      </div>

      {/* Team rows */}
      {[away, home].map((team: any, i: number) => {
        if (!team) return null;
        const isWinner = isFinal && team.winner;
        return (
          <div
            key={i}
            className={`flex items-center justify-between py-1.5 px-2 rounded-[6px] ${
              isWinner ? 'bg-[rgba(76,175,80,0.08)]' : ''
            } ${i === 0 ? 'mb-0.5' : ''}`}
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span
                className={`text-[11px] w-4 text-right flex-shrink-0 ${
                  team.homeAway === 'home' ? 'text-[#5F6B7A]' : 'text-[#5F6B7A]'
                }`}
                style={{ fontFamily: "'Space Mono', monospace" }}
              >
                {team.homeAway === 'away' ? '@' : ''}
              </span>
              <span
                className={`text-[13px] font-semibold uppercase truncate ${
                  isWinner ? 'text-[#E8E6E1]' : isFinal ? 'text-[#5F6B7A]' : 'text-[#E8E6E1]'
                }`}
                style={{ fontFamily: "'Oswald', sans-serif" }}
              >
                {team.team}
              </span>
            </div>
            {team.score !== undefined && team.score !== null && (
              <span
                className={`text-[13px] font-bold flex-shrink-0 ${
                  isWinner ? 'text-[#E8E6E1]' : 'text-[#5F6B7A]'
                }`}
                style={{ fontFamily: "'Space Mono', monospace" }}
              >
                {team.score}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Odds Matchup Card ──────────────────────────────────────────

function OddsGameCard({ event }: { event: any }) {
  const odds = event.odds || {};
  const homeFavored = (odds.homeMoneyline ?? 0) < (odds.awayMoneyline ?? 0);

  return (
    <div className="bg-[#080810] rounded-[10px] p-3 border border-[rgba(255,255,255,0.04)]">
      {/* Header: time + bookmaker count */}
      <div className="flex justify-between items-center mb-2">
        <span
          className="text-[10px] tracking-[0.08em] text-[#5F6B7A] uppercase"
          style={{ fontFamily: "'Space Mono', monospace" }}
        >
          {formatTime(event.commenceTime)}
        </span>
        <span
          className="text-[9px] tracking-[0.1em] text-[#5F6B7A]"
          style={{ fontFamily: "'Space Mono', monospace" }}
        >
          {event.bookmakerCount} BOOKS
        </span>
      </div>

      {/* Column headers */}
      <div className="flex items-center justify-end gap-0 mb-1 px-2">
        <span className="text-[8px] tracking-[0.1em] text-[#5F6B7A] w-12 text-right" style={{ fontFamily: "'Space Mono', monospace" }}>ML</span>
        <span className="text-[8px] tracking-[0.1em] text-[#5F6B7A] w-12 text-right" style={{ fontFamily: "'Space Mono', monospace" }}>SPRD</span>
        <span className="text-[8px] tracking-[0.1em] text-[#5F6B7A] w-14 text-right" style={{ fontFamily: "'Space Mono', monospace" }}>WIN%</span>
      </div>

      {/* Away team row */}
      <div className={`flex items-center justify-between py-1.5 px-2 rounded-[6px] mb-0.5 ${
        !homeFavored ? 'bg-[rgba(76,175,80,0.06)]' : ''
      }`}>
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-[11px] w-4 text-right flex-shrink-0 text-[#5F6B7A]" style={{ fontFamily: "'Space Mono', monospace" }}>@</span>
          <span
            className="text-[13px] font-semibold uppercase truncate text-[#E8E6E1]"
            style={{ fontFamily: "'Oswald', sans-serif" }}
          >
            {event.awayTeam}
          </span>
        </div>
        <div className="flex items-center gap-0 flex-shrink-0">
          <span className={`text-[11px] w-12 text-right ${(odds.awayMoneyline ?? 0) < 0 ? 'text-[#4CAF50]' : 'text-[#E8E6E1]'}`}
            style={{ fontFamily: "'Space Mono', monospace" }}>{formatML(odds.awayMoneyline)}</span>
          <span className="text-[11px] w-12 text-right text-[#9BA3AE]"
            style={{ fontFamily: "'Space Mono', monospace" }}>{formatSpread(odds.awaySpread)}</span>
          <span className={`text-[11px] w-14 text-right font-semibold ${
            (odds.awayWinProb ?? 0) > 0.5 ? 'text-[#4CAF50]' : 'text-[#9BA3AE]'
          }`} style={{ fontFamily: "'Space Mono', monospace" }}>{formatProb(odds.awayWinProb)}</span>
        </div>
      </div>

      {/* Home team row */}
      <div className={`flex items-center justify-between py-1.5 px-2 rounded-[6px] ${
        homeFavored ? 'bg-[rgba(76,175,80,0.06)]' : ''
      }`}>
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-[11px] w-4 text-right flex-shrink-0 text-[#5F6B7A]" style={{ fontFamily: "'Space Mono', monospace" }}></span>
          <span
            className="text-[13px] font-semibold uppercase truncate text-[#E8E6E1]"
            style={{ fontFamily: "'Oswald', sans-serif" }}
          >
            {event.homeTeam}
          </span>
        </div>
        <div className="flex items-center gap-0 flex-shrink-0">
          <span className={`text-[11px] w-12 text-right ${(odds.homeMoneyline ?? 0) < 0 ? 'text-[#4CAF50]' : 'text-[#E8E6E1]'}`}
            style={{ fontFamily: "'Space Mono', monospace" }}>{formatML(odds.homeMoneyline)}</span>
          <span className="text-[11px] w-12 text-right text-[#9BA3AE]"
            style={{ fontFamily: "'Space Mono', monospace" }}>{formatSpread(odds.homeSpread)}</span>
          <span className={`text-[11px] w-14 text-right font-semibold ${
            (odds.homeWinProb ?? 0) > 0.5 ? 'text-[#4CAF50]' : 'text-[#9BA3AE]'
          }`} style={{ fontFamily: "'Space Mono', monospace" }}>{formatProb(odds.homeWinProb)}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Visual Results Panels ──────────────────────────────────────

function EspnResultsPanel({ result }: { result: TestResult | null }) {
  const [expanded, setExpanded] = useState(true);
  const [showRaw, setShowRaw] = useState(false);

  if (!result) return null;

  const events = result.data?.events || [];

  // Group events by date
  const grouped: Record<string, any[]> = {};
  for (const e of events) {
    const dateKey = formatDate(e.datetime);
    if (!grouped[dateKey]) grouped[dateKey] = [];
    grouped[dateKey].push(e);
  }

  return (
    <div className="mt-3">
      <ResultHeader result={result} expanded={expanded} onToggle={() => setExpanded(!expanded)} label="Scoreboard" />

      {expanded && (
        <>
          {result.error ? (
            <div className="bg-[#1B2A3D] rounded-[10px] p-3 border border-[rgba(239,83,80,0.2)]">
              <span className="text-xs text-[#EF5350]" style={{ fontFamily: "'Space Mono', monospace" }}>{result.error}</span>
            </div>
          ) : (
            <>
              {/* Date groups */}
              {Object.entries(grouped).map(([date, dateEvents]) => (
                <div key={date} className="mb-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] tracking-[0.1em] font-bold text-[#9BA3AE] uppercase"
                      style={{ fontFamily: "'Space Mono', monospace" }}>{date}</span>
                    <span className="text-[10px] text-[#5F6B7A]" style={{ fontFamily: "'Space Mono', monospace" }}>
                      {dateEvents.length} {dateEvents.length === 1 ? 'game' : 'games'}
                    </span>
                    <div className="flex-1 h-px bg-[rgba(255,255,255,0.05)]" />
                  </div>
                  <div className="grid grid-cols-1 gap-1.5">
                    {dateEvents.map((event: any, i: number) => (
                      <EspnGameCard key={event.id || i} event={event} />
                    ))}
                  </div>
                </div>
              ))}

              {/* Raw JSON toggle */}
              <button
                onClick={() => setShowRaw(!showRaw)}
                className="text-[10px] text-[#5F6B7A] hover:text-[#9BA3AE] transition-colors mt-2"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                {showRaw ? 'Hide' : 'Show'} raw JSON
              </button>
              {showRaw && (
                <pre className="text-[10px] text-[#5F6B7A] bg-[#1B2A3D] rounded-[10px] p-3 overflow-auto max-h-60 mt-1 border border-[rgba(255,255,255,0.03)]"
                  style={{ fontFamily: "'Space Mono', monospace" }}>
                  {JSON.stringify(result.data, null, 2)}
                </pre>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

function OddsResultsPanel({ result }: { result: TestResult | null }) {
  const [expanded, setExpanded] = useState(true);
  const [showRaw, setShowRaw] = useState(false);

  if (!result) return null;

  const events = result.data?.events || [];

  // Group events by date
  const grouped: Record<string, any[]> = {};
  for (const e of events) {
    const dateKey = formatDate(e.commenceTime);
    if (!grouped[dateKey]) grouped[dateKey] = [];
    grouped[dateKey].push(e);
  }

  // Check if this is the odds-fetch test (has events with odds) vs other tests
  const hasMatchupData = events.length > 0 && events[0].odds !== undefined;

  return (
    <div className="mt-3">
      <ResultHeader result={result} expanded={expanded} onToggle={() => setExpanded(!expanded)} label="Odds" />

      {expanded && (
        <>
          {result.error ? (
            <div className="bg-[#1B2A3D] rounded-[10px] p-3 border border-[rgba(239,83,80,0.2)]">
              <span className="text-xs text-[#EF5350]" style={{ fontFamily: "'Space Mono', monospace" }}>{result.error}</span>
            </div>
          ) : hasMatchupData ? (
            <>
              {Object.entries(grouped).map(([date, dateEvents]) => (
                <div key={date} className="mb-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] tracking-[0.1em] font-bold text-[#9BA3AE] uppercase"
                      style={{ fontFamily: "'Space Mono', monospace" }}>{date}</span>
                    <span className="text-[10px] text-[#5F6B7A]" style={{ fontFamily: "'Space Mono', monospace" }}>
                      {dateEvents.length} {dateEvents.length === 1 ? 'game' : 'games'}
                    </span>
                    <div className="flex-1 h-px bg-[rgba(255,255,255,0.05)]" />
                  </div>
                  <div className="grid grid-cols-1 gap-1.5">
                    {dateEvents.map((event: any, i: number) => (
                      <OddsGameCard key={event.id || i} event={event} />
                    ))}
                  </div>
                </div>
              ))}

              <button
                onClick={() => setShowRaw(!showRaw)}
                className="text-[10px] text-[#5F6B7A] hover:text-[#9BA3AE] transition-colors mt-2"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                {showRaw ? 'Hide' : 'Show'} raw JSON
              </button>
              {showRaw && (
                <pre className="text-[10px] text-[#5F6B7A] bg-[#1B2A3D] rounded-[10px] p-3 overflow-auto max-h-60 mt-1 border border-[rgba(255,255,255,0.03)]"
                  style={{ fontFamily: "'Space Mono', monospace" }}>
                  {JSON.stringify(result.data, null, 2)}
                </pre>
              )}
            </>
          ) : (
            /* Fallback to JSON for non-matchup results (validate, active, sync-preview) */
            <pre className="text-xs text-[#9BA3AE] bg-[#1B2A3D] rounded-[10px] p-3 overflow-auto max-h-80 border border-[rgba(255,255,255,0.03)]"
              style={{ fontFamily: "'Space Mono', monospace" }}>
              {JSON.stringify(result.data, null, 2)}
            </pre>
          )}
        </>
      )}
    </div>
  );
}

// ─── Generic JSON Panel (for non-matchup results) ───────────────

function JsonResultsPanel({ result, label }: { result: TestResult | null; label?: string }) {
  const [expanded, setExpanded] = useState(true);

  if (!result) return null;

  return (
    <div className="mt-3">
      <ResultHeader result={result} expanded={expanded} onToggle={() => setExpanded(!expanded)} label={label} />
      {expanded && (
        <pre className="text-xs text-[#9BA3AE] bg-[#1B2A3D] rounded-[10px] p-3 overflow-auto max-h-80 border border-[rgba(255,255,255,0.03)]"
          style={{ fontFamily: "'Space Mono', monospace" }}>
          {result.error
            ? JSON.stringify({ error: result.error }, null, 2)
            : JSON.stringify(result.data, null, 2)}
        </pre>
      )}
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────

export default function DiagnosticsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [espnResult, setEspnResult] = useState<TestResult | null>(null);
  const [espnTestType, setEspnTestType] = useState<string>('');
  const [oddsResult, setOddsResult] = useState<TestResult | null>(null);
  const [oddsTestType, setOddsTestType] = useState<string>('');
  const [runningTest, setRunningTest] = useState<string | null>(null);
  const [actionLog, setActionLog] = useState<ActionResult[]>([]);
  const [teamIdInput, setTeamIdInput] = useState('150');

  // Check pool creator status
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/auth/login');
      return;
    }

    async function checkCreator() {
      const { data } = await supabase
        .from('pools')
        .select('id')
        .eq('creator_id', user!.id)
        .limit(1);
      setAuthorized(!!data && data.length > 0);
    }

    checkCreator();
  }, [user, authLoading, router]);

  const runDiagnostic = useCallback(async (test: string, params?: any) => {
    setRunningTest(test);
    const isEspn = test.startsWith('espn-');

    try {
      const response = await fetch('/api/admin/diagnostics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test, params }),
      });

      const result: TestResult = await response.json();

      if (isEspn) {
        setEspnResult(result);
        setEspnTestType(test);
      } else {
        setOddsResult(result);
        setOddsTestType(test);
      }
    } catch (err: any) {
      const errorResult: TestResult = {
        success: false,
        error: err.message,
        duration_ms: 0,
      };
      if (isEspn) {
        setEspnResult(errorResult);
        setEspnTestType(test);
      } else {
        setOddsResult(errorResult);
        setOddsTestType(test);
      }
    } finally {
      setRunningTest(null);
    }
  }, []);

  const runQuickAction = useCallback(async (action: string) => {
    setRunningTest(action);
    try {
      const response = await fetch('/api/admin/trigger-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      const result = await response.json();
      setActionLog(prev => [
        { timestamp: new Date().toLocaleTimeString(), action, result },
        ...prev,
      ]);
    } catch (err: any) {
      setActionLog(prev => [
        { timestamp: new Date().toLocaleTimeString(), action, result: { error: err.message } },
        ...prev,
      ]);
    } finally {
      setRunningTest(null);
    }
  }, []);

  // Loading / auth states
  if (authLoading || authorized === null) {
    return (
      <div className="min-h-screen bg-[#0D1B2A] flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-[#FF5722] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="min-h-screen bg-[#0D1B2A] flex items-center justify-center px-4">
        <div className="bg-[#111827] border border-[rgba(255,255,255,0.05)] rounded-[14px] p-6 max-w-sm w-full text-center">
          <p className="text-[#EF5350] text-sm font-semibold mb-2" style={{ fontFamily: "'Oswald', sans-serif" }}>
            UNAUTHORIZED
          </p>
          <p className="text-[#9BA3AE] text-sm" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            Only pool creators can access diagnostics.
          </p>
          <button
            onClick={() => router.back()}
            className="mt-4 text-xs text-[#FF5722] font-semibold hover:text-[#E64A19] transition-colors"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Choose the right panel based on which test was run
  const renderEspnResults = () => {
    if (!espnResult) return null;
    if (espnTestType === 'espn-scoreboard') return <EspnResultsPanel result={espnResult} />;
    return <JsonResultsPanel result={espnResult} label={espnTestType} />;
  };

  const renderOddsResults = () => {
    if (!oddsResult) return null;
    if (oddsTestType === 'odds-fetch') return <OddsResultsPanel result={oddsResult} />;
    return <JsonResultsPanel result={oddsResult} label={oddsTestType} />;
  };

  return (
    <div className="min-h-screen bg-[#0D1B2A]">
      <div className="max-w-lg mx-auto px-4 py-6 pb-28">
        {/* Header */}
        <div className="mb-6">
          <p className="label text-label-accent mb-1">DIAGNOSTICS</p>
          <h1
            className="text-xl font-bold text-[#E8E6E1] tracking-tight"
            style={{ fontFamily: "'Oswald', sans-serif" }}
          >
            API Health Check
          </h1>
        </div>

        {/* ESPN API Section */}
        <div className="bg-[#111827] border border-[rgba(255,255,255,0.05)] rounded-[14px] p-5 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <StatusDot color="green" />
            <span
              className="text-sm font-semibold text-[#E8E6E1]"
              style={{ fontFamily: "'Oswald', sans-serif" }}
            >
              ESPN API
            </span>
            <span
              className="text-xs text-[#5F6B7A] ml-auto"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              No key needed
            </span>
          </div>

          <div className="flex flex-wrap gap-2 mb-1">
            <TestButton
              label="Test Scoreboard"
              onClick={() => runDiagnostic('espn-scoreboard')}
              loading={runningTest === 'espn-scoreboard'}
            />
            <div className="flex items-center gap-1.5">
              <TestButton
                label="Test Team"
                onClick={() => runDiagnostic('espn-team', { teamId: teamIdInput })}
                loading={runningTest === 'espn-team'}
              />
              <input
                type="text"
                value={teamIdInput}
                onChange={(e) => setTeamIdInput(e.target.value)}
                placeholder="ESPN ID"
                className="w-16 text-xs bg-[#1B2A3D] border border-[rgba(255,255,255,0.1)] rounded-[6px] px-2 py-1.5 text-[#E8E6E1] focus:outline-none focus:border-[#FF5722] transition-colors"
                style={{ fontFamily: "'Space Mono', monospace" }}
              />
            </div>
            <TestButton
              label="Test Game Match"
              onClick={() => runDiagnostic('espn-game-match')}
              loading={runningTest === 'espn-game-match'}
            />
          </div>

          {renderEspnResults()}
        </div>

        {/* Odds API Section */}
        <div className="bg-[#111827] border border-[rgba(255,255,255,0.05)] rounded-[14px] p-5 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <StatusDot color={process.env.NEXT_PUBLIC_ODDS_API_CONFIGURED === 'true' ? 'yellow' : 'gray'} />
            <span
              className="text-sm font-semibold text-[#E8E6E1]"
              style={{ fontFamily: "'Oswald', sans-serif" }}
            >
              Odds API
            </span>
            <span
              className="text-xs text-[#5F6B7A] ml-auto"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              Key: server-side
            </span>
          </div>

          <div className="flex flex-wrap gap-2 mb-1">
            <TestButton
              label="Validate Key"
              onClick={() => runDiagnostic('odds-validate')}
              loading={runningTest === 'odds-validate'}
              variant="primary"
            />
            <TestButton
              label="NCAAB Active?"
              onClick={() => runDiagnostic('odds-ncaab-active')}
              loading={runningTest === 'odds-ncaab-active'}
            />
            <TestButton
              label="Fetch Odds"
              onClick={() => runDiagnostic('odds-fetch')}
              loading={runningTest === 'odds-fetch'}
            />
            <TestButton
              label="Sync Preview"
              onClick={() => runDiagnostic('odds-sync-preview')}
              loading={runningTest === 'odds-sync-preview'}
            />
          </div>

          {renderOddsResults()}
        </div>

        {/* Quick Actions Section */}
        <div className="bg-[#111827] border border-[rgba(255,255,255,0.05)] rounded-[14px] p-5">
          <p className="label text-label-accent mb-3">QUICK ACTIONS</p>

          <div className="flex flex-wrap gap-2 mb-4">
            <TestButton
              label="Sync Games (ESPN)"
              onClick={() => runQuickAction('sync-games')}
              loading={runningTest === 'sync-games'}
            />
            <TestButton
              label="Sync Odds"
              onClick={() => runQuickAction('sync-odds')}
              loading={runningTest === 'sync-odds'}
            />
            <TestButton
              label="Process Results"
              onClick={() => runQuickAction('process-results')}
              loading={runningTest === 'process-results'}
            />
          </div>

          {/* Action Log */}
          {actionLog.length > 0 && (
            <div>
              <p
                className="text-xs text-[#5F6B7A] mb-2"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                Action Log
              </p>
              <div className="space-y-2 max-h-60 overflow-auto">
                {actionLog.map((entry, i) => (
                  <div key={i} className="bg-[#1B2A3D] rounded-[10px] p-3 border border-[rgba(255,255,255,0.03)]">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span
                        className="text-[10px] text-[#5F6B7A]"
                        style={{ fontFamily: "'Space Mono', monospace" }}
                      >
                        {entry.timestamp}
                      </span>
                      <span
                        className="text-xs font-semibold text-[#E8E6E1]"
                        style={{ fontFamily: "'DM Sans', sans-serif" }}
                      >
                        {entry.action}
                      </span>
                      <span className={`text-[10px] ml-auto ${entry.result.error ? 'text-[#EF5350]' : 'text-[#4CAF50]'}`}>
                        {entry.result.error ? 'ERROR' : 'OK'}
                      </span>
                    </div>
                    <pre
                      className="text-[11px] text-[#9BA3AE] overflow-auto max-h-32"
                      style={{ fontFamily: "'Space Mono', monospace" }}
                    >
                      {JSON.stringify(entry.result, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
