import React, { useMemo, useCallback, useState, useRef, useEffect } from 'react';
import { ScheduledBlock, Task, UserSettings } from '@/types/task';
import { format, addDays, isToday } from 'date-fns';
import { Lock, Unlock, ChevronLeft, ChevronRight, Trash2, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getTaskColor } from '@/lib/taskColors';
import { GoogleIcon } from '@/components/GoogleIcon';
import { useTranslation } from 'react-i18next';

interface DayViewProps {
  blocks: ScheduledBlock[];
  tasks: Task[];
  settings: UserSettings;
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  onMoveBlock: (blockId: string, newStart: string, newEnd: string) => void;
  onResizeBlock: (blockId: string, newEnd: string) => void;
  onLockBlock: (blockId: string) => void;
  onUnlockBlock: (blockId: string) => void;
  onDeleteBlock: (blockId: string) => void;
  onQuickAdd: (date: string, time: string, durationMinutes?: number) => void;
  onEditTask?: (task: Task) => void;
  /** A task got dragged from the sidebar onto this day's grid. Pin the
   *  task to that datetime (scheduling_mode = 'fixed'). */
  onDropTaskAt?: (taskId: string, date: string, time: string) => void;
}

// Full 24-hour grid (Cron / Google Calendar / Apple Calendar / Motion all
// show the entire day). Cutting at 06:00–22:00 hid early-morning workouts
// and late-night work for night owls — and any block the engine placed
// outside that window simply didn't render.
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

