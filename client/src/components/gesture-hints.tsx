// client/src/components/gesture-hints.tsx
//
// Animated pointer-SVG hints overlaid on a 3D card stage. Tells the
// user what they can do — tap to open, drag to rotate, scroll to
// zoom. Fade in shortly after mount, fade out when the card opens.
//
// Shared between the public card viewer and the Studio review step
// so both surfaces carry the same discovery affordance.

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

interface GestureHintsProps {
  /** Hide the hints once the card opens — presumed engaged. Ignored
   *  when `alwaysVisible` is true. */
  open: boolean;
  /** Delay (ms) before the hints fade in on mount. Defaults 900ms.
   *  Ignored when `alwaysVisible` is true. */
  mountDelayMs?: number;
  /** Hide the "Scroll to zoom" hint. Use on surfaces where the
   *  Card3DViewer has `enableZoom={false}` (e.g. the marketing
   *  hero) so the hint copy isn't a lie. Default false. */
  hideZoomHint?: boolean;
  /** Render the hints STATICALLY — no mount fade-in, no fade-out
   *  when the card opens, always at full opacity. Used in modal
   *  contexts where the hints belong as fixed guidance (and where a
   *  fading row would change the modal's height mid-interaction).
   *  Default false. */
  alwaysVisible?: boolean;
}

export function GestureHints({
  open,
  mountDelayMs = 900,
  hideZoomHint = false,
  alwaysVisible = false,
}: GestureHintsProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (alwaysVisible) return; // no fade-in timing in static mode
    const t = setTimeout(() => setVisible(true), mountDelayMs);
    return () => clearTimeout(t);
  }, [mountDelayMs, alwaysVisible]);

  const HintsRow = (
    <div className="flex items-center gap-6 sm:gap-10">
      <Hint label="Tap to open">
        <TapGlyph />
      </Hint>
      <Hint label="Drag to rotate">
        <DragGlyph />
      </Hint>
      {!hideZoomHint && (
        <Hint label="Scroll to zoom" hideOnMobile>
          <ZoomGlyph />
        </Hint>
      )}
    </div>
  );

  // Static mode — render immediately, always visible, no motion.
  // Modal callers use this so the modal's height doesn't change as
  // hints fade in or out.
  if (alwaysVisible) {
    return <div className="flex justify-center">{HintsRow}</div>;
  }

  return (
    <AnimatePresence>
      {visible && !open && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8, transition: { duration: 0.3 } }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="flex justify-center"
        >
          {HintsRow}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Hint({
  label,
  children,
  hideOnMobile,
}: {
  label: string;
  children: React.ReactNode;
  hideOnMobile?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center gap-1.5 ${hideOnMobile ? 'hidden sm:flex' : ''}`}
    >
      <div className="w-9 h-9 flex items-center justify-center text-cta">
        {children}
      </div>
      <span className="text-[10px] uppercase tracking-[0.15em] text-stone-500">
        {label}
      </span>
    </div>
  );
}

// ── Glyphs ───────────────────────────────────────────────────────────

function TapGlyph() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
      {[0, 0.75].map((delay, i) => (
        <motion.circle
          key={i}
          cx="16"
          cy="16"
          r="6"
          stroke="currentColor"
          strokeWidth="1.4"
          initial={{ scale: 1, opacity: 0 }}
          animate={{ scale: [1, 2.2], opacity: [0.7, 0] }}
          transition={{ duration: 1.5, delay, repeat: Infinity, ease: 'easeOut' }}
          style={{ transformOrigin: '16px 16px' }}
        />
      ))}
      <circle cx="16" cy="16" r="3.5" fill="currentColor" />
    </svg>
  );
}

function DragGlyph() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
      {/* Orbit track — dashed so it reads as a path, not a ring */}
      <circle
        cx="16"
        cy="16"
        r="10"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeDasharray="2 3"
        opacity="0.35"
      />
      {/* Moving dot — larger + trailing ghost for readable motion */}
      <motion.g
        animate={{ rotate: 360 }}
        transition={{ duration: 2.2, repeat: Infinity, ease: 'linear' }}
        style={{ transformOrigin: '16px 16px' }}
      >
        <circle cx="26" cy="16" r="2" fill="currentColor" opacity="0.3" />
        <circle cx="26" cy="16" r="3.5" fill="currentColor" />
      </motion.g>
      {/* Fixed centre pip so the orbit has a subject to orbit around */}
      <circle cx="16" cy="16" r="1.5" fill="currentColor" opacity="0.5" />
    </svg>
  );
}

function ZoomGlyph() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
      <circle cx="14" cy="14" r="7" stroke="currentColor" strokeWidth="1.6" />
      <line
        x1="19.5"
        y1="19.5"
        x2="24"
        y2="24"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <motion.g
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
      >
        <line
          x1="14"
          y1="11"
          x2="14"
          y2="17"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        <line
          x1="11"
          y1="14"
          x2="17"
          y2="14"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </motion.g>
    </svg>
  );
}
