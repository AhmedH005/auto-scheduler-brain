// Synchronously applies the saved theme class before React renders,
// preventing a flash of the wrong theme. Mirrors ThemeContext.applyTheme
// but runs at module-load (eager) instead of inside React.

type Theme = 'dark' | 'light' | 'midnight' | 'paper' | 'mono';

const VALID: Theme[] = ['dark', 'light', 'midnight', 'paper', 'mono'];

const stored = localStorage.getItem('axis_theme') ?? 'dark';
const saved: Theme = VALID.includes(stored as Theme) ? (stored as Theme) : 'dark';

const root = document.documentElement;
root.classList.remove('light', 'theme-midnight', 'theme-paper', 'theme-mono');
if (saved === 'light') root.classList.add('light');
else if (saved === 'midnight') root.classList.add('theme-midnight');
else if (saved === 'paper') root.classList.add('theme-paper');
else if (saved === 'mono') root.classList.add('theme-mono');

export const INITIAL_THEME: Theme = saved;
