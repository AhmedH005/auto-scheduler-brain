import React, { useMemo, useCallback, useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ScheduledBlock, Task, UserSettings } from '@/types/task';
import { format, startOfWeek, addDays, addWeeks, isToday } from 'date-fns';
import { Lock, Unlock, ChevronLeft, ChevronRight, Trash2, Pencil, Check, SkipForward, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { getTaskColor } from '@/lib/taskColors';
import { GoogleIcon } from '@/components/GoogleIcon';
import { useTranslation } from 'react-i18next';
import { scoreBreakdown } from '@/engine/scoring';

interface WeekViewProps {
  blocks: ScheduledBlock[];
  tasks: Task[];
  settings: UserSettings;
  onMoveBlock: (blockId: string, newStart: string, newEnd: string) => void;
  onResizeBlock: (blockId: string, newEnd: string) => void;
  onLockBlock: (blockId: string) => void;
  onUnlockBlock: (blockId: string) => void;
  onDeleteBlock: (blockId: string) => void;
  onQuickAdd: (date: string, time: string) => void;
  onEditTask?: (task: Task) => void;
  /** Mark a block as completed. actualMinutes optional — defaults to scheduled duration. */
  onMarkDone?: (blockId: string, actualMinutes?: number) => void;
  /** Skip a block (something came up). Removes it; rebuild re-places the task. */
  onMarkSkipped?: (blockId: string) => void;
}

// Full 24-hour grid — see DayView.tsx for the rationale. Cutting at
// 06:00–22:00 hid early-morning workouts and late-night work, and any
// block scheduled outside that window simply didn't render.
const HOUR_HEIGHT = 60;
const START_HOUR = 0;
const END_HOUR = 24;
const TOTAL_HOURS = END_HOUR - START_HOUR;
const SNAP_MINUTES = 15;

function snapToGrid(minutes: number): number {
  return Math.round(minutes / SNAP_MINUTES) * SNAP_MINUTES;
}

function minutesToTime(totalMinutes: number): { hour: number; minute: number } {
  return { hour: Math.floor(totalMinutes / 60), minute: totalMinutes % 60 };
}

function yToMinutes(y: number): number {
  return (y / HOUR_HEIGHT) * 60 + START_HOUR * 60;
}

// Returns inline style for border + bg color using task's chosen color.
function getBlockInlineStyle(block: ScheduledBlock, task: Task | undefined): React.CSSProperties {
  const c = getTaskColor(task?.color);
  return { borderLeftColor: c.border, backgroundColor: c.bg };
}

// Computes side-by-side column layout for overlapping blocks (Google Calendar style).
function computeOverlapLayout(blocks: ScheduledBlock[]): Map<string, { col: number; total: number }> {
  const result = new Map<string, { col: number; total: number }>();
  if (blocks.length === 0) return result;

  const sorted = [...blocks].sort((a, b) => {
    const aS = new Date(a.start_time).getTime();
    const bS = new Date(b.start_time).getTime();
    return aS !== bS ? aS - bS : new Date(b.end_time).getTime() - new Date(a.end_time).getTime();
  });

  let i = 0;
  while (i < sorted.length) {
    // Build a cluster of all mutually overlapping blocks
    const cluster: ScheduledBlock[] = [sorted[i]];
    let maxEnd = new Date(sorted[i].end_time).getTime();

    let j = i + 1;
    while (j < sorted.length && new Date(sorted[j].start_time).getTime() < maxEnd) {
      cluster.push(sorted[j]);
      maxEnd = Math.max(maxEnd, new Date(sorted[j].end_time).getTime());
      j++;
    }

    // Greedy column assignment within the cluster
    const colEnds: number[] = [];
    const assigned: number[] = [];
    for (const block of cluster) {
      const start = new Date(block.start_time).getTime();
      let placed = false;
      for (let c = 0; c < colEnds.length; c++) {
        if (colEnds[c] <= start) {
          assigned.push(c);
          colEnds[c] = new Date(block.end_time).getTime();
          placed = true;
          break;
        }
      }
      if (!placed) {
        assigned.push(colEnds.length);
        colEnds.push(new Date(block.end_time).getTime());
      }
    }

    const total = colEnds.length;
    cluster.forEach((b, k) => result.set(b.id, { col: assigned[k], total }));
    i = j;
  }

  return result;
}

export function WeekView({
  blocks,
  tasks,
  settings,
  onMoveBlock,
  onResizeBlock,
  onLockBlock,
  onUnlockBlock,
  onDeleteBlock,
  onQuickAdd,
  onEditTask,
  onMarkDone,
  onMarkSkipped,
}: WeekViewProps) {
  const { t } = useTranslation();
  const [weekOffset, setWeekOffset] = useState(0);
  const weekStart = useMemo(() => addWeeks(startOfWeek(new Date(), { weekStartsOn: 1 }), weekOffset), [weekOffset]);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const taskMap = useMemo(() => {
    const map = new Map<string, Task>();
    tasks.forEach(t => map.set(t.id, t));
    return map;
  }, [tasks]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const columnsRef = useRef<(HTMLDivElement | null)[]>([]);

  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedBlockId) return;
    const handler = (ev: MouseEvent) => {
      const target = ev.target as HTMLElement;
      if (!target.closest('[data-block-popover]') && !target.closest('[data-block]')) {
        setSelectedBlockId(null);
      }
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [selectedBlockId]);

  // Smart auto-scroll on mount: target current time − 1h so user sees
  // what's happening now. Fall back to working-hours start at very
  // early hours to avoid showing 2 AM by default.
  useEffect(() => {
    if (!scrollRef.current) return;
    const now = new Date();
    const nowH = now.getHours() + now.getMinutes() / 60;
    const workStart = parseInt(settings.working_hours_start.split(':')[0], 10) || 8;
    const targetH = nowH < workStart - 1 ? workStart : Math.max(0, nowH - 1);
    scrollRef.current.scrollTop = targetH * HOUR_HEIGHT;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // dragState now tracks originDayIndex (where drag started) and targetDayIndex (where mouse currently is)
  const [dragState, setDragState] = useState<{
    type: 'move' | 'resize';
    blockId: string;
    originDayIndex: number;
    targetDayIndex: number;
    startY: number;
    originalStartMin: number;
    originalEndMin: number;
    currentDeltaMin: number;
  } | null>(null);
  const dragStateRef = useRef<typeof dragState>(null);

  const clampMinutes = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

  const getBlockMinutes = (block: ScheduledBlock) => {
    const start = new Date(block.start_time);
    const end = new Date(block.end_time);
    return {
      startMin: start.getHours() * 60 + start.getMinutes(),
      endMin: end.getHours() * 60 + end.getMinutes(),
    };
  };

  const getBlockStyle = (block: ScheduledBlock) => {
    let { startMin, endMin } = getBlockMinutes(block);

    if (dragState && dragState.blockId === block.id) {
      const delta = snapToGrid(dragState.currentDeltaMin);
      if (dragState.type === 'move') {
        const duration = dragState.originalEndMin - dragState.originalStartMin;
        startMin = clampMinutes(dragState.originalStartMin + delta, START_HOUR * 60, END_HOUR * 60 - duration);
        endMin = startMin + duration;
      } else {
        const minEnd = dragState.originalStartMin + 15;
        endMin = clampMinutes(dragState.originalEndMin + delta, minEnd, END_HOUR * 60);
      }
    }

    const top = ((startMin - START_HOUR * 60) / 60) * HOUR_HEIGHT;
    const height = ((endMin - startMin) / 60) * HOUR_HEIGHT;
    return { top: `${top}px`, height: `${Math.max(height, 12)}px` };
  };

  const handleMouseDown = useCallback((e: React.MouseEvent, blockId: string, type: 'move' | 'resize') => {
    e.stopPropagation();
    e.preventDefault();

    const block = blocks.find(b => b.id === blockId);
    if (!block) return;

    const blockDate = format(new Date(block.start_time), 'yyyy-MM-dd');
    const dayIndex = days.findIndex(d => format(d, 'yyyy-MM-dd') === blockDate);
    if (dayIndex < 0) return;

    const { startMin, endMin } = getBlockMinutes(block);

    const nextState = {
      type,
      blockId,
      originDayIndex: dayIndex,
      targetDayIndex: dayIndex,
      startY: e.clientY,
      originalStartMin: startMin,
      originalEndMin: endMin,
      currentDeltaMin: 0,
    };

    dragStateRef.current = nextState;
    setDragState(nextState);
  }, [blocks, days]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const current = dragStateRef.current;
      if (!current) return;

      const deltaY = e.clientY - current.startY;
      const deltaMin = (deltaY / HOUR_HEIGHT) * 60;

      // For move drags, detect which column the mouse is over
      let targetDayIndex = current.originDayIndex;
      if (current.type === 'move') {
        for (let i = 0; i < columnsRef.current.length; i++) {
          const col = columnsRef.current[i];
          if (col) {
            const rect = col.getBoundingClientRect();
            if (e.clientX >= rect.left && e.clientX <= rect.right) {
              targetDayIndex = i;
              break;
            }
          }
        }
      }

      const updated = { ...current, currentDeltaMin: deltaMin, targetDayIndex };
      dragStateRef.current = updated;
      setDragState(updated);
    };

    const handleMouseUp = () => {
      const current = dragStateRef.current;
      if (!current) return;

      const delta = snapToGrid(current.currentDeltaMin);
      const targetDay = days[current.targetDayIndex];
      const dateStr = format(targetDay, 'yyyy-MM-dd');

      if (current.type === 'move') {
        const duration = current.originalEndMin - current.originalStartMin;
        const newStartMin = clampMinutes(current.originalStartMin + delta, START_HOUR * 60, END_HOUR * 60 - duration);
        const newEndMin = newStartMin + duration;
        const { hour: sh, minute: sm } = minutesToTime(newStartMin);
        const { hour: eh, minute: em } = minutesToTime(newEndMin);
        const newStart = `${dateStr}T${String(sh).padStart(2, '0')}:${String(sm).padStart(2, '0')}:00`;
        const newEnd = `${dateStr}T${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}:00`;
        // Always call onMoveBlock so cross-day moves register even with delta === 0
        if (delta !== 0 || current.targetDayIndex !== current.originDayIndex) {
          onMoveBlock(current.blockId, newStart, newEnd);
        }
      } else {
        if (delta !== 0) {
          const minEnd = current.originalStartMin + 15;
          const newEndMin = clampMinutes(current.originalEndMin + delta, minEnd, END_HOUR * 60);
          const { hour: eh, minute: em } = minutesToTime(newEndMin);
          // Resize keeps original date
          const originDay = days[current.originDayIndex];
          const originDateStr = format(originDay, 'yyyy-MM-dd');
          const newEnd = `${originDateStr}T${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}:00`;
          onResizeBlock(current.blockId, newEnd);
        }
      }

      dragStateRef.current = null;
      setDragState(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [days, onMoveBlock, onResizeBlock]);

  const handleColumnDoubleClick = (e: React.MouseEvent, dayIndex: number) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const totalMin = yToMinutes(y);
    const snapped = snapToGrid(totalMin);
    const { hour, minute } = minutesToTime(snapped);
    const dateStr = format(days[dayIndex], 'yyyy-MM-dd');
    const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    onQuickAdd(dateStr, timeStr);
  };

  const now = new Date();
  const nowHour = now.getHours() + now.getMinutes() / 60;
  const nowOffset = (nowHour - START_HOUR) * HOUR_HEIGHT;

  const deepStart = parseInt(settings.deep_window_start.split(':')[0]);
  const deepEnd = parseInt(settings.deep_window_end.split(':')[0]);
  const deepTop = (deepStart - START_HOUR) * HOUR_HEIGHT;
  const deepHeight = (deepEnd - deepStart) * HOUR_HEIGHT;

  const workStart = parseInt(settings.working_hours_start.split(':')[0]);
  const workEnd = parseInt(settings.working_hours_end.split(':')[0]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Week navigation + Day headers */}
      <div className="shrink-0 bg-background z-10 border-b border-border">
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-border">
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setWeekOffset(w => w - 1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-foreground font-semibold">
              {format(days[0], 'MMM d')} — {format(days[6], 'MMM d, yyyy')}
            </span>
            {weekOffset !== 0 && (
              <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] font-mono" onClick={() => setWeekOffset(0)}>
                {t('calendar.today')}
              </Button>
            )}
          </div>
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setWeekOffset(w => w + 1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex">
          <div className="w-14 shrink-0" />
          {days.map((day, i) => (
            <div
              key={i}
              className={`flex-1 text-center py-2 border-l border-border ${isToday(day) ? 'bg-primary/5' : ''}`}
            >
              <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
                {(t('calendar.dayHeaders', { returnObjects: true }) as string[])[i]}
              </div>
              <div className={`text-lg font-mono font-semibold ${isToday(day) ? 'text-primary' : 'text-foreground'}`}>
                {format(day, 'd')}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Scrollable time grid */}
      <div className="flex-1 overflow-y-auto" ref={scrollRef}>
        <div className="flex" style={{ height: `${TOTAL_HOURS * HOUR_HEIGHT}px` }}>
          {/* Time labels */}
          <div className="w-14 shrink-0 relative">
            {Array.from({ length: TOTAL_HOURS }, (_, i) => (
              <div
                key={i}
                className="absolute right-2 text-[10px] font-mono text-muted-foreground"
                style={{ top: `${i * HOUR_HEIGHT - 6}px` }}
              >
                {`${String(i + START_HOUR).padStart(2, '0')}:00`}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((day, dayIndex) => {
            const dateStr = format(day, 'yyyy-MM-dd');

            // Include blocks that belong to this day, accounting for cross-day drags
            const dayBlocks = blocks.filter(b => {
              if (dragState?.blockId === b.id && dragState.type === 'move') {
                // Show dragging block in the target column, hide from origin
                return dragState.targetDayIndex === dayIndex;
              }
              return format(new Date(b.start_time), 'yyyy-MM-dd') === dateStr;
            });

            const overlapLayouts = computeOverlapLayout(dayBlocks);

            return (
              <div
                key={dayIndex}
                ref={el => { columnsRef.current[dayIndex] = el; }}
                className={`flex-1 border-l border-border relative ${isToday(day) ? 'bg-primary/[0.02]' : ''}`}
                onDoubleClick={e => handleColumnDoubleClick(e, dayIndex)}
              >
                {/* Energy-zone gradient — morning deep / afternoon moderate / evening light.
                    Maps directly to the engine's slotEnergyLevel() so the user sees the
                    cognitive demand profile they're scheduling against. Very low opacity
                    so blocks remain the visual focal point. */}
                <div
                  className="absolute inset-x-0 pointer-events-none"
                  style={{
                    top: `${(6 - START_HOUR) * HOUR_HEIGHT}px`,
                    height: `${(22 - 6) * HOUR_HEIGHT}px`,
                    background: `linear-gradient(
                      to bottom,
                      hsl(var(--energy-deep) / 0.06) 0%,
                      hsl(var(--energy-deep) / 0.05) ${((12 - 6) / (22 - 6)) * 100}%,
                      hsl(var(--energy-moderate) / 0.05) ${((12 - 6) / (22 - 6)) * 100}%,
                      hsl(var(--energy-moderate) / 0.04) ${((17 - 6) / (22 - 6)) * 100}%,
                      hsl(var(--energy-light) / 0.04) ${((17 - 6) / (22 - 6)) * 100}%,
                      hsl(var(--energy-light) / 0.03) 100%
                    )`,
                  }}
                />

                {/* Hour lines */}
                {Array.from({ length: TOTAL_HOURS }, (_, i) => (
                  <div key={i} className="absolute w-full border-t border-grid-line" style={{ top: `${i * HOUR_HEIGHT}px` }} />
                ))}
                {/* Half-hour lines */}
                {Array.from({ length: TOTAL_HOURS }, (_, i) => (
                  <div key={`half-${i}`} className="absolute w-full border-t border-grid-line/50 border-dashed" style={{ top: `${i * HOUR_HEIGHT + HOUR_HEIGHT / 2}px` }} />
                ))}

                {/* Deep window overlay — sharper accent on the user's chosen deep hours */}
                {deepStart >= START_HOUR && deepEnd <= END_HOUR && (
                  <div
                    className="absolute inset-x-0 border-l-2 border-primary/30 pointer-events-none"
                    style={{
                      top: `${deepTop}px`,
                      height: `${deepHeight}px`,
                      background: 'hsl(var(--primary) / 0.04)',
                    }}
                  />
                )}

                {/* Non-working overlays */}
                {workStart > START_HOUR && (
                  <div className="absolute inset-x-0 top-0 bg-background/60" style={{ height: `${(workStart - START_HOUR) * HOUR_HEIGHT}px` }} />
                )}
                {workEnd < END_HOUR && (
                  <div className="absolute inset-x-0 bg-background/60" style={{ top: `${(workEnd - START_HOUR) * HOUR_HEIGHT}px`, height: `${(END_HOUR - workEnd) * HOUR_HEIGHT}px` }} />
                )}

                {/* Now line */}
                {isToday(day) && nowHour >= START_HOUR && nowHour <= END_HOUR && (
                  <div className="absolute inset-x-0 z-20 flex items-center pointer-events-none" style={{ top: `${nowOffset}px` }}>
                    <div className="w-2 h-2 rounded-full bg-time-marker -ml-1" />
                    <div className="flex-1 h-[2px] bg-time-marker" />
                  </div>
                )}

                {/* Blocks (includes external calendar events) */}
                <AnimatePresence mode="popLayout">
                {dayBlocks.map(block => {
                  const task = taskMap.get(block.task_id);
                  const posStyle = getBlockStyle(block);
                  const isDragging = dragState?.blockId === block.id;
                  const isSelected = selectedBlockId === block.id;

                  // Synced tasks use calendar color; native tasks use task color.
                  const isSynced = !!task?.sync_source;
                  const extColor = task?.calendar_color ?? '#6b7280';
                  const colorStyle: React.CSSProperties = isSynced
                    ? { borderLeftColor: extColor, backgroundColor: `${extColor}22` }
                    : getBlockInlineStyle(block, task);

                  // Compute side-by-side layout for overlapping blocks
                  const layout = isDragging
                    ? { col: 0, total: 1 }
                    : (overlapLayouts.get(block.id) || { col: 0, total: 1 });
                  const leftPct = (layout.col / layout.total) * 100;
                  const widthPct = (1 / layout.total) * 100;
                  const layoutStyle: React.CSSProperties = {
                    left: `calc(${leftPct}% + 2px)`,
                    width: `calc(${widthPct}% - 4px)`,
                  };

                  // We tried layoutId-driven fly animations on rebuild apply, but
                  // framer-motion's layout-measurement pass briefly captured pointer
                  // events and made every block click feel janky. Reverted to a simple
                  // fade/scale on enter+exit — keeps the calendar feeling alive without
                  // fighting the drag system or the click handlers.
                  const blockEl = (
                    <motion.div
                      key={block.id}
                      data-block={block.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.16, ease: [0.2, 0, 0, 1] }}
                      className={`absolute rounded-sm border-l-2 px-1.5 py-0.5 z-10 group transition-colors select-none ${
                        isDragging ? 'opacity-80 shadow-lg cursor-grabbing z-30' : 'cursor-grab hover:brightness-110'
                      } ${isSelected ? 'ring-1 ring-primary' : ''} ${
                        block.completed_at ? 'opacity-55 hover:opacity-80' : ''
                      }`}
                      style={{ ...posStyle, ...layoutStyle, ...colorStyle }}
                      onMouseDown={e => {
                        if ((e.target as HTMLElement).closest('[data-block-popover]')) return;
                        handleMouseDown(e, block.id, 'move');
                      }}
                      onClick={e => {
                        e.stopPropagation();
                        if (!dragStateRef.current) {
                          setSelectedBlockId(prev => prev === block.id ? null : block.id);
                        }
                      }}
                    >
                      <div className="flex items-start justify-between gap-1 h-full overflow-hidden">
                        <div className="min-w-0 flex-1">
                          <div className={`text-[11px] font-sans font-semibold leading-tight truncate text-foreground tracking-tight ${block.completed_at ? 'line-through decoration-emerald-400/60' : ''}`}>
                            {task?.title || 'Unknown'}
                          </div>
                          <div className="text-[9px] font-mono text-muted-foreground tabular-nums leading-snug">
                            {format(new Date(block.start_time), 'HH:mm')}–{format(new Date(block.end_time), 'HH:mm')}
                            {block.completed_at && block.actual_minutes !== undefined && (
                              <span className="ml-1 text-emerald-400/80">· {Math.round(block.actual_minutes)}m</span>
                            )}
                          </div>
                          {!isSynced && task?.description && !block.completed_at && (
                            <div className="text-[10px] font-sans text-muted-foreground/65 truncate leading-tight mt-0.5">
                              {task.description}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0">
                          {block.completed_at && (
                            <Check
                              className={
                                block.completion_confidence === 'confirmed'
                                  ? 'w-3 h-3 text-emerald-400'
                                  : block.completion_confidence === 'inferred-active'
                                  ? 'w-3 h-3 text-emerald-400/75'
                                  : 'w-3 h-3 text-emerald-400/45' // assumed
                              }
                              strokeWidth={
                                block.completion_confidence === 'confirmed' ? 2.5 : 2
                              }
                            />
                          )}
                          {isSynced ? (
                            <GoogleIcon size={9} className="opacity-70" />
                          ) : (
                            block.locked && !block.completed_at && <Lock className="w-3 h-3 text-block-locked" />
                          )}
                        </div>
                      </div>

                      {/* Action popover */}
                      {isSelected && (
                        <div
                          data-block-popover
                          className="absolute -top-9 left-0 right-0 z-30 flex items-center justify-center gap-1"
                          onMouseDown={e => e.stopPropagation()}
                        >
                          <div className="flex items-center gap-0.5 bg-card border border-border rounded-md shadow-lg px-1 py-0.5">
                            {/* Done / Reopen — primary state action for native, non-locked-anchor blocks */}
                            {!isSynced && task?.scheduling_mode !== 'anchor' && (
                              <>
                                {!block.completed_at ? (
                                  <button
                                    className="p-1 rounded-sm transition-colors text-[10px] font-mono flex items-center gap-1 text-emerald-400 hover:bg-emerald-500/10"
                                    onClick={e => {
                                      e.stopPropagation();
                                      if (onMarkDone) onMarkDone(block.id);
                                      setSelectedBlockId(null);
                                    }}
                                  >
                                    <Check className="w-3 h-3" /><span>Done</span>
                                  </button>
                                ) : (
                                  <button
                                    className="p-1 rounded-sm transition-colors text-[10px] font-mono flex items-center gap-1 text-muted-foreground hover:bg-secondary"
                                    onClick={e => {
                                      e.stopPropagation();
                                      // Reopen — clear completion + clear lock so the engine can re-place if needed
                                      if (onMarkDone) onMarkDone(block.id, -1); // sentinel: see Index handler
                                      setSelectedBlockId(null);
                                    }}
                                    title="Reopen (clear completion)"
                                  >
                                    <RotateCcw className="w-3 h-3" /><span>Reopen</span>
                                  </button>
                                )}
                                <div className="w-px h-4 bg-border" />
                              </>
                            )}

                            {/* Skip — pulled forward by the next rebuild */}
                            {!isSynced && !block.completed_at && task?.scheduling_mode === 'flexible' && (
                              <>
                                <button
                                  className="p-1 rounded-sm transition-colors text-[10px] font-mono flex items-center gap-1 text-amber-400 hover:bg-amber-500/10"
                                  onClick={e => {
                                    e.stopPropagation();
                                    if (onMarkSkipped) onMarkSkipped(block.id);
                                    setSelectedBlockId(null);
                                  }}
                                  title="Something came up — push this forward"
                                >
                                  <SkipForward className="w-3 h-3" /><span>Skip</span>
                                </button>
                                <div className="w-px h-4 bg-border" />
                              </>
                            )}

                            {onEditTask && task && (
                              <>
                                <button
                                  className="p-1 rounded-sm transition-colors text-[10px] font-mono flex items-center gap-1 text-muted-foreground hover:bg-secondary"
                                  onClick={e => { e.stopPropagation(); onEditTask(task); setSelectedBlockId(null); }}
                                >
                                  <Pencil className="w-3 h-3" /><span>Edit</span>
                                </button>
                                <div className="w-px h-4 bg-border" />
                              </>
                            )}
                            <button
                              className="p-1 rounded-sm transition-colors text-[10px] font-mono flex items-center gap-1 text-muted-foreground hover:bg-secondary"
                              onClick={e => {
                                e.stopPropagation();
                                block.locked ? onUnlockBlock(block.id) : onLockBlock(block.id);
                                setSelectedBlockId(null);
                              }}
                            >
                              {block.locked
                                ? <><Unlock className="w-3 h-3" /><span>{t('calendar.unlock')}</span></>
                                : <><Lock className="w-3 h-3" /><span>{t('calendar.lock')}</span></>}
                            </button>
                            <div className="w-px h-4 bg-border" />
                            <button
                              className="p-1 rounded-sm text-destructive/70 hover:text-destructive hover:bg-destructive/10 transition-colors text-[10px] font-mono flex items-center gap-1"
                              onClick={e => { e.stopPropagation(); onDeleteBlock(block.id); setSelectedBlockId(null); }}
                            >
                              <Trash2 className="w-3 h-3" /><span>{t('calendar.delete')}</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Resize handle */}
                      <div
                        className="absolute bottom-0 inset-x-0 h-2 cursor-s-resize opacity-0 group-hover:opacity-100 bg-foreground/10 rounded-b-sm"
                        onMouseDown={e => handleMouseDown(e, block.id, 'resize')}
                      />
                    </motion.div>
                  );

                  // Wrap with hover tooltip showing the score breakdown / placement reason.
                  // Skip while dragging or selected (popover is the active surface then).
                  if (isDragging || isSelected) return blockEl;

                  return (
                    <Tooltip key={block.id} delayDuration={400}>
                      <TooltipTrigger asChild>{blockEl}</TooltipTrigger>
                      <TooltipContent
                        side="right"
                        align="start"
                        className="bg-popover/95 backdrop-blur border-border shadow-xl px-3 py-2 max-w-[260px]"
                      >
                        <BlockExplanation block={block} task={task} />
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
//  BlockExplanation — "why is this block here?" tooltip body
// ─────────────────────────────────────────────────────────────────────────

function BlockExplanation({ block, task }: { block: ScheduledBlock; task: Task | undefined }) {
  if (!task) {
    return <p className="text-[11px] font-mono text-muted-foreground">Block has no task reference.</p>;
  }

  const isSynced = !!task.sync_source;
  const startHour = new Date(block.start_time).getHours();

  if (isSynced) {
    return (
      <div className="space-y-1">
        <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/65">
          External event
        </p>
        <p className="text-xs font-medium text-foreground leading-snug">{task.title}</p>
        <p className="text-[10px] font-mono text-muted-foreground/75">
          From Google Calendar — read-only. AXIS plans around it but never modifies it.
        </p>
      </div>
    );
  }

  if (task.scheduling_mode === 'fixed') {
    return (
      <div className="space-y-1">
        <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/65">
          Fixed
        </p>
        <p className="text-xs font-medium text-foreground leading-snug">{task.title}</p>
        <p className="text-[10px] font-mono text-muted-foreground/75">
          Locked to this exact time. Won't move on rebuild.
        </p>
      </div>
    );
  }

  if (task.scheduling_mode === 'anchor') {
    return (
      <div className="space-y-1">
        <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/65">
          Anchor
        </p>
        <p className="text-xs font-medium text-foreground leading-snug">{task.title}</p>
        <p className="text-[10px] font-mono text-muted-foreground/75">
          Anchored to {task.window_start}–{task.window_end}.{' '}
          {task.is_recurring ? 'Recurs every weekday.' : 'One-shot anchor.'}
        </p>
      </div>
    );
  }

  if (block.locked) {
    return (
      <div className="space-y-1">
        <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/65">
          Locked by you
        </p>
        <p className="text-xs font-medium text-foreground leading-snug">{task.title}</p>
        <p className="text-[10px] font-mono text-muted-foreground/75">
          Manual lock — engine won't move this on rebuild. Click the block and Unlock to release.
        </p>
      </div>
    );
  }

  // Flexible / engine-placed → show the deterministic score breakdown
  const breakdown = scoreBreakdown(task, startHour);

  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/65">
        Why this block is here
      </p>
      <p className="text-xs font-medium text-foreground leading-snug">{task.title}</p>

      <div className="space-y-1 pt-1 border-t border-border/60">
        <ScoreRow
          label="urgency × 3"
          value={breakdown.urgency.value * breakdown.urgency.weight}
          reason={breakdown.urgency.reason}
        />
        <ScoreRow
          label="importance × 2"
          value={breakdown.importance.value * breakdown.importance.weight}
          reason={breakdown.importance.reason}
        />
        {breakdown.energy && (
          <ScoreRow
            label="energy-match × 1.5"
            value={breakdown.energy.value * breakdown.energy.weight}
            reason={breakdown.energy.reason}
          />
        )}
        <div className="flex items-center justify-between pt-1 border-t border-border/40">
          <span className="text-[10px] font-mono uppercase tracking-wider text-primary">
            score
          </span>
          <span className="text-[11px] font-mono tabular-nums font-semibold text-primary">
            {breakdown.total.toFixed(2)}
          </span>
        </div>
      </div>

      <p className="text-[9px] font-mono text-muted-foreground/55 pt-1 leading-relaxed">
        Higher score = picked first when slots are scarce. Deterministic. No ML.
      </p>
    </div>
  );
}

function ScoreRow({ label, value, reason }: { label: string; value: number; reason: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-mono text-foreground/85">{label}</p>
        <p className="text-[9px] font-mono text-muted-foreground/65 leading-tight">{reason}</p>
      </div>
      <span className="text-[10px] font-mono tabular-nums text-foreground/70 shrink-0">
        {value.toFixed(2)}
      </span>
    </div>
  );
}
