// client/src/components/landing/shimmer-word.tsx
//
// The "Unbinnable" shimmer — the one glow treatment on the landing pages.
// Gradient-clipped text that runs BLACK through PURPLE and back to
// black, with the violet wave sweeping left-to-right every ~8s.
//
// ONE component because several headlines wear it — the photo hero's
// rotating persona ("your best mate"), the proof heading's "used", the
// print statement's "magic's", and /create's "all about them" — and
// Kevin's call is that they must match exactly (2026-07-14). Defining the
// gradient twice is how they'd silently drift apart. Still under
// prefers-reduced-motion: the ink-to-violet gradient stays, the wave stops.
// (Moved out of landing-keeper.tsx 2026-10-09; that page re-exports it.)

//
// 2026-11-12: the shimmer is now the HERO's alone (and /create's). The
// other headings wear `Highlight` below — the studio's plain violet
// phrase ("Nan's birthday is in 8 days"). Mid-sweep the gradient made
// one word look like a single mis-coloured letter in any still frame,
// and its px-1 padding nudged the word out of line with the text above.

import { motion } from 'framer-motion';

/** The studio's emphasis, on the landing pages: one phrase in brand
 *  violet. No motion, no padding. */
export function Highlight({ children }: { children: React.ReactNode }) {
  return <span className="text-keeper-gold">{children}</span>;
}

export function ShimmerWord({
  children,
  reduced,
}: {
  children: string;
  reduced: boolean;
}) {
  return (
    <motion.span
      className="inline-block overflow-visible bg-clip-text px-1 pb-[0.12em] text-transparent"
      style={{
        backgroundImage:
          'linear-gradient(90deg, #211D19 0%, #211D19 30%, #7a76e8 45%, #5c57d4 50%, #7a76e8 55%, #211D19 70%, #211D19 100%)',
        backgroundSize: '220% 100%',
        backgroundRepeat: 'no-repeat',
      }}
      initial={{ backgroundPosition: '0% 0%' }}
      animate={reduced ? undefined : { backgroundPosition: ['0% 0%', '100% 0%', '0% 0%'] }}
      transition={
        reduced
          ? undefined
          : {
              duration: 4,
              repeat: Infinity,
              repeatDelay: 4.5,
              ease: 'easeInOut',
              delay: 0.8,
              times: [0, 0.5, 1],
            }
      }
    >
      {children}
    </motion.span>
  );
}
