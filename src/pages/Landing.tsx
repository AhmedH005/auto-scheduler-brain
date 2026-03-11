import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { CalendarDays, Zap, Lock, RefreshCw, ChevronRight, Brain, Clock, Target } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

const FEATURE_ICONS = [
  <Brain className="h-5 w-5 text-primary" />,
  <Clock className="h-5 w-5 text-primary" />,
  <RefreshCw className="h-5 w-5 text-primary" />,
  <Lock className="h-5 w-5 text-primary" />,
  <CalendarDays className="h-5 w-5 text-primary" />,
  <Target className="h-5 w-5 text-primary" />,
];

export default function Landing() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const features = t('landing.features', { returnObjects: true }) as { title: string; desc: string }[];

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
            <LanguageSwitcher />
            <Link to="/features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              {t('nav.features')}
            </Link>
            <Link to="/faq" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              {t('nav.faq')}
            </Link>
            {user ? (
              <Button asChild size="sm">
                <Link to="/app/calendar">{t('nav.openApp')}</Link>
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <Button asChild variant="ghost" size="sm">
                  <Link to="/login">{t('nav.login')}</Link>
                </Button>
                <Button asChild size="sm">
                  <Link to="/signup">{t('nav.signup')}</Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-24 pb-20 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-medium mb-8">
          <Zap className="h-3 w-3" />
          {t('landing.badge')}
        </div>
        <h1 className="text-5xl font-bold tracking-tight mb-6 leading-tight">
          {t('landing.heroTitle')}<br />
          <span className="text-primary">{t('landing.heroTitleHighlight')}</span>
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
          {t('landing.heroSubtitle')}
        </p>
        <div className="flex items-center justify-center gap-4">
          {user ? (
            <Button asChild size="lg" className="gap-2">
              <Link to="/app/calendar">
                {t('landing.openScheduler')} <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
          ) : (
            <>
              <Button asChild size="lg" className="gap-2">
                <Link to="/signup">
                  {t('landing.getStarted')} <ChevronRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/login">{t('nav.login')}</Link>
              </Button>
            </>
          )}
        </div>
      </section>

      {/* Features grid */}
      <section className="max-w-6xl mx-auto px-6 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <div key={i} className="rounded-lg border border-border bg-card p-6">
              <div className="mb-3">{FEATURE_ICONS[i]}</div>
              <h3 className="font-semibold mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border bg-card/30">
        <div className="max-w-6xl mx-auto px-6 py-20 text-center">
          <h2 className="text-3xl font-bold mb-4">{t('landing.ctaTitle')}</h2>
          <p className="text-muted-foreground mb-8">{t('landing.ctaSubtitle')}</p>
          {user ? (
            <Button asChild size="lg">
              <Link to="/app/calendar">{t('landing.openScheduler')}</Link>
            </Button>
          ) : (
            <Button asChild size="lg">
              <Link to="/signup">{t('landing.getStarted')}</Link>
            </Button>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50">
        <div className="max-w-6xl mx-auto px-6 py-8 flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" />
            <span>{t('app.name')}</span>
          </div>
          <div className="flex items-center gap-6">
            <Link to="/features" className="hover:text-foreground transition-colors">{t('nav.features')}</Link>
            <Link to="/faq" className="hover:text-foreground transition-colors">{t('nav.faq')}</Link>
            <Link to="/login" className="hover:text-foreground transition-colors">{t('nav.login')}</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
