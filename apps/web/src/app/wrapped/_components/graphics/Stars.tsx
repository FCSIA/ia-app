'use client';

import { useEffect, useRef, useState } from 'react';
import { EASE_IN_OUT_SINE, randomBetween, startAmbientLoops } from '../../_lib/motion';

function createStars() {
  return Array.from({ length: 60 }, () => ({
    top: `${Math.random() * 100}%`,
    left: `${Math.random() * 100}%`,
    opacity: 0.2 + Math.random() * 0.6,
  }));
}

export function StarsGraphic() {
  const ref = useRef<HTMLDivElement>(null);
  // Generated once per mount so parent re-renders don't teleport the stars.
  const [stars] = useState(createStars);
  useEffect(
    () =>
      startAmbientLoops(ref.current, '.twinkle', (_, i) => ({
        keyframes: [
          { opacity: stars[i].opacity, transform: 'scale(1)' },
          { opacity: randomBetween(0.2, 1), transform: `scale(${randomBetween(0.6, 1.4)})` },
        ],
        options: {
          duration: randomBetween(1400, 3200),
          delay: i * 80,
          easing: EASE_IN_OUT_SINE,
          direction: 'alternate',
        },
      })),
    [stars],
  );
  return (
    <div ref={ref} aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {stars.map((star, i) => (
        <span key={i} className="twinkle absolute block size-1 rounded-full bg-white" style={star} />
      ))}
    </div>
  );
}
