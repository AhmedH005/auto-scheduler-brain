/**
 * NowCard — the most important card in the app.
 *
 * Shows what you're doing RIGHT NOW (or what's next if nothing's
 * active). Big type, plenty of breathing room, a live progress glow,
 * and three direct-action buttons that cover ~95% of what users do
 * with a current block: done, skip, postpone.
 *
 * Anything beyond those three goes through the assistant. No menu
 * hidden behind a kebab. No "edit" form summoned. Direct or talk.
 */

import { motion } from 'framer-motion';
import { format, differenceInMinutes } from 'date-fns';
import { Check, SkipForward, Clock3, Pin, Zap } from 'lucide-react';
import { Task, ScheduledBlock } from '@/types/task';
import { getTaskColor } from '@/lib/taskColors';

interface NowCardProps {
  block: ScheduledBlock | null;
  task: Task | null;
  isCurrent: boolean;
  onComplete: (id: string) => void;
  onSkip: (id: string) => void;
  onPostpone: (id: string) => void;
}

export function NowCard({
  block,
  task,
  isCurrent,
  onComplete,
  onSkip,
  onPostpone,
}: NowCardProps) {
  if (!block || !task) return <NowEmpty />;

  const start = new Date(block.start_time);
  const end = new Date(block.end_time);
  const total = Math.max(1, differenceInMinutes(end, start));
  const remaining = isCurrent ? Math.max(0, differenceInMinutes(end, new Date())) : total;
  const elapsed = total - remaining;
  const pct = isCurrent ? Math.min(100, Math.max(0, (elapsed / total) * 100)) : 0;

  const color = getTaskColor(task.color ?? task.calendar_color);

  return (
    <motion.div
      key={block.id}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="relative overflow-hidden rounded-3xl border border-border bg-card"
      style={{
        boxShadow: isCurrent
          ? `0 0 0 1px ${color.border}33, 0 12px 36px -16px ${color.border}66`
          : undefined,
      }}
    >
      {/* Color glow — only when active */}
      {isCurrent && (
        <div
          className="absolute inset-0 opacity-40 pointer-events-none"
          style={{
            background: `radial-gradient(120% 80% at 50% 0%, ${color.bg}, transparent 60%)`,
          }}
        />
      )}

      <div className="relative p-6">
        {/* Eyebrow */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground/60">
            {isCurrent ? 'right now' : 'up next'}
          </span>
          <div className="flex items-center gap-2">
            {block.locked && (
              <span className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground/55">
                <Pin className="w-2.5 h-2.5" /> fixed
              </span>
            )}
          </div>
        </div>

        {/* Title */}
        <h2 className="text-display text-foreground tracking-tight leading-tight mb-1.5">
          {task.title}
        </h2>

        {/* Sub-line: time + duration + energy */}
        <div className="flex items-center gap-2.5 text-sm text-muted-foreground/70 mb-5 flex-wrap">
          <span className="tabular-nums">
            {format(start, 'HH:mm')}–{format(end, 'HH:mm')}
          </span>
          <span className="text-muted-foreground/30">·</span>
          <span className="tabular-nums">
            {isCurrent ? `${remaining}m left` : `in ${minutesUntil(start)}`}
          </span>
          <span className="text-muted-foreground/30">·</span>
          <span className="flex items-center gap-1 capitalize">
            <Zap className="w-3 h-3" />
            {task.energy_intensity}
          </span>
        </div>

        {/* Progress bar — alive when active */}
        {isCurrent && (
          <div className="relative h-1 rounded-full bg-secondary/40 mb-5 overflow-hidden">
            <motion.div
              className="absolute inset-y-0 left-0 rounded-full"
              style={{ background: color.border }}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
          </div>
        )}

        {/* Action row */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onComplete(block.id)}
            className="flex-1 inline-flex items-center justify-center gap-1.5 h-10 rounded-xl bg-primary text-primary-foreground text-[13px] font-semibold hover:brightness-110 active:scale-[0.98] transition-all"
          >
            <Check className="w-3.5 h-3.5" />
            done
          </button>
          <button
            onClick={() => onSkip(block.id)}
            className="inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-xl bg-secondary/50 text-foreground/80 text-[13px] font-medium hover:bg-secondary active:scale-[0.98] transition-all"
          >
            <SkipForward className="w-3.5 h-3.5" />
            skip
          </button>
          <button
            onClick={() => onPostpone(block.id)}
            className="inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-xl bg-secondary/50 text-foreground/80 text-[13px] font-medium hover:bg-secondary active:scale-[0.98] transition-all"
          >
            <Clock3 className="w-3.5 h-3.5" />
            later
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function NowEmpty() {
  return (
    <div className="rounded-3xl border border-border bg-card p-8 text-center">
      <p className="text-display text-foreground/60 tracking-tight mb-1.5">nothing on now</p>
      <p className="text-body text-muted-foreground/55">
        tell axis what to do — or relax for a bit.
      </p>
    </div>
  );
}

function minutesUntil(d: Date): string {
  const m = Math.max(0, differenceInMinutes(d, new Date()));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return mm === 0 ? `${h}h` : `${h}h ${mm}m`;
}
