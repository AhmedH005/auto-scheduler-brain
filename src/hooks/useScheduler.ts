import { useState, useCallback, useEffect, useRef } from 'react';
import { Task, ScheduledBlock, UserSettings, DEFAULT_SETTINGS } from '@/types/task';
import { rebuildSchedule } from '@/engine/scheduler';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabase';

const TASKS_KEY = 'autosched_tasks';
const BLOCKS_KEY = 'autosched_blocks';
const SETTINGS_KEY = 'autosched_settings';

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

// ─── Supabase sync helpers ────────────────────────────────────────────────────

async function getUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

async function syncTasksToSupabase(tasks: Task[], userId: string) {
  if (!userId) return;
  const rows = tasks.map((t) => ({
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
  await supabase.from('tasks').upsert(rows, { onConflict: 'id' });
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
  await supabase.from('scheduled_blocks').upsert(rows, { onConflict: 'id' });
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

// ─── Main hook ───────────────────────────────────────────────────────────────

export function useScheduler() {
  const [tasks, setTasks] = useState<Task[]>(() => loadFromStorage(TASKS_KEY, []));
  const [blocks, setBlocks] = useState<ScheduledBlock[]>(() => normalizeBlocks(loadFromStorage(BLOCKS_KEY, [])));
  const [settings, setSettings] = useState<UserSettings>(() => loadFromStorage(SETTINGS_KEY, DEFAULT_SETTINGS));

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

      // Load tasks
      const { data: taskRows } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', uid)
        .order('created_at', { ascending: true });

      // Load blocks
      const { data: blockRows } = await supabase
        .from('scheduled_blocks')
        .select('*')
        .eq('user_id', uid)
        .order('start_at', { ascending: true });

      // Load settings
      const { data: settingsRow } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', uid)
        .maybeSingle();

      if (cancelled) return;

      if (taskRows && taskRows.length > 0) {
        const mapped = taskRows.map(mapDbTaskToTask);
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

      setHydrated(true);
    })();
    return () => { cancelled = true; };
  }, []);

  // Persist to localStorage (always)
  useEffect(() => { if (hydrated) saveToStorage(TASKS_KEY, tasks); }, [tasks, hydrated]);
  useEffect(() => { if (hydrated) saveToStorage(BLOCKS_KEY, blocks); }, [blocks, hydrated]);
  useEffect(() => { if (hydrated) saveToStorage(SETTINGS_KEY, settings); }, [settings, hydrated]);

  // Persist to Supabase (when user is logged in and data is hydrated)
  useEffect(() => {
    if (!hydrated || !userIdRef.current) return;
    syncTasksToSupabase(tasks, userIdRef.current);
  }, [tasks, hydrated]);

  useEffect(() => {
    if (!hydrated || !userIdRef.current) return;
    syncBlocksToSupabase(blocks, userIdRef.current);
  }, [blocks, hydrated]);

  useEffect(() => {
    if (!hydrated || !userIdRef.current) return;
    syncSettingsToSupabase(settings, userIdRef.current);
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

  const addTask = useCallback((task: Task) => {
    setTasks(prev => [...prev, task]);
  }, []);

  const updateTask = useCallback((id: string, updates: Partial<Task>) => {
    setTasks(prev => prev.map(t => (t.id === id ? { ...t, ...updates } : t)));
  }, []);

  const deleteTask = useCallback(async (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    updateBlocksSafely(prev => prev.filter(b => b.task_id !== id));
    // Delete from Supabase
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
  }, [updateBlocksSafely]);

  const resizeBlock = useCallback((blockId: string, newEnd: string) => {
    updateBlocksSafely(prev =>
      prev.map(b => {
        if (b.id !== blockId) return b;
        return {
          ...b,
          end_time: newEnd,
          locked: true,
        };
      })
    );
  }, [updateBlocksSafely]);

  const rebuild = useCallback(() => {
    const activeTasks = tasks.filter(t => t.status === 'active');
    const activeTaskIds = new Set(activeTasks.map(t => t.id));
    // Only preserve locked blocks whose task still exists — prevents orphaned "Unknown" blocks
    const rawLocked = blocks.filter(b => b.locked && activeTaskIds.has(b.task_id));

    // Deduplicate overlapping locked blocks: if two locked blocks overlap in time,
    // keep only the first one per time slot — the other gets re-scheduled freely.
    const deduped: typeof rawLocked = [];
    for (const block of rawLocked) {
      const start = new Date(block.start_time).getTime();
      const end = new Date(block.end_time).getTime();
      const conflicts = deduped.some(b => {
        const bStart = new Date(b.start_time).getTime();
        const bEnd = new Date(b.end_time).getTime();
        return bStart < end && bEnd > start;
      });
      if (!conflicts) deduped.push(block);
    }

    const newBlocks = rebuildSchedule(activeTasks, deduped, settings);
    setBlocks(normalizeBlocks(newBlocks));
  }, [tasks, blocks, settings]);

  const updateSettings = useCallback((updates: Partial<UserSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
  }, []);

  return {
    tasks,
    blocks,
    settings,
    addTask,
    updateTask,
    deleteTask,
    lockBlock,
    unlockBlock,
    deleteBlock,
    moveBlock,
    resizeBlock,
    rebuild,
    updateSettings,
  };
}
