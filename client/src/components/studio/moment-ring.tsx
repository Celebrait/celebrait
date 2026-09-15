// The free-card progress ring — the ONE ring, shared by the studio
// home's world band, /studio/moments and the landing invite so the
// visual language can't drift (Kevin 2026-08-03: the old chunky
// three-segment version "read as a loading spinner").
//
// The redesign's idea: a fine jewellery-weight track, a single
// continuous arc that grows as dates land, and three small "stones" at
// the third-points — each date you add sets one. Full ring = all three
// stones lit. Calm at rest, legible from 44px up.

import { useId } from 'react';

export function ProgressRing({
  filled,
  size = 112,
}: {
  /** Key dates added, 0–3. */
  filled: number;
  size?: number;
}) {
  const gid = useId();
  const n = Math.max(0, Math.min(3, filled));
  const R = 46;
  const C = 2 * Math.PI * R;
  // Stones sit at the third-points, measured clockwise from the top.
  // Stone k lights once the arc has reached it (filled > k), with the
  // top stone (k=2, a full lap) lighting only at 3/3.
  const stoneAngle = (k: number) => ((k + 1) / 3) * 2 * Math.PI - Math.PI / 2;

  return (
    <svg
      viewBox="0 0 110 110"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${n} of 3 dates added`}
    >
      <defs>
        <linearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#5c57d4" />
          <stop offset="100%" stopColor="#8B87E8" />
        </linearGradient>
      </defs>

      {/* Track — hairline, barely-there lavender. */}
      <circle cx="55" cy="55" r={R} fill="none" stroke="#E9E6F8" strokeWidth="3" />

      {/* While incomplete, a short comet arc slowly orbits the track —
          visible motion at any size, reads as anticipation rather than
          decoration (Aidan 2026-08-03: the blurred-glow attempt was
          muddy and the tiny breathing stone invisible). */}
      {n < 3 && (
        <g className="animate-ring-orbit">
          <circle
            cx="55"
            cy="55"
            r={R}
            fill="none"
            stroke={`url(#${gid})`}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={`${C * 0.16} ${C}`}
            transform="rotate(-90 55 55)"
            opacity="0.6"
          />
        </g>
      )}

      {/* Progress — one continuous arc from the top, clockwise. */}
      {n > 0 && (
        <circle
          cx="55"
          cy="55"
          r={R}
          fill="none"
          stroke={`url(#${gid})`}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${(C * n) / 3} ${C}`}
          transform="rotate(-90 55 55)"
          className="transition-all duration-700 ease-out"
        />
      )}

      {/* The three stones. Lit = a date is set; the NEXT one to earn
          breathes gently — the ring should feel like it's waiting to
          grow (Aidan 2026-08-03), not sitting inert. */}
      {[0, 1, 2].map((k) => {
        const a = stoneAngle(k);
        const x = 55 + R * Math.cos(a);
        const y = 55 + R * Math.sin(a);
        const lit = n > k;
        const isNext = !lit && k === n && n < 3;
        return (
          <g key={k}>
            {/* Radar ping radiating from the next stone to earn — a
                clear, crisp "this one's waiting for you". */}
            {isNext && (
              <circle
                cx={x}
                cy={y}
                r="5"
                fill="none"
                stroke="#5c57d4"
                strokeWidth="2"
                className="animate-stone-ping"
              />
            )}
            <circle
              cx={x}
              cy={y}
              r="5"
              fill={lit ? '#5c57d4' : '#FFFDF9'}
              stroke={lit ? '#FFFDF9' : isNext ? '#5c57d4' : '#D9D5F0'}
              strokeWidth={lit ? 2 : 1.5}
              className="transition-all duration-500"
            />
          </g>
        );
      })}
    </svg>
  );
}
