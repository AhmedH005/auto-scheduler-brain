/**
 * FloatingFinishedPill — zero-obligation completion confirm.
 *
 * The auto-assume tick marks every past-due block as done with confidence
 * 'assumed' or 'inferred-active'. The user never has to do anything for
 * the system to learn from those events (passive observation).
 *
 * BUT — sometimes the user wants to give clean data. This pill is the
 * affordance for that. It surfaces ONLY when there are auto-marked blocks
 * from today that the user hasn't confirmed yet. Tapping it expands a
 * compact list with one-tap ✓ (confirm) and ✗ (actually skipped) per row.
 *
 * Design constraints:
 *  - Never required. The pill never blocks anything.
 *  - Doesn't appear when there's nothing to confirm.
 *  - Single-tap obfirms. Per-block, no chained dialogs.
 *  - Audit-friendly: shows visible-minutes-during-block so the user sees
 *    why the system inferred completion.
 */

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, Sparkles, ChevronDown } from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { ScheduledBlock, Task } from '@/types/task';

interface FloatingFinishedPillProps {
  blocks: ScheduledBlock[];
  tasks: Task[];
  onConfirm: (blockId: string) => void;
  onMarkSkipped: (blockId: string) => void;
}

export function FloatingFinishedPill({
  blocks,
  tasks,
  onConfirm,
  onMarkSkipped,
}: FloatingFinishedPillProps) {
  const [open, setOpen] = useState(false);

  // Auto-marked blocks from today/yesterday that haven't been confirmed yet.
  const pending = useMemo(() => {
    return blocks
      .filter(b => {
        if (!b.completed_at) return false;
        if (b.completion_confidence === 'confirmed') return false;
        if (!b.completion_confidence) return false; // older blocks without confidence
        const start = new Date(b.start_time);
        return isToday(start) || isYesterday(start);
      })
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  }, [blocks]);

  // Nothing to confirm? Don't render at all.
  if (pending.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-30">
      <AnimatePresence mode="wait">
        {!open ? (
          <motion.button
            key="closed"
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
            onClick={() => setOpen(true)}
            className="group inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-card border border-border shadow-xl hover:border-primary/40 hover:bg-card/90 transition-all"
            aria-label={`Confirm ${pending.length} auto-marked block${pending.length > 1 ? 's' : ''}`}
          >
            <span className="relative flex w-2 h-2 shrink-0">
              <span className="absolute inset-0 rounded-full bg-primary/60 animate-ping" />
              <span className="relative w-2 h-2 rounded-full bg-primary" />
            </span>
            <span className="text-[11px] font-mono text-foreground/85">
              {pending.length} block{pending.length > 1 ? 's' : ''} to confirm
            </span>
            <ChevronDown className="w-3 h-3 text-muted-foreground/55 group-hover:text-foreground/80 transition-colors" />
          </motion.button>
        ) : (
          <motion.div
            key="open"
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className="w-[320px] max-h-[60vh] flex flex-col rounded-xl bg-card border border-border shadow-2xl overflow-hidden"
            role="dialog"
            aria-label="Confirm completed blocks"
          >
            <div className="shrink-0 flex items-center justify-between gap-2 px-3.5 py-2.5 border-b border-border">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                <p className="text-[11px] font-mono uppercase tracking-wider font-semibold text-primary">
                  Confirm what happened
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-muted-foreground/55 hover:text-foreground transition-colors"
                aria-label="Close"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <p className="shrink-0 px-3.5 py-2 text-[10px] font-mono text-muted-foreground/60 leading-relaxed border-b border-border/60">
              Auto-marked from end-of-block tick. Confirming gives the learning engine
              full-strength signal. No obligation.
            </p>

            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {pending.map(block => {
                const task = tasks.find(t => t.id === block.task_id);
                const start = new Date(block.start_time);
                const end = new Date(block.end_time);
                const sched = (end.getTime() - start.getTime()) / 60000;
                const visible = block.visible_minutes ?? 0;
                const visibleRatio = sched > 0 ? Math.min(1, visible / sched) : 0;
                const dayLabel = isToday(start)
                  ? 'Today'
                  : isYesterday(start)
                  ? 'Yesterday'
                  : format(start, 'EEE');

                return (
                  <div
                    key={block.id}
                    className="flex items-center gap-2 px-2.5 py-2 rounded-md bg-secondary/40 border border-border/50"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-medium text-foreground truncate">
                        {task?.title ?? 'Untitled'}
                      </p>
                      <p className="text-[9px] font-mono text-muted-foreground/65 tabular-nums">
                        {dayLabel} {format(start, 'HH:mm')}–{format(end, 'HH:mm')}
                        {visible > 0 && (
                          <span className="ml-1.5 text-muted-foreground/50">
                            · {Math.round(visibleRatio * 100)}% visible
                          </span>
                        )}
                      </p>
                    </div>
                    <button
                      onClick={() => onConfirm(block.id)}
                      className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-md bg-emerald-500/12 hover:bg-emerald-500/22 border border-emerald-500/30 text-emerald-400 transition-colors"
                      aria-label="Confirm done"
                      title="Yes, this happened"
                    >
                      <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
                    </button>
                    <button
                      onClick={() => onMarkSkipped(block.id)}
                      className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-md bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 text-red-400 transition-colors"
                      aria-label="Mark skipped"
                      title="No, this didn't happen"
                    >
                      <X className="w-3.5 h-3.5" strokeWidth={2.5} />
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="shrink-0 px-3.5 py-2 border-t border-border bg-card/80">
              <p className="text-[10px] font-mono text-muted-foreground/45 text-center">
                Close anytime — assumed events still feed the engine at half weight.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
