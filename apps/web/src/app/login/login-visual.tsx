'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { readStorage, writeStorage } from '@/lib/browser-storage';
import { LOGIN_IMAGES } from './login-images';

/** One pinned image per browser tab; a new tab rolls again. */
const STORAGE_KEY = 'ia-login-visual';

function readStoredSrc(): string | null {
  const stored = readStorage(STORAGE_KEY, 'session');
  return stored && LOGIN_IMAGES.some((image) => image.src === stored) ? stored : null;
}

export function LoginVisual() {
  const [src, setSrc] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  // First load wins for the whole tab session: reuse the stored pick, or roll
  // randomly within the current day/night set and persist it. No rotation after.
  useEffect(() => {
    const stored = readStoredSrc();
    if (stored) {
      setSrc(stored);
      return;
    }
    const pick = LOGIN_IMAGES[Math.floor(Math.random() * LOGIN_IMAGES.length)] ?? LOGIN_IMAGES[0];
    writeStorage(STORAGE_KEY, pick.src, 'session');
    setSrc(pick.src);
  }, []);

  return (
    <section className="relative hidden min-h-screen overflow-hidden bg-primary lg:block" aria-hidden="true">
      {src ? (
        <Image
          src={src}
          alt=""
          fill
          priority
          sizes="(min-width: 1024px) 58vw, 0px"
          onLoad={() => setLoaded(true)}
          className={`object-cover transition-opacity duration-700 motion-reduce:transition-none ${
            loaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
      ) : null}
      {/* Theme tint: follows the active theme primary (pink in Bubblegum, ember by default). */}
      <div className="absolute inset-0 bg-primary/30 mix-blend-color" />
      {/* Legibility scrim for the caption. */}
      <div className="absolute inset-0 bg-gradient-to-tr from-black/45 via-black/10 to-transparent" />
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
