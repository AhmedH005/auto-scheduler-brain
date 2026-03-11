# AXIS Architecture

## What this is

AXIS is a cognitive-aware task scheduler. You tell it what you need to do, how long it takes, and how much focus it demands — it figures out when to do it based on your energy patterns, deadlines, and existing commitments.

## Core design decisions

### Three scheduling modes

Every task is one of:
- **Flexible** — the engine places it wherever it fits best (respects energy, deadlines, daily limits)
- **Anchor** — pinned to a time window, optionally recurring (prayers, standups, gym)
- **Fixed** — locked to an exact date/time (flights, appointments)

This taxonomy emerged from observing that most scheduling apps force you to either fully manual-schedule or fully auto-schedule. Real life has both.

### The engine (`src/engine/`)

The scheduler is a constraint-satisfaction greedy algorithm, not an optimizer. It:
1. Places fixed and anchor blocks first (they're non-negotiable)
2. Expands recurring tasks across the planning horizon
3. Scores remaining tasks by urgency + importance + energy-match
4. Greedily fills available slots, respecting working hours, deep work windows, and daily capacity limits

The scoring formula is intentionally simple: `urgency × 3 + importance × 2 + energy_match × 1.5`. Urgency spikes as deadlines approach. Energy matching prefers deep work in mornings and light work in evenings. The weights are tunable constants, not ML.

### Google Calendar import

External calendar events are imported once and converted to native AXIS tasks:
- Recurring events (same title, same calendar) → single anchor task
- One-off timed events → fixed task
- All-day events → flexible task

Imported tasks use a `synced-rec-{slug}` ID prefix and are never saved to the `tasks` table in Supabase — they're derived from `external_calendar_events` on each load. User edits (priority, energy) persist in localStorage.

### State management

`useScheduler` is the central hook. It owns tasks, blocks, and settings. Persistence is dual-write: always localStorage, plus Supabase when authenticated. No Redux, no Zustand — just `useState` + `useCallback` + effects for sync. The app works fully offline with localStorage alone.

### Scheduling modes → block types

The scheduler outputs `ScheduledBlock[]`. Each block references a task by ID. Blocks can be locked (user-placed or engine-placed-and-confirmed) or unlocked (engine suggestion). The calendar views render blocks; the sidebar manages tasks.

## File map

```
src/
├── engine/           # Pure scheduling logic, no React
│   ├── scheduler.ts  # rebuildSchedule() — the main algorithm
│   ├── scoring.ts    # calculateScore() — urgency/importance/energy
│   └── recurring.ts  # expandRecurringTasks() — date expansion
├── hooks/
│   ├── useScheduler.ts          # Task/block/settings state + persistence
│   └── useExternalCalendars.ts  # Google Calendar OAuth + import
├── types/
│   ├── task.ts       # Task, ScheduledBlock, UserSettings
│   └── calendar.ts   # External calendar account/event types
├── lib/
│   ├── googleCalendar.ts  # GIS OAuth + Google Calendar REST API
│   ├── supabase.ts        # Supabase client init
│   ├── taskColors.ts      # Color palette for task blocks
│   ├── theme.ts           # Pre-React theme class application
│   └── utils.ts           # cn() — Tailwind class merge
├── contexts/
│   ├── AuthContext.tsx    # Supabase auth provider
│   └── ThemeContext.tsx   # Dark/light toggle
├── components/
│   ├── WeekView.tsx       # 7-day time grid with drag/resize
│   ├── DayView.tsx        # Single-day time grid
│   ├── MonthView.tsx      # Month overview
│   ├── TaskForm.tsx       # Task create/edit form
│   ├── TaskList.tsx       # Sidebar task list
│   ├── SettingsPanel.tsx  # User settings editor
│   ├── CalendarIntegrationsPanel.tsx  # Google Calendar connection UI
│   ├── GoogleIcon.tsx     # Shared Google "G" SVG
│   └── ui/               # shadcn/ui primitives (button, input, etc.)
└── pages/
    ├── Index.tsx    # Main app (calendar + sidebar)
    ├── Landing.tsx  # Public landing page
    ├── Login.tsx    # Auth
    ├── Signup.tsx   # Auth
    ├── Features.tsx # Feature details
    ├── FAQ.tsx      # FAQ
    └── Roadmap.tsx  # Product vision
```
