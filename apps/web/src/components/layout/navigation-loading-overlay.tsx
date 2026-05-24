'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { IaLoadingMark } from '@/components/ui/ia-loading-mark';

export function NavigationLoadingOverlay({
  visible,
  message,
}: {
  visible: boolean;
  message: string;
}) {
  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          key="nav-loading"
          className="fixed inset-0 z-[250] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          aria-busy="true"
          aria-live="polite"
        >
          <div
            className="absolute inset-0 bg-background/40 backdrop-blur-md backdrop-saturate-150"
            aria-hidden
          />
          <motion.div
            className="relative z-10 flex max-w-md flex-col items-center gap-4 px-8 text-center"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <IaLoadingMark size="lg" />
            <motion.p
              key={message}
              className="min-h-[2.5rem] max-w-xs text-sm leading-relaxed text-muted-foreground"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              {message}
            </motion.p>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
