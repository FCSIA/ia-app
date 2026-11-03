'use client';

import { useEffect, useRef } from 'react';
import { startAmbientLoops } from '../../_lib/motion';

// Each rotating layer is its own root <svg> so the compositor can rotate it.
// Rotating <g> children repaints the whole SVG every frame. `w-full` on the
// absolute layers matches the box the original single in-flow SVG resolved to.
const LAYERS = [
  { turn: 360, duration: 40_000, circles: [{ r: 320 }, { r: 280, dash: '4 12' }] },
  { turn: -360, duration: 60_000, circles: [{ r: 220, dash: '2 10' }, { r: 160 }] },
  { turn: 360, duration: 40_000, circles: [{ r: 100, dash: '6 6' }] },
] as const;

export function RingsGraphic() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(
    () =>
      startAmbientLoops(ref.current, '.ring', (_, i) => ({
        keyframes: [{ transform: 'rotate(0deg)' }, { transform: `rotate(${LAYERS[i].turn}deg)` }],
        options: { duration: LAYERS[i].duration, easing: 'linear' },
      })),
    [],
  );
  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-30"
    >
      {LAYERS.map((layer, i) => (
        <svg key={i} viewBox="0 0 800 800" className="ring absolute w-full max-w-none">
          {layer.circles.map((circle) => (
            <circle
              key={circle.r}
              cx="400"
              cy="400"
              r={circle.r}
              stroke="white"
              strokeWidth="1"
              fill="none"
              strokeDasharray={'dash' in circle ? circle.dash : undefined}
            />
          ))}
        </svg>
      ))}
    </div>
  );
}
