import React, { useMemo, useCallback, useState, useRef, useEffect } from 'react';
import { ScheduledBlock, Task, UserSettings } from '@/types/task';
import { format, startOfWeek, addDays, addWeeks, isToday } from 'date-fns';
import { Lock, Unlock, ChevronLeft, ChevronRight, Trash2, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getTaskColor } from '@/lib/taskColors';
import { GoogleIcon } from '@/components/GoogleIcon';
import { useTranslation } from 'react-i18next';

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
}

const HOUR_HEIGHT = 60;
const START_HOUR = 6;
const END_HOUR = 22;
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

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = (7 - START_HOUR) * HOUR_HEIGHT;
    }
  }, []);

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
                {/* Hour lines */}
                {Array.from({ length: TOTAL_HOURS }, (_, i) => (
                  <div key={i} className="absolute w-full border-t border-grid-line" style={{ top: `${i * HOUR_HEIGHT}px` }} />
                ))}
                {/* Half-hour lines */}
                {Array.from({ length: TOTAL_HOURS }, (_, i) => (
                  <div key={`half-${i}`} className="absolute w-full border-t border-grid-line/50 border-dashed" style={{ top: `${i * HOUR_HEIGHT + HOUR_HEIGHT / 2}px` }} />
                ))}

                {/* Deep window overlay */}
                {deepStart >= START_HOUR && deepEnd <= END_HOUR && (
                  <div
                    className="absolute inset-x-0 bg-primary/[0.04] border-l-2 border-primary/20"
                    style={{ top: `${deepTop}px`, height: `${deepHeight}px` }}
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

                  return (
                    <div
                      key={block.id}
                      data-block={block.id}
                      className={`absolute rounded-sm border-l-2 px-1.5 py-0.5 z-10 group transition-colors select-none ${
                        isDragging ? 'opacity-80 shadow-lg cursor-grabbing z-30' : 'cursor-grab hover:brightness-110'
                      } ${isSelected ? 'ring-1 ring-primary' : ''}`}
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
                          <div className="text-[10px] font-mono font-medium leading-tight truncate text-foreground">
                            {task?.title || 'Unknown'}
                          </div>
                          <div className="text-[9px] font-mono text-muted-foreground">
                            {format(new Date(block.start_time), 'HH:mm')}–{format(new Date(block.end_time), 'HH:mm')}
                          </div>
                          {!isSynced && task?.description && (
                            <div className="text-[9px] font-sans text-muted-foreground/70 truncate leading-tight mt-0.5">
                              {task.description}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0">
                          {isSynced ? (
                            <GoogleIcon size={9} className="opacity-70" />
                          ) : (
                            block.locked && <Lock className="w-3 h-3 text-block-locked" />
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
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
