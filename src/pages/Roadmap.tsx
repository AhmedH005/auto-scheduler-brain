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
import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';

interface EngineMeta {
  icon: ReactNode;
  statusClass: string;
  dotClass: string;
  accentClass: string;
  borderClass: string;
  glowClass: string;
  featureIcons: ReactNode[];
}

const ENGINE_META: EngineMeta[] = [
  {
    icon: <CalendarDays className="h-6 w-6" />,
    statusClass: 'bg-primary/10 text-primary border-primary/30',
    dotClass: 'bg-primary shadow-[0_0_12px_hsl(var(--primary)/0.6)]',
    accentClass: 'text-primary',
    borderClass: 'border-primary/20',
    glowClass: 'from-primary/5',
    featureIcons: [
      <Zap className="h-4 w-4" />,
      <Clock className="h-4 w-4" />,
      <Target className="h-4 w-4" />,
      <Repeat2 className="h-4 w-4" />,
      <BarChart2 className="h-4 w-4" />,
    ],
  },
  {
    icon: <Activity className="h-6 w-6" />,
    statusClass: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
    dotClass: 'bg-orange-400 shadow-[0_0_12px_rgba(251,146,60,0.5)]',
    accentClass: 'text-orange-400',
    borderClass: 'border-orange-500/20',
    glowClass: 'from-orange-500/5',
    featureIcons: [
      <Utensils className="h-4 w-4" />,
      <Dumbbell className="h-4 w-4" />,
      <Moon className="h-4 w-4" />,
      <Activity className="h-4 w-4" />,
      <TrendingUp className="h-4 w-4" />,
    ],
  },
  {
    icon: <BookOpen className="h-6 w-6" />,
    statusClass: 'bg-violet-500/10 text-violet-400 border-violet-500/30',
    dotClass: 'bg-violet-400 shadow-[0_0_12px_rgba(167,139,250,0.5)]',
    accentClass: 'text-violet-400',
    borderClass: 'border-violet-500/20',
    glowClass: 'from-violet-500/5',
    featureIcons: [
      <PenLine className="h-4 w-4" />,
      <Smile className="h-4 w-4" />,
      <Repeat2 className="h-4 w-4" />,
      <BarChart2 className="h-4 w-4" />,
      <Sparkles className="h-4 w-4" />,
    ],
  },
];

const OVERVIEW_STYLE = [
  'border-primary/30 bg-primary/5',
  'border-orange-500/30 bg-orange-500/5',
  'border-violet-500/30 bg-violet-500/5',
  'border-amber-500/30 bg-amber-500/5',
];

interface RoadmapEngine {
  phase: string;
  status: string;
  name: string;
  mission: string;
  description: string;
  features: string[];
  why: string;
  bridge: string;
}

interface LifeOSEntry {
  title: string;
  desc: string;
}

interface LifeOSTranslation {
  phase: string;
  status: string;
  name: string;
  mission: string;
  description: string;
  description2: string;
  whatItCan: string;
  capabilities: LifeOSEntry[];
  rightKind: string;
  pillars: LifeOSEntry[];
}

interface RoadmapCta {
  badge: string;
  title: string;
  subtitle: string;
  getStarted: string;
  seeFeatures: string;
}

