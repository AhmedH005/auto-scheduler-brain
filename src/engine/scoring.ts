import { Task, EnergyIntensity } from '@/types/task';

export const URGENCY_WEIGHT    = 3;
export const IMPORTANCE_WEIGHT = 2;
export const ENERGY_WEIGHT     = 1.5;

// morning 06–12 → deep, afternoon 12–17 → moderate, evening 17+ → light
function slotEnergyLevel(hour: number): EnergyIntensity {
  if (hour >= 6 && hour < 12) return 'deep';
  if (hour >= 12 && hour < 17) return 'moderate';
  return 'light';
}

function energyMatchScore(taskEnergy: EnergyIntensity, slotHour: number): number {
  const ORDER: EnergyIntensity[] = ['deep', 'moderate', 'light'];
  const slotEnergy = slotEnergyLevel(slotHour);
  if (taskEnergy === slotEnergy) return 1;
  const diff = Math.abs(ORDER.indexOf(taskEnergy) - ORDER.indexOf(slotEnergy));
  return diff === 1 ? 0.5 : 0;
}

// Urgency: 0.1 baseline for no-deadline tasks, up to 1.0 for overdue/today
function urgencyScore(task: Task): number {
  if (!task.deadline) return 0.1;
  const daysUntil = (new Date(task.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  if (daysUntil <= 0) return 1;
  return Math.max(0.1, Math.min(1, 1 / (daysUntil + 1)));
}

// Importance: priority [1–5] normalised to [0–1]
function importanceScore(task: Task): number {
  return (task.priority - 1) / 4;
}

export function calculateScore(task: Task, slotHour?: number): number {
  const urgency    = urgencyScore(task);
  const importance = importanceScore(task);
  const energy     = slotHour !== undefined
    ? energyMatchScore(task.energy_intensity ?? 'moderate', slotHour)
    : 0;

  return (urgency    * URGENCY_WEIGHT)
       + (importance * IMPORTANCE_WEIGHT)
       + (energy     * ENERGY_WEIGHT);
}

export function sortByScore(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => calculateScore(b) - calculateScore(a));
}

// ─────────────────────────────────────────────────────────────────────────
//  Score breakdown — the "why is this block here?" surface
// ─────────────────────────────────────────────────────────────────────────

export interface ScoreComponent {
  /** Raw [0..1] component value before weighting. */
  value: number;
  /** Weight applied. */
  weight: number;
  /** Human-readable explanation of THIS task's value. */
  reason: string;
}

export interface ScoreBreakdown {
  urgency: ScoreComponent;
  importance: ScoreComponent;
  energy: ScoreComponent | null; // null when slotHour unknown
  total: number;
}

function urgencyReason(task: Task): string {
  if (!task.deadline) return 'No deadline — baseline urgency';
  const daysUntil = Math.ceil(
    (new Date(task.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
  if (daysUntil < 0) return `Overdue by ${Math.abs(daysUntil)} day${Math.abs(daysUntil) > 1 ? 's' : ''}`;
  if (daysUntil === 0) return 'Due today';
  if (daysUntil === 1) return 'Due tomorrow';
  return `Due in ${daysUntil} day${daysUntil > 1 ? 's' : ''}`;
}

function importanceReason(task: Task): string {
  return `Priority ${task.priority} of 5`;
}

function energyReason(task: Task, slotHour: number): string {
  const taskE = task.energy_intensity ?? 'moderate';
  const slotE = slotEnergyLevel(slotHour);
  if (taskE === slotE) return `${taskE} task in ${slotE} slot — perfect match`;
  const distance = Math.abs(
    (['deep', 'moderate', 'light'] as const).indexOf(taskE) -
    (['deep', 'moderate', 'light'] as const).indexOf(slotE)
  );
  if (distance === 1) return `${taskE} task in ${slotE} slot — adjacent zone`;
  return `${taskE} task in ${slotE} slot — mismatched zone`;
}

export function scoreBreakdown(task: Task, slotHour?: number): ScoreBreakdown {
  const urgency = urgencyScore(task);
  const importance = importanceScore(task);
  const energy = slotHour !== undefined
    ? energyMatchScore(task.energy_intensity ?? 'moderate', slotHour)
    : null;

  const urgencyComp: ScoreComponent = {
    value: urgency,
    weight: URGENCY_WEIGHT,
    reason: urgencyReason(task),
  };
  const importanceComp: ScoreComponent = {
    value: importance,
    weight: IMPORTANCE_WEIGHT,
    reason: importanceReason(task),
  };
  const energyComp: ScoreComponent | null = energy !== null && slotHour !== undefined
    ? {
        value: energy,
        weight: ENERGY_WEIGHT,
        reason: energyReason(task, slotHour),
      }
    : null;

  const total =
    urgencyComp.value * urgencyComp.weight +
    importanceComp.value * importanceComp.weight +
    (energyComp ? energyComp.value * energyComp.weight : 0);

  return {
    urgency: urgencyComp,
    importance: importanceComp,
    energy: energyComp,
    total,
  };
}
