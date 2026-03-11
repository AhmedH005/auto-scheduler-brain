import { useState } from 'react';
import { RefreshCw, Link2, Link2Off, X, Calendar, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { ConnectedCalendarAccount, ExternalCalendar } from '@/types/calendar';
import { SyncStatus } from '@/hooks/useExternalCalendars';
import { isGoogleConfigured, setDevClientIdOverride } from '@/lib/googleCalendar';
import { GoogleIcon } from '@/components/GoogleIcon';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';

interface CalendarIntegrationsPanelProps {
  accounts:           ConnectedCalendarAccount[];
  calendars:          ExternalCalendar[];
  syncStatus:         SyncStatus;
  syncError:          string | null;
  onClose:            () => void;
  onConnectGoogle:    () => void;
  onSyncAccount:      (accountId: string) => void;
  onDisconnectAccount:(accountId: string) => void;
  onToggleCalendar:   (calendarId: string, enabled: boolean) => void;
}

function AccountCard({
  account,
  calendars,
  syncStatus,
  onSync,
  onDisconnect,
  onToggle,
}: {
  account:    ConnectedCalendarAccount;
  calendars:  ExternalCalendar[];
  syncStatus: SyncStatus;
  onSync:     () => void;
  onDisconnect: () => void;
  onToggle:   (id: string, enabled: boolean) => void;
}) {
  const isSyncing = syncStatus === 'syncing';
  const accountCals = calendars.filter(c => c.connected_account_id === account.id);

  return (
    <div className="rounded-md border border-border bg-background/60 overflow-hidden">
      {/* Account header */}
      <div className="flex items-center gap-2.5 px-3 py-2.5 border-b border-border/50">
        {account.avatar_url ? (
          <img src={account.avatar_url} alt="" className="w-6 h-6 rounded-full shrink-0" />
        ) : (
          <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center shrink-0">
            <GoogleIcon size={12} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-xs font-sans font-medium text-foreground truncate">{account.provider_account_email}</div>
          {account.last_synced_at && (
            <div className="text-[10px] font-mono text-muted-foreground">
              Synced {format(new Date(account.last_synced_at), 'MMM d, HH:mm')}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onSync}
            disabled={isSyncing}
            className="p-1 rounded-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-40"
            title="Sync now"
          >
            <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={onDisconnect}
            className="p-1 rounded-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            title="Disconnect"
          >
            <Link2Off className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Calendar list */}
      {accountCals.length > 0 && (
        <div className="divide-y divide-border/30">
          {accountCals.map(cal => (
            <div key={cal.id} className="flex items-center gap-2 px-3 py-1.5">
              <div
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: cal.color ?? '#6b7280' }}
              />
              <span className="flex-1 text-[11px] font-sans text-foreground truncate">
                {cal.name}
                {cal.is_primary && (
                  <span className="ml-1 text-[9px] font-mono text-primary opacity-70">primary</span>
                )}
              </span>
              <Switch
                checked={cal.is_enabled}
                onCheckedChange={v => onToggle(cal.id, v)}
                className="scale-75 origin-right"
              />
            </div>
          ))}
        </div>
      )}

      {accountCals.length === 0 && (
        <div className="px-3 py-2 text-[10px] font-mono text-muted-foreground/60 italic">
          No calendars found — try syncing.
        </div>
      )}
    </div>
  );
}

export function CalendarIntegrationsPanel({
  accounts,
  calendars,
  syncStatus,
  syncError,
  onClose,
  onConnectGoogle,
  onSyncAccount,
  onDisconnectAccount,
  onToggleCalendar,
}: CalendarIntegrationsPanelProps) {
  const { t } = useTranslation();
  const [googleConfigured, setGoogleConfigured] = useState(isGoogleConfigured);
  const [devIdInput, setDevIdInput] = useState('');
  const isConnecting = syncStatus === 'connecting';
  const isSyncing    = syncStatus === 'syncing';
  const busy         = isConnecting || isSyncing;

  const handleSetDevId = () => {
    setDevClientIdOverride(devIdInput.trim());
    setGoogleConfigured(isGoogleConfigured());
    setDevIdInput('');
  };

  return (
    <div className="flex flex-col gap-4 animate-slide-in">
      {/* Header */}
      <div className="flex items-center justify-between pb-1.5 border-b border-border">
        <h3 className="font-mono text-xs font-semibold text-primary tracking-widest uppercase flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5" />
          {t('calendarIntegrations.title')}
        </h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Not configured notice */}
      {!googleConfigured && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-[11px] font-sans text-amber-400 space-y-1.5">
          <div className="font-semibold flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" />
            {t('calendarIntegrations.notConfigured')}
          </div>
          <p className="text-amber-400/80 leading-relaxed">
            {t('calendarIntegrations.notConfiguredDesc')}
          </p>
          <code className="block mt-1 bg-background/40 rounded px-2 py-1 text-[10px] font-mono text-foreground/80">
            VITE_GOOGLE_CLIENT_ID=your-client-id
          </code>
          {import.meta.env.DEV && (
            <div className="pt-1.5 space-y-1.5 border-t border-amber-500/20">
              <p className="text-amber-400/60 text-[10px]">Dev shortcut — paste your Client ID to skip server restart:</p>
              <div className="flex gap-1.5">
                <Input
                  value={devIdInput}
                  onChange={e => setDevIdInput(e.target.value)}
                  placeholder="…apps.googleusercontent.com"
                  className="flex-1 h-6 text-[10px] font-mono bg-background/40 border-amber-500/30 text-foreground placeholder:text-muted-foreground/40 px-2"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 px-2 text-[10px] font-mono border-amber-500/30 text-amber-400 hover:bg-amber-500/10 shrink-0"
                  onClick={handleSetDevId}
                  disabled={!devIdInput.trim()}
                >
                  Set
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Status messages */}
      {syncStatus === 'error' && syncError && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2.5 text-[11px] font-sans text-destructive flex items-start gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{syncError}</span>
        </div>
      )}
      {busy && (
        <div className="flex items-center gap-2 text-[11px] font-mono text-muted-foreground">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          {isConnecting ? t('calendarIntegrations.connecting') : t('calendarIntegrations.syncing')}
        </div>
      )}

      {/* Connected accounts */}
      {accounts.length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-primary" />
            {t('calendarIntegrations.connectedAccounts')}
          </div>
          {accounts.map(account => (
            <AccountCard
              key={account.id}
              account={account}
              calendars={calendars}
              syncStatus={syncStatus}
              onSync={() => onSyncAccount(account.id)}
              onDisconnect={() => onDisconnectAccount(account.id)}
              onToggle={onToggleCalendar}
            />
          ))}
        </div>
      )}

      {/* Connect Google button */}
      {googleConfigured && (
        <Button
          variant="outline"
          size="sm"
          className="w-full font-mono text-xs gap-2 h-8"
          onClick={onConnectGoogle}
          disabled={busy}
        >
          <Link2 className="w-3.5 h-3.5" />
          <GoogleIcon size={13} />
          {accounts.some(a => a.provider === 'google')
            ? t('calendarIntegrations.addAnotherGoogle')
            : t('calendarIntegrations.connectGoogle')}
        </Button>
      )}

      {/* Info note */}
      <p className="text-[10px] font-sans text-muted-foreground/60 leading-relaxed">
        {t('calendarIntegrations.note')}
      </p>
    </div>
  );
}
