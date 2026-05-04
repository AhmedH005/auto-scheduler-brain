/**
 * Natural-language task parser. Turns one line into a task.
 *
 *   "Read research paper 90min by Friday"
 *      → { title: "Read research paper", duration: 90, deadline: "2026-05-08", energy: "deep" }
 *
 *   "Reply to emails 15m every weekday"
 *      → { title: "Reply to emails", duration: 15, recurring: { pattern: "weekdays" }, energy: "light" }
 *
 *   "Lunch tomorrow 12:30"
 *      → { title: "Lunch", scheduling: "fixed", start: "2026-05-04T12:30", duration: 60, energy: "light" }
 *
 * Extraction is deterministic and confidence-tagged. The UI shows the
 * preview live as the user types so they can see what AXIS understood.
 *
 * Falls back gracefully — anything we can't parse stays as part of the
 * title. The user is never blocked by the parser.
 */

import { addDays, format, nextDay, parse, isValid } from 'date-fns';
import { Task, EnergyIntensity, RecurrencePattern, SchedulingMode } from '@/types/task';

export interface ParsedTask {
  title: string;
  /** Duration in minutes. Defaults to 30 when unspecified. */
  duration: number;
  /** yyyy-MM-dd deadline if extracted, null otherwise. */
  deadline: string | null;
  /** Recurrence pattern if extracted. */
  recurring: { pattern: RecurrencePattern; end: string | null } | null;
  /** Inferred from keywords in the title. */
  energy: EnergyIntensity;
  /** Set when "at HH:MM" or "tomorrow at 14:00" is parsed → fixed task. */
  scheduling_mode: SchedulingMode;
  /** ISO yyyy-MM-ddTHH:mm:ss when scheduling_mode === 'fixed'. */
  start_datetime: string | null;
  /** ISO yyyy-MM-ddTHH:mm:ss when scheduling_mode === 'fixed'. */
  end_datetime: string | null;
  /** 1..5; 3 default. Inferred from words like "urgent", "important", "low priority". */
  priority: number;
  /** Tells the UI which fields the parser confidently extracted. */
  matched: {
    duration: boolean;
    deadline: boolean;
    recurring: boolean;
    energy: boolean;
    fixed_time: boolean;
    priority: boolean;
  };
}

// ─────────────────────────────────────────────────────────────────────────
//  Top-level parse
// ─────────────────────────────────────────────────────────────────────────

export function parseQuickAdd(input: string, now = new Date()): ParsedTask {
  const matched: ParsedTask['matched'] = {
    duration: false,
    deadline: false,
    recurring: false,
    energy: false,
    fixed_time: false,
    priority: false,
  };

  let remaining = input.trim();

  // Order matters — extract the most specific patterns first so they don't
  // get swallowed by greedier ones (e.g. "every Friday" before "Friday").

  // 1. Recurring patterns
  const rec = extractRecurring(remaining);
  if (rec) {
    matched.recurring = true;
    remaining = rec.remaining;
  }

  // 2. Fixed time ("at 3pm", "tomorrow at 14:00")
  const fixed = extractFixedTime(remaining, now);
  if (fixed) {
    matched.fixed_time = true;
    remaining = fixed.remaining;
  }

  // 3. Deadline ("by Friday", "due tomorrow", "next Tuesday")
  const dl = !fixed ? extractDeadline(remaining, now) : null;
  if (dl) {
    matched.deadline = true;
    remaining = dl.remaining;
  }

  // 4. Duration ("90min", "1.5h", "for 2 hours")
  const dur = extractDuration(remaining);
  if (dur) {
    matched.duration = true;
    remaining = dur.remaining;
  }

  // 5. Priority ("urgent", "important", "low priority")
  const pr = extractPriority(remaining);
  if (pr) {
    matched.priority = true;
    remaining = pr.remaining;
  }

  // 6. Whatever's left is the title — clean it up
  const title = cleanTitle(remaining);

  // 7. Energy is INFERRED from title keywords (not stripped from input)
  const energyResult = inferEnergy(title);
  matched.energy = energyResult.matched;

  return {
    title: title || 'Untitled',
    duration: dur?.minutes ?? 30,
    deadline: dl?.date ?? null,
    recurring: rec ? { pattern: rec.pattern, end: rec.end ?? null } : null,
    energy: energyResult.energy,
    scheduling_mode: fixed ? 'fixed' : 'flexible',
    start_datetime: fixed?.startIso ?? null,
    end_datetime: fixed?.endIso ?? null,
    priority: pr?.priority ?? 3,
    matched,
  };
}

