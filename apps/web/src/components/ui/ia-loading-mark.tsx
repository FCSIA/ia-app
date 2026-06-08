'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

const sizeClasses = {
  sm: 'h-16 w-48',
  md: 'h-24 w-72',
  lg: 'h-32 w-96',
} as const;

type IaLoadingMarkProps = {
  className?: string;
  size?: keyof typeof sizeClasses;
  label?: string;
  animated?: boolean;
};

/** Innovation Academy wordmark with phoenix — used for route loading states. */
export function IaLoadingMark({
  className,
  size = 'lg',
  label = 'Loading',
  animated = false,
}: IaLoadingMarkProps) {
  const content = (
    <Image
      src="/icons/innovation-academy-logo.png"
      alt="Innovation Academy"
      width={384}
      height={128}
      priority
      className="h-full w-auto object-contain drop-shadow-sm"
    />
  );

  return (
    <div
      className={cn('relative flex items-center justify-center', sizeClasses[size], className)}
      role="status"
      aria-label={label}
    >
      {animated ? (
        <motion.div
          className="flex h-full w-full items-center justify-center"
          animate={{ opacity: [0.88, 1, 0.88], scale: [0.98, 1, 0.98] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        >
          {content}
        </motion.div>
      ) : (
        content
      )}
    </div>
  );
}
