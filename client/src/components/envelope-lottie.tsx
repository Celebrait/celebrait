// client/src/components/envelope-lottie.tsx
//
// Shared Lottie-driven envelope. Single source of truth for the
// "closed → opening" frame sequence, so every surface that shows
// the envelope (digital viewer welcome gate, studio reveal moment)
// animates identically.
//
// Source animation timeline (envelope-open.lottie.json):
//   frames  0- 34  envelope fades in
//   frames 35- 58  flap opens
//   frames 51- 77  letter emerges (unused; we cut at the open moment)
// We park at frame 34 (envelope fully visible + closed) as idle, and
// play to `ENVELOPE_END_FRAME` on `opening=true`.
//
// Pure presentational — choreography (float, tap, caption fade, exit)
// lives in the caller.

import { useEffect, useRef } from 'react';
import Lottie from 'lottie-react';
import envelopeAnimation from '../assets/envelope-open.lottie.json';

export const ENVELOPE_IDLE_FRAME = 34;
export const ENVELOPE_END_FRAME = 105;

interface EnvelopeLottieProps {
  /** When flipped true, plays the open segment once. False = idle on
   *  the closed-but-visible frame. Parent owns the one-way transition. */
  opening: boolean;
  /** Tailwind size classes. Defaults to the sizing used by the
   *  welcome gate (w-56 h-56 on mobile, w-64 h-64 from sm up). */
  className?: string;
}

export function EnvelopeLottie({
  opening,
  className = 'w-56 h-56 sm:w-64 sm:h-64',
}: EnvelopeLottieProps) {
  const lottieRef = useRef<any>(null);

  // Seek to the closed-but-visible frame on mount. lottie-react's
  // DOMLoaded callback fires once the animation is ready to control.
  const handleDomLoaded = () => {
    if (lottieRef.current) {
      lottieRef.current.goToAndStop(ENVELOPE_IDLE_FRAME, true);
    }
  };

  useEffect(() => {
    if (opening && lottieRef.current) {
      lottieRef.current.playSegments(
        [ENVELOPE_IDLE_FRAME, ENVELOPE_END_FRAME],
        true,
      );
    }
  }, [opening]);

  return (
    <div
      className={className}
      style={{ filter: 'drop-shadow(0 18px 30px rgba(0,0,0,0.18))' }}
    >
      <Lottie
        lottieRef={lottieRef}
        animationData={envelopeAnimation}
        autoplay={false}
        loop={false}
        onDOMLoaded={handleDomLoaded}
        className="w-full h-full"
      />
    </div>
  );
}
