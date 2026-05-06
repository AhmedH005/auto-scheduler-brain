/**
 * useBlockNotifications — fires browser notifications a configurable
 * number of minutes before each upcoming block starts.
 *
 * Pattern lineage: Motion / Reclaim / Sunsama / Cron all do "X min
 * before, alert me." We do the in-tab variant (no service worker, no
 * push backend). It works while the AXIS tab is open in any state
 * (background tabs included on most browsers); shipping a service
 * worker for true background delivery is a Phase 2 expansion.
 *
 * Behavior
 *   - On settings.notifications_enabled flip from false→true, requests
 *     Notification permission. Refuses to do anything if denied.
 *   - Every 30 seconds, scans blocks and finds any that:
 *       • starts in the next [lead, lead + 30s] window
 *       • isn't already completed/skipped
 *       • we haven't notified yet (per localStorage dedupe set)
 *   - Fires Notification with the task title.
 *   - Dedup set is keyed by `${blockId}:${start_time}` so a moved
 *     block re-arms (different start_time → different key).
 *   - Set is bounded to last 200 entries to keep localStorage tiny.
 */

import { useEffect, useRef } from 'react';
import { ScheduledBlock, Task, UserSettings } from '@/types/task';

const DEDUP_KEY = 'axis_notified_blocks';
const SCAN_INTERVAL_MS = 30_000;
const SCAN_WINDOW_SEC = 30;

function loadDedup(): Set<string> {
  try {
    const raw = localStorage.getItem(DEDUP_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function saveDedup(s: Set<string>) {
  try {
    // Keep only the last 200 — block keys are short so this is bounded.
    const arr = Array.from(s).slice(-200);
    localStorage.setItem(DEDUP_KEY, JSON.stringify(arr));
  } catch {
    /* localStorage full / disabled — silently degrade */
  }
}

export function useBlockNotifications(
  blocks: ScheduledBlock[],
  tasks: Task[],
  settings: UserSettings
) {
  const dedupRef = useRef<Set<string>>(loadDedup());

  // Permission flow — runs whenever notifications_enabled flips true.
  useEffect(() => {
    if (!settings.notifications_enabled) return;
    if (typeof Notification === 'undefined') return;
    if (Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {
        /* user dismissed without choosing — fine */
      });
    }
  }, [settings.notifications_enabled]);

  useEffect(() => {
    if (!settings.notifications_enabled) return;
    if (typeof Notification === 'undefined') return;
    if (Notification.permission !== 'granted') return;

    const lead = settings.notification_lead_minutes ?? 5;
    const taskById = new Map(tasks.map(t => [t.id, t]));

    const scan = () => {
      const now = Date.now();
      const windowStart = now + lead * 60_000;
      const windowEnd = windowStart + SCAN_WINDOW_SEC * 1000;
      for (const b of blocks) {
        if (b.completed_at) continue;
        const startMs = new Date(b.start_time).getTime();
        if (startMs < windowStart || startMs >= windowEnd) continue;
        const key = `${b.id}:${b.start_time}`;
        if (dedupRef.current.has(key)) continue;
        const task = taskById.get(b.task_id);
        if (!task) continue;

        const minsUntil = Math.round((startMs - now) / 60_000);
        try {
          new Notification(`Starting in ${minsUntil}m: ${task.title}`, {
            body: `${b.start_time.slice(11, 16)} – ${b.end_time.slice(11, 16)}`,
            tag: b.id, // Replaces a prior notification with the same tag
            icon: '/favicon.svg',
            silent: false,
          });
          dedupRef.current.add(key);
          saveDedup(dedupRef.current);
        } catch {
          /* Notification constructor can throw on some platforms — no-op */
        }
      }
    };

    // Run once immediately so the user doesn't have to wait 30s for the
    // first scan after enabling.
    scan();
    const id = setInterval(scan, SCAN_INTERVAL_MS);
    return () => clearInterval(id);
  }, [
    blocks,
    tasks,
    settings.notifications_enabled,
    settings.notification_lead_minutes,
  ]);
}
