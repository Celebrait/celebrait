// client/src/components/landing/rise.tsx
//
// The landing pages' one entrance: fade + 12px rise, once, as a block
// scrolls into view. Lived inside landing-keeper.tsx until 2026-10-09,
// when its sections started being shared with /create — a helper the
// pages share has to live outside either page.

import { motion } from 'framer-motion';

export const EASE = [0.22, 1, 0.36, 1] as const;

export function Rise({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.55, delay, ease: EASE }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