export function DayView({
  blocks, tasks, settings, selectedDate, onDateChange,
  onMoveBlock, onResizeBlock, onLockBlock, onUnlockBlock, onDeleteBlock, onQuickAdd, onEditTask,
  onDropTaskAt,
}: DayViewProps) {
  const { t } = useTranslation();
  const dateStr = format(selectedDate, 'yyyy-MM-dd');

  const taskMap = useMemo(() => new Map(tasks.map(t => [t.id, t])), [tasks]);

  const dayBlocks = useMemo(() =>
    blocks.filter(b => format(new Date(b.start_time), 'yyyy-MM-dd') === dateStr),
    [blocks, dateStr]
  );

  const scrollRef = useRef<HTMLDivElement>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);

  // Smart auto-scroll: land on current time minus 1h so the user sees
  // "what's happening now" in context. If it's 3 AM, fall back to
  // working-hours start (no point scrolling to 2 AM by default). Only
  // runs once on mount.
  useEffect(() => {
    if (!scrollRef.current) return;
    const now = new Date();
    const nowH = now.getHours() + now.getMinutes() / 60;
    const workStart = parseInt(settings.working_hours_start.split(':')[0], 10) || 8;
    const targetH = nowH < workStart - 1 ? workStart : Math.max(0, nowH - 1);
    scrollRef.current.scrollTop = targetH * HOUR_HEIGHT;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Drag state
  const [dragState, setDragState] = useState<{
    type: 'move' | 'resize'; blockId: string; startY: number;
    originalStartMin: number; originalEndMin: number; currentDeltaMin: number;
  } | null>(null);
  const dragRef = useRef<typeof dragState>(null);

  const clamp = (v: number, mn: number, mx: number) => Math.min(Math.max(v, mn), mx);

  const getBlockMinutes = (b: ScheduledBlock) => {
    const s = new Date(b.start_time), e = new Date(b.end_time);
    return { startMin: s.getHours() * 60 + s.getMinutes(), endMin: e.getHours() * 60 + e.getMinutes() };
  };

  const getBlockStyle = (block: ScheduledBlock) => {
    let { startMin, endMin } = getBlockMinutes(block);
    if (dragState && dragState.blockId === block.id) {
      const delta = snapToGrid(dragState.currentDeltaMin);
      if (dragState.type === 'move') {
        const dur = dragState.originalEndMin - dragState.originalStartMin;
        startMin = clamp(dragState.originalStartMin + delta, START_HOUR * 60, END_HOUR * 60 - dur);
        endMin = startMin + dur;
      } else {
        endMin = clamp(dragState.originalEndMin + delta, dragState.originalStartMin + 15, END_HOUR * 60);
      }
    }
    const top = ((startMin - START_HOUR * 60) / 60) * HOUR_HEIGHT;
    const height = ((endMin - startMin) / 60) * HOUR_HEIGHT;
    return { top: `${top}px`, height: `${Math.max(height, 12)}px` };
  };

  const getBlockInlineStyle = (block: ScheduledBlock, task: Task | undefined): React.CSSProperties => {
    const c = getTaskColor(task?.color);
    return { borderLeftColor: c.border, backgroundColor: c.bg };
  };

  const overlapLayouts = useMemo(() => {
    if (dayBlocks.length === 0) return new Map<string, { col: number; total: number }>();
    const sorted = [...dayBlocks].sort((a, b) => {
      const aS = new Date(a.start_time).getTime();
      const bS = new Date(b.start_time).getTime();
      return aS !== bS ? aS - bS : new Date(b.end_time).getTime() - new Date(a.end_time).getTime();
    });
    const result = new Map<string, { col: number; total: number }>();
    let i = 0;
    while (i < sorted.length) {
      const cluster: ScheduledBlock[] = [sorted[i]];
      let maxEnd = new Date(sorted[i].end_time).getTime();
      let j = i + 1;
      while (j < sorted.length && new Date(sorted[j].start_time).getTime() < maxEnd) {
        cluster.push(sorted[j]);
        maxEnd = Math.max(maxEnd, new Date(sorted[j].end_time).getTime());
        j++;
      }
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
        if (!placed) { assigned.push(colEnds.length); colEnds.push(new Date(block.end_time).getTime()); }
      }
      const total = colEnds.length;
      cluster.forEach((b, k) => result.set(b.id, { col: assigned[k], total }));
      i = j;
    }
    return result;
  }, [dayBlocks]);

  const handleMouseDown = useCallback((e: React.MouseEvent, blockId: string, type: 'move' | 'resize') => {
    e.stopPropagation(); e.preventDefault();
    const block = dayBlocks.find(b => b.id === blockId);
    if (!block) return;
    const { startMin, endMin } = getBlockMinutes(block);
    const s = { type, blockId, startY: e.clientY, originalStartMin: startMin, originalEndMin: endMin, currentDeltaMin: 0 };
    dragRef.current = s;
    setDragState(s);
  }, [dayBlocks]);

  useEffect(() => {
    const move = (e: MouseEvent) => {
      const c = dragRef.current; if (!c) return;
      const delta = ((e.clientY - c.startY) / HOUR_HEIGHT) * 60;
      const u = { ...c, currentDeltaMin: delta }; dragRef.current = u; setDragState(u);
    };
    const up = () => {
      const c = dragRef.current; if (!c) return;
      const delta = snapToGrid(c.currentDeltaMin);
      if (delta !== 0) {
        if (c.type === 'move') {
          const dur = c.originalEndMin - c.originalStartMin;
          const ns = clamp(c.originalStartMin + delta, START_HOUR * 60, END_HOUR * 60 - dur);
          const ne = ns + dur;
          const { hour: sh, minute: sm } = minutesToTime(ns);
          const { hour: eh, minute: em } = minutesToTime(ne);
          onMoveBlock(c.blockId, `${dateStr}T${String(sh).padStart(2,'0')}:${String(sm).padStart(2,'0')}:00`, `${dateStr}T${String(eh).padStart(2,'0')}:${String(em).padStart(2,'0')}:00`);
        } else {
          const ne = clamp(c.originalEndMin + delta, c.originalStartMin + 15, END_HOUR * 60);
          const { hour: eh, minute: em } = minutesToTime(ne);
          onResizeBlock(c.blockId, `${dateStr}T${String(eh).padStart(2,'0')}:${String(em).padStart(2,'0')}:00`);
        }
      }
      dragRef.current = null; setDragState(null);
    };
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
  }, [dateStr, onMoveBlock, onResizeBlock]);

  const handleDoubleClick = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const snapped = snapToGrid(yToMinutes(y));
    const { hour, minute } = minutesToTime(snapped);
    onQuickAdd(dateStr, `${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`);
  };

  // Click-and-drag-on-empty pattern (Google / Cron / Apple Calendar) —
  // size a new block by drag distance instead of opening the form first.
  const columnRef = useRef<HTMLDivElement>(null);
  const [dragCreate, setDragCreate] = useState<{
    startMin: number;
    currentMin: number;
  } | null>(null);
  const dragCreateRef = useRef<typeof dragCreate>(null);
  dragCreateRef.current = dragCreate;

  const onColumnMouseDown = (e: React.MouseEvent) => {
    if (e.target !== e.currentTarget) return;
    if (e.button !== 0) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const y = e.clientY - rect.top;
    const min = snapToGrid(yToMinutes(y));
    setDragCreate({ startMin: min, currentMin: min });
  };

  useEffect(() => {
    const move = (e: MouseEvent) => {
      const dc = dragCreateRef.current;
      if (!dc || !columnRef.current) return;
      const rect = columnRef.current.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const min = snapToGrid(yToMinutes(y));
      setDragCreate(d => (d ? { ...d, currentMin: min } : null));
    };
    const up = () => {
      const dc = dragCreateRef.current;
      if (!dc) return;
      const start = Math.min(dc.startMin, dc.currentMin);
      const end = Math.max(dc.startMin, dc.currentMin);
      const dur = end - start;
      setDragCreate(null);
      if (dur < SNAP_MINUTES) return;
      const { hour, minute } = minutesToTime(start);
      onQuickAdd(
        dateStr,
        `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
        dur
      );
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
  }, [dateStr, onQuickAdd]);

  // Drag-from-sidebar drop target — same protocol as WeekView.
  const [dropY, setDropY] = useState<number | null>(null);
  const onGridDragOver = (e: React.DragEvent) => {
    if (!onDropTaskAt) return;
    if (!e.dataTransfer.types.includes('application/x-axis-task-id')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const snappedMin = snapToGrid(yToMinutes(y));
    const snappedY = ((snappedMin - START_HOUR * 60) / 60) * HOUR_HEIGHT;
    setDropY(snappedY);
  };
  const onGridDragLeave = () => setDropY(null);
  const onGridDrop = (e: React.DragEvent) => {
    if (!onDropTaskAt) return;
    e.preventDefault();
    setDropY(null);
    const taskId = e.dataTransfer.getData('application/x-axis-task-id');
    if (!taskId) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const snapped = snapToGrid(yToMinutes(y));
    const { hour, minute } = minutesToTime(snapped);
    onDropTaskAt(
      taskId,
      dateStr,
      `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
    );
  };

  const now = new Date();
  const nowHour = now.getHours() + now.getMinutes() / 60;
  const nowOffset = (nowHour - START_HOUR) * HOUR_HEIGHT;
  const workStart = parseInt(settings.working_hours_start.split(':')[0]);
  const workEnd = parseInt(settings.working_hours_end.split(':')[0]);
  const deepStart = parseInt(settings.deep_window_start.split(':')[0]);
  const deepEnd = parseInt(settings.deep_window_end.split(':')[0]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="shrink-0 bg-background z-10 border-b border-border">
        <div className="flex items-center justify-between px-4 py-2">
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => onDateChange(addDays(selectedDate, -1))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2">
            <span className="text-sm font-mono font-semibold text-foreground">
              {format(selectedDate, 'EEEE, MMM d, yyyy')}
            </span>
            {!isToday(selectedDate) && (
              <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] font-mono" onClick={() => onDateChange(new Date())}>{t('calendar.today')}</Button>
            )}
          </div>
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => onDateChange(addDays(selectedDate, 1))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto" ref={scrollRef}>
        <div className="flex" style={{ height: `${TOTAL_HOURS * HOUR_HEIGHT}px` }}>
          {/* Time labels */}
          <div className="w-16 shrink-0 relative">
            {Array.from({ length: TOTAL_HOURS }, (_, i) => (
              <div key={i} className="absolute right-3 text-[10px] font-mono text-muted-foreground" style={{ top: `${i * HOUR_HEIGHT - 6}px` }}>
                {`${String(i + START_HOUR).padStart(2,'0')}:00`}
              </div>
            ))}
          </div>

          {/* Column */}
          <div
            ref={columnRef}
            className={
              `flex-1 border-l border-border relative cursor-cell ` +
              (isToday(selectedDate) ? 'bg-primary/[0.02] ' : '') +
              (dropY !== null ? 'bg-primary/[0.05]' : '')
            }
            onMouseDown={onColumnMouseDown}
            onDoubleClick={handleDoubleClick}
            onDragOver={onGridDragOver}
            onDragLeave={onGridDragLeave}
            onDrop={onGridDrop}
          >
            {Array.from({ length: TOTAL_HOURS }, (_, i) => (
              <div key={i} className="absolute w-full border-t border-grid-line" style={{ top: `${i * HOUR_HEIGHT}px` }} />
            ))}
            {Array.from({ length: TOTAL_HOURS }, (_, i) => (
              <div key={`h-${i}`} className="absolute w-full border-t border-grid-line/50 border-dashed" style={{ top: `${i * HOUR_HEIGHT + HOUR_HEIGHT / 2}px` }} />
            ))}

            {/* Deep window */}
            {deepStart >= START_HOUR && deepEnd <= END_HOUR && (
              <div className="absolute inset-x-0 bg-primary/[0.04] border-l-2 border-primary/20" style={{ top: `${(deepStart - START_HOUR) * HOUR_HEIGHT}px`, height: `${(deepEnd - deepStart) * HOUR_HEIGHT}px` }} />
            )}

            {/* Non-working overlays */}
            {workStart > START_HOUR && <div className="absolute inset-x-0 top-0 bg-background/60" style={{ height: `${(workStart - START_HOUR) * HOUR_HEIGHT}px` }} />}
            {workEnd < END_HOUR && <div className="absolute inset-x-0 bg-background/60" style={{ top: `${(workEnd - START_HOUR) * HOUR_HEIGHT}px`, height: `${(END_HOUR - workEnd) * HOUR_HEIGHT}px` }} />}

            {/* Drop indicator (sidebar drop target) */}
            {dropY !== null && (
              <div
                className="absolute inset-x-0 z-30 pointer-events-none"
                style={{ top: `${dropY}px` }}
              >
                <div className="h-0.5 bg-primary/80 rounded-full shadow-[0_0_8px_rgba(255,138,52,0.6)]" />
                <div className="absolute -left-2 -top-1 w-3 h-3 rounded-full bg-primary shadow-md" />
              </div>
            )}

            {/* Drag-create ghost (click-and-drag on empty grid) */}
            {dragCreate && (() => {
              const a = Math.min(dragCreate.startMin, dragCreate.currentMin);
              const b = Math.max(dragCreate.startMin, dragCreate.currentMin);
              const top = ((a - START_HOUR * 60) / 60) * HOUR_HEIGHT;
              const height = ((b - a) / 60) * HOUR_HEIGHT;
              const fmt = (m: number) =>
                `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
              return (
                <div
                  className="absolute left-1 right-1 z-30 rounded-md border-2 border-dashed border-primary bg-primary/15 pointer-events-none flex items-center justify-center"
                  style={{ top: `${top}px`, height: `${Math.max(2, height)}px` }}
                >
                  <span className="text-[11px] font-mono text-primary tabular-nums">
                    {fmt(a)}–{fmt(b)} · {b - a}m
                  </span>
                </div>
              );
            })()}

            {/* Now line */}
            {isToday(selectedDate) && nowHour >= START_HOUR && nowHour <= END_HOUR && (
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

              const isSynced = !!task?.sync_source;
              const extColor = task?.calendar_color ?? '#6b7280';
              const colorStyle: React.CSSProperties = isSynced
                ? { borderLeftColor: extColor, backgroundColor: `${extColor}22` }
                : getBlockInlineStyle(block, task);

              const layout = isDragging
                ? { col: 0, total: 1 }
                : (overlapLayouts.get(block.id) || { col: 0, total: 1 });
              const leftPct = (layout.col / layout.total) * 100;
              const widthPct = (1 / layout.total) * 100;
              const layoutStyle: React.CSSProperties = {
                left: `calc(${leftPct}% + 4px)`,
                width: `calc(${widthPct}% - 8px)`,
              };

              return (
                <div
                  key={block.id}
                  data-block={block.id}
                  className={`absolute rounded-sm border-l-2 px-2 py-1 z-10 group transition-colors select-none ${
                    isDragging ? 'opacity-80 shadow-lg cursor-grabbing' : 'cursor-grab hover:brightness-110'
                  } ${isSelected ? 'ring-1 ring-primary' : ''}`}
                  style={{ ...posStyle, ...layoutStyle, ...colorStyle }}
                  onMouseDown={e => { if ((e.target as HTMLElement).closest('[data-block-popover]')) return; handleMouseDown(e, block.id, 'move'); }}
                  onClick={e => { e.stopPropagation(); if (!dragRef.current) setSelectedBlockId(p => p === block.id ? null : block.id); }}
                >
                  <div className="flex items-start justify-between gap-1 h-full overflow-hidden">
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-mono font-medium leading-tight truncate text-foreground">
                        {task?.title || 'Unknown'}
                      </div>
                      <div className="text-[10px] font-mono text-muted-foreground">{format(new Date(block.start_time), 'HH:mm')}–{format(new Date(block.end_time), 'HH:mm')}</div>
                      {!isSynced && task?.description && (
                        <div className="text-[10px] font-sans text-muted-foreground/70 truncate leading-tight mt-0.5">{task.description}</div>
                      )}
                    </div>
                    <div className="shrink-0">
                      {isSynced ? (
                        <GoogleIcon size={9} className="opacity-70" />
                      ) : (
                        block.locked && <Lock className="w-3 h-3 text-block-locked" />
                      )}
                    </div>
                  </div>

                  {isSelected && (
                    <div data-block-popover className="absolute -top-9 left-0 right-0 z-30 flex items-center justify-center gap-1" onMouseDown={e => e.stopPropagation()}>
                      <div className="flex items-center gap-0.5 bg-card border border-border rounded-md shadow-lg px-1 py-0.5">
                        {onEditTask && task && (
                          <>
                            <button className="p-1 rounded-sm transition-colors text-[10px] font-mono flex items-center gap-1 text-muted-foreground hover:bg-secondary" onClick={e => { e.stopPropagation(); onEditTask(task); setSelectedBlockId(null); }}>
                              <Pencil className="w-3 h-3" /><span>Edit</span>
                            </button>
                            <div className="w-px h-4 bg-border" />
                          </>
                        )}
                        <button className="p-1 rounded-sm transition-colors text-[10px] font-mono flex items-center gap-1 text-muted-foreground hover:bg-secondary" onClick={e => { e.stopPropagation(); block.locked ? onUnlockBlock(block.id) : onLockBlock(block.id); setSelectedBlockId(null); }}>
                          {block.locked ? <><Unlock className="w-3 h-3" /><span>{t('calendar.unlock')}</span></> : <><Lock className="w-3 h-3" /><span>{t('calendar.lock')}</span></>}
                        </button>
                        <div className="w-px h-4 bg-border" />
                        <button className="p-1 rounded-sm text-destructive/70 hover:text-destructive hover:bg-destructive/10 transition-colors text-[10px] font-mono flex items-center gap-1" onClick={e => { e.stopPropagation(); onDeleteBlock(block.id); setSelectedBlockId(null); }}>
                          <Trash2 className="w-3 h-3" /><span>{t('calendar.delete')}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="absolute bottom-0 inset-x-0 h-2 cursor-s-resize opacity-0 group-hover:opacity-100 bg-foreground/10 rounded-b-sm" onMouseDown={e => handleMouseDown(e, block.id, 'resize')} />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
