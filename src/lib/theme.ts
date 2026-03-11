// Synchronously applies the saved theme class before React renders,
// preventing a flash of the wrong theme.
const saved = (localStorage.getItem('autosched_theme') || 'dark') as 'dark' | 'light';

if (saved === 'light') {
  document.documentElement.classList.add('light');
} else {
  document.documentElement.classList.remove('light');
}

export const INITIAL_THEME: 'dark' | 'light' = saved;
