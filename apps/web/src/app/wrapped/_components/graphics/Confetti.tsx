'use client';

import { useEffect, useRef, useState } from 'react';
import { EASE_IN_OUT_SINE, randomBetween, startAmbientLoops } from '../../_lib/motion';

function createPieces() {
  return Array.from({ length: 36 }, () => ({
    top: `${Math.random() * 100}%`,
    left: `${Math.random() * 100}%`,
    width: `${6 + Math.random() * 10}px`,
    height: `${6 + Math.random() * 14}px`,
    opacity: 0.35 + Math.random() * 0.5,
    rotate: Math.random() * 360,
  }));
}

export function ConfettiGraphic() {
  const ref = useRef<HTMLDivElement>(null);
  // Generated once per mount so parent re-renders don't teleport the pieces
  // or overwrite the running transform.
  const [pieces] = useState(createPieces);
  useEffect(
    () =>
      startAmbientLoops(ref.current, '.confetti', (_, i) => {
        const { rotate } = pieces[i];
        return {
          keyframes: [
            { transform: `translate(0px, 0px) rotate(${rotate}deg)` },
            {
              transform: `translate(${randomBetween(-40, 40)}px, ${randomBetween(-80, 80)}px) rotate(${rotate + randomBetween(-180, 180)}deg)`,
            },
          ],
          options: {
            duration: randomBetween(4000, 9000),
            easing: EASE_IN_OUT_SINE,
            direction: 'alternate',
          },
        };
      }),
    [pieces],
  );
  return (
    <div ref={ref} aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map(({ rotate, ...piece }, i) => (
        <span
          key={i}
          className="confetti absolute block rounded-sm bg-white/70"
          style={{ ...piece, transform: `rotate(${rotate}deg)` }}
        />
      ))}
    </div>
  );
}
