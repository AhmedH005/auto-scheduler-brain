/**
 * WeeklyRetrospectiveSheet — the slow-loop view of how the system is
 * learning about you.
 *
 * Surfaces the deterministic outputs of the learning layer:
 *   - Digest headline + completion rate + minutes summary
 *   - Day-of-week shape chart (bars)
 *   - Recurring miss patterns with one-click jump-to-task
 *   - Learned energy curve preview with Apply
 *   - Worst-overrun + best-estimate tasks
 *
 * Opens via ⌘K → "Weekly retrospective" or via the InsightsBanner footer link.
 */

import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Repeat,
  Sunrise,
  Coffee,
  Flame,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEffect } from 'react';
import {
  EnergySuggestion,
  CapacitySuggestion,
  DayShape,
  MissedPattern,
  WeeklyDigest,
} from '@/types/task';

interface WeeklyRetrospectiveSheetProps {
  open: boolean;
  onClose: () => void;
  energy: EnergySuggestion;
  capacity: CapacitySuggestion;
  dayShape: DayShape;
  missed: MissedPattern[];
  digest: WeeklyDigest;
  onApplyEnergy: () => void;
  onApplyCapacity: () => void;
  onJumpToTask: (taskId: string) => void;
}

const DAY_LABELS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function WeeklyRetrospectiveSheet({
  open,
  onClose,
  energy,
  capacity,
  dayShape,
  missed,
  digest,
  onApplyEnergy,
  onApplyCapacity,
  onJumpToTask,
}: WeeklyRetrospectiveSheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const empty = digest.scheduled_minutes === 0 && energy.confidence === 'none' && capacity.confidence === 'none';

  return (
    <AnimatePresence>
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <motion.aside
        key="panel"
        initial={{ opacity: 0, x: 24 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 24 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        role="dialog"
        aria-modal="true"
        aria-label="Weekly retrospective"
        className="fixed right-0 top-0 bottom-0 z-50 w-full sm:w-[520px] bg-card border-l border-border shadow-2xl flex flex-col"
      >
        {/* Header */}
        <header className="shrink-0 px-5 py-4 border-b border-border flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <h2 className="font-mono text-xs font-bold tracking-wider text-primary uppercase">
                Weekly retrospective
              </h2>
            </div>
            <p className="text-[11px] text-muted-foreground font-mono">
              {empty
                ? 'No history yet — mark a few blocks done and the system starts learning.'
                : `${digest.start_date} → ${digest.end_date}`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
            aria-label="Close retrospective"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Headline */}
          {!empty && (
            <section>
              <p className="text-[10px] uppercase tracking-wider font-mono font-semibold text-muted-foreground/65 mb-2">
                Headline
              </p>
              <p className="text-sm text-foreground/85 leading-relaxed">{digest.headline}</p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <Stat
                  label="Completed"
                  value={`${(digest.completed_minutes / 60).toFixed(1)}h`}
                  tone="emerald"
                />
                <Stat
                  label="Skipped"
                  value={`${(digest.skipped_minutes / 60).toFixed(1)}h`}
                  tone="amber"
                />
                <Stat
                  label="Rate"
                  value={`${Math.round(digest.completion_rate * 100)}%`}
                  tone={digest.completion_rate >= 0.8 ? 'emerald' : digest.completion_rate >= 0.6 ? 'amber' : 'red'}
                />
              </div>
            </section>
          )}

          {/* Energy curve */}
          {energy.confidence !== 'none' && (
            <Section icon={Sunrise} tone="sky" title="Your real peak">
              <p className="text-[12px] text-foreground/80 leading-relaxed mb-3">
                {energy.reason}
              </p>
              <div className="flex items-center gap-2 text-[11px] font-mono">
                <span className="text-muted-foreground/60">Current:</span>
                <span className="text-foreground/80 tabular-nums">
                  {pad(energy.current_start_hour)}:00–{pad(energy.current_end_hour)}:00
                </span>
                <ArrowRight className="w-3 h-3 text-muted-foreground/45" />
                <span className="text-sky-300 tabular-nums font-semibold">
                  {pad(energy.suggested_start_hour)}:00–{pad(energy.suggested_end_hour)}:00
                </span>
                <ConfidenceBadge confidence={energy.confidence} samples={energy.sample_size} />
              </div>
              {energy.shift_recommended && (
                <Button
                  size="sm"
                  className="mt-3 h-7 text-[11px] font-mono"
                  onClick={onApplyEnergy}
                >
                  Apply learned curve
                </Button>
              )}
            </Section>
          )}

          {/* Capacity */}
          {capacity.confidence !== 'none' && (
            <Section
              icon={capacity.reduce_recommended ? TrendingDown : TrendingUp}
              tone={capacity.reduce_recommended ? 'amber' : 'emerald'}
              title="Daily capacity"
            >
              <p className="text-[12px] text-foreground/80 leading-relaxed mb-3">
                {capacity.reason}
              </p>
              <div className="flex items-center gap-2 text-[11px] font-mono">
                <span className="text-muted-foreground/60">Current:</span>
                <span className="text-foreground/80 tabular-nums">
                  {capacity.current_cap_hours}h ({Math.round(capacity.completion_rate_at_current * 100)}%)
                </span>
                <ArrowRight className="w-3 h-3 text-muted-foreground/45" />
                <span className="text-foreground/90 tabular-nums font-semibold">
                  {capacity.suggested_cap_hours}h ({Math.round(capacity.completion_rate_at_suggested * 100)}%)
                </span>
                <ConfidenceBadge confidence={capacity.confidence} samples={capacity.sample_size} />
              </div>
              {(capacity.reduce_recommended || capacity.raise_recommended) && (
                <Button
                  size="sm"
                  className="mt-3 h-7 text-[11px] font-mono"
                  onClick={onApplyCapacity}
                >
                  Apply suggested cap
                </Button>
              )}
            </Section>
          )}

          {/* Day shape */}
          {dayShape.confidence !== 'none' && (
            <Section icon={Coffee} tone="amber" title="Day-of-week shape">
              <p className="text-[11px] text-muted-foreground/75 leading-relaxed mb-3">
                Mean completion rate by weekday across your last {dayShape.sample_size} blocks.
              </p>
              <div className="flex items-end gap-1.5 h-20">
                {dayShape.stats.map(s => {
                  const isWeak = dayShape.weak_days.includes(s.day_of_week);
                  const isStrong = dayShape.strong_days.includes(s.day_of_week);
                  const fill = Math.min(s.completion_rate, 1) * 100;
                  return (
                    <div key={s.day_of_week} className="flex-1 flex flex-col items-center gap-1">
                      <div className="relative w-full flex-1 rounded-sm bg-secondary/40 overflow-hidden flex items-end">
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: `${fill}%` }}
                          transition={{ duration: 0.5, delay: s.day_of_week * 0.04 }}
                          className={`w-full ${isStrong ? 'bg-emerald-500/55' : isWeak ? 'bg-red-500/55' : 'bg-foreground/30'}`}
                        />
                      </div>
                      <span className="text-[9px] font-mono text-muted-foreground/65">{s.day_label}</span>
                      {s.sample_size > 0 && (
                        <span className="text-[9px] font-mono text-foreground/55 tabular-nums">
                          {Math.round(s.completion_rate * 100)}%
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              {dayShape.weak_days.length > 0 && (
                <p className="text-[10px] font-mono text-amber-300/80 mt-3 leading-relaxed">
                  Weak days:{' '}
                  {dayShape.weak_days.map(d => DAY_LABELS_SHORT[d]).join(', ')}. Consider lighter
                  loads.
                </p>
              )}
            </Section>
          )}

          {/* Recurring misses */}
          {missed.length > 0 && (
            <Section icon={Repeat} tone="violet" title={`Recurring misses (${missed.length})`}>
              <p className="text-[11px] text-muted-foreground/75 leading-relaxed mb-3">
                Recurring tasks you've skipped at least half the time over the past 4 weeks.
                Most painful first.
              </p>
              <ul className="space-y-2">
                {missed.slice(0, 5).map(m => (
                  <li
                    key={m.task_id}
                    className="px-3 py-2 rounded-md border border-violet-500/15 bg-violet-500/5"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-xs font-medium text-foreground truncate">{m.task_title}</p>
                      <span className="shrink-0 text-[10px] font-mono text-violet-300 tabular-nums">
                        {m.missed_count}/{m.total_attempts} skipped
                      </span>
                    </div>
                    <p className="text-[10px] font-mono text-muted-foreground/75 leading-relaxed mb-2">
                      {m.suggestion}
                    </p>
                    <button
                      onClick={() => onJumpToTask(m.task_id)}
                      className="text-[10px] font-mono text-violet-300 hover:brightness-125 inline-flex items-center gap-1"
                    >
                      Edit task
                      <ArrowRight className="w-2.5 h-2.5" />
                    </button>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Worst overruns / best estimates */}
          {(digest.worst_overruns.length > 0 || digest.best_estimates.length > 0) && (
            <Section icon={AlertTriangle} tone="amber" title="Estimation accuracy">
              {digest.worst_overruns.length > 0 && (
                <div className="mb-3">
                  <p className="text-[10px] uppercase tracking-wider font-mono text-amber-400/80 mb-1.5">
                    Running long
                  </p>
                  <ul className="space-y-1">
                    {digest.worst_overruns.map(t => (
                      <li
                        key={t.task_title}
                        className="flex items-center justify-between gap-2 text-[11px]"
                      >
                        <span className="text-foreground/80 truncate">{t.task_title}</span>
                        <span className="text-amber-300 font-mono tabular-nums shrink-0">
                          +{t.overrun_pct}% · {t.samples}×
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {digest.best_estimates.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-mono text-emerald-400/80 mb-1.5">
                    On budget
                  </p>
                  <ul className="space-y-1">
                    {digest.best_estimates.map(t => (
                      <li
                        key={t.task_title}
                        className="flex items-center justify-between gap-2 text-[11px]"
                      >
                        <span className="text-foreground/80 truncate">{t.task_title}</span>
                        <span className="text-emerald-300 font-mono tabular-nums shrink-0">
                          {t.samples}×
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Section>
          )}

          {empty && (
            <div className="text-center py-12">
              <Sparkles className="w-6 h-6 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-xs font-mono text-muted-foreground/55 leading-relaxed max-w-[280px] mx-auto">
                Mark blocks done as you finish them. After ~2 weeks of history the retrospective
                fills in with your actual energy curve, capacity, and patterns.
              </p>
            </div>
          )}
        </div>
      </motion.aside>
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────────────────────────────────────
//  Subcomponents
// ─────────────────────────────────────────────────────────────────────────

const sectionTone: Record<string, { bg: string; border: string; text: string }> = {
  sky: { bg: 'bg-sky-500/8', border: 'border-sky-500/20', text: 'text-sky-300' },
  amber: { bg: 'bg-amber-500/8', border: 'border-amber-500/20', text: 'text-amber-300' },
  emerald: { bg: 'bg-emerald-500/8', border: 'border-emerald-500/20', text: 'text-emerald-300' },
  violet: { bg: 'bg-violet-500/8', border: 'border-violet-500/20', text: 'text-violet-300' },
  red: { bg: 'bg-red-500/8', border: 'border-red-500/20', text: 'text-red-300' },
};

function Section({
  title,
  icon: Icon,
  tone,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: keyof typeof sectionTone;
  children: React.ReactNode;
}) {
  const t = sectionTone[tone];
  return (
    <section
      className={`rounded-lg border p-3.5 ${t.bg} ${t.border}`}
    >
      <div className={`flex items-center gap-1.5 mb-2.5 ${t.text}`}>
        <Icon className="w-3.5 h-3.5" />
        <h3 className="text-[10px] uppercase tracking-wider font-mono font-semibold">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: keyof typeof sectionTone;
}) {
  const t = sectionTone[tone];
  return (
    <div className={`px-2.5 py-2 rounded-md border ${t.bg} ${t.border}`}>
      <p className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground/60">
        {label}
      </p>
      <p className={`text-base font-mono font-semibold tabular-nums ${t.text}`}>{value}</p>
    </div>
  );
}

function ConfidenceBadge({
  confidence,
  samples,
}: {
  confidence: 'high' | 'medium' | 'low' | 'none';
  samples: number;
}) {
  const map: Record<typeof confidence, string> = {
    high: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    medium: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    low: 'bg-muted/50 text-muted-foreground border-border',
    none: 'bg-muted/30 text-muted-foreground/60 border-border',
  };
  return (
    <span
      className={`ml-auto text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${map[confidence]}`}
    >
      {confidence} · {samples}
    </span>
  );
}

const pad = (n: number) => String(n).padStart(2, '0');
