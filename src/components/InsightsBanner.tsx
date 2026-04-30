/**
 * InsightsBanner — proactive nudges from the learning layer.
 *
 * Renders ≤2 actionable insights above the calendar, surfaced from
 * insights.energy / insights.capacity / insights.missed. Designed to be
 * QUIET by default — when there's no actionable signal, the banner
 * doesn't render at all.
 *
 * Each nudge has a one-click apply button. The user is never forced into
 * the change — they can dismiss by closing the banner (kept simple here:
 * the banner reappears next session if the underlying suggestion is
 * still active, which is what we want — the system keeps re-surfacing
 * a real pattern until the user acts on it).
 */

import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Coffee,
  Sunrise,
  Repeat,
  ArrowRight,
  X,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import {
  EnergySuggestion,
  CapacitySuggestion,
  MissedPattern,
} from '@/types/task';

interface InsightsBannerProps {
  energy: EnergySuggestion;
  capacity: CapacitySuggestion;
  missed: MissedPattern[];
  /** Local dismiss flag — the parent owns it so the user can close until next session. */
  dismissed: Set<string>;
  onDismiss: (key: string) => void;
  onApplyEnergy: () => void;
  onApplyCapacity: () => void;
  onJumpToTask: (taskId: string) => void;
  onOpenRetrospective: () => void;
}

interface Nudge {
  key: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: 'amber' | 'emerald' | 'sky' | 'violet';
  title: string;
  body: string;
  cta: string;
  onAct: () => void;
}

export function InsightsBanner({
  energy,
  capacity,
  missed,
  dismissed,
  onDismiss,
  onApplyEnergy,
  onApplyCapacity,
  onJumpToTask,
  onOpenRetrospective,
}: InsightsBannerProps) {
  const nudges: Nudge[] = [];

  // Energy curve — only surface if shift is recommended AND not dismissed
  if (energy.shift_recommended && !dismissed.has('energy')) {
    nudges.push({
      key: 'energy',
      icon: Sunrise,
      tone: 'sky',
      title: `Your real peak is ${pad(energy.suggested_start_hour)}:00–${pad(energy.suggested_end_hour)}:00`,
      body: energy.reason,
      cta: 'Update deep window',
      onAct: onApplyEnergy,
    });
  }

  // Capacity — reduce recommended takes priority over raise
  if (capacity.reduce_recommended && !dismissed.has('capacity')) {
    nudges.push({
      key: 'capacity',
      icon: TrendingDown,
      tone: 'amber',
      title: `${capacity.current_cap_hours}h is too much — try ${capacity.suggested_cap_hours}h`,
      body: capacity.reason,
      cta: `Lower cap to ${capacity.suggested_cap_hours}h`,
      onAct: onApplyCapacity,
    });
  } else if (capacity.raise_recommended && !dismissed.has('capacity')) {
    nudges.push({
      key: 'capacity',
      icon: TrendingUp,
      tone: 'emerald',
      title: `${capacity.current_cap_hours}h has headroom — try ${capacity.suggested_cap_hours}h`,
      body: capacity.reason,
      cta: `Raise cap to ${capacity.suggested_cap_hours}h`,
      onAct: onApplyCapacity,
    });
  }

  // Missed patterns — top one only, plus a "see all in retrospective" link
  if (missed.length > 0 && !dismissed.has('missed')) {
    const top = missed[0];
    nudges.push({
      key: 'missed',
      icon: Repeat,
      tone: 'violet',
      title: `"${top.task_title}" keeps slipping`,
      body: top.suggestion,
      cta: missed.length > 1 ? 'Open retrospective' : 'Edit task',
      onAct: missed.length > 1 ? onOpenRetrospective : () => onJumpToTask(top.task_id),
    });
  }

  // Cap to 2 nudges — beyond that it's noise. Push to retrospective.
  const visible = nudges.slice(0, 2);
  if (visible.length === 0) return null;

  return (
    <div className="px-3 py-2 border-b border-border bg-card/30 space-y-1.5">
      <AnimatePresence initial={false}>
        {visible.map(n => (
          <motion.div
            key={n.key}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4, height: 0, marginTop: 0 }}
            transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
            className={`relative flex items-start gap-2.5 px-3 py-2 rounded-md ${toneBg[n.tone]} border ${toneBorder[n.tone]}`}
          >
            <div className={`mt-0.5 shrink-0 ${toneText[n.tone]}`}>
              <n.icon className="w-3.5 h-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-[12px] font-medium leading-tight ${toneText[n.tone]}`}>
                {n.title}
              </p>
              <p className="text-[10px] font-mono text-muted-foreground/70 leading-snug mt-0.5">
                {n.body}
              </p>
            </div>
            <button
              onClick={n.onAct}
              className={`shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono font-semibold ${toneCta[n.tone]} hover:brightness-110 transition-all`}
            >
              {n.cta}
              <ArrowRight className="w-2.5 h-2.5" />
            </button>
            <button
              onClick={() => onDismiss(n.key)}
              className="shrink-0 text-muted-foreground/45 hover:text-muted-foreground"
              aria-label="Dismiss"
            >
              <X className="w-3 h-3" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Footer link — visible only when at least one nudge is visible */}
      <button
        onClick={onOpenRetrospective}
        className="w-full flex items-center justify-center gap-1.5 py-0.5 text-[10px] font-mono text-muted-foreground/55 hover:text-muted-foreground transition-colors"
      >
        <Sparkles className="w-2.5 h-2.5" />
        Open this week's retrospective
      </button>
    </div>
  );
}

const toneBg: Record<Nudge['tone'], string> = {
  amber: 'bg-amber-500/8',
  emerald: 'bg-emerald-500/8',
  sky: 'bg-sky-500/8',
  violet: 'bg-violet-500/8',
};

const toneBorder: Record<Nudge['tone'], string> = {
  amber: 'border-amber-500/20',
  emerald: 'border-emerald-500/20',
  sky: 'border-sky-500/20',
  violet: 'border-violet-500/20',
};

const toneText: Record<Nudge['tone'], string> = {
  amber: 'text-amber-300',
  emerald: 'text-emerald-300',
  sky: 'text-sky-300',
  violet: 'text-violet-300',
};

const toneCta: Record<Nudge['tone'], string> = {
  amber: 'bg-amber-500/15 text-amber-200 border border-amber-500/30',
  emerald: 'bg-emerald-500/15 text-emerald-200 border border-emerald-500/30',
  sky: 'bg-sky-500/15 text-sky-200 border border-sky-500/30',
  violet: 'bg-violet-500/15 text-violet-200 border border-violet-500/30',
};

const pad = (n: number) => String(n).padStart(2, '0');
