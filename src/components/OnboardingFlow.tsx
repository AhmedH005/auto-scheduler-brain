/**
 * OnboardingFlow — the first-run experience.
 *
 * Triggers when the user has no tasks AND no completion log (true
 * first-run, not an emptied-out account). Three lightweight steps that
 * set the most important defaults the engine cares about:
 *
 *   1. Welcome — what AXIS is, what it isn't (sets expectations)
 *   2. Working hours quick-set — when does your day start/end?
 *   3. Energy archetype quick-set — morning person / mixed / night owl
 *
 * Optionally seeds the user with a sample task after step 3 so the
 * empty-calendar feeling resolves immediately.
 *
 * Skippable at any step. Stored in localStorage so it doesn't re-trigger
 * after the user closes it (even with empty state).
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain,
  Sunrise,
  Coffee,
  Moon,
  ArrowRight,
  X,
  Check,
  Sparkles,
  Lock,
  ShieldCheck,
  Eye,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Task, UserSettings } from '@/types/task';

const ONBOARDING_KEY = 'axis_onboarded_v1';

interface OnboardingFlowProps {
  /** Force-show the onboarding (e.g. via "Show tour" command). When false,
   *  the component decides for itself based on localStorage + empty state. */
  forceOpen?: boolean;
  /** Empty state — only render onboarding when both true. */
  hasNoTasks: boolean;
  hasNoHistory: boolean;
  settings: UserSettings;
  onUpdateSettings: (updates: Partial<UserSettings>) => void;
  onAddSampleTask: (task: Partial<Task>) => void;
  onClose?: () => void;
}

type EnergyArchetype = 'morning' | 'mixed' | 'night';

const ARCHETYPE_PRESETS: Record<
  EnergyArchetype,
  { working: { start: string; end: string }; deep: { start: string; end: string }; label: string; description: string }
> = {
  morning: {
    label: 'Morning person',
    description: 'Peak focus before noon. Deep window 06:00–11:00.',
    working: { start: '06:00', end: '17:00' },
    deep: { start: '06:00', end: '11:00' },
  },
  mixed: {
    label: 'Mixed / standard',
    description: 'Solid morning + post-lunch dip. Deep window 09:00–12:00.',
    working: { start: '08:00', end: '18:00' },
    deep: { start: '09:00', end: '12:00' },
  },
  night: {
    label: 'Night owl',
    description: 'Best hours after dinner. Deep window 19:00–23:00.',
    working: { start: '10:00', end: '23:00' },
    deep: { start: '19:00', end: '23:00' },
  },
};

