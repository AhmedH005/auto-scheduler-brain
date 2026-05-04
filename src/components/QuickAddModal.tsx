/**
 * QuickAddModal — the new task creation primitive.
 *
 * Replaces the side-panel TaskForm for new-task creation. Side panel
 * stays for EDITING existing tasks (where the heavy form makes sense).
 * Creation should be fast — Cmd+N opens a centered Spotlight-like
 * composer with a single natural-language input that AXIS parses live.
 *
 * Why: research on power-user tools (Linear, Things 3, Notion, Cron,
 * Superhuman) converges on the "single-line natural-language quick add"
 * pattern because:
 *   - 90% of tasks need 3-4 fields (title, duration, deadline, priority)
 *   - Typing "Read paper 90min by Friday" is faster than tabbing through
 *     11 form fields
 *   - The parser is forgiving — anything unparsed stays as the title
 *   - Power users can still expand to the full form via "Show advanced"
 *
 * The user sees the parsed preview live as they type, so trust is
 * earned by transparency — they can verify what AXIS extracted before
 * pressing Enter.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import {
  Sparkles,
  Clock,
  Calendar,
  Repeat,
  Zap,
  Pin,
  Flame,
  ArrowRight,
  Hash,
  AlertCircle,
} from 'lucide-react';
import { Task, EnergyIntensity } from '@/types/task';
import { parseQuickAdd, parsedTaskToTask, ParsedTask } from '@/engine/quickadd-parser';

interface QuickAddModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (task: Omit<Task, 'id' | 'created_at' | 'status'>) => void;
  /** Pre-fill the input. When the user clicks an empty slot in the
   *  calendar, we open with "Task at HH:MM" pre-filled. */
  initialInput?: string;
}

