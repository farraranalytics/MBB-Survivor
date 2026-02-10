'use client';

export interface TutorialStep {
  id: string;
  title: string;
  body: string;
  expandDay: string | null; // day ID to auto-expand
  highlightId: string | null; // element ID to highlight
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'predict',
    title: 'PREDICT WINNERS',
    body: "Click a team name to predict they'll win — they advance into the next round's matchup. Try calling an upset.",
    expandDay: null, // will be set to first day ID dynamically
    highlightId: null,
  },
  {
    id: 'pin',
    title: 'LOCK YOUR PICK',
    body: 'Hit the ✎ button next to a team to pin it as your survivor pick for this day. That team is burned — crossed out everywhere else.',
    expandDay: null,
    highlightId: null,
  },
  {
    id: 'flow',
    title: 'WATCH IT FLOW FORWARD',
    body: "Your predicted winners from R64 are now the teams in the R32 matchups. Pinned picks are struck through — gone for the rest of the tournament.",
    expandDay: null,
    highlightId: null,
  },
  {
    id: 'tracker',
    title: 'WATCH YOUR REGIONS',
    body: "The region bars track how many picks you've used from each region. Too heavy in one and you'll run out of options in the Elite 8.",
    expandDay: null,
    highlightId: 'region-tracker',
  },
  {
    id: 'danger',
    title: 'THE ELITE 8 TRAP',
    body: "The Bracket Flow shows your full projected path. Teams you've already burned appear red with a strikethrough. If your E8 contender is red — you're stuck.",
    expandDay: null,
    highlightId: 'bracket-flow',
  },
];

interface PlannerCoachingProps {
  stepIndex: number;
  totalSteps: number;
  step: TutorialStep;
  onNext: () => void;
  onDismiss: () => void;
}

export default function PlannerCoaching({
  stepIndex,
  totalSteps,
  step,
  onNext,
  onDismiss,
}: PlannerCoachingProps) {
  return (
    <div
      className="fixed bottom-0 left-0 right-0 animate-[slide-up_0.3s_ease]"
      style={{ zIndex: 500, pointerEvents: 'auto' }}
    >
      <div
        className="max-w-[720px] mx-auto p-4 px-5"
        style={{
          background: 'var(--surface-3)',
          border: '1px solid var(--border-accent)',
          borderBottom: 'none',
          borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
          boxShadow: '0 -4px 30px rgba(0,0,0,0.5), 0 0 20px rgba(255,87,34,0.08)',
        }}
      >
        <div className="flex justify-between items-start gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2.5 mb-1.5">
              <span
                className="font-[family-name:var(--font-display)] font-bold text-[0.7rem] rounded-full py-[3px] px-2.5"
                style={{
                  color: 'var(--color-orange)',
                  background: 'var(--color-orange-subtle)',
                  border: '1px solid var(--border-accent)',
                }}
              >
                {stepIndex + 1}/{totalSteps}
              </span>
              <span className="font-[family-name:var(--font-display)] font-semibold text-[0.85rem] uppercase text-[var(--text-primary)]">
                {step.title}
              </span>
            </div>
            <p className="font-[family-name:var(--font-body)] text-[0.85rem] text-[var(--text-secondary)] leading-[1.55] m-0">
              {step.body}
            </p>
          </div>
          <div className="flex gap-2 shrink-0 items-center">
            <button
              onClick={onDismiss}
              className="btn-secondary py-2 px-3.5 text-[0.7rem]"
            >
              Got it
            </button>
            <button
              onClick={onNext}
              className="btn-orange py-2 px-4.5 text-[0.7rem]"
              style={{ boxShadow: '0 0 12px rgba(255,87,34,0.2)' }}
            >
              {stepIndex < totalSteps - 1 ? 'Next →' : 'Done ✓'}
            </button>
          </div>
        </div>

        {/* Progress dots */}
        <div className="flex gap-1 mt-2.5 justify-center">
          {Array.from({ length: totalSteps }, (_, i) => (
            <div
              key={i}
              className="h-1 rounded-sm transition-all duration-250"
              style={{
                width: i === stepIndex ? 20 : 6,
                background: i === stepIndex
                  ? 'var(--color-orange)'
                  : i < stepIndex
                    ? 'rgba(255,87,34,0.4)'
                    : 'var(--surface-5)',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
