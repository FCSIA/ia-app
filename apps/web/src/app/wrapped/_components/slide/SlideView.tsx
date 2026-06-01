'use client';

import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import type { Slide } from '../../_lib/types';
import { Graphic } from '../graphics/Graphic';
import { ScatterIcons } from './ScatterIcons';

interface SlideViewProps {
  slide: Slide;
  direction: 1 | -1;
}

export function SlideView({ slide, direction }: SlideViewProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const valueRef = useRef<HTMLDivElement>(null);
  const heroIconRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!rootRef.current) return;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

      // Slide-wide entrance: subtle push from direction.
      tl.fromTo(
        rootRef.current,
        { opacity: 0, x: direction * 60, scale: 0.98 },
        { opacity: 1, x: 0, scale: 1, duration: 0.6 },
      );

      // Eyebrow reveal with clip-path.
      tl.fromTo(
        '.slide-eyebrow',
        {
          opacity: 0,
          y: 20,
          clipPath: 'inset(0 100% 0 0)',
        },
        {
          opacity: 1,
          y: 0,
          clipPath: 'inset(0 0% 0 0)',
          duration: 0.55,
        },
        '-=0.35',
      );

      // Hero icon pop.
      if (heroIconRef.current) {
        tl.fromTo(
          heroIconRef.current,
          { opacity: 0, scale: 0, rotate: -60 },
          { opacity: 1, scale: 1, rotate: 0, duration: 0.5, ease: 'back.out(2)' },
          '-=0.4',
        );
      }

      // Hero value.
      tl.fromTo(
        '.slide-value',
        { opacity: 0, y: 40, letterSpacing: '-0.04em' },
        { opacity: 1, y: 0, letterSpacing: '-0.02em', duration: 0.7 },
        '-=0.3',
      );

      // Count-up for numeric slides.
      if (slide.numericValue != null && valueRef.current && slide.numericValue > 0) {
        const target = { v: 0 };
        const el = valueRef.current;
        tl.to(
          target,
          {
            v: slide.numericValue,
            duration: 1.4,
            ease: 'power2.out',
            onUpdate: () => {
              el.textContent = Math.round(target.v).toLocaleString();
            },
          },
          '-=0.5',
        );
      }

      // Caption fade.
      tl.fromTo(
        '.slide-caption',
        { opacity: 0, y: 16 },
        { opacity: 1, y: 0, duration: 0.55 },
        '-=0.4',
      );

      // Chips pop (pathway etc.).
      const chips = gsap.utils.toArray<HTMLElement>('.slide-chips > *');
      if (chips.length > 0) {
        tl.fromTo(
          chips,
          { opacity: 0, y: 10, scale: 0.8 },
          { opacity: 1, y: 0, scale: 1, duration: 0.4, stagger: 0.08, ease: 'back.out(2)' },
          '-=0.3',
        );
      }

      // Footer line.
      tl.fromTo(
        '.slide-footer',
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: 0.4 },
        '-=0.3',
      );
    }, rootRef);

    return () => ctx.revert();
  }, [slide.key, direction, slide.numericValue]);

  const HeroIcon = slide.icon;

  return (
    <div
      ref={rootRef}
      className={`absolute inset-0 flex flex-col items-start justify-center px-6 py-20 sm:px-14 md:px-20 lg:px-28 bg-gradient-to-br ${slide.gradient} text-white overflow-hidden`}
    >
      <Graphic kind={slide.graphic} />
      <ScatterIcons icons={slide.scatterIcons} />

      <div className="relative z-10 flex flex-col items-start gap-6 max-w-4xl w-full">
        <div
          ref={heroIconRef}
          className="flex size-16 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-md shadow-lg border border-white/30"
        >
          <HeroIcon size={32} className="text-white" strokeWidth={2.25} />
        </div>

        <div className="slide-eyebrow text-sm sm:text-base font-semibold uppercase tracking-[0.3em] text-white/90">
          {slide.eyebrow}
        </div>

        <div
          ref={valueRef}
          className={`slide-value font-black leading-[0.95] tracking-tight drop-shadow-[0_4px_24px_rgba(0,0,0,0.35)] ${
            // Long text slides get a smaller top size so they don't clip.
            slide.kind === 'name' || slide.kind === 'pathway' || slide.kind === 'word'
              ? slide.value.length > 18
                ? 'text-5xl sm:text-6xl md:text-7xl'
                : 'text-5xl sm:text-7xl md:text-8xl'
              : 'text-6xl sm:text-8xl md:text-9xl'
          }`}
          style={{
            fontFamily: 'var(--font-work-sans, inherit)',
            wordBreak:
              slide.kind === 'name' || slide.kind === 'pathway' || slide.kind === 'word'
                ? 'break-word'
                : 'normal',
          }}
        >
          {slide.numericValue != null && slide.numericValue > 0 ? '0' : slide.value}
        </div>

        {slide.caption && (
          <div className="slide-caption max-w-2xl text-xl sm:text-2xl md:text-3xl font-medium text-white/95 leading-snug">
            {slide.caption}
          </div>
        )}

        {slide.chips && slide.chips.length > 0 && (
          <div className="slide-chips flex flex-wrap gap-2 pt-1">
            {slide.chips.map((chip) => (
              <span
                key={chip}
                className="rounded-full border border-white/30 bg-white/15 backdrop-blur-sm px-3 py-1 text-xs sm:text-sm font-semibold text-white uppercase tracking-wider"
              >
                {chip}
              </span>
            ))}
          </div>
        )}

        <div className="slide-footer mt-auto pt-6 text-xs uppercase tracking-[0.35em] text-white/70">
          IA Wrapped
        </div>
      </div>
    </div>
  );
}
