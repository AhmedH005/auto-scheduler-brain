import { UserSettings, DEFAULT_SETTINGS } from '@/types/task';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Settings, X, CalendarDays } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface SettingsPanelProps {
  settings: UserSettings;
  onUpdate: (updates: Partial<UserSettings>) => void;
  onClose: () => void;
  onOpenIntegrations: () => void;
}

export function SettingsPanel({ settings, onUpdate, onClose, onOpenIntegrations }: SettingsPanelProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-4 animate-slide-in">
      <div className="flex items-center justify-between">
        <h3 className="font-mono text-sm font-semibold text-primary tracking-wider uppercase flex items-center gap-1.5">
          <Settings className="w-3.5 h-3.5" />
          {t('settings.title')}
        </h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-[10px] font-mono text-muted-foreground">{t('settings.workStart')}</Label>
          <Input
            type="time"
            value={settings.working_hours_start}
            onChange={e => onUpdate({ working_hours_start: e.target.value })}
            className="bg-secondary border-border font-mono text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] font-mono text-muted-foreground">{t('settings.workEnd')}</Label>
          <Input
            type="time"
            value={settings.working_hours_end}
            onChange={e => onUpdate({ working_hours_end: e.target.value })}
            className="bg-secondary border-border font-mono text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] font-mono text-muted-foreground">{t('settings.deepStart')}</Label>
          <Input
            type="time"
            value={settings.deep_window_start}
            onChange={e => onUpdate({ deep_window_start: e.target.value })}
            className="bg-secondary border-border font-mono text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] font-mono text-muted-foreground">{t('settings.deepEnd')}</Label>
          <Input
            type="time"
            value={settings.deep_window_end}
            onChange={e => onUpdate({ deep_window_end: e.target.value })}
            className="bg-secondary border-border font-mono text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-[10px] font-mono text-muted-foreground">{t('settings.bufferMin')}</Label>
          <Input
            type="number"
            value={settings.buffer_time}
            onChange={e => onUpdate({ buffer_time: Number(e.target.value) })}
            className="bg-secondary border-border font-mono text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] font-mono text-muted-foreground">{t('settings.maxDeepHrs')}</Label>
          <Input
            type="number"
            value={settings.max_deep_hours_per_day}
            onChange={e => onUpdate({ max_deep_hours_per_day: Number(e.target.value) })}
            className="bg-secondary border-border font-mono text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] font-mono text-muted-foreground">{t('settings.maxTotalHrs')}</Label>
          <Input
            type="number"
            value={settings.max_total_hours_per_day}
            onChange={e => onUpdate({ max_total_hours_per_day: Number(e.target.value) })}
            className="bg-secondary border-border font-mono text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] font-mono text-muted-foreground">{t('settings.minChunk')}</Label>
          <Input
            type="number"
            value={settings.min_chunk_size}
            onChange={e => onUpdate({ min_chunk_size: Number(e.target.value) })}
            className="bg-secondary border-border font-mono text-sm"
          />
        </div>
      </div>

      <Button
        variant="outline"
        size="sm"
        className="font-mono text-xs"
        onClick={() => onUpdate(DEFAULT_SETTINGS)}
      >
        {t('settings.resetDefaults')}
      </Button>

      <div className="border-t border-border pt-3">
        <Button
          variant="ghost"
          size="sm"
          className="w-full font-mono text-xs gap-2 justify-start text-muted-foreground hover:text-foreground"
          onClick={onOpenIntegrations}
        >
          <CalendarDays className="w-3.5 h-3.5" />
          {t('settings.calendarIntegrations')}
        </Button>
      </div>
    </div>
  );
}
