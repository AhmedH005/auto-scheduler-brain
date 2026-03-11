<div align="center">

<br />

<img src="https://img.shields.io/badge/AXIS-Cognitive%20Scheduler-0d9488?style=for-the-badge&labelColor=0f172a" alt="AXIS" />

<br /><br />

**A task scheduler that thinks the way you do.**

AXIS learns when you do your best work and builds your day around it — placing deep work in the morning, lighter tasks in the evening, and never double-booking your time.

<br />

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61dafb?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-5-646cff?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-auth%20%2B%20db-3ecf8e?style=flat-square&logo=supabase&logoColor=white)](https://supabase.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-38bdf8?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![i18n](https://img.shields.io/badge/i18n-EN%20%7C%20FR%20%7C%20AR-f59e0b?style=flat-square)](https://www.i18next.com/)

<br />

</div>

---

## What is AXIS?

Most scheduling apps treat every hour of your day as equal. They don't know that 9 AM is your sharpest hour, or that an engineering deep-dive should never follow an exhausting meeting.

AXIS does.

You tell it what needs to get done — how long it takes, how much focus it demands, when it's due. AXIS figures out the *when* by mapping tasks against your personal energy curve, your existing commitments, and your daily capacity limits. The result is a schedule that works *with* your biology, not against it.

---

## Core Features

### Three scheduling modes

| Mode | What it does |
|---|---|
| **Flexible** | Engine places it where it fits best — energy match, deadline urgency, daily limits |
| **Anchor** | Pinned to a recurring time window (prayers, gym, standups) — never moved |
| **Fixed** | Locked to an exact date and time (flights, appointments) |

This distinction exists because most scheduling tools force a binary: either you manually place everything, or you hand full control to automation. Real life has both.

### Cognitive energy matching

The engine maps tasks to time slots based on cognitive demand:

- **Deep work** → scheduled in peak morning hours (06:00–12:00)
- **Moderate focus** → afternoon blocks (12:00–17:00)
- **Light tasks** → reserved for low-energy evenings (17:00+)

The scoring formula is intentionally transparent:

```
score = urgency × 3 + importance × 2 + energy_match × 1.5
```

Urgency spikes as deadlines approach. Weights are tunable constants, not a black box.

### Google Calendar sync

Connect your Google Calendar and AXIS imports your existing events as native tasks:

- Recurring events (same title) → single **anchor** task
- One-off timed events → **fixed** task
- All-day events → **flexible** task

Your schedule stays in sync without manual re-entry.

### Offline-first

Everything works without an internet connection. State lives in `localStorage` first; Supabase syncs in the background when you're authenticated. No connectivity, no problem.

### Internationalization

Full UI support for **English**, **French**, and **Arabic** — including right-to-left layout.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite |
| Styling | Tailwind CSS, shadcn/ui |
| Auth & Database | Supabase (PostgreSQL + Row-Level Security) |
| Calendar OAuth | Google Identity Services (GIS) |
| Scheduling engine | Custom greedy constraint-satisfaction algorithm |
| i18n | i18next |
| Testing | Vitest |

---

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- A [Supabase](https://supabase.com/) project
- A Google Cloud project with the Calendar API enabled (optional — for Google Calendar sync)

### Setup

```bash
# 1. Clone the repository
git clone https://github.com/AhmedH005/auto-scheduler-brain.git
cd auto-scheduler-brain

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.example .env
```

Edit `.env` with your credentials:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Optional — enables Google Calendar integration
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

```bash
# 4. Apply database migrations
# Run the SQL files in supabase/migrations/ against your Supabase project

# 5. Start the development server
npm run dev
```

The app will be running at `http://localhost:8080`.

---

## Project Structure

```
src/
├── engine/           # Pure scheduling logic — no React dependencies
│   ├── scheduler.ts  # rebuildSchedule() — the main algorithm
│   ├── scoring.ts    # calculateScore() — urgency / importance / energy
│   └── recurring.ts  # expandRecurringTasks() — date expansion
├── hooks/
│   ├── useScheduler.ts          # Task / block / settings state + persistence
│   └── useExternalCalendars.ts  # Google Calendar OAuth + import
├── types/
│   ├── task.ts       # Task, ScheduledBlock, UserSettings
│   └── calendar.ts   # External calendar account / event types
├── lib/
│   ├── googleCalendar.ts  # GIS OAuth + Google Calendar REST API
│   └── supabase.ts        # Supabase client
├── components/
│   ├── WeekView.tsx   # 7-day time grid with drag and resize
│   ├── DayView.tsx    # Single-day time grid
│   ├── MonthView.tsx  # Month overview
│   ├── TaskForm.tsx   # Task create / edit form
│   └── TaskList.tsx   # Sidebar task list
└── pages/
    ├── Index.tsx    # Main app shell
    ├── Landing.tsx  # Public landing page
    └── Roadmap.tsx  # Product vision
```

---

## How the Engine Works

The scheduler is a **greedy constraint-satisfaction algorithm** — not a neural network, not a black box.

1. **Fixed and anchor blocks are placed first** — they're non-negotiable
2. **Recurring tasks are expanded** across the planning horizon (up to 28 days, extended by deadlines)
3. **Remaining tasks are scored** by urgency + importance + energy match
4. **Greedy fill** — highest-scoring tasks placed into available slots, respecting working hours, deep-work windows, buffer time, and daily capacity caps

The planning horizon extends automatically to cover the furthest deadline in your task list.

---

## Running Tests

```bash
npm run test
```

Tests cover the scoring engine — urgency decay, energy matching, importance normalization, and sort order.

---

## Roadmap

| Phase | Status | Focus |
|---|---|---|
| 01 — Schedule Engine | ✅ Live | Core scheduling, Google Calendar sync, offline support |
| 02 — Habit Engine | Planned | Streaks, consistency tracking, adaptive rescheduling |
| 03 — Focus Engine | Planned | Pomodoro, session analytics, distraction logging |
| 04 — Life OS | Vision | Sleep, nutrition, and fitness integration |

---

## Contributing

Pull requests are welcome. For significant changes, please open an issue first to discuss what you'd like to change.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes
4. Push to the branch and open a pull request

Please ensure the TypeScript compiler passes (`npm run build`) and tests pass (`npm run test`) before submitting.

---

## License

MIT — see [LICENSE](LICENSE) for details.

---

<div align="center">

Built with clarity of purpose. Designed for people who take their time seriously.

</div>
