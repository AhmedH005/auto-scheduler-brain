/**
 * TasksSheet — the full task inventory.
 *
 * Conversation is the primary interaction (composer at the bottom of
 * the app), but power users need a way to see everything they have to
 * do, sort it, filter it, and edit fields quickly. Motion and Reclaim
 * both have task lists; not having one would be a regression in
 * functionality.
 *
 * Layout: slide-in sheet from the right. Filter chips at top, scrollable
 * list below. Tap a task to expand inline-edit. Save / delete in the
 * expanded row. Add new tasks via the composer (sheet closes when you
 * type, or you can say "add X").
 *
 * No nested modals. Inline editing only.
 */

import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import {
  Calendar,
  Clock,
  Flame,
  Trash2,
  Repeat,
  X,
  Pin,
  Shield,
  ChevronDown,
} from 'lucide-react';
import { Sheet } from '@/components/ui/sheet';
import { Task, EnergyIntensity } from '@/types/task';
import { calculateScore } from '@/engine/scoring';
import { getTaskColor } from '@/lib/taskColors';

type Filter = 'today' | 'week' | 'all' | 'done';
type Sort = 'score' | 'deadline' | 'priority' | 'recent';

interface TasksSheetProps {
  open: boolean;
  onClose: () => void;
  tasks: Task[];
  onUpdate: (task: Task) => void;
  onDelete: (id: string) => void;
  onFocusComposer: () => void;
}

