'use client';

import { useEffect, useRef } from 'react';
import { EASE_IN_OUT_SINE, randomBetween, startAmbientLoops } from '../../_lib/motion';

export function OrbsGraphic() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(
    () =>
      startAmbientLoops(ref.current, '.orb', (_, i) => ({
        keyframes: [
          { transform: 'translate(0px, 0px) scale(1)' },
          {
            transform: `translate(${randomBetween(-40, 40)}px, ${randomBetween(-40, 40)}px) scale(${randomBetween(0.8, 1.3)})`,
          },
        ],
        options: {
          duration: randomBetween(6000, 12_000),
          delay: i * 200,
          easing: EASE_IN_OUT_SINE,
          direction: 'alternate',
        },
      })),
    [],
  );
  return (
    <div ref={ref} aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="orb absolute top-[12%] left-[8%] size-64 rounded-full bg-white/25 blur-3xl" />
      <div className="orb absolute top-[40%] right-[12%] size-96 rounded-full bg-black/20 blur-3xl" />
      <div className="orb absolute bottom-[10%] left-[30%] size-80 rounded-full bg-white/15 blur-3xl" />
      <div className="orb absolute top-[60%] left-[60%] size-72 rounded-full bg-white/20 blur-3xl" />
    </div>
  );
}
