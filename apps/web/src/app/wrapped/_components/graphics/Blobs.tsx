'use client';

import { useEffect, useRef } from 'react';
import { startAmbientLoops } from '../../_lib/motion';

export function BlobsGraphic() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(
    () =>
      startAmbientLoops(ref.current, '.blob', (_, i) => ({
        keyframes: [{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }],
        options: { duration: 30_000, delay: i * 2000, easing: 'linear' },
      })),
    [],
  );
  return (
    <div ref={ref} aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <svg
        viewBox="0 0 600 600"
        className="blob absolute -top-32 -left-32 size-[50rem] opacity-30"
      >
        <path
          fill="white"
          d="M421.5,316Q391,382,325,410Q259,438,192,410Q125,382,112,316Q99,250,122,191Q145,132,208,116Q271,100,332,121Q393,142,421,196Q449,250,421.5,316Z"
        />
      </svg>
      <svg
        viewBox="0 0 600 600"
        className="blob absolute -bottom-48 -right-48 size-[60rem] opacity-25"
      >
        <path
          fill="black"
          d="M441.5,316Q411,382,342,409Q273,436,206,408Q139,380,118,315Q97,250,118,184Q139,118,207,99Q275,80,339,108Q403,136,429,193Q455,250,441.5,316Z"
        />
      </svg>
    </div>
  );
}
