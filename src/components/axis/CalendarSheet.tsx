/**
 * CalendarSheet — the week-grid lens.
 *
 * The home surface (week ribbon + now + flow + composer) is the
 * conversation-first daily driver. But there are moments — moving
 * three blocks across the week, scanning conflicts, eyeballing where
 * Tuesday afternoon's hole is — when a calendar grid is just faster.
 *
 * This sheet wraps the existing WeekView grid (drag-to-move, lock,
 * resize, complete) and surfaces it on demand. Not a tab. Not a mode.
 * Just a lens you open when you need it.
 */

import { Sheet } from '@/components/ui/sheet';
import { WeekView } from '@/components/WeekView';
import { Task, ScheduledBlock, UserSettings } from '@/types/task';

interface CalendarSheetProps {
  open: boolean;
  onClose: () => void;
  blocks: ScheduledBlock[];
  tasks: Task[];
  settings: UserSettings;
  onMoveBlock: (id: string, start: string, end: string) => void;
  onResizeBlock: (id: string, end: string) => void;
  onLockBlock: (id: string) => void;
  onUnlockBlock: (id: string) => void;
  onDeleteBlock: (id: string) => void;
  onMarkDone: (id: string) => void;
  onMarkSkipped: (id: string) => void;
  onQuickAdd: (date: string, time: string) => void;
}

export function CalendarSheet({
  open,
  onClose,
  blocks,
  tasks,
  settings,
  onMoveBlock,
  onResizeBlock,
  onLockBlock,
  onUnlockBlock,
  onDeleteBlock,
  onMarkDone,
  onMarkSkipped,
  onQuickAdd,
}: CalendarSheetProps) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="calendar"
      description="drag to move · click empty to add · ⌘ + drag to resize"
      size="lg"
    >
      <div className="px-2 py-2 h-full">
        <WeekView
          blocks={blocks}
          tasks={tasks}
          settings={settings}
          onMoveBlock={onMoveBlock}
          onResizeBlock={onResizeBlock}
          onLockBlock={onLockBlock}
          onUnlockBlock={onUnlockBlock}
          onDeleteBlock={onDeleteBlock}
          onQuickAdd={(d, t) => {
            onQuickAdd(d, t);
            onClose();
          }}
          onMarkDone={onMarkDone}
          onMarkSkipped={onMarkSkipped}
        />
      </div>
    </Sheet>
  );
}
