import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Brain } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

export default function Signup() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError(t('auth.passwordTooShort'));
      return;
    }

    setLoading(true);
    const { error } = await signUp(email, password, displayName);
    setLoading(false);

    if (error) {
      setError(error);
    } else {
      setSuccess(true);
      setTimeout(() => navigate('/app/calendar', { replace: true }), 1500);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Nav */}
      <nav className="border-b border-border/50">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-semibold text-primary">
            <Brain className="h-5 w-5" />
            <span>{t('app.name')}</span>
          </Link>
          <LanguageSwitcher />
        </div>
      </nav>

      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold mb-1">{t('auth.signupTitle')}</h1>
            <p className="text-sm text-muted-foreground">{t('auth.signupSubtitle')}</p>
          </div>

          {success ? (
            <div className="text-center p-6 rounded-lg border border-primary/30 bg-primary/5">
              <p className="font-medium text-primary mb-1">{t('auth.accountCreated')}</p>
              <p className="text-sm text-muted-foreground">{t('auth.redirecting')}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="displayName">{t('auth.displayName')}</Label>
                <Input
                  id="displayName"
                  type="text"
                  placeholder={t('auth.namePlaceholder')}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">{t('auth.email')}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={t('auth.emailPlaceholder')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">{t('auth.password')}</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder={t('auth.passwordPlaceholder')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? t('auth.creatingAccount') : t('auth.createAccount')}
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                {t('auth.termsNotice')}
              </p>
            </form>
          )}

          <p className="text-center text-sm text-muted-foreground mt-6">
            {t('auth.haveAccount')}{' '}
            <Link to="/login" className="text-primary hover:underline">
              {t('auth.loginLink')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
