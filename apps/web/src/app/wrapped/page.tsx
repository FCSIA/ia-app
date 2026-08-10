'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery as useConvexQuery } from 'convex/react';
import { api } from '~/apps/convex/src/_generated/api';
import { hasRole, useCurrentUser } from '@/lib/auth';
import { computeWrappedAvailability } from '@/lib/wrapped';

import { buildSlides } from './_lib/utils';
import { SlideView } from './_components/slide/SlideView';
import { ProgressBar } from './_components/navigation/ProgressBar';
import { NavigationControls } from './_components/navigation/NavigationControls';
import { LockedScreen } from './_components/gate/LockedScreen';
import { SummaryOverlay } from './_components/summary/SummaryOverlay';
import { LoadingState } from './_components/feedback/LoadingState';
import { ErrorState } from './_components/feedback/ErrorState';

export default function WrappedPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const user = useCurrentUser();
  const displayName = user ? `${user.firstName} ${user.lastName}` : 'You';
  const isAdmin = user !== null && hasRole(user, 'ADMIN', 'SUPER_ADMIN');

  // Recompute availability each mount + tick every 60s so the countdown
  // decrements without a page refresh (and the gate flips open at 12:00 AM
  // May 1).
  const [nowTick, setNowTick] = useState(() => new Date());
  useEffect(() => {
    if (!mounted) return;
    const id = setInterval(() => setNowTick(new Date()), 60_000);
    return () => clearInterval(id);
  }, [mounted]);

  const availability = useMemo(() => computeWrappedAvailability(nowTick), [nowTick]);
  const gated = mounted && !availability.open && !isAdmin;

  const data = useConvexQuery(
    api.wrapped.snapshots.getMine,
    mounted && !gated ? {} : 'skip',
  );

  const isLoading = mounted && !gated && data === undefined;
  const error = null;

  const slides = useMemo(
    () => (data ? buildSlides(data, displayName) : []),
    [data, displayName],
  );

  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);

  const go = (dir: 1 | -1) => {
    setDirection(dir);
    setIndex((i) => Math.max(0, Math.min(slides.length - 1, i + dir)));
  };

  const jumpTo = (i: number) => {
    setDirection(i > index ? 1 : -1);
    setIndex(i);
  };

  useEffect(() => {
    if (slides.length === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        go(1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        go(-1);
      } else if (e.key === 'Escape') {
        window.location.href = '/dashboard';
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [slides.length]);

  // Not yet May and not an admin — render the locked teaser.
  if (gated) {
    return (
      <LockedScreen opensAt={availability.opensAt} schoolYear={availability.schoolYear} />
    );
  }

  if (!mounted || isLoading) {
    return <LoadingState />;
  }

  if (error || !data) {
    return <ErrorState />;
  }

  const slide = slides[index];
  const atStart = index === 0;
  const atEnd = index === slides.length - 1;

  return (
    <div className="fixed inset-0 z-[60] overflow-hidden bg-black">
      {/* Slide Content */}
      <SlideView key={slide.key} slide={slide} direction={direction} />

      {/* Top Progress Bars */}
      <ProgressBar slides={slides} index={index} jumpTo={jumpTo} />

      {/* Navigation & Controls */}
      <NavigationControls go={go} atStart={atStart} atEnd={atEnd} />

      {/* Summary grid on last slide */}
      {atEnd && <SummaryOverlay summary={data} />}
    </div>
  );
}
