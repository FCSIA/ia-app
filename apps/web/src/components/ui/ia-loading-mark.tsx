'use client';

import { cn } from '@/lib/utils';
import { IaOrbitMark } from '@/components/ui/ia-orbit-mark';

const sizeClasses = {
  sm: 'size-16',
  md: 'size-24',
  lg: 'size-32',
} as const;

type IaLoadingMarkProps = {
  className?: string;
  size?: keyof typeof sizeClasses;
  label?: string;
  animated?: boolean;
};

/** Innovation Academy app mark used for route loading states. */
export function IaLoadingMark({
  className,
  size = 'lg',
  label = 'Loading',
  animated = false,
}: IaLoadingMarkProps) {
  const content = (
    <IaOrbitMark
      alt="IA Orbit"
      width={128}
      height={128}
      priority
      className="size-full object-contain drop-shadow-sm"
    />
  );

  return (
    <div
      className={cn('relative flex items-center justify-center', sizeClasses[size], className)}
      role="status"
      aria-label={label}
    >
      {animated ? (
        // CSS keyframes, not a Framer loop: the scale shorthand ran on the
        // main thread exactly while navigation/hydration kept it busy.
        <div className="flex h-full w-full animate-loading-mark-breathe items-center justify-center motion-reduce:animate-none">
          {content}
        </div>
      ) : (
        content
      )}
    </div>
  );
}
