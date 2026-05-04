/**
 * TaskEditSheet — slide-in panel for both new tasks and existing-task edits.
 *
 * Single surface, two modes:
 *   • task is null   → "New task" header, TaskForm with default values.
 *   • task is a Task → "Edit task" header, TaskForm with initialTask=task.
 *
 * Width is "lg" (560px) — the form has 6+ rows, narrower felt cramped.
 * The Sheet primitive provides the slide animation, escape-to-close,
 * click-outside-to-close, and the rounded inner corner.
 */

import { Sheet } from '@/components/ui/sheet';
import { TaskForm } from '@/components/TaskForm';
import { Task, ScheduledBlock, DurationSuggestion } from '@/types/task';

interface TaskEditSheetProps {
  open: boolean;
  /** Pass null when creating a new task; the sheet renders an empty form. */
  task: Task | null;
  existingBlocks: ScheduledBlock[];
  existingTasks: Task[];
  onClose: () => void;
  onSubmit: (task: Task) => void;
  getDurationSuggestion?: (
    task: Pick<Task, 'id' | 'title' | 'total_duration' | 'energy_intensity'>
  ) => DurationSuggestion;
}

export function TaskEditSheet({
  open,
  task,
  existingBlocks,
  existingTasks,
  onClose,
  onSubmit,
  getDurationSuggestion,
}: TaskEditSheetProps) {
  const isEditing = !!task;
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={isEditing ? 'Edit task' : 'New task'}
      description={
        isEditing
          ? task!.title
            ? `Updating "${task!.title}"`
            : 'Updating untitled task'
          : 'Add it to the inbox — axis will place it'
      }
      size="lg"
    >
      <TaskForm
        initialTask={task ?? undefined}
        onSubmit={t => {
          onSubmit(t);
          onClose();
        }}
        onClose={onClose}
        existingBlocks={existingBlocks}
        existingTasks={existingTasks}
        getDurationSuggestion={getDurationSuggestion}
      />
    </Sheet>
  );
}
