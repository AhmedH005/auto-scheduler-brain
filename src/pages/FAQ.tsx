import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Brain, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border last:border-0">
      <button
        className="w-full flex items-center justify-between py-5 text-left gap-4"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="font-medium">{q}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <p className="text-muted-foreground text-sm leading-relaxed pb-5">{a}</p>
      )}
    </div>
  );
}

export default function FAQ() {
  const { t } = useTranslation();
  const items = t('faqPage.items', { returnObjects: true }) as { q: string; a: string }[];

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
            <Link to="/features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t('nav.features')}</Link>
            <Link to="/faq" className="text-sm text-foreground font-medium">{t('nav.faq')}</Link>
            <Button asChild size="sm">
              <Link to="/signup">{t('nav.signup')}</Link>
            </Button>
          </div>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold mb-4">{t('faqPage.pageTitle')}</h1>
          <p className="text-muted-foreground text-lg">{t('faqPage.pageSubtitle')}</p>
        </div>

        <div className="rounded-lg border border-border bg-card px-6">
          {items.map((faq, i) => (
            <FAQItem key={i} q={faq.q} a={faq.a} />
          ))}
        </div>

        <div className="mt-16 text-center">
          <p className="text-muted-foreground mb-4">{t('faqPage.stillQuestions')}</p>
          <Button asChild variant="outline">
            <Link to="/signup">{t('faqPage.tryButton')}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
