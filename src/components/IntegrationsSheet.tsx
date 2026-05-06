/**
 * IntegrationsSheet — wraps the existing CalendarIntegrationsPanel in
 * the Sheet primitive so the user can connect external calendars
 * without losing their place. Now also exposes the universal-interop
 * .ics export — works with Apple Calendar / Outlook / Fantastical /
 * Notion Calendar / Cron / Thunderbird, anything that consumes
 * RFC 5545. Closes the "no Outlook integration" gap without writing
 * an Outlook-specific adapter.
 */

import { Sheet } from '@/components/ui/sheet';
import { CalendarIntegrationsPanel } from '@/components/CalendarIntegrationsPanel';
import { ConnectedCalendarAccount, ExternalCalendar } from '@/types/calendar';
import { ScheduledBlock, Task } from '@/types/task';
import { SyncStatus } from '@/hooks/useExternalCalendars';
import { exportBlocksToIcs, downloadIcsFile } from '@/lib/icalExport';
import { Download, FileDown } from 'lucide-react';
import { toast } from 'sonner';

interface IntegrationsSheetProps {
  open: boolean;
  onClose: () => void;
  accounts: ConnectedCalendarAccount[];
  calendars: ExternalCalendar[];
  syncStatus: SyncStatus;
  syncError: string | null;
  onConnectGoogle: () => void;
  onSyncAccount: (accountId: string) => void;
  onDisconnectAccount: (accountId: string) => void;
  onToggleCalendar: (calendarId: string, enabled: boolean) => void;
  /** Current schedule + tasks — used by the .ics export. */
  blocks: ScheduledBlock[];
  tasks: Task[];
}

export function IntegrationsSheet({
  open,
  onClose,
  accounts,
  calendars,
  syncStatus,
  syncError,
  onConnectGoogle,
  onSyncAccount,
  onDisconnectAccount,
  onToggleCalendar,
  blocks,
  tasks,
}: IntegrationsSheetProps) {
  const handleExport = () => {
    if (blocks.length === 0) {
      toast.error('Nothing to export', {
        description: 'Schedule at least one block first.',
      });
      return;
    }
    const ics = exportBlocksToIcs({ blocks, tasks });
    const filename = `axis-${new Date().toISOString().slice(0, 10)}.ics`;
    downloadIcsFile(ics, filename);
    toast.success(`Exported ${blocks.length} blocks`, {
      description: `Open ${filename} with any calendar app.`,
    });
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Integrations"
      description="Connect external calendars or export your schedule."
    >
      <div className="px-5 py-4 space-y-5">
        {/* Live sync — read-only Google */}
        <CalendarIntegrationsPanel
          accounts={accounts}
          calendars={calendars}
          syncStatus={syncStatus}
          syncError={syncError}
          onClose={onClose}
          onConnectGoogle={onConnectGoogle}
          onSyncAccount={onSyncAccount}
          onDisconnectAccount={onDisconnectAccount}
          onToggleCalendar={onToggleCalendar}
        />

        {/* Universal export — opens AXIS to any calendar app via .ics */}
        <section className="border-t border-border pt-4">
          <div className="flex items-center gap-2 mb-2">
            <FileDown className="w-3.5 h-3.5 text-muted-foreground/70" />
            <h3 className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground/75">
              Universal export
            </h3>
          </div>
          <p className="text-[12px] text-muted-foreground/70 mb-3 leading-relaxed">
            Download your current schedule as a standard{' '}
            <code className="text-[11px] px-1 rounded bg-secondary/40">.ics</code>{' '}
            file. Import into Apple Calendar, Outlook, Fantastical,
            Notion Calendar, Cron, Thunderbird — any tool that handles
            iCalendar. One-shot snapshot, not live sync.
          </p>
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-2 px-4 h-9 rounded-lg bg-secondary/50 border border-border text-[12px] font-medium text-foreground/85 hover:bg-secondary/75 active:scale-[0.98] transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            Download .ics ({blocks.length} block{blocks.length === 1 ? '' : 's'})
          </button>
          <div className="mt-3 grid grid-cols-3 gap-2 text-[10px] font-mono text-muted-foreground/55">
            <div className="px-2 py-1.5 rounded bg-secondary/25 border border-border/60">
              ✓ Apple Calendar
            </div>
            <div className="px-2 py-1.5 rounded bg-secondary/25 border border-border/60">
              ✓ Outlook / 365
            </div>
            <div className="px-2 py-1.5 rounded bg-secondary/25 border border-border/60">
              ✓ Cron / Notion Cal
            </div>
          </div>
        </section>
      </div>
    </Sheet>
  );
}
