/**
 * Sheet — overlay primitive with two presentation modes.
 *
 *   • position="right" (default) — slides in from the right edge. Used
 *     for context-preserving panels: SettingsSheet, IntegrationsSheet,
 *     WeeklyRetrospectiveSheet, edit-existing flows.
 *
 *   • position="center" — fades + scales into the viewport center.
 *     Used for focused modal dialogs: new-task creation, confirmation.
 *     Linear / Cron / Notion converge on centered for "intent-focused"
 *     surfaces and right-slide for "in-context" surfaces.
 *
 * Both share Esc-to-close, click-outside-to-close, body-scroll-lock,
 * and the same backdrop blur. Width by-prop (sm/md/lg).
 */

import { useEffect, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

type SheetSize = 'sm' | 'md' | 'lg';
type SheetPosition = 'right' | 'center';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  size?: SheetSize;
  position?: SheetPosition;
  children: ReactNode;
  /** Renders below children, above the safe-area. Used for primary CTAs. */
  footer?: ReactNode;
  /** Hide the X close button. Defaults to false. */
  hideClose?: boolean;
}

const sizeWidthClass: Record<SheetSize, string> = {
  sm: 'w-full sm:w-[340px]',
  md: 'w-full sm:w-[420px]',
  lg: 'w-full sm:w-[560px]',
};

export function Sheet({
  open,
  onClose,
  title,
  description,
  size = 'md',
  position = 'right',
  children,
  footer,
  hideClose,
}: SheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const isRight = position === 'right';

  // Why the wrapper-div pattern for center: framer-motion's animate prop
  // sets inline transform styles (translateY/scale) that override the
  // Tailwind `-translate-x-1/2` we'd otherwise use to center. So we put
  // centering on a parent that DOESN'T animate, and only scale/opacity
  // on the inner motion element. The right-slide pattern doesn't need
  // this because its motion is a translateX from 32 → 0.
  const inner = (
    <>
      {(title || description || !hideClose) && (
        <header className="shrink-0 px-6 py-4 border-b border-border flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {title && (
              <h2 className="text-[18px] font-semibold text-foreground tracking-tight leading-tight">
                {title}
              </h2>
            )}
            {description && (
              <p className="text-[12px] text-muted-foreground/75 mt-1 leading-relaxed">
                {description}
              </p>
            )}
          </div>
          {!hideClose && (
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground hover:bg-secondary/50 rounded-md p-1 -mr-1 transition-colors shrink-0 -mt-0.5"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </header>
      )}
      <div className="flex-1 overflow-y-auto min-h-0">{children}</div>
      {footer && (
        <footer className="shrink-0 px-5 py-3 border-t border-border bg-card/80">
          {footer}
        </footer>
      )}
    </>
  );

  const panelStyle: React.CSSProperties = {
    boxShadow:
      '0 32px 64px -32px rgba(0,0,0,0.55), 0 0 0 1px hsl(var(--border) / 0.5)',
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-40 bg-background/80 backdrop-blur-md"
            onClick={onClose}
            aria-hidden="true"
          />
          {isRight ? (
            <motion.aside
              key="panel"
              initial={{ opacity: 0, x: 32 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 32 }}
              transition={{ type: 'spring', stiffness: 380, damping: 34 }}
              role="dialog"
              aria-modal="true"
              aria-label={title}
              className={`fixed right-3 top-3 bottom-3 z-50 ${sizeWidthClass[size]} bg-card border border-border flex flex-col rounded-2xl overflow-hidden`}
              style={panelStyle}
            >
              {inner}
            </motion.aside>
          ) : (
            <div
              key="panel-wrap"
              className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            >
              <motion.aside
                initial={{ opacity: 0, scale: 0.96, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, y: 8 }}
                transition={{ type: 'spring', stiffness: 380, damping: 34 }}
                role="dialog"
                aria-modal="true"
                aria-label={title}
                className={`pointer-events-auto ${sizeWidthClass[size]} max-h-[88vh] bg-card border border-border flex flex-col rounded-2xl overflow-hidden`}
                style={panelStyle}
              >
                {inner}
              </motion.aside>
            </div>
          )}
        </>
      )}
    </AnimatePresence>
  );
}
