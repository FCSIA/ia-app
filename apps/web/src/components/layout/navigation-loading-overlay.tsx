'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { IaLoadingMark } from '@/components/ui/ia-loading-mark';

export function NavigationLoadingOverlay({ visible }: { visible: boolean }) {
  const reduceMotion = useReducedMotion();

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          key="nav-loading"
          className="fixed inset-0 z-[250] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          aria-busy="true"
          aria-live="polite"
        >
          <div
            className="absolute inset-0 bg-background/70 supports-[backdrop-filter]:bg-background/50 supports-[backdrop-filter]:backdrop-blur-md supports-[backdrop-filter]:backdrop-saturate-150"
            aria-hidden
          />
          <motion.div
            className="relative z-10 flex flex-col items-center px-8"
            initial={{ opacity: 0, y: reduceMotion ? 0 : 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
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
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
