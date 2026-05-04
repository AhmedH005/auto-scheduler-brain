/**
 * AssistantBar — the always-on composer at the bottom of the app.
 *
 * Best-practice synthesis (Linear, Superhuman, Things 3, Cron, Raycast):
 * the most-used action should never be gated behind a button or modal.
 * For axis the most-used action is "tell axis what's happening." So the
 * input lives at the bottom of the viewport at all times, focused on
 * load.
 *
 * Submitting expands a thread upward showing the back-and-forth. Esc
 * collapses. ⌘/ focuses from anywhere. The thread is bounded (last 12
 * turns) — this is a working memory, not a chat log.
 */

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ArrowUp, X } from 'lucide-react';

export interface ThreadTurn {
  from: 'user' | 'axis';
  text: string;
  at: number;
}

interface AssistantBarProps {
  thread: ThreadTurn[];
  onSubmit: (input: string) => void;
  onClearThread: () => void;
}

export function AssistantBar({ thread, onSubmit, onClearThread }: AssistantBarProps) {
  const [input, setInput] = useState('');
  const [expanded, setExpanded] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);

  // Focus on mount — composer is the spine.
  useEffect(() => {
    const id = setTimeout(() => inputRef.current?.focus(), 120);
    return () => clearTimeout(id);
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    if (!inputRef.current) return;
    inputRef.current.style.height = 'auto';
    inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`;
  }, [input]);

  // ⌘/ focus from anywhere; Esc collapse
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === 'Escape' && expanded) {
        setExpanded(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded]);

  // Scroll thread to bottom whenever new turn arrives
  useEffect(() => {
    if (expanded) threadEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [thread, expanded]);

  const submit = () => {
    const v = input.trim();
    if (!v) return;
    onSubmit(v);
    setInput('');
    setExpanded(true);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 pointer-events-none">
      {/* Thread — slides up above the composer */}
      <AnimatePresence>
        {expanded && thread.length > 0 && (
          <motion.div
            key="thread"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className="pointer-events-auto mx-auto max-w-2xl px-4 mb-2"
          >
            <div className="bg-card/95 backdrop-blur-xl border border-border rounded-2xl shadow-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 border-b border-border/60">
                <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground/60">
                  conversation
                </span>
                <button
                  onClick={() => { onClearThread(); setExpanded(false); }}
                  className="text-muted-foreground/50 hover:text-foreground transition-colors p-1 rounded"
                  aria-label="Close conversation"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="max-h-[40vh] overflow-y-auto px-4 py-3 space-y-3">
                {thread.slice(-12).map((turn, i) => (
                  <ThreadBubble key={turn.at + '-' + i} turn={turn} />
                ))}
                <div ref={threadEndRef} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Composer — the spine */}
      <div className="pointer-events-auto mx-auto max-w-2xl px-4 pb-4 pt-2">
        <motion.div
          layout
          className="bg-card/95 backdrop-blur-xl border border-border rounded-2xl shadow-2xl flex items-end gap-2 px-3 py-2.5"
        >
          <div className="w-7 h-7 shrink-0 rounded-lg bg-primary/15 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
          </div>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            onFocus={() => thread.length > 1 && setExpanded(true)}
            placeholder='tell axis…  ("read paper 90m friday" · "what’s next" · "I finished standup")'
            rows={1}
            className="flex-1 bg-transparent resize-none text-body text-foreground placeholder:text-muted-foreground/45 focus:outline-none min-h-[24px] max-h-[120px] py-1"
            spellCheck={false}
            autoComplete="off"
          />
          <button
            onClick={submit}
            disabled={input.trim().length === 0}
            className="w-8 h-8 shrink-0 rounded-lg bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:brightness-110 transition-all"
            aria-label="Send"
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
        </motion.div>
        <div className="flex items-center justify-center gap-3 mt-2 text-[10px] font-mono text-muted-foreground/45">
          <span><kbd className="px-1 rounded border border-border/60 bg-secondary/30">⌘/</kbd> focus</span>
          <span><kbd className="px-1 rounded border border-border/60 bg-secondary/30">↵</kbd> send</span>
          <span><kbd className="px-1 rounded border border-border/60 bg-secondary/30">⇧↵</kbd> newline</span>
          {thread.length > 1 && !expanded && (
            <button
              onClick={() => setExpanded(true)}
              className="ml-2 text-primary/70 hover:text-primary transition-colors"
            >
              ↑ {thread.length - 1} turn{thread.length - 1 === 1 ? '' : 's'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ThreadBubble({ turn }: { turn: ThreadTurn }) {
  if (turn.from === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] px-3 py-2 rounded-2xl rounded-br-md bg-primary/15 text-primary text-body leading-snug">
          {turn.text}
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2">
      <div className="w-5 h-5 mt-0.5 shrink-0 rounded-md bg-primary/15 flex items-center justify-center">
        <Sparkles className="w-2.5 h-2.5 text-primary" />
      </div>
      <div className="max-w-[80%] text-body text-foreground/85 leading-snug">{turn.text}</div>
    </div>
  );
}
