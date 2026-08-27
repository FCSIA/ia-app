import { AppShell } from "@/components/layout/AppShell";
import { PageFrame } from "@/components/layout/page-frame";
import { Skeleton } from "@/components/ui/skeleton";

export function ScheduleWorkspaceSkeleton() {
  return (
    <AppShell
      headerSlot={
        <h1 className="truncate text-lg font-semibold tracking-tight text-foreground">
          Schedule
        </h1>
      }
    >
      <PageFrame>
        <div aria-hidden="true" className="flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="hidden h-4 w-44 sm:block" />
          </div>

          <div className="flex flex-col gap-3 border-b border-border/60 pb-4 lg:flex-row lg:items-center lg:justify-between">
            <Skeleton className="h-10 w-full lg:w-72" />
            <Skeleton className="h-8 w-full lg:w-80" />
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(18rem,0.72fr)_minmax(0,1.7fr)]">
            <Skeleton className="h-[32rem] w-full" />
            <div className="flex flex-col gap-3">
              <Skeleton className="h-28 w-full" />
              {Array.from({ length: 6 }, (_, index) => (
                <Skeleton key={index} className="h-14 w-full" />
              ))}
            </div>
          </div>
        </div>
      </PageFrame>
    </AppShell>
  );
}
