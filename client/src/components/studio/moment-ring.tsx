// Three-segment progress ring for the free-card mechanic. Shared by the
// studio home's world section and /studio/moments so the two can't
// drift. `size` in px; stroke colours via currentColor-adjacent classes.
export function ProgressRing({ filled, size = 112 }: { filled: number; size?: number }) {
  const R = 44;
  const C = 2 * Math.PI * R;
  const seg = C / 3;
  const gap = 8;
  return (
    <svg viewBox="0 0 110 110" style={{ width: size, height: size }} className="-rotate-90">
      {[0, 1, 2].map((i) => (
        <circle
          key={i}
          cx="55"
          cy="55"
          r={R}
          fill="none"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${seg - gap} ${C - seg + gap}`}
          strokeDashoffset={-i * seg}
          className={i < filled ? 'stroke-brand transition-all duration-700' : 'stroke-stone-200'}
        />
      ))}
    </svg>
  );
}
