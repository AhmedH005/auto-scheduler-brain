/**
 * iCalendar (.ics) export.
 *
 * Universal interop: every calendar app (Apple, Outlook, Google,
 * Fantastical, Thunderbird, Notion Calendar, Cron…) imports .ics. So
 * even though we only have native Google sync, exporting .ics gives
 * users a path to view their AXIS schedule in any tool of their
 * choice. Closes the "no Outlook integration" gap without writing an
 * Outlook adapter.
 *
 * RFC 5545 conformant: VCALENDAR / VEVENT / DTSTART / DTEND / SUMMARY /
 * UID / DTSTAMP / DESCRIPTION / CATEGORIES (for tags). No timezone
 * objects — uses local time + the system's IANA TZID via DTSTART;TZID.
 */

import { ScheduledBlock, Task } from '@/types/task';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Format a local datetime as YYYYMMDDTHHMMSS (RFC 5545 floating local). */
function formatLocal(iso: string): string {
  const d = new Date(iso);
  return (
    d.getFullYear().toString() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    'T' +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  );
}

/** Format the current moment as a UTC stamp for DTSTAMP. */
function nowUtcStamp(): string {
  const d = new Date();
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    'T' +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    'Z'
  );
}

/** Escape per RFC 5545 §3.3.11 — backslash, semicolon, comma, newline. */
function escapeText(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '');
}

/** Fold lines longer than 75 octets per RFC 5545 §3.1. */
function fold(line: string): string {
  if (line.length <= 75) return line;
  const out: string[] = [];
  let i = 0;
  out.push(line.slice(0, 75));
  i = 75;
  while (i < line.length) {
    out.push(' ' + line.slice(i, i + 74));
    i += 74;
  }
  return out.join('\r\n');
}

export interface IcsExportOptions {
  blocks: ScheduledBlock[];
  tasks: Task[];
  /** Calendar name shown when imported. */
  calendarName?: string;
}

export function exportBlocksToIcs({
  blocks,
  tasks,
  calendarName = 'AXIS',
}: IcsExportOptions): string {
  const taskById = new Map(tasks.map(t => [t.id, t]));
  const tz =
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const stamp = nowUtcStamp();

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//AXIS//Self-Direction//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    fold(`X-WR-CALNAME:${escapeText(calendarName)}`),
    fold(`X-WR-TIMEZONE:${tz}`),
  ];

  for (const b of blocks) {
    const task = taskById.get(b.task_id);
    const title = task?.title ?? 'Untitled';
    const description: string[] = [];
    if (task?.description) description.push(task.description);
    if (task?.tags && task.tags.length > 0) {
      description.push(`tags: ${task.tags.map(t => '#' + t).join(' ')}`);
    }
    description.push(`scheduled by AXIS · score-driven`);

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${b.id}@axis.app`);
    lines.push(`DTSTAMP:${stamp}`);
    lines.push(`DTSTART;TZID=${tz}:${formatLocal(b.start_time)}`);
    lines.push(`DTEND;TZID=${tz}:${formatLocal(b.end_time)}`);
    lines.push(fold(`SUMMARY:${escapeText(title)}`));
    if (description.length > 0) {
      lines.push(fold(`DESCRIPTION:${escapeText(description.join('\\n'))}`));
    }
    if (task?.tags && task.tags.length > 0) {
      lines.push(fold(`CATEGORIES:${task.tags.map(escapeText).join(',')}`));
    }
    if (b.completed_at) {
      lines.push('STATUS:COMPLETED');
    } else if (b.locked) {
      lines.push('STATUS:CONFIRMED');
    } else {
      lines.push('STATUS:TENTATIVE');
    }
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export function downloadIcsFile(content: string, filename = 'axis-schedule.ics') {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
