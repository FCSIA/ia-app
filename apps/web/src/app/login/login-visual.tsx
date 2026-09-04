'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { LOGIN_ROTATE_MS, getLoginImagesForHour, isDayHour } from './login-images';

function currentHour(): number {
  return new Date().getHours();
}

export function LoginVisual() {
  // Deterministic noon initial keeps SSR and first client paint identical;
  // the effect below corrects to the viewer's local hour on mount.
  const [hour, setHour] = useState(12);
  const [index, setIndex] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    setHour(currentHour());
    const clock = window.setInterval(() => setHour(currentHour()), 60_000);
    return () => window.clearInterval(clock);
  }, []);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(query.matches);
    const onChange = (event: MediaQueryListEvent) => setReducedMotion(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  const images = getLoginImagesForHour(hour);
  const day = isDayHour(hour);

  useEffect(() => {
    setIndex(0);
  }, [day]);

  useEffect(() => {
    if (reducedMotion || images.length < 2) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      setIndex((current) => (current + 1) % images.length);
    }, LOGIN_ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [images.length, reducedMotion]);

  return (
    <section className="relative hidden min-h-screen overflow-hidden bg-primary lg:block" aria-hidden="true">
      {images.map((image, position) => (
        <Image
          key={image.src}
          src={image.src}
          alt={image.alt}
          fill
          priority={position === 0}
          sizes="(min-width: 1024px) 58vw, 0px"
          className={`object-cover transition-opacity duration-700 ${
            position === index % images.length ? 'opacity-100' : 'opacity-0'
          }`}
        />
      ))}
      <div
        className={`absolute inset-0 bg-gradient-to-tr via-transparent ${
          day ? 'from-black/40 to-primary/10' : 'from-black/60 to-primary/20'
        }`}
      />
      <div className="absolute inset-x-0 bottom-0 p-10 text-white">
        <div className="max-w-lg rounded-2xl border border-white/20 bg-black/25 p-5 backdrop-blur-sm">
          <p className="text-sm font-medium uppercase tracking-[0.16em] text-white/75">Innovation Academy</p>
          <p className="mt-2 text-xl font-medium leading-snug">
            Classes, clubs, events, and school updates in one place.
          </p>
        </div>
      </div>
    </section>
  );
}