export function OnboardingFlow({
  forceOpen,
  hasNoTasks,
  hasNoHistory,
  settings,
  onUpdateSettings,
  onAddSampleTask,
  onClose,
}: OnboardingFlowProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0);
  const [archetype, setArchetype] = useState<EnergyArchetype>('mixed');
  const [workingStart, setWorkingStart] = useState(settings.working_hours_start);
  const [workingEnd, setWorkingEnd] = useState(settings.working_hours_end);

  // Decide visibility
  useEffect(() => {
    if (forceOpen) {
      setOpen(true);
      setStep(0);
      return;
    }
    const onboarded = localStorage.getItem(ONBOARDING_KEY);
    if (!onboarded && hasNoTasks && hasNoHistory) {
      // Defer slightly so the page chrome paints first
      const t = setTimeout(() => setOpen(true), 600);
      return () => clearTimeout(t);
    }
  }, [forceOpen, hasNoTasks, hasNoHistory]);

  const finish = (skipped: boolean) => {
    localStorage.setItem(ONBOARDING_KEY, JSON.stringify({ at: new Date().toISOString(), skipped }));
    setOpen(false);
    onClose?.();
  };

  const applyArchetype = (a: EnergyArchetype) => {
    const preset = ARCHETYPE_PRESETS[a];
    setArchetype(a);
    setWorkingStart(preset.working.start);
    setWorkingEnd(preset.working.end);
  };

  const goNext = () => {
    if (step === 2) {
      // Apply the gathered settings
      const preset = ARCHETYPE_PRESETS[archetype];
      onUpdateSettings({
        working_hours_start: workingStart,
        working_hours_end: workingEnd,
        deep_window_start: preset.deep.start,
        deep_window_end: preset.deep.end,
      });
      setStep(3);
    } else if (step === 3) {
      finish(false);
    } else {
      setStep((step + 1) as 0 | 1 | 2);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[70] bg-background/80 backdrop-blur-md"
            aria-hidden="true"
          />
          <motion.div
            key="dialog"
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 260, damping: 26 }}
            role="dialog"
            aria-modal="true"
            aria-label="Welcome to AXIS"
            className="fixed inset-0 z-[71] flex items-center justify-center p-4 pointer-events-none"
          >
            <div className="relative w-full max-w-[480px] bg-card border border-border rounded-lg shadow-2xl overflow-hidden pointer-events-auto">
              {/* Skip */}
              <button
                onClick={() => finish(true)}
                className="absolute top-3 right-3 z-10 text-muted-foreground/55 hover:text-foreground transition-colors"
                aria-label="Skip onboarding"
              >
                <X className="w-4 h-4" />
              </button>

              <AnimatePresence mode="wait">
                {step === 0 && <WelcomeStep key="welcome" onNext={goNext} />}
                {step === 1 && (
                  <ArchetypeStep
                    key="archetype"
                    selected={archetype}
                    onSelect={applyArchetype}
                    onNext={goNext}
                  />
                )}
                {step === 2 && (
                  <HoursStep
                    key="hours"
                    workingStart={workingStart}
                    workingEnd={workingEnd}
                    onWorkingStart={setWorkingStart}
                    onWorkingEnd={setWorkingEnd}
                    onNext={goNext}
                  />
                )}
                {step === 3 && (
                  <DoneStep
                    key="done"
                    onAddSample={() => {
                      const tomorrow = new Date();
                      tomorrow.setDate(tomorrow.getDate() + 1);
                      const ymd = tomorrow.toISOString().slice(0, 10);
                      onAddSampleTask({
                        title: 'Deep work — getting started with AXIS',
                        description: 'A 90-min sample so the calendar isn\'t empty. Delete or edit anytime.',
                        total_duration: 90,
                        priority: 4,
                        deadline: ymd,
                        energy_intensity: 'deep',
                        scheduling_mode: 'flexible',
                        execution_style: 'single',
                        is_recurring: false,
                        status: 'active',
                      });
                      finish(false);
                    }}
                    onSkip={() => finish(false)}
                  />
                )}
              </AnimatePresence>

              {/* Step pips */}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                {[0, 1, 2, 3].map(i => (
                  <span
                    key={i}
                    className={`block w-1.5 h-1.5 rounded-full transition-colors ${
                      i === step
                        ? 'bg-primary'
                        : i < step
                        ? 'bg-primary/40'
                        : 'bg-border'
                    }`}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────────────────────────────────────
//  Steps
// ─────────────────────────────────────────────────────────────────────────

function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -12 }}
      transition={{ duration: 0.2 }}
      className="px-7 pt-8 pb-12"
    >
      <div className="w-12 h-12 rounded-md bg-primary/15 flex items-center justify-center mb-5">
        <Brain className="w-6 h-6 text-primary" strokeWidth={1.8} />
      </div>
      <h2 className="text-display text-2xl text-foreground mb-2 tracking-tight">Welcome to AXIS</h2>
      <p className="text-body text-muted-foreground leading-relaxed mb-5 max-w-[360px]">
        A scheduler that learns when you actually do your best work — and adapts
        instead of just telling you off when you miss a block.
      </p>

      <div className="space-y-2.5 mb-6">
        <Promise icon={Lock} text="Your Google Calendar stays read-only — AXIS never writes back." />
        <Promise icon={ShieldCheck} text="Anything you lock stays locked. Engine respects exceptions." />
        <Promise icon={Eye} text="Scoring is transparent: urgency × 3 + importance × 2 + energy × 1.5." />
      </div>

      <Button onClick={onNext} className="w-full h-9 text-body font-medium">
        Let's set you up
        <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
      </Button>
      <p className="text-caption text-center mt-2.5">Takes 30 seconds. Adjustable anytime.</p>
    </motion.div>
  );
}

function Promise({ icon: Icon, text }: { icon: React.ComponentType<{ className?: string }>; text: string }) {
  return (
    <div className="flex items-start gap-2">
      <div className="w-5 h-5 rounded bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="w-3 h-3 text-primary" />
      </div>
      <p className="text-body text-muted-foreground leading-relaxed">{text}</p>
    </div>
  );
}

