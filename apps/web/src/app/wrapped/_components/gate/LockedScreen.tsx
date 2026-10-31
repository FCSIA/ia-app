'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import gsap from 'gsap';
import { Clock, Lock, X } from 'lucide-react';
import { formatCountdown, schoolYearLabel } from '@/lib/wrapped';
import { prefersReducedMotion, startAmbientLoops } from '../../_lib/motion';

// Only the dashed rings rotate; a solid circle spinning about its own centre
// changes no pixels.
const RING_DURATIONS_MS = [40_000, 52_000];

function createStars() {
  return Array.from({ length: 60 }, () => ({
    top: `${Math.random() * 100}%`,
    left: `${Math.random() * 100}%`,
    opacity: 0.2 + Math.random() * 0.6,
    animationDelay: `${Math.random() * 3}s`,
    animationDuration: `${2 + Math.random() * 3}s`,
  }));
}

interface LockedScreenProps {
  opensAt: Date;
  schoolYear: number;
}

export function LockedScreen({ opensAt, schoolYear }: LockedScreenProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => new Date());
  // Generated once so the minute countdown re-render doesn't teleport the
  // stars or restart their pulse.
  const [stars] = useState(createStars);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  useLayoutEffect(() => {
    if (!rootRef.current) return;
    const reduce = prefersReducedMotion();
    const ctx = gsap.context(() => {
      if (reduce) {
        gsap.fromTo(
          ['.locked-icon', '.locked-eyebrow', '.locked-title', '.locked-body', '.locked-countdown', '.locked-cta'],
          { opacity: 0 },
          { opacity: 1, duration: 0.3, ease: 'power3.out' },
        );
        return;
      }
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      tl.fromTo(
        '.locked-icon',
        { scale: 0.5, rotate: -60, opacity: 0 },
        { scale: 1, rotate: 0, opacity: 1, duration: 0.7, ease: 'back.out(2)' },
      )
        .fromTo(
          '.locked-eyebrow',
          { opacity: 0, y: 20, clipPath: 'inset(0 100% 0 0)' },
          { opacity: 1, y: 0, clipPath: 'inset(0 0% 0 0)', duration: 0.5 },
          '-=0.3',
        )
        .fromTo(
          '.locked-title',
          { opacity: 0, y: 30 },
          { opacity: 1, y: 0, duration: 0.6 },
          '-=0.2',
        )
        .fromTo(
          '.locked-body',
          { opacity: 0, y: 16 },
          { opacity: 1, y: 0, duration: 0.5 },
          '-=0.3',
        )
        .fromTo(
          '.locked-countdown',
          { opacity: 0, scale: 0.9 },
          { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(1.4)' },
          '-=0.2',
        )
        .fromTo(
          '.locked-cta',
          { opacity: 0, y: 10 },
          { opacity: 1, y: 0, duration: 0.4 },
          '-=0.2',
        );
    }, rootRef);
    return () => ctx.revert();
  }, []);

  // Slow ring rotation, compositor-driven; skipped under reduced motion.
  useEffect(
    () =>
      startAmbientLoops(rootRef.current, '.locked-star', (_, i) => ({
        keyframes: [{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }],
        options: { duration: RING_DURATIONS_MS[i], easing: 'linear' },
      })),
    [],
  );

  const countdown = formatCountdown(opensAt, now);
  const opensLabel = opensAt.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-[60] overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950 to-purple-950 text-white"
    >
      {/* Decorative orbiting rings */}
      <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <svg viewBox="0 0 800 800" className="locked-star w-[200%] max-w-none opacity-25">
          <circle cx="400" cy="400" r="320" stroke="white" strokeWidth="1" fill="none" strokeDasharray="4 12" />
        </svg>
        <svg viewBox="0 0 800 800" className="absolute w-[160%] max-w-none opacity-20">
          <circle cx="400" cy="400" r="260" stroke="white" strokeWidth="1" fill="none" />
        </svg>
        <svg viewBox="0 0 800 800" className="locked-star absolute w-[120%] max-w-none opacity-15">
          <circle cx="400" cy="400" r="200" stroke="white" strokeWidth="1" fill="none" strokeDasharray="2 10" />
        </svg>
      </div>

      {/* Starfield */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {stars.map((star, i) => (
          <span
            key={i}
            className="absolute block size-1 rounded-full bg-white animate-pulse motion-reduce:animate-none"
            style={star}
          />
        ))}
      </div>

      {/* Close */}
      <Link
        href="/dashboard"
        aria-label="Close"
        className="absolute top-4 right-4 z-30 flex size-10 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-md hover:bg-white/30 transition border border-white/20"
      >
        <X size={18} />
      </Link>

      <div className="relative z-10 flex flex-col items-center justify-center h-full px-6 text-center max-w-2xl mx-auto">
        <div className="locked-icon mb-6 flex size-24 items-center justify-center rounded-full bg-white/10 backdrop-blur-md border border-white/20 shadow-2xl">
          <Lock size={44} className="text-white" strokeWidth={2} />
        </div>

        <div className="locked-eyebrow text-xs sm:text-sm font-semibold uppercase tracking-[0.35em] text-white/70 mb-4">
          IA Wrapped · {schoolYearLabel(schoolYear)}
        </div>

        <h1
          className="locked-title text-5xl sm:text-7xl font-black leading-none tracking-tight mb-6"
          style={{ fontFamily: 'var(--font-work-sans, inherit)' }}
        >
          Come back in May.
        </h1>

        <p className="locked-body text-lg sm:text-xl text-white/80 mb-8 max-w-xl leading-snug">
          Wrapped unlocks once a year, just as the school year wraps up. Your stats are tracking
          in the background — the reveal waits for{' '}
          <span className="font-semibold text-white">{opensLabel}</span>.
        </p>

        <div className="locked-countdown flex items-baseline gap-3 rounded-2xl border border-white/20 bg-white/10 backdrop-blur-md px-6 py-4 mb-8">
          <Clock size={20} className="text-white/70" />
          <span className="text-xs uppercase tracking-widest text-white/60">Opens in</span>
          <span className="text-2xl sm:text-3xl font-bold tracking-tight">{countdown}</span>
        </div>

        <Link
          href="/dashboard"
          className="locked-cta rounded-full border border-white/30 bg-white/15 px-6 py-3 text-sm font-semibold uppercase tracking-wider hover:bg-white/25 transition"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
