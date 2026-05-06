/**
 * ThemeContext — multi-theme support.
 *
 * Five themes shipping:
 *   • dark (default) — midnight indigo + dawn amber. Original aesthetic.
 *   • light          — clean teal + white. Daytime / outdoors readability.
 *   • midnight       — pure black + violet. OLED-friendly, low-eyestrain
 *                      late-night. Common request from late-night users.
 *   • paper          — warm cream + sienna. Things 3 / iA Writer vibe.
 *                      Soft, low-contrast for long-reading days.
 *   • mono           — grayscale only, no color accents. Pure focus —
 *                      strips the color signal so nothing competes for
 *                      attention. (Lab / writing tool aesthetic.)
 *
 * The active theme is applied via a class on <html> ('', 'light',
 * 'theme-midnight', 'theme-paper', 'theme-mono'). All theme tokens
 * live in src/index.css under @layer base; this context only holds
 * the name and persists it to localStorage.
 */

import { createContext, useContext, useState, useCallback } from 'react';
import { INITIAL_THEME } from '@/lib/theme';

export type Theme = 'dark' | 'light' | 'midnight' | 'paper' | 'mono';

export const THEMES: Array<{
  id: Theme;
  label: string;
  description: string;
  swatch: string; // CSS color preview
}> = [
  { id: 'dark',     label: 'Dark',     description: 'Default — midnight indigo + amber',      swatch: 'hsl(28 95% 62%)' },
  { id: 'light',    label: 'Light',    description: 'Daytime — clean teal',                   swatch: 'hsl(175 65% 36%)' },
  { id: 'midnight', label: 'Midnight', description: 'Pure black + violet — OLED-friendly',    swatch: 'hsl(260 80% 65%)' },
  { id: 'paper',    label: 'Paper',    description: 'Warm cream + sienna — paper-like',       swatch: 'hsl(20 70% 48%)' },
  { id: 'mono',     label: 'Mono',     description: 'Grayscale only — no color, pure focus',  swatch: 'hsl(0 0% 70%)' },
];

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  setTheme: () => {},
  toggleTheme: () => {},
});

function applyTheme(t: Theme) {
  const root = document.documentElement;
  root.classList.remove('light', 'theme-midnight', 'theme-paper', 'theme-mono');
  if (t === 'light') root.classList.add('light');
  else if (t === 'midnight') root.classList.add('theme-midnight');
  else if (t === 'paper') root.classList.add('theme-paper');
  else if (t === 'mono') root.classList.add('theme-mono');
  // 'dark' = no class, the :root variables apply.
  localStorage.setItem('axis_theme', t);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(INITIAL_THEME as Theme);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    applyTheme(t);
  }, []);

  // Backwards-compat: dark↔light cycle for the topbar quick-toggle.
  const toggleTheme = useCallback(() => {
    setThemeState(prev => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
