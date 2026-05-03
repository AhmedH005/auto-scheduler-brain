/**
 * SettingsSheet — refactor of SettingsPanel from sidebar-replace pattern
 * to a right-slide sheet that floats over the canvas.
 *
 * Why: replacing the task list with a settings panel was context-loss UX —
 * users lost their place. A floating sheet preserves context and is the
 * industry standard (Linear, Notion, Things).
 *
 * Sectioned for scannability:
 *   1. Working hours — when AXIS schedules you
 *   2. Deep work window — your peak (with learned-curve hint)
 *   3. Daily caps — total + deep
 *   4. Block sizing — buffer + min chunk
 *   5. Footer: Calendar integrations + Reset
 */

import { Sheet } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ChevronRight, RotateCcw, Sunrise, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { UserSettings, DEFAULT_SETTINGS, EnergySuggestion } from '@/types/task';

interface SettingsSheetProps {
  open: boolean;
  onClose: () => void;
  settings: UserSettings;
  energyInsight?: EnergySuggestion;
  onUpdate: (updates: Partial<UserSettings>) => void;
  onApplyLearnedDeepWindow: () => void;
  onOpenIntegrations: () => void;
}

export function SettingsSheet({
  open,
  onClose,
  settings,
  energyInsight,
  onUpdate,
  onApplyLearnedDeepWindow,
  onOpenIntegrations,
}: SettingsSheetProps) {
  const { t } = useTranslation();

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('settings.title')}
      description="Tune how AXIS schedules your week and what it learns from."
    >
      <div className="px-5 py-4 space-y-6">
        <Section
          title="Working hours"
          subtitle="When AXIS is allowed to place tasks."
        >
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start">
              <Input
                type="time"
                value={settings.working_hours_start}
                onChange={e => onUpdate({ working_hours_start: e.target.value })}
                className="text-data"
              />
            </Field>
            <Field label="End">
              <Input
                type="time"
                value={settings.working_hours_end}
                onChange={e => onUpdate({ working_hours_end: e.target.value })}
                className="text-data"
              />
            </Field>
          </div>
        </Section>

        <Section
          title="Deep work window"
          subtitle="Your most-focused hours. Deep tasks are placed here first."
        >
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start">
              <Input
                type="time"
                value={settings.deep_window_start}
                onChange={e => onUpdate({ deep_window_start: e.target.value })}
                className="text-data"
              />
            </Field>
            <Field label="End">
              <Input
                type="time"
                value={settings.deep_window_end}
                onChange={e => onUpdate({ deep_window_end: e.target.value })}
                className="text-data"
              />
            </Field>
          </div>

          {/* Learned-curve nudge */}
          {energyInsight && energyInsight.shift_recommended && (
            <div className="mt-3 px-3 py-2.5 rounded-md bg-sky-500/8 border border-sky-500/20 flex items-start gap-2">
              <Sunrise className="w-3.5 h-3.5 text-sky-300 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-body text-sky-200 leading-tight">
                  History suggests {pad(energyInsight.suggested_start_hour)}:00–
                  {pad(energyInsight.suggested_end_hour)}:00
                </p>
                <p className="text-caption text-muted-foreground/65 leading-relaxed mt-0.5">
                  {energyInsight.reason}
                </p>
                <button
                  onClick={onApplyLearnedDeepWindow}
                  className="mt-1.5 text-[11px] font-medium text-sky-300 hover:text-sky-200 inline-flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3" />
                  Apply learned window
                </button>
              </div>
            </div>
          )}
        </Section>

        <Section
          title="Daily caps"
          subtitle="Hard ceilings on scheduled hours per day. Engine never crosses these."
        >
          <div className="grid grid-cols-2 gap-3">
            <Field label="Total hours">
              <Input
                type="number"
                min={1}
                max={16}
                value={settings.max_total_hours_per_day}
                onChange={e => onUpdate({ max_total_hours_per_day: Number(e.target.value) })}
                className="text-data"
              />
            </Field>
            <Field label="Deep hours">
              <Input
                type="number"
                min={1}
                max={10}
                value={settings.max_deep_hours_per_day}
                onChange={e => onUpdate({ max_deep_hours_per_day: Number(e.target.value) })}
                className="text-data"
              />
            </Field>
          </div>
        </Section>

        <Section
          title="Block sizing"
          subtitle="How tasks get split and spaced."
        >
          <div className="grid grid-cols-2 gap-3">
            <Field label="Buffer between blocks (min)">
              <Input
                type="number"
                min={0}
                max={60}
                value={settings.buffer_time}
                onChange={e => onUpdate({ buffer_time: Number(e.target.value) })}
                className="text-data"
              />
            </Field>
            <Field label="Min chunk size (min)">
              <Input
                type="number"
                min={5}
                max={120}
                value={settings.min_chunk_size}
                onChange={e => onUpdate({ min_chunk_size: Number(e.target.value) })}
                className="text-data"
              />
            </Field>
          </div>
        </Section>

        <div className="pt-2 border-t border-border space-y-1">
          <button
            onClick={onOpenIntegrations}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-md hover:bg-secondary/60 text-foreground transition-colors group"
          >
            <span className="text-body font-medium">Calendar integrations</span>
            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground" />
          </button>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-muted-foreground hover:text-destructive"
            onClick={() => onUpdate(DEFAULT_SETTINGS)}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset to defaults</span>
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

// ─────────────────────────────────────────────────────────────────────────
//  Subcomponents
// ─────────────────────────────────────────────────────────────────────────

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="text-heading text-foreground tracking-tight">{title}</h3>
      {subtitle && <p className="text-caption mt-0.5 leading-relaxed">{subtitle}</p>}
      <div className="mt-2.5">{children}</div>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-eyebrow">{label}</Label>
      {children}
    </div>
  );
}

const pad = (n: number) => String(n).padStart(2, '0');
