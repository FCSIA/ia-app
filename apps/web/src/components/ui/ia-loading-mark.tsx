import Image from 'next/image';
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
};

/** Innovation Academy wordmark with phoenix — used for route loading states. */
export function IaLoadingMark({ className, size = 'lg', label = 'Loading' }: IaLoadingMarkProps) {
  return (
    <div
      className={cn('relative flex items-center justify-center', sizeClasses[size], className)}
      role="status"
      aria-label={label}
    >
      <Image
        src="/icons/innovation-academy-logo.png"
        alt="Innovation Academy"
        width={384}
        height={128}
        priority
        className="h-full w-auto object-contain drop-shadow-sm"
      />
    </div>
  );
}
