import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Brain, CalendarDays, Activity, BookOpen, Cpu,
  ChevronRight, ArrowDown, Zap, Clock, Target,
  BarChart2, Dumbbell, Moon, Utensils, Smile,
  PenLine, Repeat2, TrendingUp, Layers, Sparkles,
  ArrowRight,
} from 'lucide-react';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';

// ─── Engine definitions ───────────────────────────────────────────────────────

const ENGINES = [
  {
    phase: '01',
    status: 'Live Now',
    statusClass: 'bg-primary/10 text-primary border-primary/30',
    dotClass: 'bg-primary shadow-[0_0_12px_hsl(var(--primary)/0.6)]',
    accentClass: 'text-primary',
    borderClass: 'border-primary/20',
    glowClass: 'from-primary/5 to-transparent',
    title: 'Time Engine',
    icon: <CalendarDays className="h-6 w-6" />,
    mission: 'Turn intention into execution — automatically.',
    description:
      'The Time Engine is the foundation of AXIS. It handles the cognitive overhead of scheduling so you can focus entirely on doing the work.',
    features: [
      { icon: <Zap className="h-4 w-4" />, text: 'Intelligent auto-scheduling based on priority and deadline' },
      { icon: <Clock className="h-4 w-4" />, text: 'Energy-aware time blocks matched to your natural rhythms' },
      { icon: <Target className="h-4 w-4" />, text: 'Flexible, anchor, and fixed scheduling modes' },
      { icon: <Repeat2 className="h-4 w-4" />, text: 'Recurring task and habit support' },
      { icon: <BarChart2 className="h-4 w-4" />, text: 'Conflict detection and automatic rescheduling' },
    ],
    why: 'Most people fail not from lack of ambition, but from the gap between deciding and doing. The Time Engine closes that gap by converting your intentions into a concrete, conflict-free schedule — and rebuilding it whenever life changes.',
    bridge: 'Your schedule is only as effective as the energy behind it. Body Engine measures that.',
    bridgeTarget: 'Body Engine',
  },
  {
    phase: '02',
    status: 'Coming Next',
    statusClass: 'bg-orange-500/10 text-orange-400 border-orange-500/30 dark:text-orange-400',
    dotClass: 'bg-orange-400 shadow-[0_0_12px_rgba(251,146,60,0.5)]',
    accentClass: 'text-orange-400',
    borderClass: 'border-orange-500/20',
    glowClass: 'from-orange-500/5 to-transparent',
    title: 'Body Engine',
    icon: <Activity className="h-6 w-6" />,
    mission: 'Understand the physical state behind your performance.',
    description:
      'The Body Engine brings your health data into the system — not as a fitness app, but as a lens through which AXIS understands your capacity and energy on any given day.',
    features: [
      { icon: <Utensils className="h-4 w-4" />, text: 'Nutrition and meal tracking' },
      { icon: <Dumbbell className="h-4 w-4" />, text: 'Workout and movement logging' },
      { icon: <Moon className="h-4 w-4" />, text: 'Sleep quality and duration tracking' },
      { icon: <Activity className="h-4 w-4" />, text: 'Recovery and energy level monitoring' },
      { icon: <TrendingUp className="h-4 w-4" />, text: 'Physical trend analysis over time' },
    ],
    why: 'Your physical state is not a separate concern — it is the foundation of everything else. When your body is depleted, even the best schedule becomes aspirational fiction. When it is strong, the same schedule becomes achievable. AXIS needs to know the difference.',
    bridge: 'Physical recovery shapes emotional state. Mind Engine captures what happens next.',
    bridgeTarget: 'Mind Engine',
  },
  {
    phase: '03',
    status: 'In Design',
    statusClass: 'bg-violet-500/10 text-violet-400 border-violet-500/30',
    dotClass: 'bg-violet-400 shadow-[0_0_12px_rgba(167,139,250,0.5)]',
    accentClass: 'text-violet-400',
    borderClass: 'border-violet-500/20',
    glowClass: 'from-violet-500/5 to-transparent',
    title: 'Mind Engine',
    icon: <BookOpen className="h-6 w-6" />,
    mission: 'Know yourself deeply enough to improve.',
    description:
      'The Mind Engine is your space for inner clarity. It helps you track how you actually feel — not just what you do — and surfaces the emotional and behavioral patterns that shape everything else.',
    features: [
      { icon: <PenLine className="h-4 w-4" />, text: 'Structured daily journaling prompts' },
      { icon: <Smile className="h-4 w-4" />, text: 'Mood and emotional state tracking' },
      { icon: <Repeat2 className="h-4 w-4" />, text: 'Habit formation and streak tracking' },
      { icon: <BarChart2 className="h-4 w-4" />, text: 'Behavioral pattern recognition' },
      { icon: <Sparkles className="h-4 w-4" />, text: 'Wellbeing and mental clarity check-ins' },
    ],
    why: "Plans fail for emotional reasons more often than logistical ones. The Mind Engine gives you the language to understand why some weeks feel like progress and others like drift. It turns subjective experience into legible data — the kind AXIS can actually learn from.",
    bridge: 'Time, Body, and Mind together form a complete picture. Life OS reads it — and helps you write a better future.',
    bridgeTarget: 'Life OS',
  },
];