export default function Roadmap() {
  const { t } = useTranslation();

  const engines = t('roadmap.engines', { returnObjects: true }) as RoadmapEngine[];
  const lifeOS  = t('roadmap.lifeOS',  { returnObjects: true }) as LifeOSTranslation;
  const cta     = t('roadmap.cta',     { returnObjects: true }) as RoadmapCta;

  // Overview bar: first 3 engines + lifeOS
  const overviewEngines = [
    ...engines.map((e, i) => ({ phase: e.phase, name: e.name, status: e.status, style: OVERVIEW_STYLE[i] })),
    { phase: lifeOS.phase, name: lifeOS.name, status: lifeOS.status, style: OVERVIEW_STYLE[3] },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">

      <nav className="border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-semibold text-primary">
            <Brain className="h-5 w-5" />
            <span>AXIS</span>
          </Link>
          <div className="flex items-center gap-4">
            <ThemeSwitcher />
            <LanguageSwitcher />
            <Link to="/features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t('nav.features')}</Link>
            <Link to="/roadmap" className="text-sm text-foreground font-medium">{t('nav.roadmap')}</Link>
            <Link to="/faq" className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t('nav.faq')}</Link>
            <Button asChild size="sm">
              <Link to="/signup">{t('nav.signup')}</Link>
            </Button>
          </div>
        </div>
      </nav>

      <section className="max-w-4xl mx-auto px-6 pt-24 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-medium mb-8">
          <Layers className="h-3 w-3" />
          {t('roadmap.badge')}
        </div>
        <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-6 leading-[1.1]">
          {t('roadmap.heroTitle')}<br />
          <span className="text-primary">{t('roadmap.heroTitleHighlight')}</span>
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-6">
          {t('roadmap.heroSubtitle')}
        </p>
        <p className="text-base text-muted-foreground max-w-xl mx-auto leading-relaxed">
          {t('roadmap.heroDesc')}
        </p>
      </section>

      <section className="max-w-4xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {overviewEngines.map(e => (
            <div key={e.phase} className={`rounded-lg border p-4 text-center ${e.style}`}>
              <div className="font-mono text-[10px] text-muted-foreground mb-1">Phase {e.phase}</div>
              <div className="font-semibold text-sm mb-1">{e.name}</div>
              <div className="text-xs text-muted-foreground">{e.status}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-6 pb-24">
        <div className="space-y-6">

          {engines.map((engine, idx) => {
            const meta = ENGINE_META[idx];
            return (
              <div key={engine.phase}>
                <div className={`rounded-xl border ${meta.borderClass} bg-gradient-to-br ${meta.glowClass} via-card to-card overflow-hidden`}>

                  {/* Card header */}
                  <div className="p-8 pb-6 border-b border-border/50">
                    <div className="flex items-start gap-4 mb-6">
                      <div className="font-mono text-4xl font-bold text-muted-foreground/20 select-none leading-none">
                        {engine.phase}
                      </div>
                      <div>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium mb-2 ${meta.statusClass}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${meta.dotClass}`} />
                          {engine.status}
                        </span>
                        <h2 className={`text-2xl font-bold flex items-center gap-2 ${meta.accentClass}`}>
                          {meta.icon}
                          {engine.name}
                        </h2>
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
                        {t('roadmap.whatItDoes')}
                      </h3>
                      <ul className="space-y-3">
                        {engine.features.map((f, fi) => (
                          <li key={fi} className="flex items-start gap-3">
                            <span className={`mt-0.5 shrink-0 ${meta.accentClass}`}>{meta.featureIcons[fi]}</span>
                            <span className="text-sm text-muted-foreground leading-snug">{f}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
                        {t('roadmap.whyItMatters')}
                      </h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {engine.why}
                      </p>
                    </div>
                  </div>

                  {/* Bridge */}
                  <div className="px-8 pb-6">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-4 py-3 border border-border/50">
                      <ArrowRight className="h-3 w-3 shrink-0 text-primary" />
                      <span>{engine.bridge}</span>
                    </div>
                  </div>
                </div>

                {/* Connector */}
                <div className="flex justify-center py-4">
                  <ArrowDown className="h-5 w-5 text-muted-foreground/30" />
                </div>
              </div>
            );
          })}

          <div className="relative rounded-xl border border-amber-500/20 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-card to-violet-500/5 pointer-events-none" />

            {/* Header */}
            <div className="relative p-8 pb-6 border-b border-border/50">
              <div className="flex items-start gap-4 mb-6">
                <div className="font-mono text-4xl font-bold text-muted-foreground/20 select-none leading-none">
                  {lifeOS.phase}
                </div>
                <div>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-400 text-xs font-medium mb-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]" />
                    {lifeOS.status}
                  </span>
                  <h2 className="text-2xl font-bold flex items-center gap-2 text-amber-400">
                    <Cpu className="h-6 w-6" />
                    {lifeOS.name}
                  </h2>
                </div>
              </div>
              <p className="text-lg font-medium text-foreground mb-3 italic">
                "{lifeOS.mission}"
              </p>
              <p className="text-muted-foreground leading-relaxed mb-4">{lifeOS.description}</p>
              <p className="text-muted-foreground leading-relaxed">{lifeOS.description2}</p>
            </div>

            {/* Capabilities grid */}
            <div className="relative p-8 border-b border-border/50">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-6">
                {lifeOS.whatItCan}
              </h3>
              <div className="grid md:grid-cols-2 gap-4 lg:grid-cols-3">
                {lifeOS.capabilities.map((cap, i) => (
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

            {/* Philosophy pillars */}
            <div className="relative p-8">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
                {lifeOS.rightKind}
              </h3>
              <div className="grid md:grid-cols-3 gap-6">
                {lifeOS.pillars.map((p, i) => (
                  <div key={i} className="space-y-1.5">
                    <p className="text-sm font-semibold text-foreground">{p.title}</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">{p.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-card/30">
        <div className="max-w-4xl mx-auto px-6 py-24 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-medium mb-8">
            <CalendarDays className="h-3 w-3" />
            {cta.badge}
          </div>
          <h2 className="text-3xl md:text-4xl font-bold mb-5">{cta.title}</h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto mb-10 leading-relaxed">
            {cta.subtitle}
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Button asChild size="lg" className="gap-2">
              <Link to="/signup">
                {cta.getStarted} <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/features">{cta.seeFeatures}</Link>
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/50">
        <div className="max-w-6xl mx-auto px-6 py-8 flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" />
            <span>AXIS</span>
          </div>
          <div className="flex items-center gap-6">
            <Link to="/features" className="hover:text-foreground transition-colors">{t('nav.features')}</Link>
            <Link to="/roadmap" className="hover:text-foreground transition-colors">{t('nav.roadmap')}</Link>
            <Link to="/faq" className="hover:text-foreground transition-colors">{t('nav.faq')}</Link>
            <Link to="/login" className="hover:text-foreground transition-colors">{t('nav.login')}</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
