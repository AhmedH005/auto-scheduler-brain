/**
 * TaskEditSheet — replaces the sidebar-replacing edit panel pattern.
 *
 * When the user clicks an existing task, this sheet slides in from the
 * right, holding the full TaskForm. The sidebar task list stays put,
 * preserving context. Apply or close — your place in the list isn't lost.
 *
 * Why a sheet not a modal: editing has many fields (priority, recurrence,
 * deadline, energy, execution, color, description). A modal-modal would
 * feel cramped. The right-slide sheet gives breathing room and uses
 * the same primitive as Settings/Integrations for consistency.
 */

import { Sheet } from '@/components/ui/sheet';
import { TaskForm } from '@/components/TaskForm';
import { Task, ScheduledBlock, DurationSuggestion } from '@/types/task';

interface TaskEditSheetProps {
  open: boolean;
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
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Edit task"
      description={task?.title ? `Updating "${task.title}"` : undefined}
      size="md"
    >
      {task && (
        <TaskForm
          initialTask={task}
          onSubmit={(t) => {
            onSubmit(t);
            onClose();
          }}
          onClose={onClose}
          existingBlocks={existingBlocks}
          existingTasks={existingTasks}
          getDurationSuggestion={getDurationSuggestion}
        />
      )}
    </Sheet>
  );
}
