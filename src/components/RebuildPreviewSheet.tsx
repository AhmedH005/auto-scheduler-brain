import { useEffect } from 'react';
import { format } from 'date-fns';
import {
  X,
  Plus,
  ArrowRight,
  Trash2,
  AlertTriangle,
  AlertOctagon,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Task,
  RebuildResult,
  ScheduleDiff,
  BlockMove,
  ScheduledBlock,
  DroppedTask,
  AtRiskTask,
} from '@/types/task';

interface RebuildPreviewSheetProps {
  open: boolean;
  result: RebuildResult | null;
  diff: ScheduleDiff | null;
  tasks: Task[];
  onApply: () => void;
  onCancel: () => void;
}

const blockTaskTitle = (block: ScheduledBlock, tasks: Task[]) =>
  tasks.find(t => t.id === block.task_id)?.title ?? 'Untitled';

const fmtTime = (iso: string) => format(new Date(iso), 'HH:mm');
const fmtDay = (iso: string) => format(new Date(iso), 'EEE MMM d');

export function RebuildPreviewSheet({
  open,
  result,
  diff,
  tasks,
  onApply,
  onCancel,
}: RebuildPreviewSheetProps) {
  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open || !result || !diff) return null;

  const totalChanges =
    diff.added.length +
    diff.moved.length +
    diff.removed.length +
    result.dropped.length +
    result.at_risk.length;
  const isNoOp = totalChanges === 0;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm animate-in fade-in"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Slide-in panel */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="preview-sheet-title"
        className="fixed right-0 top-0 bottom-0 z-50 w-full sm:w-[480px] bg-card border-l border-border shadow-2xl flex flex-col animate-in slide-in-from-right"
      >
        {/* Header */}
        <header className="shrink-0 px-5 py-4 border-b border-border flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
              <h2
                id="preview-sheet-title"
                className="font-mono text-xs font-bold tracking-wider text-primary uppercase"
              >
                Proposed schedule
              </h2>
            </div>
            <p className="text-[11px] text-muted-foreground font-mono">
              {isNoOp
                ? 'No changes from your current schedule.'
                : 'Review changes before applying. Nothing is committed yet.'}
            </p>
          </div>
          <button
            onClick={onCancel}
            className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
            aria-label="Close preview"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {/* Summary chips */}
        <div className="shrink-0 px-5 py-3 border-b border-border flex flex-wrap gap-1.5">
          <SummaryChip label="New" count={diff.added.length} tone="green" icon={Plus} />
          <SummaryChip label="Moved" count={diff.moved.length} tone="amber" icon={ArrowRight} />
          <SummaryChip label="Removed" count={diff.removed.length} tone="muted" icon={Trash2} />
          <SummaryChip label="Couldn't fit" count={result.dropped.length} tone="red" icon={AlertOctagon} />
          <SummaryChip label="At risk" count={result.at_risk.length} tone="amber" icon={AlertTriangle} />
          <SummaryChip label="Unchanged" count={diff.unchanged_count} tone="muted" icon={CheckCircle2} />
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Couldn't fit — most important, surface first */}
          {result.dropped.length > 0 && (
            <Section title="Couldn't fit" tone="red" icon={AlertOctagon}>
              {result.dropped.map((d, i) => (
                <DroppedRow key={`${d.task_id}-${i}`} drop={d} reason={diff.reasons[d.task_id]} />
              ))}
            </Section>
          )}

          {/* At risk */}
          {result.at_risk.length > 0 && (
            <Section title="At risk" tone="amber" icon={AlertTriangle}>
              {result.at_risk.map((r, i) => (
                <AtRiskRow key={`${r.task_id}-${i}`} risk={r} reason={diff.reasons[r.task_id]} />
              ))}
            </Section>
          )}

          {/* Moved */}
          {diff.moved.length > 0 && (
            <Section title="Moved" tone="amber" icon={ArrowRight}>
              {diff.moved.map(m => (
                <MoveRow key={m.block_id} move={m} />
              ))}
            </Section>
          )}

          {/* Added */}
          {diff.added.length > 0 && (
            <Section title="New blocks" tone="green" icon={Plus}>
              {diff.added.map(b => (
                <BlockRow
                  key={b.id}
                  title={blockTaskTitle(b, tasks)}
                  start={b.start_time}
                  end={b.end_time}
                  locked={b.locked}
                />
              ))}
            </Section>
          )}

          {/* Removed */}
          {diff.removed.length > 0 && (
            <Section title="Removed" tone="muted" icon={Trash2}>
              {diff.removed.map(b => (
                <BlockRow
                  key={b.id}
                  title={blockTaskTitle(b, tasks)}
                  start={b.start_time}
                  end={b.end_time}
                  locked={b.locked}
                  faded
                />
              ))}
            </Section>
          )}

          {isNoOp && (
            <div className="text-center py-12">
              <CheckCircle2 className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-xs text-muted-foreground font-mono">
                Schedule already matches your tasks. Nothing to change.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="shrink-0 px-5 py-3 border-t border-border flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" className="font-mono text-[11px] h-8" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="font-mono text-[11px] h-8 px-4"
            onClick={onApply}
            disabled={isNoOp}
          >
            {isNoOp ? 'Nothing to apply' : 'Apply changes'}
          </Button>
        </footer>
      </aside>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────
//  Subcomponents
// ─────────────────────────────────────────────────────────────────────────

type Tone = 'green' | 'amber' | 'red' | 'muted';

const toneClasses: Record<Tone, { bg: string; text: string; border: string; iconBg: string }> = {
  green: {
    bg: 'bg-emerald-500/8',
    text: 'text-emerald-400',
    border: 'border-emerald-500/20',
    iconBg: 'bg-emerald-500/15',
  },
  amber: {
    bg: 'bg-amber-500/8',
    text: 'text-amber-400',
    border: 'border-amber-500/20',
    iconBg: 'bg-amber-500/15',
  },
  red: {
    bg: 'bg-red-500/8',
    text: 'text-red-400',
    border: 'border-red-500/25',
    iconBg: 'bg-red-500/15',
  },
  muted: {
    bg: 'bg-muted/30',
    text: 'text-muted-foreground',
    border: 'border-border',
    iconBg: 'bg-muted/50',
  },
};

function SummaryChip({
  label,
  count,
  tone,
  icon: Icon,
}: {
  label: string;
  count: number;
  tone: Tone;
  icon: React.ComponentType<{ className?: string }>;
}) {
  if (count === 0) return null;
  const c = toneClasses[tone];
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium ${c.bg} ${c.text} border ${c.border}`}
    >
      <Icon className="w-2.5 h-2.5" />
      {count} {label}
    </span>
  );
}

function Section({
  title,
  tone,
  icon: Icon,
  children,
}: {
  title: string;
  tone: Tone;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  const c = toneClasses[tone];
  return (
    <div>
      <h3 className={`flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-mono font-semibold mb-2 ${c.text}`}>
        <Icon className="w-3 h-3" />
        {title}
      </h3>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function BlockRow({
  title,
  start,
  end,
  locked,
  faded,
}: {
  title: string;
  start: string;
  end: string;
  locked: boolean;
  faded?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 px-3 py-2 rounded-md border border-border bg-secondary/40 ${faded ? 'opacity-50 line-through' : ''}`}
    >
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-foreground truncate">{title}</p>
        <p className="text-[10px] text-muted-foreground font-mono">{fmtDay(start)}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-[11px] font-mono tabular-nums text-foreground">
          {fmtTime(start)}–{fmtTime(end)}
        </p>
        {locked && <p className="text-[9px] text-muted-foreground font-mono">locked</p>}
      </div>
    </div>
  );
}