/** Convert a ParsedTask to a draft Task ready for the engine. */
export function parsedTaskToTask(parsed: ParsedTask): Omit<Task, 'id' | 'created_at' | 'status'> {
  return {
    title: parsed.title,
    description: undefined,
    color: undefined,
    total_duration: parsed.duration,
    priority: parsed.priority,
    deadline: parsed.deadline,
    energy_intensity: parsed.energy,
    scheduling_mode: parsed.scheduling_mode,
    window_start: null,
    window_end: null,
    start_datetime: parsed.start_datetime,
    end_datetime: parsed.end_datetime,
    execution_style: 'auto_chunk',
    is_recurring: parsed.recurring !== null,
    recurrence_pattern: parsed.recurring?.pattern ?? null,
    recurrence_interval: 1,
    recurrence_end: parsed.recurring?.end ?? null,
  };
}

// ─────────────────────────────────────────────────────────────────────────
//  Sub-extractors
// ─────────────────────────────────────────────────────────────────────────

function extractDuration(input: string): { minutes: number; remaining: string } | null {
  // "90min", "90 min", "90 minutes", "90m"
  const minRe = /\b(?:for\s+)?(\d{1,3})\s*(?:min(?:ute)?s?|m)\b/i;
  const minMatch = input.match(minRe);
  if (minMatch) {
    return { minutes: parseInt(minMatch[1], 10), remaining: input.replace(minRe, '').trim() };
  }
  // "1.5h", "1.5 hours", "2h", "2 hour", "for 2h"
  const hourRe = /\b(?:for\s+)?(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b/i;
  const hourMatch = input.match(hourRe);
  if (hourMatch) {
    return { minutes: Math.round(parseFloat(hourMatch[1]) * 60), remaining: input.replace(hourRe, '').trim() };
  }
  return null;
}

function extractRecurring(
  input: string
): { pattern: RecurrencePattern; end: string | null; remaining: string } | null {
  const patterns: Array<{ re: RegExp; pattern: RecurrencePattern }> = [
    { re: /\bevery\s+weekday\b/i, pattern: 'weekdays' },
    { re: /\bweekdays\b/i, pattern: 'weekdays' },
    { re: /\bevery\s+day\b/i, pattern: 'daily' },
    { re: /\bdaily\b/i, pattern: 'daily' },
    { re: /\bevery\s+week\b/i, pattern: 'weekly' },
    { re: /\bweekly\b/i, pattern: 'weekly' },
    { re: /\bevery\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i, pattern: 'weekly' },
  ];
  for (const { re, pattern } of patterns) {
    const m = input.match(re);
    if (m) {
      return { pattern, end: null, remaining: input.replace(re, '').trim() };
    }
  }
  return null;
}

function extractFixedTime(
  input: string,
  now: Date
): { startIso: string; endIso: string; remaining: string } | null {
  // "today at 3pm", "tomorrow at 14:00", "Friday at 9", "at 3pm"
  // Capture: day prefix + "at" + time
  const re = /\b(?:(today|tomorrow|next\s+\w+|this\s+\w+|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+)?at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i;
  const m = input.match(re);
  if (!m) return null;

  const dayWord = m[1]?.toLowerCase();
  const baseDate = dayWord ? resolveDayWord(dayWord, now) : new Date(now);
  if (!baseDate) return null;

  let hour = parseInt(m[2], 10);
  const minute = m[3] ? parseInt(m[3], 10) : 0;
  const ampm = m[4]?.toLowerCase();
  if (ampm === 'pm' && hour < 12) hour += 12;
  if (ampm === 'am' && hour === 12) hour = 0;
  // If no am/pm and hour is small (1-7), assume PM (most useful default)
  if (!ampm && hour >= 1 && hour <= 7) hour += 12;

  baseDate.setHours(hour, minute, 0, 0);
  const start = new Date(baseDate);
  const end = new Date(start.getTime() + 60 * 60 * 1000); // default 1h

  const remaining = input.replace(re, '').trim();
  return { startIso: formatLocal(start), endIso: formatLocal(end), remaining };
}

function extractDeadline(input: string, now: Date): { date: string; remaining: string } | null {
  // "by tomorrow", "due Friday", "by next Tuesday", "in 3 days", "in 2 weeks", "by 5/12"
  // 1. "in N days/weeks"
  const inRe = /\bin\s+(\d+)\s+(day|week)s?\b/i;
  const inMatch = input.match(inRe);
  if (inMatch) {
    const n = parseInt(inMatch[1], 10);
    const days = inMatch[2].toLowerCase().startsWith('week') ? n * 7 : n;
    const d = addDays(now, days);
    return { date: format(d, 'yyyy-MM-dd'), remaining: input.replace(inRe, '').trim() };
  }
  // 2. "by/due <day-word>"
  const byRe = /\b(?:by|due|before)\s+(today|tomorrow|next\s+\w+|this\s+\w+|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i;
  const byMatch = input.match(byRe);
  if (byMatch) {
    const d = resolveDayWord(byMatch[1].toLowerCase(), now);
    if (d) {
      return { date: format(d, 'yyyy-MM-dd'), remaining: input.replace(byRe, '').trim() };
    }
  }
  // 3. "by M/D" or "by M/D/YYYY"
  const byDateRe = /\b(?:by|due|before)\s+(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/;
  const byDateMatch = input.match(byDateRe);
  if (byDateMatch) {
    const month = parseInt(byDateMatch[1], 10);
    const day = parseInt(byDateMatch[2], 10);
    const year = byDateMatch[3]
      ? byDateMatch[3].length === 2
        ? 2000 + parseInt(byDateMatch[3], 10)
        : parseInt(byDateMatch[3], 10)
      : now.getFullYear();
    const d = new Date(year, month - 1, day);
    if (isValid(d)) {
      return { date: format(d, 'yyyy-MM-dd'), remaining: input.replace(byDateRe, '').trim() };
    }
  }
  return null;
}

function extractPriority(input: string): { priority: number; remaining: string } | null {
  const matchers: Array<{ re: RegExp; priority: number }> = [
    { re: /\b(urgent|critical|asap)\b/i, priority: 5 },
    { re: /\b(high\s+priority|important)\b/i, priority: 4 },
    { re: /\b(low\s+priority|whenever)\b/i, priority: 2 },
    { re: /\b(p1|p\s*1)\b/i, priority: 5 },
    { re: /\b(p2|p\s*2)\b/i, priority: 4 },
    { re: /\b(p3|p\s*3)\b/i, priority: 3 },
    { re: /\b(p4|p\s*4)\b/i, priority: 2 },
    { re: /\b(p5|p\s*5)\b/i, priority: 1 },
  ];
  for (const { re, priority } of matchers) {
    const m = input.match(re);
    if (m) {
      return { priority, remaining: input.replace(re, '').trim() };
    }
  }
  return null;
}

function inferEnergy(title: string): { energy: EnergyIntensity; matched: boolean } {
  const t = title.toLowerCase();
  // Deep — focus-intensive work
  const deepKeywords = ['research', 'design', 'write', 'writing', 'code', 'coding', 'study', 'thesis', 'paper', 'deep', 'analysis', 'develop', 'spec', 'architecture'];
  if (deepKeywords.some(k => t.includes(k))) return { energy: 'deep', matched: true };
  // Light — low-cognitive-demand tasks
  const lightKeywords = ['email', 'inbox', 'reply', 'admin', 'errand', 'lunch', 'break', 'walk', 'commute', 'shopping', 'call'];
  if (lightKeywords.some(k => t.includes(k))) return { energy: 'light', matched: true };
  // Moderate — meetings, reviews, planning
  const moderateKeywords = ['meeting', 'review', 'standup', 'sync', 'planning', 'one-on-one', '1:1', 'interview', 'demo'];
  if (moderateKeywords.some(k => t.includes(k))) return { energy: 'moderate', matched: true };
  return { energy: 'moderate', matched: false };
}

// ─────────────────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────────────────

function resolveDayWord(word: string, now: Date): Date | null {
  const w = word.trim().toLowerCase();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  if (w === 'today') return today;
  if (w === 'tomorrow') return addDays(today, 1);

  const dayIndex: Record<string, number> = {
    sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
    thursday: 4, friday: 5, saturday: 6,
  };

  // "next monday" — explicit "next" means SKIP this week's
  const nextMatch = w.match(/^next\s+(\w+)/);
  if (nextMatch) {
    const idx = dayIndex[nextMatch[1]];
    if (idx === undefined) return null;
    const target = nextDay(today, idx as 0 | 1 | 2 | 3 | 4 | 5 | 6);
    return target;
  }
  // "this monday" or just "monday" — next occurrence of that weekday
  const thisMatch = w.match(/^this\s+(\w+)/);
  const dayWord = thisMatch ? thisMatch[1] : w;
  const idx = dayIndex[dayWord];
  if (idx === undefined) return null;
  const todayIdx = today.getDay();
  let diff = idx - todayIdx;
  if (diff < 0) diff += 7;
  if (diff === 0 && !thisMatch) diff = 7; // "monday" on Monday means NEXT Monday
  return addDays(today, diff);
}

function cleanTitle(s: string): string {
  return s
    .replace(/\s+/g, ' ')
    .replace(/^[\s,;\-]+/, '')
    .replace(/[\s,;\-]+$/, '')
    .trim();
}

function formatLocal(date: Date): string {
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${mo}-${d}T${h}:${mi}:00`;
}
