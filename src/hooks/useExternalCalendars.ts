import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { ConnectedCalendarAccount, ExternalCalendar } from '@/types/calendar';
import { Task } from '@/types/task';
import {
  requestGoogleAccessToken,
  fetchGoogleProfile,
  fetchGoogleCalendars,
  fetchGoogleCalendarEvents,
  normalizeGoogleEvent,
} from '@/lib/googleCalendar';

export type SyncStatus = 'idle' | 'connecting' | 'syncing' | 'error';

async function getUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

/** Convert a UTC ISO string to local yyyy-MM-ddTHH:mm */
function utcToLocalDT(utcStr: string): string {
  const d = new Date(utcStr);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Get local HH:MM from a UTC ISO string */
function utcToHHMM(utcStr: string): string {
  const d = new Date(utcStr);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

type DbEvent = {
  id: string; title: string; start_at: string; end_at: string;
  is_all_day: boolean; status: string; external_calendar_id: string;
  connected_account_id: string; provider_event_id: string | null;
};

/**
 * Groups timed events by calendar + title.
 * Events like prayer times shift daily, so we can't group by exact HH:MM.
 * Groups with 2+ instances are recurring and become a single anchor task.
 * Single instances become fixed tasks.
 */
function convertTimedEvents(
  events: DbEvent[],
  calColor: string | undefined,
  provider: Task['sync_source'],
): Task[] {
  // Group by [calendarId, title] — same name in same calendar = same series
  const groups = new Map<string, DbEvent[]>();
  for (const e of events) {
    const key = `${e.external_calendar_id}|${(e.title ?? '').toLowerCase().trim()}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(e);
  }

  const tasks: Task[] = [];

  for (const [, group] of groups) {
    const sorted = [...group].sort((a, b) => a.start_at.localeCompare(b.start_at));
    const first = sorted[0];
    const durationMin = Math.round(
      (new Date(first.end_at).getTime() - new Date(first.start_at).getTime()) / 60000
    );

    if (sorted.length < 2) {
      // Single occurrence → fixed task
      tasks.push({
        id:                  `synced-${first.id}`,
        title:               first.title ?? '(No title)',
        total_duration:      durationMin,
        priority:            3,
        deadline:            null,
        energy_intensity:    'moderate' as const,
        scheduling_mode:     'fixed' as const,
        window_start:        null,
        window_end:          null,
        start_datetime:      utcToLocalDT(first.start_at),
        end_datetime:        utcToLocalDT(first.end_at),
        execution_style:     'single' as const,
        is_recurring:        false,
        recurrence_pattern:  null,
        recurrence_interval: 1,
        recurrence_end:      null,
        status:              'active' as const,
        created_at:          first.start_at,
        sync_source:         provider,
        provider_event_id:   first.provider_event_id ?? first.id,
        calendar_color:      calColor,
      } satisfies Task);
    } else {
      // Multiple occurrences at the same time → detect recurrence pattern
      const dayDiffs = sorted.slice(1).map((e, i) => {
        const a = new Date(sorted[i].start_at); a.setHours(0, 0, 0, 0);
        const b = new Date(e.start_at);         b.setHours(0, 0, 0, 0);
        return Math.round((b.getTime() - a.getTime()) / 86400000);
      });

      // Most common gap between consecutive occurrences
      const diffCounts = new Map<number, number>();
      for (const d of dayDiffs) diffCounts.set(d, (diffCounts.get(d) || 0) + 1);
      const dominantDiff = [...diffCounts.entries()].sort((a, b) => b[1] - a[1])[0][0];

      let pattern: Task['recurrence_pattern'] = 'daily';
      if (dominantDiff >= 6 && dominantDiff <= 8) {
        pattern = 'weekly';
      } else if (dominantDiff === 1) {
        // Daily — check if strictly weekdays only
        const weekdays = sorted.map(e => new Date(e.start_at).getDay()); // 0=Sun, 6=Sat
        const hasWeekend = weekdays.some(d => d === 0 || d === 6);
        pattern = hasWeekend ? 'daily' : 'weekdays';
      }

      // Use the most common start/end HH:MM across all occurrences
      // (prayer times shift daily, so we pick the median/most frequent)
      const startCounts = new Map<string, number>();
      const endCounts   = new Map<string, number>();
      for (const e of sorted) {
        const s = utcToHHMM(e.start_at); startCounts.set(s, (startCounts.get(s) ?? 0) + 1);
        const en = utcToHHMM(e.end_at);  endCounts.set(en, (endCounts.get(en) ?? 0) + 1);
      }
      const startHHMM = [...startCounts.entries()].sort((a, b) => b[1] - a[1])[0][0];
      const endHHMM   = [...endCounts.entries()].sort((a, b) => b[1] - a[1])[0][0];
      const lastDate  = sorted[sorted.length - 1].start_at.substring(0, 10);

      // Stable, deterministic ID for this recurring series (title-based, no time)
      const slug = `${first.external_calendar_id}-${(first.title ?? '').replace(/[^a-z0-9]/gi, '_')}`;

      tasks.push({
        id:                  `synced-rec-${slug}`,
        title:               first.title ?? '(No title)',
        total_duration:      durationMin,
        priority:            3,
        deadline:            null,
        energy_intensity:    'moderate' as const,
        scheduling_mode:     'anchor' as const,
        window_start:        startHHMM,
        window_end:          endHHMM,
        start_datetime:      null,
        end_datetime:        null,
        execution_style:     'single' as const,
        is_recurring:        true,
        recurrence_pattern:  pattern,
        recurrence_interval: 1,
        recurrence_end:      lastDate,
        status:              'active' as const,
        created_at:          first.start_at,
        sync_source:         provider,
        provider_event_id:   first.provider_event_id ?? first.id,
        calendar_color:      calColor,
      } satisfies Task);
    }
  }

  return tasks;
}

// Loads synced calendar events from Supabase and converts them to AXIS Task objects.
// Recurring timed events become anchor tasks; single timed events become fixed tasks;
// all-day events become flexible tasks.
async function loadSyncedTasksFromDb(
  userId: string,
  calendarList: ExternalCalendar[],
  accountList: ConnectedCalendarAccount[],
): Promise<Task[]> {
  const enabledIds = new Set(calendarList.filter(c => c.is_enabled).map(c => c.id));
  const calMap     = new Map(calendarList.map(c => [c.id, c]));
  const accountMap = new Map(accountList.map(a => [a.id, a]));

  const { data } = await supabase
    .from('external_calendar_events')
    .select('id,title,start_at,end_at,is_all_day,status,external_calendar_id,connected_account_id,provider_event_id')
    .eq('user_id', userId)
    .neq('status', 'cancelled');

  const filtered = (data ?? []).filter(e => enabledIds.has(e.external_calendar_id)) as DbEvent[];

  const tasks: Task[] = [];

  // Group by calendar so we can look up color/provider per group
  const byCalendar = new Map<string, DbEvent[]>();
  for (const e of filtered) {
    if (!byCalendar.has(e.external_calendar_id)) byCalendar.set(e.external_calendar_id, []);
    byCalendar.get(e.external_calendar_id)!.push(e);
  }

  for (const [calId, events] of byCalendar) {
    const cal      = calMap.get(calId);
    const account  = accountMap.get(events[0].connected_account_id);
    const calColor = cal?.color ?? undefined;
    const provider = (account?.provider ?? 'google') as Task['sync_source'];

    const allDay = events.filter(e => e.is_all_day);
    const timed  = events.filter(e => !e.is_all_day);

    // All-day events → flexible tasks (individual)
    for (const e of allDay) {
      tasks.push({
        id:                  `synced-${e.id}`,
        title:               e.title ?? '(No title)',
        total_duration:      60,
        priority:            3,
        deadline:            e.start_at.substring(0, 10),
        energy_intensity:    'moderate' as const,
        scheduling_mode:     'flexible' as const,
        window_start:        null,
        window_end:          null,
        start_datetime:      null,
        end_datetime:        null,
        execution_style:     'single' as const,
        is_recurring:        false,
        recurrence_pattern:  null,
        recurrence_interval: 1,
        recurrence_end:      null,
        status:              'active' as const,
        created_at:          e.start_at,
        sync_source:         provider,
        provider_event_id:   e.provider_event_id ?? e.id,
        calendar_color:      calColor,
      } satisfies Task);
    }

    // Timed events → detect recurring vs single
    tasks.push(...convertTimedEvents(timed, calColor, provider));
  }

  return tasks;
}

export function useExternalCalendars() {
  const [accounts,      setAccounts]      = useState<ConnectedCalendarAccount[]>([]);
  const [calendars,     setCalendars]     = useState<ExternalCalendar[]>([]);
  const [syncedTasks,   setSyncedTasks]   = useState<Task[]>([]);
  const [syncStatus,    setSyncStatus]    = useState<SyncStatus>('idle');
  const [syncError,   setSyncError]   = useState<string | null>(null);
  const [hydrated,    setHydrated]    = useState(false);
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const uid = await getUserId();
      if (cancelled) return;
      userIdRef.current = uid;
      if (!uid) { setHydrated(true); return; }

      const [accRes, calRes] = await Promise.all([
        supabase.from('connected_calendar_accounts').select('*').eq('user_id', uid).eq('is_connected', true),
        supabase.from('external_calendars').select('*').eq('user_id', uid),
      ]);
      if (cancelled) return;

      const loadedAccounts  = (accRes.data ?? []) as ConnectedCalendarAccount[];
      const loadedCalendars = (calRes.data ?? []) as ExternalCalendar[];
      setAccounts(loadedAccounts);
      setCalendars(loadedCalendars);

      const tasks = await loadSyncedTasksFromDb(uid, loadedCalendars, loadedAccounts);
      if (!cancelled) setSyncedTasks(tasks);
      setHydrated(true);
    })();
    return () => { cancelled = true; };
  }, []);

  const syncGoogleAccount = useCallback(async (
    account: ConnectedCalendarAccount,
    accessToken: string,
    currentCalendars: ExternalCalendar[],
    uid: string,
  ): Promise<ExternalCalendar[]> => {
    // Fetch calendar list from Google
    const gCals = await fetchGoogleCalendars(accessToken);

    // Determine is_enabled for each: new calendars default to primary || selected
    const existingMap = new Map(currentCalendars.filter(c => c.connected_account_id === account.id).map(c => [c.provider_calendar_id, c]));
    const calRows = gCals.map(c => ({
      user_id:              uid,
      connected_account_id: account.id,
      provider_calendar_id: c.id,
      name:                 c.summary,
      description:          c.description ?? null,
      color:                c.backgroundColor ?? null,
      is_enabled:           existingMap.get(c.id)?.is_enabled ?? (c.primary ?? c.selected ?? true),
      is_primary:           c.primary ?? false,
    }));

    const { data: savedCals } = await supabase
      .from('external_calendars')
      .upsert(calRows, { onConflict: 'connected_account_id,provider_calendar_id' })
      .select();

    const freshCals = (savedCals ?? []) as ExternalCalendar[];

    // Fetch + upsert events for each calendar
    for (const cal of freshCals) {
      const gEvents = await fetchGoogleCalendarEvents(accessToken, cal.provider_calendar_id);
      if (gEvents.length === 0) continue;

      const rows = gEvents.map(e => normalizeGoogleEvent(e, uid, account.id, cal.id));
      await supabase
        .from('external_calendar_events')
        .upsert(rows, { onConflict: 'connected_account_id,provider_event_id' });

      // Mark cancelled events
      const cancelledIds = gEvents.filter(e => e.status === 'cancelled').map(e => e.id);
      if (cancelledIds.length > 0) {
        await supabase
          .from('external_calendar_events')
          .update({ status: 'cancelled' })
          .in('provider_event_id', cancelledIds)
          .eq('connected_account_id', account.id);
      }
    }

    // Update last_synced_at
    await supabase
      .from('connected_calendar_accounts')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', account.id);

    return freshCals;
  }, []);

  const connectGoogle = useCallback(async () => {
    const uid = userIdRef.current;
    if (!uid) return;
    setSyncStatus('connecting');
    setSyncError(null);
    try {
      const token   = await requestGoogleAccessToken();
      const profile = await fetchGoogleProfile(token);

      // Upsert account row
      const { data: accRow, error: accErr } = await supabase
        .from('connected_calendar_accounts')
        .upsert({
          user_id:               uid,
          provider:              'google',
          provider_account_id:   profile.id,
          provider_account_email: profile.email,
          display_name:          profile.name,
          avatar_url:            profile.picture,
          is_connected:          true,
        }, { onConflict: 'user_id,provider,provider_account_id' })
        .select()
        .single();
      if (accErr || !accRow) throw new Error(accErr?.message ?? 'Failed to save account');
      const account = accRow as ConnectedCalendarAccount;

      setSyncStatus('syncing');
      const allCalendars = [...calendars];
      const freshCals = await syncGoogleAccount(account, token, allCalendars, uid);

      // Merge into state
      const otherCals = allCalendars.filter(c => c.connected_account_id !== account.id);
      const mergedCals = [...otherCals, ...freshCals];

      const otherAccounts = accounts.filter(a => a.id !== account.id);
      const mergedAccounts = [...otherAccounts, { ...account, last_synced_at: new Date().toISOString() }];

      setAccounts(mergedAccounts);
      setCalendars(mergedCals);
      setSyncedTasks(await loadSyncedTasksFromDb(uid, mergedCals, mergedAccounts));
      setSyncStatus('idle');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Connection failed';
      setSyncError(msg);
      setSyncStatus('error');
    }
  }, [accounts, calendars, syncGoogleAccount]);

  const syncAccount = useCallback(async (accountId: string) => {
    const uid = userIdRef.current;
    if (!uid) return;
    const account = accounts.find(a => a.id === accountId);
    if (!account) return;

    setSyncStatus('syncing');
    setSyncError(null);
    try {
      let freshCals: ExternalCalendar[] = [];
      if (account.provider === 'google') {
        const token = await requestGoogleAccessToken();
        freshCals = await syncGoogleAccount(account, token, calendars, uid);
      }
      const otherCals = calendars.filter(c => c.connected_account_id !== accountId);
      const mergedCals = [...otherCals, ...freshCals];

      const updatedAccounts = accounts.map(a =>
        a.id === accountId ? { ...a, last_synced_at: new Date().toISOString() } : a
      );
      setAccounts(updatedAccounts);
      setCalendars(mergedCals);
      setSyncedTasks(await loadSyncedTasksFromDb(uid, mergedCals, updatedAccounts));
      setSyncStatus('idle');
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Sync failed');
      setSyncStatus('error');
    }
  }, [accounts, calendars, syncGoogleAccount]);

  const disconnectAccount = useCallback(async (accountId: string) => {
    const uid = userIdRef.current;
    if (!uid) return;
    // Cascade delete via FK: deleting account removes its calendars + events
    await supabase.from('connected_calendar_accounts').delete().eq('id', accountId).eq('user_id', uid);
    const updatedAccounts  = accounts.filter(a => a.id !== accountId);
    const updatedCalendars = calendars.filter(c => c.connected_account_id !== accountId);
    setAccounts(updatedAccounts);
    setCalendars(updatedCalendars);
    setSyncedTasks(prev => prev.filter(t => !t.provider_event_id?.startsWith(accountId)));
    // Reload to ensure clean state after cascade delete
    const uid2 = userIdRef.current;
    if (uid2) setSyncedTasks(await loadSyncedTasksFromDb(uid2, updatedCalendars, updatedAccounts));
  }, [accounts, calendars]);

  const toggleCalendar = useCallback(async (calendarId: string, enabled: boolean) => {
    const uid = userIdRef.current;
    if (!uid) return;
    await supabase.from('external_calendars').update({ is_enabled: enabled }).eq('id', calendarId);
    const updatedCalendars = calendars.map(c => c.id === calendarId ? { ...c, is_enabled: enabled } : c);
    setCalendars(updatedCalendars);
    setSyncedTasks(await loadSyncedTasksFromDb(uid, updatedCalendars, accounts));
  }, [calendars, accounts]);

  return {
    accounts,
    calendars,
    syncedTasks,
    syncStatus,
    syncError,
    hydrated,
    connectGoogle,
    syncAccount,
    disconnectAccount,
    toggleCalendar,
  };
}
