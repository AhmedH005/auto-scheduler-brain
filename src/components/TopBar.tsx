/**
 * TopBar — the global navigation surface.
 *
 * Replaces the cramped sidebar header. Borrowed-and-adapted patterns
 * from Cron / Notion Calendar (minimal chrome) + Linear (keyboard-first
 * + ⌘K trigger) + Things 3 (Today as a primary affordance).
 *
 * Three zones, fixed height 44px:
 *   Left    — brand mark + "AXIS" label (clickable to home)
 *   Center  — date navigation (← Today →) + view switcher (D/W/M)
 *   Right   — search/⌘K trigger + insights bell + theme/lang/settings menu
 *
 * Why no breadcrumbs / no project picker: AXIS is single-user single-
 * workspace by design. Adding org-style chrome would lie about the product.
 */

import { useMemo } from 'react';
import { format, addDays, addMonths, addWeeks, startOfWeek, endOfWeek } from 'date-fns';
import {
  ChevronLeft,
  ChevronRight,
  Search,
  Sparkles,
  Settings,
  Brain,
  CalendarDays,
  Calendar,
  LayoutGrid,
  Plus,
  PanelLeft,
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

type CalendarView = 'day' | 'week' | 'month';

interface TopBarProps {
  view: CalendarView;
  selectedDate: Date;
  hasInsights: boolean;
  onSidebarToggle: () => void;
  sidebarOpen: boolean;
  onViewChange: (view: CalendarView) => void;
  onDateChange: (date: Date) => void;
  onJumpToToday: () => void;
  onOpenPalette: () => void;
  onAddTask: () => void;
  onOpenSettings: () => void;
  onOpenRetrospective: () => void;
}

export function TopBar({
  view,
  selectedDate,
  hasInsights,
  onSidebarToggle,
  sidebarOpen,
  onViewChange,
  onDateChange,
  onJumpToToday,
  onOpenPalette,
  onAddTask,
  onOpenSettings,
  onOpenRetrospective,
}: TopBarProps) {
  const dateLabel = useMemo(() => {
    if (view === 'day') return format(selectedDate, 'EEE, MMM d');
    if (view === 'month') return format(selectedDate, 'MMMM yyyy');
    // Week
    const start = startOfWeek(selectedDate, { weekStartsOn: 1 });
    const end = endOfWeek(selectedDate, { weekStartsOn: 1 });
    if (start.getMonth() === end.getMonth()) {
      return `${format(start, 'MMM d')} – ${format(end, 'd, yyyy')}`;
    }
    return `${format(start, 'MMM d')} – ${format(end, 'MMM d')}`;
  }, [view, selectedDate]);

  const nav = (delta: number) => {
    if (view === 'day') onDateChange(addDays(selectedDate, delta));
    else if (view === 'week') onDateChange(addWeeks(selectedDate, delta));
    else onDateChange(addMonths(selectedDate, delta));
  };

  return (
    <header
      className="shrink-0 h-11 flex items-center gap-2 px-3 border-b border-border bg-card/40 backdrop-blur"
      role="banner"
    >
      {/* ── Brand + sidebar toggle ─────────────────────────────────── */}
      <div className="flex items-center gap-1 shrink-0 min-w-0 mr-2">
        <button
          onClick={onSidebarToggle}
          className="w-7 h-7 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
          aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          title={sidebarOpen ? 'Collapse sidebar (⌘\\)' : 'Expand sidebar (⌘\\)'}
        >
          <PanelLeft className="w-3.5 h-3.5" />
        </button>
        <div className="flex items-center gap-2 ml-1">
          <div className="w-6 h-6 rounded-sm bg-primary/15 flex items-center justify-center">
            <Brain className="w-3.5 h-3.5 text-primary" strokeWidth={2.2} />
          </div>
          <span className="text-display text-foreground tracking-tight">AXIS</span>
        </div>
      </div>

      {/* ── Center: date nav + view switcher ──────────────────────── */}
      <div className="flex-1 flex items-center justify-center gap-1.5 min-w-0">
        <div className="flex items-center gap-0.5 mr-1">
          <button
            onClick={() => nav(-1)}
            className="w-7 h-7 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
            aria-label={`Previous ${view}`}
            title={`Previous ${view}`}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onJumpToToday}
            className="px-2.5 h-7 text-body font-medium rounded text-foreground hover:bg-secondary/60 transition-colors"
            title="Jump to today (T)"
          >
            Today
          </button>
          <button
            onClick={() => nav(1)}
            className="w-7 h-7 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
            aria-label={`Next ${view}`}
            title={`Next ${view}`}
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <span className="text-body text-foreground/70 truncate min-w-0 px-1">{dateLabel}</span>

        <div className="flex items-center gap-0.5 ml-1 p-0.5 rounded bg-secondary/40 border border-border/60">
          {(
            [
              { key: 'day' as const, label: 'D', icon: CalendarDays, hint: '1' },
              { key: 'week' as const, label: 'W', icon: Calendar, hint: '2' },
              { key: 'month' as const, label: 'M', icon: LayoutGrid, hint: '3' },
            ]
          ).map(({ key, label, icon: Icon, hint }) => {
            const active = view === key;
            return (
              <button
                key={key}
                onClick={() => onViewChange(key)}
                className={`group relative px-2 h-6 rounded-sm flex items-center gap-1 text-[11px] font-medium transition-colors ${
                  active
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title={`${label === 'D' ? 'Day' : label === 'W' ? 'Week' : 'Month'} view (${hint})`}
              >
                <Icon className="w-3 h-3" />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Right cluster: actions + menus ─────────────────────────── */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={onAddTask}
          className="inline-flex items-center gap-1 px-2.5 h-7 rounded text-body font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
          title="Add task (A)"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Task</span>
        </button>

        <button
          onClick={onOpenPalette}
          className="inline-flex items-center gap-2 h-7 px-2.5 rounded bg-secondary/40 hover:bg-secondary/70 border border-border/60 hover:border-primary/30 transition-all text-muted-foreground hover:text-foreground"
          aria-label="Open command palette"
          title="Search or run a command (⌘K)"
        >
          <Search className="w-3 h-3" />
          <span className="hidden md:inline text-[11px]">Search</span>
          <kbd className="hidden md:inline text-[9px] font-mono px-1 py-px rounded border border-border bg-background/60 text-muted-foreground/70">
            ⌘K
          </kbd>
        </button>

        {hasInsights && (
          <button
            onClick={onOpenRetrospective}
            className="relative w-7 h-7 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
            aria-label="Open weekly retrospective"
            title="Weekly retrospective"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-primary" />
          </button>
        )}

        <ThemeButton />

        <button
          onClick={onOpenSettings}
          className="w-7 h-7 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
          aria-label="Open settings"
          title="Settings"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
}

// ─────────────────────────────────────────────────────────────────────────
//  Theme button — refactored from the old ThemeSwitcher to be lighter
// ─────────────────────────────────────────────────────────────────────────

function ThemeButton() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  return (
    <button
      onClick={toggleTheme}
      className="w-7 h-7 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Light mode' : 'Dark mode'}
    >
      {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
    </button>
  );
}
