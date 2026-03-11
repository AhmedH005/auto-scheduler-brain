import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Brain, ChevronRight, Zap, Lock, RefreshCw, CalendarDays, Clock, Target, Sliders, Layers } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';

const FEATURE_ICONS = [
  <Brain className="h-6 w-6 text-primary" />,
  <Sliders className="h-6 w-6 text-primary" />,
  <Layers className="h-6 w-6 text-primary" />,
  <RefreshCw className="h-6 w-6 text-primary" />,
  <Lock className="h-6 w-6 text-primary" />,
  <CalendarDays className="h-6 w-6 text-primary" />,
  <Target className="h-6 w-6 text-primary" />,
  <Clock className="h-6 w-6 text-primary" />,
  <Zap className="h-6 w-6 text-primary" />,
];

export default function Features() {
  const { t } = useTranslation();
  const items = t('featuresPage.items', { returnObjects: true }) as { title: string; desc: string }[];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-semibold text-primary">
            <Brain className="h-5 w-5" />
            <span>{t('app.name')}</span>
          </Link>
          <div className="flex items-center gap-4">
            <ThemeSwitcher />
            <LanguageSwitcher />
            <Link to="/features" className="text-sm text-foreground font-medium">{t('nav.features')}</Link>
            <Link to="/faq" className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t('nav.faq')}</Link>
            <Button asChild size="sm">
              <Link to="/signup">{t('featuresPage.getStarted')}</Link>
            </Button>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold mb-4">{t('featuresPage.pageTitle')}</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            {t('featuresPage.pageSubtitle')}
          </p>
        </div>

        <div className="space-y-16">
          {items.map((f, i) => (
            <div key={i} className="flex gap-6">
              <div className="shrink-0 mt-1 p-2 rounded-lg bg-primary/10 border border-primary/20 h-fit">
                {FEATURE_ICONS[i]}
              </div>
              <div>
                <h2 className="text-xl font-semibold mb-2">{f.title}</h2>
                <p className="text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-20 text-center">
          <h2 className="text-2xl font-bold mb-4">{t('featuresPage.tryFree')}</h2>
          <Button asChild size="lg" className="gap-2">
            <Link to="/signup">
              {t('featuresPage.getStarted')} <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
