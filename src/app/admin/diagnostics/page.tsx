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

// ─── Results Panel ──────────────────────────────────────────────

function ResultsPanel({ result }: { result: TestResult | null }) {
  const [expanded, setExpanded] = useState(true);

  if (!result) return null;

  return (
    <div className="mt-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-xs text-[#9BA3AE] hover:text-[#E8E6E1] transition-colors mb-2"
        style={{ fontFamily: "'DM Sans', sans-serif" }}
      >
        <span className="text-[10px]">{expanded ? '▼' : '▶'}</span>
        Result
        <span className="text-[#5F6B7A]">|</span>
        <span className={result.success ? 'text-[#4CAF50]' : 'text-[#EF5350]'}>
          {result.success ? 'OK' : 'ERROR'}
        </span>
        <span className="text-[#5F6B7A]">|</span>
        <span>{result.duration_ms}ms</span>
        {result.quota && result.quota.remaining !== null && (
          <>
            <span className="text-[#5F6B7A]">|</span>
            <span>Quota: {result.quota.remaining} remaining</span>
          </>
        )}
      </button>

      {expanded && (
        <pre
          className="text-xs text-[#9BA3AE] bg-[#1B2A3D] rounded-[10px] p-3 overflow-auto max-h-80 border border-[rgba(255,255,255,0.03)]"
          style={{ fontFamily: "'Space Mono', monospace" }}
        >
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
  const [oddsResult, setOddsResult] = useState<TestResult | null>(null);
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
      } else {
        setOddsResult(result);
      }
    } catch (err: any) {
      const errorResult: TestResult = {
        success: false,
        error: err.message,
        duration_ms: 0,
      };
      if (isEspn) setEspnResult(errorResult);
      else setOddsResult(errorResult);
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

          <ResultsPanel result={espnResult} />
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

          <ResultsPanel result={oddsResult} />
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
