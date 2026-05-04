/**
 * axis assistant — turns natural language into scheduler intents.
 *
 * For now this is deterministic pattern matching (fast, free, predictable).
 * The shape is designed to be drop-in replaceable with an LLM call once
 * we wire ANTHROPIC_API_KEY — same input, same output type, just smarter
 * intent detection for ambiguous phrasings.
 *
 * Why not LLM-first today:
 *   - latency: deterministic = 0ms. LLM = 800ms+.
 *   - reliability: regex never hallucinates a fake task.
 *   - cost: $0 vs $0.001/turn (small but non-zero at scale).
 *
 * The deterministic layer covers the obvious commands. The LLM is the
 * planned safety net for the long tail ("help me think about this week",
 * "I'm overwhelmed", etc.). For now, those fall into 'unknown' and axis
 * politely says it didn't catch the intent.
 */

import { parseQuickAdd, ParsedTask } from './quickadd-parser';

export type AssistantIntent =
  | { kind: 'add'; task: ParsedTask }
  | { kind: 'complete'; query: string }
  | { kind: 'skip'; query: string }
  | { kind: 'delete'; query: string }
  | { kind: 'replan'; scope: 'now' | 'today' }
  | { kind: 'undo' }
  | { kind: 'ease' }
  | { kind: 'push' }
  | { kind: 'query_now' }
  | { kind: 'query_next' }
  | { kind: 'query_today' }
  | { kind: 'query_week' }
  | { kind: 'show_tasks' }
  | { kind: 'show_calendar' }
  | { kind: 'show_insights' }
  | { kind: 'show_settings' }
  | { kind: 'show_integrations' }
  | { kind: 'unknown'; raw: string };

export interface AssistantTurn {
  intent: AssistantIntent;
  /** What axis says back. Empty string means: render the result some
   *  other way (the page handles 'query_*' intents specially). */
  speech: string;
}

const RX = {
  replan: /^(replan|reschedule|fix\s+(?:my\s+)?schedule|optimi[sz]e\s+(?:my\s+)?(?:day|schedule))/i,
  undo: /^(undo|revert|wait[, ]+no|never\s*mind)\b/i,
  done: /^(?:i\s+(?:just\s+)?finished|i'?m\s+done\s+with|done\s+with|completed?|finished)\s+(.+)/i,
  skip: /^(?:skip(?:ping)?|drop|cancel\s+for\s+now)\s+(.+)/i,
  remove: /^(?:remove|delete|cancel|kill|nix)\s+(.+)/i,
  ease: /\b(easy|light|chill|low[\s-]?key|short)\s+day\b/i,
  push: /\b(heavy|big|full|long|crank|grind)\s+day\b/i,
  qNow: /\b(what'?s?\s+(?:happening\s+)?(?:right\s+)?now|what\s+am\s+i\s+(?:on|doing))\b/i,
  qNext: /\b(what'?s?\s+(?:up\s+)?next|coming\s+up|after\s+this)\b/i,
  qToday: /\b(what'?s?\s+(?:on\s+)?today|today'?s?\s+plan|plan\s+(?:for\s+)?today)\b/i,
  qWeek: /\b(this\s+week|week\s+ahead|week\s+plan)\b/i,
  showTasks: /^(show|open|see)\s+(?:all\s+)?(tasks|task\s+list|inbox|backlog)\b/i,
  showCalendar: /^(show|open|see)\s+(calendar|grid|week|schedule)\b/i,
  showInsights: /^(show|open|see)\s+(insights?|stats?|analytics|retro(?:spective)?|report)\b/i,
  showSettings: /^(show|open|see)\s+settings?\b/i,
  showIntegrations: /^(show|open|see|connect)\s+(integrations?|google|calendars?)\b/i,
};

export function interpret(input: string, now = new Date()): AssistantTurn {
  const trimmed = input.trim();
  const lower = trimmed.toLowerCase();

  // Action commands first — they take priority over add-by-default.
  if (RX.replan.test(lower)) {
    const scope = lower.includes('now') ? 'now' : 'today';
    return {
      intent: { kind: 'replan', scope },
      speech: scope === 'now' ? 'Replanning from this moment.' : 'Rebuilding the day.',
    };
  }

  if (RX.undo.test(lower)) {
    return { intent: { kind: 'undo' }, speech: 'Reverted.' };
  }

  let m: RegExpMatchArray | null;
  if ((m = trimmed.match(RX.done))) {
    return { intent: { kind: 'complete', query: m[1] }, speech: 'Marked done. Recomputing.' };
  }
  if ((m = trimmed.match(RX.skip))) {
    return { intent: { kind: 'skip', query: m[1] }, speech: 'Skipped — engine has clean signal.' };
  }
  if ((m = trimmed.match(RX.remove))) {
    return { intent: { kind: 'delete', query: m[1] }, speech: 'Removed.' };
  }

  if (RX.ease.test(lower)) {
    return { intent: { kind: 'ease' }, speech: 'Easing today. Cap halved, deep blocks pruned.' };
  }
  if (RX.push.test(lower)) {
    return { intent: { kind: 'push' }, speech: 'Heavier day. Cap raised, more deep work.' };
  }

  if (RX.qNow.test(lower)) return { intent: { kind: 'query_now' }, speech: '' };
  if (RX.qNext.test(lower)) return { intent: { kind: 'query_next' }, speech: '' };
  if (RX.qToday.test(lower)) return { intent: { kind: 'query_today' }, speech: '' };
  if (RX.qWeek.test(lower)) return { intent: { kind: 'query_week' }, speech: '' };

  if (RX.showTasks.test(lower)) return { intent: { kind: 'show_tasks' }, speech: 'Opening tasks.' };
  if (RX.showCalendar.test(lower)) return { intent: { kind: 'show_calendar' }, speech: 'Opening calendar.' };
  if (RX.showInsights.test(lower)) return { intent: { kind: 'show_insights' }, speech: 'Opening insights.' };
  if (RX.showSettings.test(lower)) return { intent: { kind: 'show_settings' }, speech: 'Opening settings.' };
  if (RX.showIntegrations.test(lower)) return { intent: { kind: 'show_integrations' }, speech: 'Opening integrations.' };

  // Default: try to add a task. The parser is forgiving — anything it
  // can't pin down stays as the title, so "buy milk" becomes a 30-min
  // moderate task with title "buy milk".
  const parsed = parseQuickAdd(trimmed, now);
  if (!parsed.title || parsed.title.length === 0) {
    return {
      intent: { kind: 'unknown', raw: trimmed },
      speech: 'Hmm, didn\'t catch that. Try: "read paper 90m friday" · "what\'s next" · "I finished standup".',
    };
  }
  return { intent: { kind: 'add', task: parsed }, speech: buildAddSpeech(parsed) };
}

function buildAddSpeech(p: ParsedTask): string {
  const meta: string[] = [];
  if (p.matched.duration) meta.push(`${p.duration}m`);
  if (p.matched.fixed_time && p.start_datetime) {
    meta.push(`fixed ${p.start_datetime.slice(11, 16)}`);
  }
  if (p.matched.deadline && p.deadline) meta.push(`due ${p.deadline.slice(5)}`);
  if (p.matched.recurring && p.recurring) meta.push(p.recurring.pattern);
  if (p.matched.priority && p.priority >= 4) meta.push('priority high');
  const tail = meta.length > 0 ? ` (${meta.join(' · ')})` : '';
  return `Added "${p.title}"${tail}. Slotting it in.`;
}
