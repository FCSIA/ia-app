'use client';

import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { pickNavigationLoadingFact } from '@ia/fun-facts';
import { IaLoadingMark } from '@/components/ui/ia-loading-mark';
import { LoadingFact } from '@/components/ui/loading-fact';

export function NavigationLoadingOverlay({ visible }: { visible: boolean }) {
  const reduceMotion = useReducedMotion();

  return (
    <>
      <AnimatePresence>
        {visible ? <MobileNavigationLoading reduceMotion={reduceMotion} /> : null}
      </AnimatePresence>
      <AnimatePresence>
        {visible ? <DesktopNavigationLoading reduceMotion={reduceMotion} /> : null}
      </AnimatePresence>
    </>
  );
}

function MobileNavigationLoading({ reduceMotion }: { reduceMotion: boolean | null }) {
  return (
    <motion.div
      key="nav-loading-mobile"
      className="pointer-events-none fixed inset-x-0 top-0 z-[250] h-[calc(3px+env(safe-area-inset-top))] overflow-hidden bg-background/70 pt-[env(safe-area-inset-top)] lg:hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.12 }}
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Loading the next page</span>
      <motion.span
        aria-hidden
        className="block h-[3px] origin-left rounded-r-full bg-primary shadow-[0_0_12px_hsl(var(--primary)/0.45)]"
        initial={{ scaleX: 0.08 }}
        animate={{ scaleX: reduceMotion ? 0.72 : [0.08, 0.68, 0.86] }}
        transition={
          reduceMotion
            ? { duration: 0 }
            : { duration: 1.2, repeat: Infinity, ease: 'easeInOut' }
        }
      />
    </motion.div>
  );
}

function DesktopNavigationLoading({ reduceMotion }: { reduceMotion: boolean | null }) {
  const [fact] = useState(pickNavigationLoadingFact);

  return (
    <motion.div
      key="nav-loading-desktop"
      className="fixed inset-0 z-[250] hidden items-center justify-center lg:flex"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.2 }}
      aria-busy="true"
      aria-live="polite"
    >
      <div
        className="absolute inset-0 bg-background/70 supports-[backdrop-filter]:bg-background/50 supports-[backdrop-filter]:backdrop-blur-md supports-[backdrop-filter]:backdrop-saturate-150"
        aria-hidden
      />
      <motion.div
        className="relative z-10 flex w-full max-w-md flex-col items-center gap-5 px-8"
        initial={{ opacity: 0, y: reduceMotion ? 0 : 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.2 }}
      >
        <div className="relative flex items-center justify-center rounded-2xl bg-primary/5 p-6 ring-1 ring-primary/20">
          {!reduceMotion ? (
            <motion.span
              className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-primary/15"
              aria-hidden
              animate={{ scale: [1, 1.06, 1], opacity: [0.5, 0.15, 0.5] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
            />
          ) : null}
          <IaLoadingMark size="lg" animated={!reduceMotion} />
        </div>
        <LoadingFact
          fact={fact}
          className="w-full rounded-2xl border border-border/70 bg-background/85 px-4 py-3 shadow-sm supports-[backdrop-filter]:backdrop-blur-md"
        />
      </motion.div>
    </motion.div>
  );
}
