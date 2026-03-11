import { Task } from '@/types/task';

export function calculateScore(task: Task): number {
  const priority = task.priority;
  let deadlineWeight = 1;

  if (task.deadline) {
    const now = new Date();
    const deadline = new Date(task.deadline);
    const daysUntil = Math.max(0, (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    deadlineWeight = 1 / (daysUntil + 1);
  }

  return priority * deadlineWeight;
}

export function sortByScore(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => calculateScore(b) - calculateScore(a));
}