function ArchetypeStep({
  selected,
  onSelect,
  onNext,
}: {
  selected: EnergyArchetype;
  onSelect: (a: EnergyArchetype) => void;
  onNext: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -12 }}
      transition={{ duration: 0.2 }}
      className="px-7 pt-8 pb-12"
    >
      <p className="text-eyebrow text-primary mb-2">Step 1 of 3</p>
      <h2 className="text-display text-xl text-foreground mb-1.5 tracking-tight">When do you focus best?</h2>
      <p className="text-body text-muted-foreground leading-relaxed mb-5 max-w-[360px]">
        We'll preset your deep-work window. AXIS refines it from your real patterns within a few weeks.
      </p>

      <div className="space-y-2 mb-6">
        {(['morning', 'mixed', 'night'] as const).map(a => {
          const preset = ARCHETYPE_PRESETS[a];
          const isSelected = selected === a;
          const Icon = a === 'morning' ? Sunrise : a === 'mixed' ? Coffee : Moon;
          return (
            <button
              key={a}
              onClick={() => onSelect(a)}
              className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-md text-left transition-all border ${
                isSelected
                  ? 'bg-primary/8 border-primary/40 ring-1 ring-primary/30'
                  : 'bg-secondary/40 border-border hover:bg-secondary/70 hover:border-border'
              }`}
            >
              <div
                className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${
                  isSelected ? 'bg-primary/20' : 'bg-secondary'
                }`}
              >
                <Icon className={`w-4 h-4 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-body font-semibold ${isSelected ? 'text-foreground' : 'text-foreground/80'}`}>
                  {preset.label}
                </p>
                <p className="text-caption leading-relaxed">{preset.description}</p>
              </div>
              {isSelected && <Check className="w-4 h-4 text-primary shrink-0" />}
            </button>
          );
        })}
      </div>

      <Button onClick={onNext} className="w-full h-9 text-body font-medium">
        Continue
        <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
      </Button>
    </motion.div>
  );
}

function HoursStep({
  workingStart,
  workingEnd,
  onWorkingStart,
  onWorkingEnd,
  onNext,
}: {
  workingStart: string;
  workingEnd: string;
  onWorkingStart: (s: string) => void;
  onWorkingEnd: (s: string) => void;
  onNext: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -12 }}
      transition={{ duration: 0.2 }}
      className="px-7 pt-8 pb-12"
    >
      <p className="text-eyebrow text-primary mb-2">Step 2 of 3</p>
      <h2 className="text-display text-xl text-foreground mb-1.5 tracking-tight">When does your day run?</h2>
      <p className="text-body text-muted-foreground leading-relaxed mb-5 max-w-[360px]">
        We pre-filled this from your archetype. Tweak if it's off — AXIS will only
        place tasks within these hours.
      </p>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="space-y-1">
          <Label className="text-eyebrow">Day starts</Label>
          <Input
            type="time"
            value={workingStart}
            onChange={e => onWorkingStart(e.target.value)}
            className="text-data"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-eyebrow">Day ends</Label>
          <Input
            type="time"
            value={workingEnd}
            onChange={e => onWorkingEnd(e.target.value)}
            className="text-data"
          />
        </div>
      </div>

      <Button onClick={onNext} className="w-full h-9 text-body font-medium">
        Looks right
        <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
      </Button>
    </motion.div>
  );
}

function DoneStep({
  onAddSample,
  onSkip,
}: {
  onAddSample: () => void;
  onSkip: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -12 }}
      transition={{ duration: 0.2 }}
      className="px-7 pt-8 pb-12"
    >
      <div className="w-10 h-10 rounded-md bg-primary/15 flex items-center justify-center mb-4">
        <Sparkles className="w-5 h-5 text-primary" strokeWidth={1.8} />
      </div>
      <h2 className="text-display text-xl text-foreground mb-1.5 tracking-tight">You're set up</h2>
      <p className="text-body text-muted-foreground leading-relaxed mb-5 max-w-[360px]">
        Add tasks via the +Task button or ⌘K. To see how scheduling feels, drop in
        a sample task — you can edit or delete it anytime.
      </p>

      <div className="space-y-2">
        <Button onClick={onAddSample} className="w-full h-9 text-body font-medium">
          <Sparkles className="w-3.5 h-3.5 mr-1.5" />
          Add a sample task
        </Button>
        <Button
          onClick={onSkip}
          variant="ghost"
          className="w-full h-9 text-body font-medium text-muted-foreground hover:text-foreground"
        >
          Start fresh
        </Button>
      </div>
    </motion.div>
  );
}
