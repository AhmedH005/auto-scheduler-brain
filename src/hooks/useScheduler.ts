import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  Task,
  ScheduledBlock,
  UserSettings,
  DEFAULT_SETTINGS,
  RebuildResult,
  ScheduleDiff,
  RescheduleSnapshot,
  DurationLog,
  DurationSuggestion,
  DailyOverride,
  DailyOverrides,
  CompletionEvent,
  CompletionConfidence,
} from '@/types/task';
import { rebuildSchedule } from '@/engine/scheduler';
import { diffSchedules, explainDiff } from '@/engine/diff';
import { recordCompletion, suggestDuration } from '@/engine/adaptive-duration';
import {
  buildCompletionEvent,
  appendCompletion,
  buildAllInsights,
} from '@/engine/learning';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabase';

const TASKS_KEY = 'axis_tasks';
const BLOCKS_KEY = 'axis_blocks';
const SETTINGS_KEY = 'axis_settings';
const UNDO_STACK_KEY = 'axis_undo_stack';
const DURATION_LOG_KEY = 'axis_duration_log';
const DAILY_OVERRIDES_KEY = 'axis_daily_overrides';
const COMPLETION_LOG_KEY = 'axis_completion_log';

const UNDO_STACK_MAX = 10;

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : fallback;
  } catch {
    return fallback;
  }
}

function saveToStorage<T>(key: string, data: T): void {
  localStorage.setItem(key, JSON.stringify(data));
}

function normalizeBlocks(blocks: ScheduledBlock[]): ScheduledBlock[] {
  const byId = new Map<string, ScheduledBlock>();

  for (const block of blocks) {
    if (!block?.id || !block.task_id || !block.start_time || !block.end_time) continue;

    const start = new Date(block.start_time);
    const end = new Date(block.end_time);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue;
    if (end <= start) continue;

    byId.set(block.id, {
      ...block,
      instance_date: block.instance_date || format(start, 'yyyy-MM-dd'),
    });
  }

  return Array.from(byId.values()).sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  );
}

async function getUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
  } catch {
    // Network or auth client failure — treat as anonymous, fall back to localStorage
    return null;
  }
}

/** Tasks whose IDs start with 'synced-' are imported from external calendars.
 *  They must NOT be saved to the tasks table — they live in external_calendar_events. */
const isSyncedId = (id: string) => id.startsWith('synced-');

async function syncTasksToSupabase(tasks: Task[], userId: string) {
  if (!userId) return;
  const rows = tasks.filter(t => !isSyncedId(t.id)).map((t) => ({
    id: t.id,
    user_id: userId,
    title: t.title,
    description: t.description ?? null,
    color: t.color ?? null,
    task_type: t.scheduling_mode,
    total_duration: t.total_duration,
    priority: t.priority,
    deadline: t.deadline,
    energy_intensity: t.energy_intensity,
    scheduling_mode: t.scheduling_mode,
    window_start: t.window_start,
    window_end: t.window_end,
    start_datetime: t.start_datetime,
    end_datetime: t.end_datetime,
    execution_style: t.execution_style,
    is_recurring: t.is_recurring,
    recurrence_pattern: t.recurrence_pattern,
    recurrence_interval: t.recurrence_interval,
    recurrence_end: t.recurrence_end,
    status: t.status,
    created_at: t.created_at,
  }));
  const { error } = await supabase.from('tasks').upsert(rows, { onConflict: 'id' });
  if (error) console.error('[scheduler] syncTasksToSupabase error:', error);
}

async function syncBlocksToSupabase(blocks: ScheduledBlock[], userId: string) {
  if (!userId) return;
  const rows = blocks.map((b) => ({
    id: b.id,
    user_id: userId,
    task_id: b.task_id,
    start_at: b.start_time,
    end_at: b.end_time,
    is_locked: b.locked,
    block_type: b.block_type,
    instance_date: b.instance_date,
    source_type: b.locked ? 'manual' : 'engine',
  }));
  const { error } = await supabase.from('scheduled_blocks').upsert(rows, { onConflict: 'id' });
  if (error) console.error('[scheduler] syncBlocksToSupabase error:', error);
}

async function syncSettingsToSupabase(settings: UserSettings, userId: string) {
  if (!userId) return;
  await supabase.from('user_settings').upsert(
    {
      user_id: userId,
      working_hours_start: settings.working_hours_start,
      working_hours_end: settings.working_hours_end,
      deep_window_start: settings.deep_window_start,
      deep_window_end: settings.deep_window_end,
      buffer_time: settings.buffer_time,
      max_deep_hours_per_day: settings.max_deep_hours_per_day,
      max_total_hours_per_day: settings.max_total_hours_per_day,
      min_chunk_size: settings.min_chunk_size,
      max_chunk_size: settings.max_chunk_size,
    },
    { onConflict: 'user_id' }
  );
}

