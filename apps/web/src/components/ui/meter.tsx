import { useId, type ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/** A static measurement within a known range, rather than task progress.
 * The native meter owns its accessible role and numeric range. */
export function Meter({ label, valueText, className, ...props }: Omit<ComponentProps<'meter'>, 'children'> & {
  label: string;
  valueText: string;
}) {
  const labelId = useId();
  return (
    <div className={cn('flex min-w-0 flex-col gap-1 text-xs', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span id={labelId} className="text-muted-foreground">{label}</span>
        <span className="tabular-nums text-foreground">{valueText}</span>
      </div>
      <meter
        {...props}
        aria-labelledby={labelId}
        aria-valuetext={valueText}
        className="h-2 w-full overflow-hidden rounded-full bg-muted [&::-webkit-meter-bar]:border-0 [&::-webkit-meter-bar]:bg-muted [&::-webkit-meter-optimum-value]:bg-primary [&::-webkit-meter-suboptimum-value]:bg-primary [&::-webkit-meter-even-less-good-value]:bg-primary [&::-moz-meter-bar]:bg-primary"
      />
    </div>
  );
}
