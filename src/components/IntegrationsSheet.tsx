/**
 * IntegrationsSheet — wraps the existing CalendarIntegrationsPanel in
 * the Sheet primitive so the user can connect Google Calendar without
 * losing their place in the task list.
 */

import { Sheet } from '@/components/ui/sheet';
import { CalendarIntegrationsPanel } from '@/components/CalendarIntegrationsPanel';
import { ConnectedCalendarAccount, ExternalCalendar } from '@/types/calendar';
import { SyncStatus } from '@/hooks/useExternalCalendars';

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
}: IntegrationsSheetProps) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Calendar integrations"
      description="Connect external calendars. AXIS reads them — never writes back."
    >
      <div className="px-5 py-4">
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
      </div>
    </Sheet>
  );
}