export function TasksSheet({
  open,
  onClose,
  tasks,
  onUpdate,
  onDelete,
  onFocusComposer,
}: TasksSheetProps) {
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('score');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const today = format(new Date(), 'yyyy-MM-dd');
  const weekEnd = format(
    new Date(Date.now() + 7 * 24 * 3600_000),
    'yyyy-MM-dd'
  );

  const counts = useMemo(
    () => ({
      today: tasks.filter(
        x => x.status === 'active' && x.deadline === today
      ).length,
      week: tasks.filter(
        x =>
          x.status === 'active' && x.deadline && x.deadline <= weekEnd
      ).length,
      all: tasks.filter(x => x.status === 'active').length,
      done: tasks.filter(x => x.status === 'completed').length,
    }),
    [tasks, today, weekEnd]
  );

  // Tag filter — set of tags that must ALL be present on a task for it
  // to pass. Empty set = no tag filter applied.
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set());

  const allTags = useMemo(() => {
    const s = new Set<string>();
    for (const t of tasks) {
      if (t.tags) for (const tag of t.tags) s.add(tag);
    }
    return Array.from(s).sort();
  }, [tasks]);

  const filtered = useMemo(() => {
    let r = tasks;
    if (filter === 'today')
      r = r.filter(x => x.status === 'active' && x.deadline === today);
    else if (filter === 'week')
      r = r.filter(
        x => x.status === 'active' && x.deadline && x.deadline <= weekEnd
      );
    else if (filter === 'all') r = r.filter(x => x.status === 'active');
    else if (filter === 'done') r = r.filter(x => x.status === 'completed');

    if (activeTags.size > 0) {
      r = r.filter(t => {
        if (!t.tags) return false;
        for (const want of activeTags) {
          if (!t.tags.includes(want)) return false;
        }
        return true;
      });
    }

    const sorted = [...r].sort((a, b) => {
      if (sort === 'score') return calculateScore(b) - calculateScore(a);
      if (sort === 'deadline') {
        if (!a.deadline && !b.deadline) return 0;
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return a.deadline.localeCompare(b.deadline);
      }
      if (sort === 'priority') return b.priority - a.priority;
      return b.created_at.localeCompare(a.created_at);
    });
    return sorted;
  }, [tasks, filter, sort, today, weekEnd, activeTags]);

  const toggleTag = (t: string) => {
    setActiveTags(prev => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  };

  const filterChips: Array<{ key: Filter; label: string; count: number }> = [
    { key: 'all', label: 'Active', count: counts.all },
    { key: 'today', label: 'Today', count: counts.today },
    { key: 'week', label: 'This week', count: counts.week },
    { key: 'done', label: 'Done', count: counts.done },
  ];

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="tasks"
      description={`${counts.all} active · ${counts.done} done`}
      size="lg"
      footer={
        <button
          onClick={() => {
            onClose();
            onFocusComposer();
          }}
          className="w-full inline-flex items-center justify-center gap-1.5 h-10 rounded-xl bg-primary text-primary-foreground text-[13px] font-semibold hover:brightness-110 transition-all"
        >
          + add via composer (or type below)
        </button>
      }
    >
      {/* Filter + sort chrome */}
      <div className="px-5 pt-3 pb-2 border-b border-border/60 sticky top-0 bg-card z-10 backdrop-blur">
        <div className="flex items-center gap-1 mb-2 flex-wrap">
          {filterChips.map(chip => {
            const active = filter === chip.key;
            return (
              <button
                key={chip.key}
                onClick={() => setFilter(chip.key)}
                className={
                  'flex items-center gap-1.5 px-2.5 h-7 rounded-md text-[11px] font-medium transition-colors ' +
                  (active
                    ? 'bg-primary/15 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40')
                }
              >
                {chip.label}
                <span
                  className={
                    'text-[9px] font-mono tabular-nums ' +
                    (active ? 'text-primary/70' : 'text-muted-foreground/55')
                  }
                >
                  {chip.count}
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2 text-[10px] font-mono">
          <span className="text-muted-foreground/55">sort by</span>
          {(['score', 'deadline', 'priority', 'recent'] as Sort[]).map(s => (
            <button
              key={s}
              onClick={() => setSort(s)}
              className={
                sort === s
                  ? 'text-primary font-semibold'
                  : 'text-muted-foreground/60 hover:text-foreground'
              }
            >
              {s}
            </button>
          ))}
        </div>

        {/* Tag filter — Linear / Things 3: click to toggle. Multiple
            active tags = AND filter. */}
        {allTags.length > 0 && (
          <div className="flex items-center gap-1 mt-2 flex-wrap">
            <span className="text-[10px] font-mono text-muted-foreground/55 mr-1">
              tags
            </span>
            {allTags.map(t => {
              const active = activeTags.has(t);
              return (
                <button
                  key={t}
                  onClick={() => toggleTag(t)}
                  className={
                    'px-1.5 h-5 rounded text-[10px] font-mono transition-colors ' +
                    (active
                      ? 'bg-primary/20 text-primary'
                      : 'bg-secondary/40 text-muted-foreground/75 hover:bg-secondary/60 hover:text-foreground')
                  }
                >
                  #{t}
                </button>
              );
            })}
            {activeTags.size > 0 && (
              <button
                onClick={() => setActiveTags(new Set())}
                className="px-1.5 h-5 text-[10px] font-mono text-muted-foreground/60 hover:text-foreground"
              >
                clear
              </button>
            )}
          </div>
        )}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="px-5 py-12 text-center">
          <p className="text-body text-muted-foreground/60 mb-1">
            no tasks here
          </p>
          <p className="text-[11px] font-mono text-muted-foreground/45">
            tell axis what to add — or change the filter
          </p>
        </div>
      ) : (
        <div className="px-2 py-2 space-y-0.5">
          {filtered.map(task => (
            <TaskRow
              key={task.id}
              task={task}
              expanded={expandedId === task.id}
              onToggle={() =>
                setExpandedId(expandedId === task.id ? null : task.id)
              }
              onUpdate={onUpdate}
              onDelete={id => {
                onDelete(id);
                setExpandedId(null);
              }}
            />
          ))}
        </div>
      )}
    </Sheet>
  );
}

// ─────────────────────────────────────────────────────────────────────────
//  Row — collapsed = scannable line; expanded = inline editor
// ─────────────────────────────────────────────────────────────────────────

interface TaskRowProps {
  task: Task;
  expanded: boolean;
  onToggle: () => void;
  onUpdate: (task: Task) => void;
  onDelete: (id: string) => void;
}

function TaskRow({ task, expanded, onToggle, onUpdate, onDelete }: TaskRowProps) {
  const color = getTaskColor(task.color ?? task.calendar_color);
  const score = calculateScore(task);
  const overdue =
    task.deadline && task.deadline < format(new Date(), 'yyyy-MM-dd');

  return (
    <div className="rounded-xl bg-secondary/20 hover:bg-secondary/35 transition-colors">
      <button
        onClick={onToggle}
        className="w-full text-left flex items-start gap-3 px-3 py-2.5"
      >
        <div
          className="w-1 self-stretch rounded-full mt-0.5"
          style={{ backgroundColor: color.border, minHeight: '2.25rem' }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p
              className={
                'text-body font-medium truncate leading-snug ' +
                (task.status === 'completed'
                  ? 'text-foreground/55 line-through'
                  : 'text-foreground')
              }
            >
              {task.title || '(untitled)'}
            </p>
            {task.is_recurring && (
              <Repeat className="w-3 h-3 text-primary/65 shrink-0" />
            )}
            {task.scheduling_mode === 'fixed' && (
              <Pin className="w-3 h-3 text-muted-foreground/55 shrink-0" />
            )}
            {task.scheduling_mode === 'anchor' && (
              <Shield className="w-3 h-3 text-muted-foreground/55 shrink-0" />
            )}
          </div>
          <div className="flex items-center gap-2.5 mt-1 text-[10px] font-mono text-muted-foreground/65 leading-none flex-wrap">
            <span className="flex items-center gap-1">
              <Clock className="w-2.5 h-2.5" />
              <span className="tabular-nums">{task.total_duration}m</span>
            </span>
            <span className="flex items-center gap-1">
              <Flame className="w-2.5 h-2.5" />
              p{task.priority}
            </span>
            {task.deadline && (
              <span
                className={
                  'flex items-center gap-1 ' +
                  (overdue
                    ? 'text-destructive'
                    : 'text-amber-300/85')
                }
              >
                <Calendar className="w-2.5 h-2.5" />
                <span className="tabular-nums">{task.deadline.slice(5)}</span>
              </span>
            )}
            <span className="capitalize text-muted-foreground/55">
              {task.energy_intensity}
            </span>
            {score >= 2.8 && (
              <span
                className={
                  'px-1 rounded font-semibold ' +
                  (score >= 4
                    ? 'text-destructive bg-destructive/10'
                    : 'text-amber-300 bg-amber-500/10')
                }
              >
                {score >= 4 ? 'CRIT' : 'HIGH'}
              </span>
            )}
          </div>
        </div>
        <ChevronDown
          className={
            'w-3.5 h-3.5 text-muted-foreground/55 shrink-0 mt-1 transition-transform ' +
            (expanded ? 'rotate-180' : '')
          }
        />
      </button>

      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-border/40">
          <InlineEditor task={task} onUpdate={onUpdate} onDelete={onDelete} />
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
//  Inline editor — slim on purpose. Anything richer goes through the
//  composer ("change the title to X", "make it recurring weekly").
// ─────────────────────────────────────────────────────────────────────────

function InlineEditor({
  task,
  onUpdate,
  onDelete,
}: {
  task: Task;
  onUpdate: (task: Task) => void;
  onDelete: (id: string) => void;
}) {
  const [duration, setDuration] = useState(task.total_duration);
  const [priority, setPriority] = useState(task.priority);
  const [energy, setEnergy] = useState<EnergyIntensity>(task.energy_intensity);
  const [deadline, setDeadline] = useState(task.deadline ?? '');

  const dirty =
    duration !== task.total_duration ||
    priority !== task.priority ||
    energy !== task.energy_intensity ||
    (deadline || null) !== (task.deadline || null);

  const save = () => {
    onUpdate({
      ...task,
      total_duration: duration,
      priority,
      energy_intensity: energy,
      deadline: deadline || null,
    });
  };

  return (
    <div className="space-y-3 mt-1">
      {/* Duration */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/55">
            duration
          </span>
          <span className="text-[11px] font-mono tabular-nums text-foreground/75">
            {duration}m
          </span>
        </div>
        <div className="flex gap-1 flex-wrap">
          {[15, 30, 45, 60, 90, 120].map(d => (
            <button
              key={d}
              onClick={() => setDuration(d)}
              className={
                'px-2 h-7 rounded-md text-[11px] font-medium transition-colors ' +
                (duration === d
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary/40 text-muted-foreground hover:bg-secondary/60')
              }
            >
              {d}
            </button>
          ))}
          <input
            type="number"
            value={duration}
            onChange={e => setDuration(Math.max(5, parseInt(e.target.value) || 5))}
            className="w-16 h-7 px-2 rounded-md bg-secondary/40 border border-border text-[11px] font-mono tabular-nums text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
            min={5}
          />
        </div>
      </div>

      {/* Priority */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/55">
            priority
          </span>
          <span className="text-[11px] font-mono tabular-nums text-foreground/75">
            p{priority}
          </span>
        </div>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map(p => (
            <button
              key={p}
              onClick={() => setPriority(p)}
              className={
                'flex-1 h-7 rounded-md text-[11px] font-medium transition-colors ' +
                (priority === p
                  ? p >= 4
                    ? 'bg-destructive/85 text-white'
                    : p === 3
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-foreground'
                  : 'bg-secondary/40 text-muted-foreground hover:bg-secondary/60')
              }
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Energy */}
      <div>
        <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/55 mb-1">
          energy
        </div>
        <div className="flex gap-1">
          {(['light', 'moderate', 'deep'] as EnergyIntensity[]).map(e => (
            <button
              key={e}
              onClick={() => setEnergy(e)}
              className={
                'flex-1 h-7 rounded-md text-[11px] font-medium capitalize transition-colors ' +
                (energy === e
                  ? e === 'deep'
                    ? 'bg-violet-500/85 text-white'
                    : e === 'light'
                    ? 'bg-emerald-500/85 text-white'
                    : 'bg-amber-500/85 text-white'
                  : 'bg-secondary/40 text-muted-foreground hover:bg-secondary/60')
              }
            >
              {e}
            </button>
          ))}
        </div>
      </div>

      {/* Deadline */}
      <div>
        <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/55 mb-1">
          deadline
        </div>
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={deadline}
            onChange={e => setDeadline(e.target.value)}
            className="flex-1 h-8 px-2 rounded-md bg-secondary/40 border border-border text-[11px] font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
          {deadline && (
            <button
              onClick={() => setDeadline('')}
              className="text-muted-foreground/60 hover:text-foreground p-1"
              title="Clear deadline"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Action row */}
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={save}
          disabled={!dirty}
          className="flex-1 h-9 rounded-lg bg-primary text-primary-foreground text-[12px] font-semibold disabled:opacity-30 disabled:cursor-not-allowed hover:brightness-110 transition-all"
        >
          {dirty ? 'save changes' : 'no changes'}
        </button>
        <button
          onClick={() => onDelete(task.id)}
          className="h-9 px-3 rounded-lg bg-destructive/15 text-destructive text-[12px] font-medium hover:bg-destructive/25 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