function mapDbTaskToTask(row: Record<string, unknown>): Task {
  return {
    id: row.id as string,
    title: row.title as string,
    description: (row.description as string | undefined) ?? undefined,
    color: (row.color as string | undefined) ?? undefined,
    total_duration: (row.total_duration as number) ?? 60,
    priority: (row.priority as number) ?? 3,
    deadline: (row.deadline as string | null) ?? null,
    energy_intensity: (row.energy_intensity as Task['energy_intensity']) ?? 'moderate',
    scheduling_mode: (row.scheduling_mode as Task['scheduling_mode']) ?? 'flexible',
    window_start: (row.window_start as string | null) ?? null,
    window_end: (row.window_end as string | null) ?? null,
    start_datetime: (row.start_datetime as string | null) ?? null,
    end_datetime: (row.end_datetime as string | null) ?? null,
    execution_style: (row.execution_style as Task['execution_style']) ?? 'single',
    is_recurring: (row.is_recurring as boolean) ?? false,
    recurrence_pattern: (row.recurrence_pattern as Task['recurrence_pattern']) ?? null,
    recurrence_interval: (row.recurrence_interval as number) ?? 1,
    recurrence_end: (row.recurrence_end as string | null) ?? null,
    status: (row.status as Task['status']) ?? 'active',
    created_at: (row.created_at as string) ?? new Date().toISOString(),
  };
}

function mapDbBlockToBlock(row: Record<string, unknown>): ScheduledBlock {
  const start = row.start_at as string;
  return {
    id: row.id as string,
    task_id: row.task_id as string,
    start_time: start,
    end_time: row.end_at as string,
    locked: (row.is_locked as boolean) ?? false,
    block_type: (row.block_type as ScheduledBlock['block_type']) ?? 'focus',
    instance_date: (row.instance_date as string) ?? format(new Date(start), 'yyyy-MM-dd'),
  };
}

function mapDbSettingsToSettings(row: Record<string, unknown>): UserSettings {
  return {
    working_hours_start: (row.working_hours_start as string) ?? DEFAULT_SETTINGS.working_hours_start,
    working_hours_end: (row.working_hours_end as string) ?? DEFAULT_SETTINGS.working_hours_end,
    deep_window_start: (row.deep_window_start as string) ?? DEFAULT_SETTINGS.deep_window_start,
    deep_window_end: (row.deep_window_end as string) ?? DEFAULT_SETTINGS.deep_window_end,
    buffer_time: (row.buffer_time as number) ?? DEFAULT_SETTINGS.buffer_time,
    max_deep_hours_per_day: (row.max_deep_hours_per_day as number) ?? DEFAULT_SETTINGS.max_deep_hours_per_day,
    max_total_hours_per_day: (row.max_total_hours_per_day as number) ?? DEFAULT_SETTINGS.max_total_hours_per_day,
    min_chunk_size: (row.min_chunk_size as number) ?? DEFAULT_SETTINGS.min_chunk_size,
    max_chunk_size: (row.max_chunk_size as number) ?? DEFAULT_SETTINGS.max_chunk_size,
  };
}