export function QuickAddModal({
  open,
  onClose,
  onSubmit,
  initialInput,
}: QuickAddModalProps) {
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset on open
  useEffect(() => {
    if (open) {
      setInput(initialInput ?? '');
      // Focus on next tick so the modal animation completes
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [open, initialInput]);

  // Esc closes
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Parse on every keystroke
  const parsed: ParsedTask | null = useMemo(() => {
    const trimmed = input.trim();
    if (trimmed.length === 0) return null;
    return parseQuickAdd(trimmed);
  }, [input]);

  const submit = () => {
    if (!parsed || !parsed.title || parsed.title === 'Untitled') return;
    onSubmit(parsedTaskToTask(parsed));
    onClose();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[60] bg-background/75 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            key="modal"
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className="fixed left-1/2 top-[14vh] z-[61] -translate-x-1/2 w-[92vw] max-w-[600px]"
            role="dialog"
            aria-modal="true"
            aria-label="Quick add task"
          >
            <div className="bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
              {/* Header / input */}
              <div className="px-4 py-3 border-b border-border flex items-center gap-3">
                <div className="w-7 h-7 rounded-md bg-primary/15 flex items-center justify-center shrink-0">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                </div>
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder="Read research paper 90min by Friday — type naturally…"
                  className="flex-1 bg-transparent text-display text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
                  autoComplete="off"
                  spellCheck={false}
                />
                <kbd className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono text-muted-foreground/60 px-1.5 py-0.5 rounded border border-border bg-secondary/50">
                  ↵ Enter
                </kbd>
              </div>

              {/* Live parse preview */}
              <div className="px-4 py-3 min-h-[120px] bg-card/70">
                {parsed ? (
                  <ParsePreview parsed={parsed} />
                ) : (
                  <ParseHints />
                )}
              </div>

              {/* Footer */}
              <div className="px-4 py-2.5 border-t border-border flex items-center justify-between">
                <div className="flex items-center gap-3 text-[10px] font-mono text-muted-foreground/55">
                  <span className="flex items-center gap-1">
                    <kbd className="text-[9px] px-1 py-px rounded border border-border bg-secondary/40">Esc</kbd>
                    cancel
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="text-[9px] px-1 py-px rounded border border-border bg-secondary/40">↵</kbd>
                    add
                  </span>
                </div>
                <button
                  onClick={submit}
                  disabled={!parsed || !parsed.title || parsed.title === 'Untitled'}
                  className="inline-flex items-center gap-1.5 px-4 h-8 rounded-md bg-primary text-primary-foreground text-[12px] font-semibold hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  Add task
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────────────────────────────────────
//  Parse preview — shows what AXIS extracted, live
// ─────────────────────────────────────────────────────────────────────────

function ParsePreview({ parsed }: { parsed: ParsedTask }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className="space-y-3"
    >
      {/* Title preview */}
      <div className="flex items-start gap-2">
        <Hash className="w-3.5 h-3.5 text-muted-foreground/55 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-eyebrow text-muted-foreground/55 mb-0.5">Title</p>
          <p className="text-display text-foreground tracking-tight leading-snug">
            {parsed.title}
          </p>
        </div>
      </div>

      {/* Detected attributes — only show what was matched */}
      <div className="flex flex-wrap gap-1.5">
        <Chip
          icon={Clock}
          label={`${parsed.duration} min`}
          matched={parsed.matched.duration}
          fallback="default"
        />

        <Chip
          icon={Zap}
          label={parsed.energy}
          matched={parsed.matched.energy}
          fallback="moderate"
          colorClass={energyColorClass(parsed.energy)}
        />

        <Chip
          icon={Flame}
          label={`Priority ${priorityLabel(parsed.priority)}`}
          matched={parsed.matched.priority}
          fallback="3 (medium)"
        />

        {parsed.matched.fixed_time && parsed.start_datetime && (
          <Chip
            icon={Pin}
            label={`Fixed ${format(new Date(parsed.start_datetime), 'EEE HH:mm')}`}
            matched={true}
          />
        )}

        {parsed.matched.deadline && parsed.deadline && (
          <Chip
            icon={Calendar}
            label={`Due ${format(new Date(parsed.deadline), 'EEE MMM d')}`}
            matched={true}
            colorClass="bg-amber-500/10 text-amber-300 border-amber-500/25"
          />
        )}

        {parsed.matched.recurring && parsed.recurring && (
          <Chip
            icon={Repeat}
            label={`Repeats ${recurringLabel(parsed.recurring.pattern)}`}
            matched={true}
            colorClass="bg-violet-500/10 text-violet-300 border-violet-500/25"
          />
        )}
      </div>
    </motion.div>
  );
}

function Chip({
  icon: Icon,
  label,
  matched,
  fallback,
  colorClass,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  matched: boolean;
  fallback?: string;
  colorClass?: string;
}) {
  const baseClass = matched
    ? colorClass ?? 'bg-primary/12 text-primary border-primary/30'
    : 'bg-secondary/40 text-muted-foreground/60 border-border/60';

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium border ${baseClass}`}
    >
      <Icon className="w-3 h-3" />
      {label}
      {!matched && fallback && (
        <span className="text-[9px] font-mono opacity-60 ml-0.5">· {fallback}</span>
      )}
    </span>
  );
}

function ParseHints() {
  return (
    <div className="space-y-2">
      <p className="text-eyebrow text-muted-foreground/55">Try writing</p>
      <div className="space-y-1 text-body text-muted-foreground/65">
        <HintLine pre="Read research paper" highlight=" 90min by Friday" />
        <HintLine pre="Reply to emails" highlight=" 15m every weekday" />
        <HintLine pre="Lunch with Sara" highlight=" tomorrow at 12:30" />
        <HintLine pre="Sprint planning" highlight=" 1.5h urgent" />
      </div>
    </div>
  );
}

function HintLine({ pre, highlight }: { pre: string; highlight: string }) {
  return (
    <p className="leading-relaxed">
      <span>{pre}</span>
      <span className="text-primary/85 font-medium">{highlight}</span>
    </p>
  );
}

// ─────────────────────────────────────────────────────────────────────────
//  Tiny helpers
// ─────────────────────────────────────────────────────────────────────────

function priorityLabel(p: number): string {
  if (p >= 5) return 'urgent';
  if (p >= 4) return 'high';
  if (p === 3) return 'medium';
  if (p === 2) return 'low';
  return 'minimal';
}

function energyColorClass(e: EnergyIntensity): string {
  if (e === 'deep') return 'bg-violet-500/12 text-violet-300 border-violet-500/30';
  if (e === 'light') return 'bg-emerald-500/12 text-emerald-300 border-emerald-500/30';
  return 'bg-amber-500/12 text-amber-300 border-amber-500/30';
}

function recurringLabel(p: string): string {
  if (p === 'weekdays') return 'every weekday';
  if (p === 'daily') return 'every day';
  if (p === 'weekly') return 'every week';
  return p;
}
