import { AppShell } from '@/components/layout/AppShell';
import { PageFrame } from '@/components/layout/page-frame';
import { Skeleton } from '@/components/ui/skeleton';

export function ScheduleWorkspaceSkeleton() {
  return (
    <AppShell>
      <PageFrame>
        <div aria-hidden="true" className="flex flex-col gap-6">
          <div className="flex items-center gap-6">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="hidden h-4 w-44 sm:block" />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Skeleton className="h-8 w-full sm:w-72" />
            <Skeleton className="h-8 w-52" />
          </div>

          <div className="flex items-end gap-2 border-b border-border/30 pb-1">
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton key={index} className="h-8 w-14 sm:w-20" />
            ))}
          </div>

          <div className="flex flex-col gap-3">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        </div>
      </PageFrame>
    </AppShell>
  );
}