export function useScheduler() {
  const [tasks, setTasks] = useState<Task[]>(() => {
    // Strip any old individual synced tasks from localStorage on startup.
    const stored: Task[] = loadFromStorage(TASKS_KEY, []);
    const cleaned = stored.filter(t => !isSyncedId(t.id) || t.id.startsWith('synced-rec-'));
    if (cleaned.length !== stored.length) {
      saveToStorage(TASKS_KEY, cleaned);
    }
    return cleaned;
  });
  const [blocks, setBlocks] = useState<ScheduledBlock[]>(() => {
    const stored: ScheduledBlock[] = loadFromStorage(BLOCKS_KEY, []);
    const cleaned = stored.filter(b => !isSyncedId(b.task_id) || b.task_id.startsWith('synced-rec-'));
    if (cleaned.length !== stored.length) saveToStorage(BLOCKS_KEY, cleaned);
    return normalizeBlocks(cleaned);
  });
  const [settings, setSettings] = useState<UserSettings>(() => loadFromStorage(SETTINGS_KEY, DEFAULT_SETTINGS));
  const [undoStack, setUndoStack] = useState<RescheduleSnapshot[]>(() =>
    loadFromStorage<RescheduleSnapshot[]>(UNDO_STACK_KEY, [])
  );
  const [durationLog, setDurationLog] = useState<DurationLog[]>(() =>
    loadFromStorage<DurationLog[]>(DURATION_LOG_KEY, [])
  );
  const [dailyOverrides, setDailyOverrides] = useState<DailyOverrides>(() =>
    loadFromStorage<DailyOverrides>(DAILY_OVERRIDES_KEY, {})
  );
  // CompletionEvent log — every done/partial/skipped feeds the learning layer.
  const [completionLog, setCompletionLog] = useState<CompletionEvent[]>(() =>
    loadFromStorage<CompletionEvent[]>(COMPLETION_LOG_KEY, [])
  );

  // Pending state — set by previewRebuild, cleared by applyPending / cancelPending
  const [pendingResult, setPendingResult] = useState<RebuildResult | null>(null);
  const [pendingDiff, setPendingDiff] = useState<ScheduleDiff | null>(null);

  // Last-applied result — for surfacing summary in toasts/banners after silent rebuilds
  const [lastResult, setLastResult] = useState<RebuildResult | null>(null);

  // Track user id for Supabase syncing
  const userIdRef = useRef<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // On mount: resolve user and load from Supabase if authenticated
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const uid = await getUserId();
      userIdRef.current = uid;

      if (!uid) {
        // Not logged in — localStorage-only mode (graceful fallback)
        setHydrated(true);
        return;
      }

      try {
        const { data: taskRows } = await supabase
          .from('tasks')
          .select('*')
          .eq('user_id', uid)
          .order('created_at', { ascending: true });

        const { data: blockRows } = await supabase
          .from('scheduled_blocks')
          .select('*')
          .eq('user_id', uid)
          .order('start_at', { ascending: true });

        const { data: settingsRow } = await supabase
          .from('user_settings')
          .select('*')
          .eq('user_id', uid)
          .maybeSingle();

        if (cancelled) return;

        if (taskRows && taskRows.length > 0) {
          const syncedInDb = taskRows.filter(r => isSyncedId(r.id as string));
          if (syncedInDb.length > 0) {
            supabase.from('tasks').delete().in('id', syncedInDb.map(r => r.id)).eq('user_id', uid);
            supabase.from('scheduled_blocks').delete().in('task_id', syncedInDb.map(r => r.id)).eq('user_id', uid);
          }
          const mapped = taskRows.map(mapDbTaskToTask).filter(t => !isSyncedId(t.id));
          setTasks(mapped);
          saveToStorage(TASKS_KEY, mapped);
        }

        if (blockRows && blockRows.length > 0) {
          const mapped = normalizeBlocks(blockRows.map(mapDbBlockToBlock));
          setBlocks(mapped);
          saveToStorage(BLOCKS_KEY, mapped);
        }

        if (settingsRow) {
          const mapped = mapDbSettingsToSettings(settingsRow as Record<string, unknown>);
          setSettings(mapped);
          saveToStorage(SETTINGS_KEY, mapped);
        }
      } catch (err) {
        console.warn('[scheduler] Supabase hydration failed, using localStorage only', err);
      }

      setHydrated(true);
    })();
    return () => { cancelled = true; };
  }, []);

  // Persist to localStorage (always)
  useEffect(() => { if (hydrated) saveToStorage(TASKS_KEY, tasks); }, [tasks, hydrated]);
  useEffect(() => { if (hydrated) saveToStorage(BLOCKS_KEY, blocks); }, [blocks, hydrated]);
  useEffect(() => { if (hydrated) saveToStorage(SETTINGS_KEY, settings); }, [settings, hydrated]);
  useEffect(() => { if (hydrated) saveToStorage(UNDO_STACK_KEY, undoStack); }, [undoStack, hydrated]);
  useEffect(() => { if (hydrated) saveToStorage(DURATION_LOG_KEY, durationLog); }, [durationLog, hydrated]);
  useEffect(() => { if (hydrated) saveToStorage(DAILY_OVERRIDES_KEY, dailyOverrides); }, [dailyOverrides, hydrated]);
  useEffect(() => { if (hydrated) saveToStorage(COMPLETION_LOG_KEY, completionLog); }, [completionLog, hydrated]);

  // Persist to Supabase (when user is logged in and data is hydrated)
  // Sequential: tasks must be written before blocks to avoid FK violations.
  useEffect(() => {
    if (!hydrated || !userIdRef.current) return;
    const uid = userIdRef.current;
    (async () => {
      await syncTasksToSupabase(tasks, uid);
      await syncBlocksToSupabase(blocks.filter(b => !isSyncedId(b.task_id)), uid);
    })();
  }, [tasks, blocks, hydrated]);

  const settingsSyncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!hydrated || !userIdRef.current) return;
    if (settingsSyncTimer.current) clearTimeout(settingsSyncTimer.current);
    const uid = userIdRef.current;
    settingsSyncTimer.current = setTimeout(() => {
      syncSettingsToSupabase(settings, uid);
    }, 800);
    return () => { if (settingsSyncTimer.current) clearTimeout(settingsSyncTimer.current); };
  }, [settings, hydrated]);

  const updateBlocksSafely = useCallback((updater: (prev: ScheduledBlock[]) => ScheduledBlock[]) => {
    setBlocks(prev => {
      const snapshot = prev;
      try {
        return normalizeBlocks(updater(prev));
      } catch (error) {
        console.error('Block update failed, rolling back', error);
        return snapshot;
      }
    });
  }, []);

  const pushUndoSnapshot = useCallback((label: string) => {
    setUndoStack(prev => {
      const snapshot: RescheduleSnapshot = {
        blocks: blocks.map(b => ({ ...b })),
        taken_at: new Date().toISOString(),
        label,
      };
      const next = [snapshot, ...prev].slice(0, UNDO_STACK_MAX);
      return next;
    });
  }, [blocks]);

  const addTask = useCallback((task: Task) => {
    setTasks(prev => [...prev, task]);
  }, []);

  const updateTask = useCallback((id: string, updates: Partial<Task>) => {
    setTasks(prev => prev.map(t => (t.id === id ? { ...t, ...updates } : t)));
  }, []);

  const deleteTask = useCallback(async (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    updateBlocksSafely(prev => prev.filter(b => b.task_id !== id));
    if (userIdRef.current) {
      await supabase.from('scheduled_blocks').delete().eq('task_id', id).eq('user_id', userIdRef.current);
      await supabase.from('tasks').delete().eq('id', id).eq('user_id', userIdRef.current);
    }
  }, [updateBlocksSafely]);

  const lockBlock = useCallback((blockId: string) => {
    updateBlocksSafely(prev => prev.map(b => (b.id === blockId ? { ...b, locked: true } : b)));
  }, [updateBlocksSafely]);

  const unlockBlock = useCallback((blockId: string) => {
    updateBlocksSafely(prev => prev.map(b => (b.id === blockId ? { ...b, locked: false } : b)));
  }, [updateBlocksSafely]);

  const deleteBlock = useCallback(async (blockId: string) => {
    updateBlocksSafely(prev => prev.filter(b => b.id !== blockId));
    if (userIdRef.current) {
      await supabase.from('scheduled_blocks').delete().eq('id', blockId).eq('user_id', userIdRef.current);
    }
  }, [updateBlocksSafely]);

  const moveBlock = useCallback((blockId: string, newStart: string, newEnd: string) => {
    pushUndoSnapshot('Move block');
    updateBlocksSafely(prev =>
      prev.map(b => {
        if (b.id !== blockId) return b;
        return {
          ...b,
          start_time: newStart,
          end_time: newEnd,
          locked: true,
          instance_date: format(new Date(newStart), 'yyyy-MM-dd'),
        };
      })
    );
  }, [updateBlocksSafely, pushUndoSnapshot]);

  const resizeBlock = useCallback((blockId: string, newEnd: string) => {
    pushUndoSnapshot('Resize block');
    updateBlocksSafely(prev =>
      prev.map(b => {
        if (b.id !== blockId) return b;
        return { ...b, end_time: newEnd, locked: true };
      })
    );
  }, [updateBlocksSafely, pushUndoSnapshot]);

  const importSyncedTasks = useCallback((incoming: Task[]) => {
    setTasks(prev => {
      const incomingIds = new Set(incoming.map(t => t.id));
      const native = prev.filter(t => !isSyncedId(t.id) || incomingIds.has(t.id));
      const existingIds = new Set(native.map(t => t.id));
      const toAdd = incoming.filter(t => !existingIds.has(t.id));
      if (toAdd.length === 0 && native.length === prev.length) return prev;
      return [...native, ...toAdd];
    });
  }, []);

  // ─────────────────────────────────────────────────────────────────────
  //  Rebuild flow — split into preview + apply
  // ─────────────────────────────────────────────────────────────────────

  /** Compute the rebuild result without committing. Sets pending state. */
  const previewRebuild = useCallback(() => {
    const activeTasks = tasks.filter(t => t.status === 'active');
    const allTaskIds = new Set(activeTasks.map(t => t.id));
    // Preserve locks AND completions — see rebuildSchedule.
    const rawPreserved = blocks.filter(
      b => (b.locked || !!b.completed_at) && allTaskIds.has(b.task_id)
    );

    // Deduplicate overlapping preserved blocks (defensive — guards against bad data).
    const deduped: typeof rawPreserved = [];
    for (const block of rawPreserved) {
      const start = new Date(block.start_time).getTime();
      const end = new Date(block.end_time).getTime();
      const conflicts = deduped.some(b => {
        const bStart = new Date(b.start_time).getTime();
        const bEnd = new Date(b.end_time).getTime();
        return bStart < end && bEnd > start;
      });
      if (!conflicts) deduped.push(block);
    }

    const result = rebuildSchedule(activeTasks, deduped, settings, dailyOverrides);
    const proposed = normalizeBlocks(result.blocks);
    const diff = explainDiff(diffSchedules(blocks, proposed, activeTasks), result, activeTasks);

    setPendingResult({ ...result, blocks: proposed });
    setPendingDiff(diff);
    return { result: { ...result, blocks: proposed }, diff };
  }, [tasks, blocks, settings, dailyOverrides]);

  /** Commit the pending rebuild. Pushes the previous schedule to undo stack. */
  const applyPending = useCallback(() => {
    if (!pendingResult) return;
    pushUndoSnapshot(`Before rebuild at ${format(new Date(), 'HH:mm')}`);
    setBlocks(normalizeBlocks(pendingResult.blocks));
    setLastResult(pendingResult);
    setPendingResult(null);
    setPendingDiff(null);
  }, [pendingResult, pushUndoSnapshot]);

  /** Discard the pending rebuild without applying. */
  const cancelPending = useCallback(() => {
    setPendingResult(null);
    setPendingDiff(null);
  }, []);

  /** Silent rebuild — used by inline task add/update/delete. No preview, but
   *  still pushes a snapshot for undo so user can revert if surprised. */
  const rebuild = useCallback((opts: { silent?: boolean } = {}) => {
    const activeTasks = tasks.filter(t => t.status === 'active');
    const allTaskIds = new Set(activeTasks.map(t => t.id));
    // Preserve locks AND completions.
    const rawPreserved = blocks.filter(
      b => (b.locked || !!b.completed_at) && allTaskIds.has(b.task_id)
    );

    const deduped: typeof rawPreserved = [];
    for (const block of rawPreserved) {
      const start = new Date(block.start_time).getTime();
      const end = new Date(block.end_time).getTime();
      const conflicts = deduped.some(b => {
        const bStart = new Date(b.start_time).getTime();
        const bEnd = new Date(b.end_time).getTime();
        return bStart < end && bEnd > start;
      });
      if (!conflicts) deduped.push(block);
    }

    pushUndoSnapshot(opts.silent ? 'Auto-rebuild' : `Rebuild at ${format(new Date(), 'HH:mm')}`);
    const result = rebuildSchedule(activeTasks, deduped, settings, dailyOverrides);
    setBlocks(normalizeBlocks(result.blocks));
    setLastResult(result);
    return result;
  }, [tasks, blocks, settings, dailyOverrides, pushUndoSnapshot]);

  /** Undo the last reschedule operation. */
  const undo = useCallback(() => {
    setUndoStack(prev => {
      if (prev.length === 0) return prev;
      const [snapshot, ...rest] = prev;
      setBlocks(normalizeBlocks(snapshot.blocks));
      return rest;
    });
  }, []);

  const canUndo = undoStack.length > 0;

  // ─────────────────────────────────────────────────────────────────────
  //  Adaptive duration
  // ─────────────────────────────────────────────────────────────────────

  const markBlockComplete = useCallback(
    (block: ScheduledBlock, actualMinutes: number) => {
      const task = tasks.find(t => t.id === block.task_id);
      if (!task) return;
      setDurationLog(prev =>
        recordCompletion(prev, {
          task_id: task.id,
          task_title: task.title,
          estimated_minutes: task.total_duration,
          actual_minutes: actualMinutes,
          energy_intensity: task.energy_intensity,
        })
      );
    },
    [tasks]
  );

  /** Mark a block as done. The block stays where it is (preserved on
   *  rebuild) and contributes actual_minutes to the parent task's consumed
   *  total — so a 30-min completion of a 60-min block leaves 30 min owed,
   *  which the next rebuild will roll forward.
   *
   *  Two side-effect logs are written:
   *    durationLog     — per-task duration accuracy for the suggestDuration hint
   *    completionLog   — full event with hour-of-day + day-of-week for the
   *                      learning layer (energy curve, capacity, day shape)
   *
   *  `confidence` defaults to 'confirmed' (user explicitly tapped). The
   *  auto-assume tick passes 'assumed' or 'inferred-active' instead so
   *  the learning engine can downweight passive observations. */
  const markBlockDone = useCallback(
    (
      blockId: string,
      actualMinutes?: number,
      opts: { confidence?: CompletionConfidence; silent?: boolean } = {}
    ) => {
      const block = blocks.find(b => b.id === blockId);
      if (!block) return;
      // Don't double-mark — but DO upgrade an assumed/inferred block to
      // confirmed if the user is explicitly tapping Done after auto-mark.
      if (block.completed_at && opts.confidence !== 'confirmed') return;

      const task = tasks.find(t => t.id === block.task_id);
      const scheduledMinutes =
        (new Date(block.end_time).getTime() - new Date(block.start_time).getTime()) / 60000;
      const reportedMinutes = actualMinutes ?? Math.max(scheduledMinutes, 0);
      const isPartial = reportedMinutes < scheduledMinutes - 1; // 1-min jitter buffer
      const confidence: CompletionConfidence = opts.confidence ?? 'confirmed';

      if (!opts.silent) pushUndoSnapshot('Mark done');
      updateBlocksSafely(prev =>
        prev.map(b =>
          b.id === blockId
            ? {
                ...b,
                completed_at: new Date().toISOString(),
                actual_minutes: reportedMinutes,
                completion_confidence: confidence,
              }
            : b
        )
      );

      if (task) {
        // Adaptive duration log (per-task estimate vs actual). Skip for
        // 'assumed' confidence since we don't actually know how long it
        // took — would pollute the duration suggestions.
        if (confidence !== 'assumed') {
          setDurationLog(prev =>
            recordCompletion(prev, {
              task_id: task.id,
              task_title: task.title,
              estimated_minutes: task.total_duration,
              actual_minutes: reportedMinutes,
              energy_intensity: task.energy_intensity,
            })
          );
        }

        // Behavioral completion log (drives learning.ts) — confidence-tagged
        setCompletionLog(prev =>
          appendCompletion(
            prev,
            buildCompletionEvent({
              block_id: blockId,
              task,
              scheduled_start: block.start_time,
              scheduled_end: block.end_time,
              status: isPartial ? 'partial' : 'done',
              actual_minutes: reportedMinutes,
              confidence,
            })
          )
        );
      }
    },
    [blocks, tasks, pushUndoSnapshot, updateBlocksSafely]
  );

  /** Reopen a previously-completed block (clear completion state). */
  const markBlockReopen = useCallback(
    (blockId: string) => {
      pushUndoSnapshot('Reopen block');
      updateBlocksSafely(prev =>
        prev.map(b => {
          if (b.id !== blockId) return b;
          // Drop completion fields via destructure
          const {
            completed_at: _c,
            actual_minutes: _a,
            completion_confidence: _cc,
            ...rest
          } = b;
          return rest as ScheduledBlock;
        })
      );
    },
    [pushUndoSnapshot, updateBlocksSafely]
  );

  // ─────────────────────────────────────────────────────────────────────
  //  Passive completion: visibility accumulator + auto-assume tick
  //
  //  Two timers run while the app is mounted:
  //    1. Every 30s, if AXIS is the visible tab, add 0.5 min to each
  //       currently-active block's visible-minutes counter (ref-based to
  //       avoid re-renders).
  //    2. Every 60s, find blocks whose end_time has passed without
  //       explicit completion → auto-mark with confidence:
  //         'inferred-active' if visible-minutes ≥ 30% of duration
  //         'assumed' otherwise
  //
  //  Confirmed taps from the popover override these (markBlockDone with
  //  confidence='confirmed' upgrades the entry).
  // ─────────────────────────────────────────────────────────────────────

  const visibleMinutesRef = useRef<Map<string, number>>(new Map());

  // Visibility accumulator
  useEffect(() => {
    const accumulate = () => {
      if (typeof document === 'undefined' || document.visibilityState !== 'visible') return;
      const now = Date.now();
      for (const b of blocks) {
        if (b.completed_at) continue;
        const start = new Date(b.start_time).getTime();
        const end = new Date(b.end_time).getTime();
        if (start <= now && now <= end) {
          const cur = visibleMinutesRef.current.get(b.id) ?? 0;
          visibleMinutesRef.current.set(b.id, cur + 0.5);
        }
      }
    };
    const interval = setInterval(accumulate, 30_000);
    return () => clearInterval(interval);
  }, [blocks]);

  // Auto-assume tick — marks expired blocks as done with the right confidence
  useEffect(() => {
    const sweep = () => {
      const now = Date.now();
      const candidates: Array<{
        blockId: string;
        scheduledMinutes: number;
        visibleMinutes: number;
        confidence: CompletionConfidence;
      }> = [];

      for (const b of blocks) {
        if (b.completed_at) continue;
        if (b.locked) continue; // anchor / fixed / user-locked: don't auto-mark
        const start = new Date(b.start_time);
        const end = new Date(b.end_time);
        if (end.getTime() > now) continue; // not over yet
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue;

        const scheduledMinutes = Math.max(0, (end.getTime() - start.getTime()) / 60000);
        if (scheduledMinutes <= 0) continue;

        const visibleMinutes = visibleMinutesRef.current.get(b.id) ?? 0;
        const visibleRatio = visibleMinutes / scheduledMinutes;
        const confidence: CompletionConfidence =
          visibleRatio >= 0.3 ? 'inferred-active' : 'assumed';

        candidates.push({ blockId: b.id, scheduledMinutes, visibleMinutes, confidence });
      }

      if (candidates.length === 0) return;

      // Mark each — silent (no undo snapshot per block — a sweep can mark
      // many at once, would flood the undo stack) and update visible_minutes.
      for (const c of candidates) {
        markBlockDone(c.blockId, c.scheduledMinutes, { confidence: c.confidence, silent: true });
      }
      // Also annotate visible_minutes on the block — the FloatingFinishedPill
      // surfaces this so the user can audit "you were on AXIS for 22 of
      // those 60 min" before confirming.
      updateBlocksSafely(prev =>
        prev.map(b => {
          const c = candidates.find(x => x.blockId === b.id);
          return c ? { ...b, visible_minutes: c.visibleMinutes } : b;
        })
      );
    };

    // Run once on mount (catches blocks that ended while user was offline)
    sweep();
    const interval = setInterval(sweep, 60_000);
    return () => clearInterval(interval);
  }, [blocks, markBlockDone, updateBlocksSafely]);

  /** Confirm an auto-marked block (upgrade confidence to 'confirmed').
   *  This is what the FloatingFinishedPill calls when user taps ✓. */
  const confirmAutoMarked = useCallback(
    (blockId: string) => {
      const block = blocks.find(b => b.id === blockId);
      if (!block || !block.completed_at) return;
      // Already confirmed — no-op
      if (block.completion_confidence === 'confirmed') return;

      const scheduledMinutes =
        (new Date(block.end_time).getTime() - new Date(block.start_time).getTime()) / 60000;
      const reported = block.actual_minutes ?? scheduledMinutes;
      // Re-mark with confirmed confidence — this also re-logs the duration
      markBlockDone(blockId, reported, { confidence: 'confirmed', silent: true });
    },
    [blocks, markBlockDone]
  );

  /** Mark a block as skipped (something came up, didn't get done). Removes
   *  the block; the next rebuild will re-place the full task duration. Also
   *  logs a 'skipped' completion event so the learning layer can detect
   *  recurring miss patterns. */
  const markBlockSkipped = useCallback(
    async (blockId: string) => {
      const block = blocks.find(b => b.id === blockId);
      const task = block ? tasks.find(t => t.id === block.task_id) : undefined;

      pushUndoSnapshot('Skip block');
      updateBlocksSafely(prev => prev.filter(b => b.id !== blockId));
      if (userIdRef.current) {
        await supabase.from('scheduled_blocks').delete().eq('id', blockId).eq('user_id', userIdRef.current);
      }

      if (block && task) {
        setCompletionLog(prev =>
          appendCompletion(
            prev,
            buildCompletionEvent({
              block_id: blockId,
              task,
              scheduled_start: block.start_time,
              scheduled_end: block.end_time,
              status: 'skipped',
            })
          )
        );
      }
    },
    [blocks, tasks, pushUndoSnapshot, updateBlocksSafely]
  );

  /** "Things came up — push everything pending forward."
   *  Removes any non-locked, non-completed block whose start time is in the
   *  past (or right now), then opens the rebuild preview. The today-clamp
   *  in the engine ensures new placements only land at or after the
   *  current minute. */
  const replanFromNow = useCallback(() => {
    const nowMs = Date.now();
    pushUndoSnapshot('Replan from now');
    updateBlocksSafely(prev =>
      prev.filter(b => {
        if (b.locked) return true;
        if (b.completed_at) return true;
        return new Date(b.start_time).getTime() > nowMs;
      })
    );
    // Wait one tick so the cleared blocks are reflected before we preview.
    setTimeout(() => previewRebuild(), 0);
  }, [pushUndoSnapshot, updateBlocksSafely]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Apply a per-day cap override. "Easy day" = 50% of normal cap (rounded
   *  down to integer hours, min 2). "Heavy day" = +50% (max 12). Pass
   *  mode='normal' to clear an existing override. */
  const setDayMode = useCallback(
    (dateStr: string, mode: 'easy' | 'normal' | 'heavy') => {
      setDailyOverrides(prev => {
        if (mode === 'normal') {
          if (!prev[dateStr]) return prev;
          const next = { ...prev };
          delete next[dateStr];
          return next;
        }
        const baseTotal = settings.max_total_hours_per_day;
        const baseDeep = settings.max_deep_hours_per_day;
        const factor = mode === 'easy' ? 0.5 : 1.5;
        const override: DailyOverride = {
          max_total_hours: Math.max(2, Math.floor(baseTotal * factor)),
          max_deep_hours: Math.max(1, Math.floor(baseDeep * factor)),
          label: mode,
        };
        return { ...prev, [dateStr]: override };
      });
    },
    [settings]
  );

  const getDayMode = useCallback(
    (dateStr: string): 'easy' | 'normal' | 'heavy' => {
      return dailyOverrides[dateStr]?.label ?? 'normal';
    },
    [dailyOverrides]
  );

  const getDurationSuggestion = useCallback(
    (task: Pick<Task, 'id' | 'title' | 'total_duration' | 'energy_intensity'>): DurationSuggestion => {
      return suggestDuration(task, durationLog);
    },
    [durationLog]
  );

  const updateSettings = useCallback((updates: Partial<UserSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
  }, []);

  // Memoized convenience: counts visible in UI
  const summary = useMemo(() => {
    return {
      activeTasks: tasks.filter(t => t.status === 'active').length,
      placedBlocks: blocks.filter(b => !b.locked).length,
      lockedBlocks: blocks.filter(b => b.locked).length,
      droppedTasks: lastResult?.dropped.length ?? 0,
      atRiskTasks: lastResult?.at_risk.length ?? 0,
    };
  }, [tasks, blocks, lastResult]);

  // ─────────────────────────────────────────────────────────────────────
  //  Learning layer — insights derived from completionLog
  // ─────────────────────────────────────────────────────────────────────

  const insights = useMemo(
    () => buildAllInsights(completionLog, tasks, settings),
    [completionLog, tasks, settings]
  );

  /** Apply the learned deep-window suggestion to user settings. */
  const applyLearnedDeepWindow = useCallback(() => {
    const e = insights.energy;
    if (!e.shift_recommended) return;
    const start = `${String(e.suggested_start_hour).padStart(2, '0')}:00`;
    const end = `${String(e.suggested_end_hour).padStart(2, '0')}:00`;
    setSettings(prev => ({ ...prev, deep_window_start: start, deep_window_end: end }));
  }, [insights.energy]);

  /** Apply the learned daily-cap suggestion. */
  const applyLearnedCap = useCallback(() => {
    const c = insights.capacity;
    if (!c.reduce_recommended && !c.raise_recommended) return;
    setSettings(prev => ({ ...prev, max_total_hours_per_day: c.suggested_cap_hours }));
  }, [insights.capacity]);

  return {
    // State
    tasks,
    blocks,
    settings,
    summary,
    pendingResult,
    pendingDiff,
    lastResult,
    durationLog,
    dailyOverrides,
    canUndo,
    undoStackSize: undoStack.length,
    // Tasks
    addTask,
    updateTask,
    deleteTask,
    importSyncedTasks,
    // Blocks
    lockBlock,
    unlockBlock,
    deleteBlock,
    moveBlock,
    resizeBlock,
    markBlockDone,
    markBlockReopen,
    markBlockSkipped,
    confirmAutoMarked,
    // Rebuild flow
    previewRebuild,
    applyPending,
    cancelPending,
    rebuild,
    replanFromNow,
    undo,
    // Adaptive duration
    markBlockComplete,
    getDurationSuggestion,
    // Day mode
    setDayMode,
    getDayMode,
    // Learning insights — read these to render banners / retrospective
    completionLog,
    insights,
    applyLearnedDeepWindow,
    applyLearnedCap,
    // Settings
    updateSettings,
  };
}
