// client/src/hooks/use-typewriter.ts — the rotating-placeholder machine
//
// Types a phrase → pauses → deletes → next. Only runs while `active`,
// so it never fights a user who's typing. Extracted from the scene step
// (2026-09-08) so the brief's "What's their thing?" field can type out
// examples too. Static under reduced motion: the first phrase, whole.

import { useEffect, useState } from 'react';

const TYPE_CHAR_MS = 42;
const BACKSPACE_CHAR_MS = 22;
const PAUSE_MS = 1700;

export function useTypewriter(phrases: string[], active: boolean): string {
  const [text, setText] = useState('');
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<'typing' | 'pausing' | 'deleting'>('typing');
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  // A new phrase list (the recipient changed) restarts from the top.
  useEffect(() => { setText(''); setIdx(0); setPhase('typing'); }, [phrases]);

  useEffect(() => {
    if (!active || reduced) return;
    const target = phrases[idx % phrases.length] ?? '';
    if (phase === 'typing') {
      if (text.length < target.length) {
        const t = setTimeout(() => setText(target.slice(0, text.length + 1)), TYPE_CHAR_MS);
        return () => clearTimeout(t);
      }
      const t = setTimeout(() => setPhase('pausing'), 0);
      return () => clearTimeout(t);
    }
    if (phase === 'pausing') {
      const t = setTimeout(() => setPhase('deleting'), PAUSE_MS);
      return () => clearTimeout(t);
    }
    if (text.length > 0) {
      const t = setTimeout(() => setText(text.slice(0, -1)), BACKSPACE_CHAR_MS);
      return () => clearTimeout(t);
    }
    setIdx((i) => i + 1);
    setPhase('typing');
  }, [phase, text, idx, phrases, active, reduced]);

  useEffect(() => {
    if (!active) { setText(''); setPhase('typing'); }
  }, [active]);

  if (reduced) return phrases[0] ?? '';
  return text;
}