function MoveRow({ move }: { move: BlockMove }) {
  const beforeDay = fmtDay(move.before.start_time);
  const afterDay = fmtDay(move.after.start_time);
  const sameDay = beforeDay === afterDay;
  return (
    <div className="px-3 py-2 rounded-md border border-amber-500/15 bg-amber-500/5">
      <p className="text-xs font-medium text-foreground truncate mb-1">{move.task_title}</p>
      <div className="flex items-center gap-2 text-[10px] font-mono tabular-nums text-muted-foreground">
        <span className="line-through opacity-60">
          {sameDay ? '' : beforeDay + ' '}
          {fmtTime(move.before.start_time)}
        </span>
        <ArrowRight className="w-2.5 h-2.5 text-amber-400" />
        <span className="text-amber-400">
          {sameDay ? '' : afterDay + ' '}
          {fmtTime(move.after.start_time)}
        </span>
      </div>
    </div>
  );
}

function DroppedRow({ drop, reason }: { drop: DroppedTask; reason?: string }) {
  return (
    <div className="px-3 py-2 rounded-md border border-red-500/20 bg-red-500/5">
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className="text-xs font-medium text-foreground truncate">{drop.task_title}</p>
        <span className="text-[9px] font-mono text-red-400 shrink-0">
          {drop.remaining_minutes}m unplaced
        </span>
      </div>
      {reason && <p className="text-[10px] text-muted-foreground/80 leading-relaxed">{reason}</p>}
    </div>
  );
}

function AtRiskRow({ risk, reason }: { risk: AtRiskTask; reason?: string }) {
  return (
    <div className="px-3 py-2 rounded-md border border-amber-500/20 bg-amber-500/5">
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className="text-xs font-medium text-foreground truncate">{risk.task_title}</p>
        <span className="text-[9px] font-mono text-amber-400 shrink-0">
          {risk.buffer_minutes < 0
            ? `${Math.abs(risk.buffer_minutes)}m past`
            : `${Math.round(risk.buffer_minutes / 60)}h buffer`}
        </span>
      </div>
      {reason && <p className="text-[10px] text-muted-foreground/80 leading-relaxed">{reason}</p>}
    </div>
  );
}
