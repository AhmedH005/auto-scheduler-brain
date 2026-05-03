/**
 * Sheet — generic right-slide-in overlay primitive.
 *
 * Replaces the previous sidebar-panel pattern (where opening Settings
 * REPLACED the task list — context loss). A Sheet floats above the
 * canvas, preserving the user's place in the app.
 *
 * Used by: SettingsSheet, IntegrationsSheet, RebuildPreviewSheet (next
 * round), WeeklyRetrospectiveSheet (next round) — gives every overlay
 * the same animation curve, escape-to-close, click-outside-to-close,
 * and accessibility wiring.
 *
 * Width is by-prop (default 420px). Use 'lg' (560px) for content-heavy
 * sheets like the retrospective. Use 'sm' (340px) for compact ones.
 */

import { useEffect, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

type SheetSize = 'sm' | 'md' | 'lg';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  size?: SheetSize;
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
  children,
  footer,
  hideClose,
}: SheetProps) {
  // Esc closes
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.aside
            key="panel"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={`fixed right-0 top-0 bottom-0 z-50 ${sizeWidthClass[size]} bg-card border-l border-border shadow-2xl flex flex-col`}
          >
            {/* Header */}
            {(title || description || !hideClose) && (
              <header className="shrink-0 px-5 py-4 border-b border-border flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  {title && <h2 className="text-display text-foreground tracking-tight">{title}</h2>}
                  {description && (
                    <p className="text-caption mt-0.5 leading-relaxed">{description}</p>
                  )}
                </div>
                {!hideClose && (
                  <button
                    onClick={onClose}
                    className="text-muted-foreground hover:text-foreground transition-colors shrink-0 -mt-0.5"
                    aria-label="Close"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </header>
            )}

            {/* Body */}
            <div className="flex-1 overflow-y-auto">{children}</div>

            {/* Footer */}
            {footer && (
              <footer className="shrink-0 px-5 py-3 border-t border-border bg-card/80">
                {footer}
              </footer>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
