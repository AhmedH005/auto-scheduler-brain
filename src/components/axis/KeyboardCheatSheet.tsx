/**
 * KeyboardCheatSheet — `?` overlay listing every keyboard shortcut.
 *
 * Pattern lineage: Linear / Notion / Cron / Slack all use a `?`-keyed
 * cheat sheet as the canonical "discoverability for keyboard users"
 * surface. Ships in every power-user productivity tool because it's
 * the cheapest way to teach shortcuts without a tutorial.
 *
 * Convention: pressing `?` (without modifier, when not focused in an
 * input) opens the sheet. Esc closes. Click outside closes.
 */

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Keyboard } from 'lucide-react';

interface KeyboardCheatSheetProps {
  open: boolean;
  onClose: () => void;
}

const SECTIONS: Array<{
  title: string;
  items: Array<{ keys: string[]; label: string }>;
}> = [
  {
    title: 'General',
    items: [
      { keys: ['?'], label: 'Show this cheat sheet' },
      { keys: ['Esc'], label: 'Close panel / modal' },
      { keys: ['⌘', 'K'], label: 'Open command menu' },
      { keys: ['⌘', '\\'], label: 'Toggle sidebar' },
    ],
  },
  {
    title: 'Tasks',
    items: [
      { keys: ['⌘', 'N'], label: 'New task' },
      { keys: ['A'], label: 'Add task (no modifier)' },
      { keys: ['⌘', '↵'], label: 'Save task (in form)' },
    ],
  },
  {
    title: 'Calendar',
    items: [
      { keys: ['T'], label: 'Jump to today' },
      { keys: ['1'], label: 'Day view' },
      { keys: ['2'], label: 'Week view' },
      { keys: ['3'], label: 'Month view' },
    ],
  },
];

export function KeyboardCheatSheet({ open, onClose }: KeyboardCheatSheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="cheat-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[90] bg-background/80 backdrop-blur-md"
            onClick={onClose}
            aria-hidden="true"
          />
          <div
            key="cheat-wrap"
            className="fixed inset-0 z-[91] flex items-center justify-center p-4 pointer-events-none"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 8 }}
              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              className="pointer-events-auto w-full max-w-[520px] max-h-[80vh] bg-card border border-border rounded-2xl overflow-hidden flex flex-col shadow-2xl"
              role="dialog"
              aria-modal="true"
              aria-label="Keyboard shortcuts"
            >
              <header className="shrink-0 px-6 py-4 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-md bg-primary/15 flex items-center justify-center">
                    <Keyboard className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-[16px] font-semibold text-foreground tracking-tight leading-tight">
                      Keyboard shortcuts
                    </h2>
                    <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                      press <Kbd>?</Kbd> any time to reopen
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="text-muted-foreground hover:text-foreground hover:bg-secondary/50 rounded-md p-1 transition-colors"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </header>

              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
                {SECTIONS.map(section => (
                  <section key={section.title}>
                    <h3 className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/55 mb-1.5">
                      {section.title}
                    </h3>
                    <ul className="space-y-0.5">
                      {section.items.map((item, i) => (
                        <li
                          key={i}
                          className="flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-secondary/25"
                        >
                          <span className="text-[12px] text-foreground/85">
                            {item.label}
                          </span>
                          <span className="flex items-center gap-1 shrink-0">
                            {item.keys.map((k, j) => (
                              <Kbd key={j}>{k}</Kbd>
                            ))}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded border border-border bg-secondary/40 text-[10px] font-mono text-foreground/80 shadow-sm">
      {children}
    </kbd>
  );
}