// ─── Life OS — extended treatment ─────────────────────────────────────────────

const LIFEOS_CAPABILITIES = [
  {
    title: 'Pattern recognition across engines',
    desc: 'Life OS reads across your schedule, your physical state, and your inner life to find patterns that no single engine could see alone.',
  },
  {
    title: 'Trajectory analysis',
    desc: 'Based on your current habits and direction, Life OS shows you where your behavior is likely to lead — and whether that destination matches what you actually want.',
  },
  {
    title: 'Early course correction',
    desc: "It notices when you're drifting before the drift becomes a problem — and names it clearly so you can decide what to do about it.",
  },
  {
    title: 'Intelligent suggestions',
    desc: 'Life OS can propose concrete changes across the engines: a better sleep window, a lighter workload during recovery periods, a journaling habit that fits your existing routine.',
  },
  {
    title: 'Conversational guidance',
    desc: 'Ask it questions. "Why do I keep skipping workouts?" "Am I making progress toward my goals?" "What would a better week look like?" It answers with your own data, not generic advice.',
  },
];

// ─── Component ─────────────────────────────────────────────────────────────────

export default function Roadmap() {
  return (
    <div className="min-h-screen bg-background text-foreground">

      {/* ── Nav ───────────────────────────────────────────────────────────── */}
      <nav className="border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-semibold text-primary">
            <Brain className="h-5 w-5" />
            <span>AXIS</span>
          </Link>
          <div className="flex items-center gap-4">
            <ThemeSwitcher />
            <LanguageSwitcher />
            <Link to="/features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Features</Link>
            <Link to="/roadmap" className="text-sm text-foreground font-medium">Roadmap</Link>
            <Link to="/faq" className="text-sm text-muted-foreground hover:text-foreground transition-colors">FAQ</Link>
            <Button asChild size="sm">
              <Link to="/signup">Get Started</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-6 pt-24 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-medium mb-8">
          <Layers className="h-3 w-3" />
          The AXIS Vision
        </div>
        <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-6 leading-[1.1]">
          Four Engines.<br />
          <span className="text-primary">One Life.</span>
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-6">
          AXIS begins with time — and grows into a complete system for understanding
          and improving every dimension of how you live.
        </p>
        <p className="text-base text-muted-foreground max-w-xl mx-auto leading-relaxed">
          Each engine is designed to work alone. Together, they form something
          fundamentally more powerful: a system that actually knows you.
        </p>
      </section>

      {/* ── Phase overview bar ─────────────────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { phase: '01', name: 'Time Engine',  status: 'Live Now',     color: 'border-primary/30 bg-primary/5' },
            { phase: '02', name: 'Body Engine',  status: 'Coming Next',  color: 'border-orange-500/30 bg-orange-500/5' },
            { phase: '03', name: 'Mind Engine',  status: 'In Design',    color: 'border-violet-500/30 bg-violet-500/5' },
            { phase: '04', name: 'Life OS',      status: 'Vision',       color: 'border-amber-500/30 bg-amber-500/5' },
          ].map(e => (
            <div key={e.phase} className={`rounded-lg border p-4 text-center ${e.color}`}>
              <div className="font-mono text-[10px] text-muted-foreground mb-1">Phase {e.phase}</div>
              <div className="font-semibold text-sm mb-1">{e.name}</div>
              <div className="text-xs text-muted-foreground">{e.status}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Timeline ──────────────────────────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-6 pb-24">
        <div className="space-y-6">

          {ENGINES.map((engine, idx) => (
            <div key={engine.phase} className="relative">

              {/* Phase card */}
              <div className={`rounded-xl border ${engine.borderClass} bg-gradient-to-br ${engine.glowClass} via-card to-card overflow-hidden`}>

                {/* Card header */}
                <div className="p-8 pb-6 border-b border-border/50">
                  <div className="flex items-start justify-between gap-4 mb-6">
                    <div className="flex items-center gap-4">
                      <div className="font-mono text-4xl font-bold text-muted-foreground/20 select-none leading-none">
                        {engine.phase}
                      </div>
                      <div>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium mb-2 ${engine.statusClass}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${engine.dotClass}`} />
                          {engine.status}
                        </span>
                        <h2 className={`text-2xl font-bold flex items-center gap-2 ${engine.accentClass}`}>
                          {engine.icon}
                          {engine.title}
                        </h2>
                      </div>
                    </div>
                  </div>
                  <p className="text-lg font-medium text-foreground mb-2 italic">
                    "{engine.mission}"
                  </p>
                  <p className="text-muted-foreground leading-relaxed">
                    {engine.description}
                  </p>
                </div>

                {/* Features + Why */}
                <div className="p-8 grid md:grid-cols-2 gap-8">
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
                      What it does
                    </h3>
                    <ul className="space-y-3">
                      {engine.features.map((f, fi) => (
                        <li key={fi} className="flex items-start gap-3">
                          <span className={`mt-0.5 shrink-0 ${engine.accentClass}`}>{f.icon}</span>
                          <span className="text-sm text-muted-foreground leading-snug">{f.text}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
                      Why it matters
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {engine.why}
                    </p>
                  </div>
                </div>

                {/* Bridge to next */}
                {idx < ENGINES.length && (
                  <div className="px-8 pb-6">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-4 py-3 border border-border/50">
                      <ArrowRight className="h-3 w-3 shrink-0 text-primary" />
                      <span>{engine.bridge}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Connector arrow between cards */}
              {idx < ENGINES.length - 1 && (
                <div className="flex justify-center py-4">
                  <ArrowDown className="h-5 w-5 text-muted-foreground/30" />
                </div>
              )}
            </div>
          ))}

          {/* ── Phase 04: Life OS ─────────────────────────────────────────── */}
          <div className="flex justify-center py-4">
            <ArrowDown className="h-5 w-5 text-muted-foreground/30" />
          </div>

          <div className="relative rounded-xl border border-amber-500/20 overflow-hidden">
            {/* Subtle gradient backdrop */}
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-card to-violet-500/5 pointer-events-none" />

            {/* Header */}
            <div className="relative p-8 pb-6 border-b border-border/50">
              <div className="flex items-start gap-4 mb-6">
                <div className="font-mono text-4xl font-bold text-muted-foreground/20 select-none leading-none">04</div>
                <div>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-400 text-xs font-medium mb-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]" />
                    Vision
                  </span>
                  <h2 className="text-2xl font-bold flex items-center gap-2 text-amber-400">
                    <Cpu className="h-6 w-6" />
                    Life OS
                  </h2>
                </div>
              </div>

              <p className="text-lg font-medium text-foreground mb-3 italic">
                "An intelligent guide that connects every dimension of your life."
              </p>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Life OS is not a fourth tracker. It is the intelligence layer that sits above the other three engines —
                reading the full picture they create together, and using it to help you understand yourself and improve.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                On its own, each engine gives you data. Life OS gives you meaning. It finds the connections between
                how you spend your time, how your body feels, and how your mind is doing — and turns that into
                something actionable: a clearer understanding of where you are, and a realistic path to where you want to be.
              </p>
            </div>

            {/* Capabilities grid */}
            <div className="relative p-8 border-b border-border/50">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-6">
                What Life OS can do
              </h3>
              <div className="grid md:grid-cols-2 gap-4 lg:grid-cols-3">
                {LIFEOS_CAPABILITIES.map((cap, i) => (
                  <div key={i} className="rounded-lg border border-border/50 bg-background/60 p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                      <span className="text-sm font-semibold">{cap.title}</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{cap.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Philosophy */}
            <div className="relative p-8">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
                The right kind of intelligence
              </h3>
              <div className="grid md:grid-cols-3 gap-6">
                <div className="space-y-1.5">
                  <p className="text-sm font-semibold text-foreground">An intelligent mirror</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Life OS reflects your patterns back to you clearly and honestly — not to judge, but to help you see what's actually happening.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <p className="text-sm font-semibold text-foreground">A thoughtful guide</p>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    It offers suggestions, not mandates. You stay in control of every decision. The system proposes; you choose.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <p className="text-sm font-semibold text-foreground">Built around you</p>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    Every insight comes from your own data — not generic averages or population benchmarks. The more you use it, the more precisely it understands your specific patterns.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────────────── */}
      <section className="border-t border-border bg-card/30">
        <div className="max-w-4xl mx-auto px-6 py-24 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-medium mb-8">
            <CalendarDays className="h-3 w-3" />
            Phase 01 is live today
          </div>
          <h2 className="text-3xl md:text-4xl font-bold mb-5">
            Start building your foundation.
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto mb-10 leading-relaxed">
            The Time Engine is available now. Everything begins here — with your schedule,
            your priorities, and your time.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Button asChild size="lg" className="gap-2">
              <Link to="/signup">
                Get started free <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/features">See all features</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer className="border-t border-border/50">
        <div className="max-w-6xl mx-auto px-6 py-8 flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" />
            <span>AXIS</span>
          </div>
          <div className="flex items-center gap-6">
            <Link to="/features" className="hover:text-foreground transition-colors">Features</Link>
            <Link to="/roadmap" className="hover:text-foreground transition-colors">Roadmap</Link>
            <Link to="/faq" className="hover:text-foreground transition-colors">FAQ</Link>
            <Link to="/login" className="hover:text-foreground transition-colors">Login</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
