import { useTranslation } from 'react-i18next';

const LANGUAGES = [
  { code: 'en', label: 'EN', dir: 'ltr' },
  { code: 'fr', label: 'FR', dir: 'ltr' },
  { code: 'ar', label: 'AR', dir: 'rtl' },
] as const;

export function LanguageSwitcher() {
  const { i18n } = useTranslation();

  const handleChange = (code: string, dir: string) => {
    i18n.changeLanguage(code);
    localStorage.setItem('autosched_lang', code);
    document.documentElement.dir = dir;
    document.documentElement.lang = code;
  };

  return (
    <div className="flex gap-0.5">
      {LANGUAGES.map(l => (
        <button
          key={l.code}
          onClick={() => handleChange(l.code, l.dir)}
          className={`px-1.5 py-0.5 text-[10px] font-mono rounded transition-colors ${
            i18n.language === l.code
              ? 'bg-primary/20 text-primary font-semibold'
              : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
          }`}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}
