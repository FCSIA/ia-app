import type { FunctionReturnType } from 'convex/server';
import { api } from '~/apps/convex/src/_generated/api';
import type { Id } from '~/apps/convex/src/_generated/dataModel';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Clock, X, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import type { FlexAttendanceStatus } from '~/apps/convex/src/validators';

export type AttendanceStatus = FlexAttendanceStatus;

type RosterResponse = NonNullable<FunctionReturnType<typeof api.flexFriday.attendance.getRoster>>;
type RosterStudent = NonNullable<RosterResponse['registrations'][number]['student']>;

interface Props {
  roster: RosterResponse | null | undefined;
  isLoading: boolean;
  error: Error | null;
  onMark: (studentId: Id<'users'>, status: AttendanceStatus) => void;
  onClear: (studentId: Id<'users'>) => void;
  isMarking: boolean;
}

export function AttendancePanel({
  roster,
  isLoading,
  error,
  onMark,
  onClear,
  isMarking,
}: Props) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-2 rounded-xl border border-border/60 bg-card p-3">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Could not load the roster</AlertTitle>
        <AlertDescription>{error.message}</AlertDescription>
      </Alert>
    );
  }

  if (!roster) {
    return (
      <Empty className="border border-border/60 py-8">
        <EmptyHeader>
          <EmptyTitle>No roster available</EmptyTitle>
          <EmptyDescription>This workshop does not have roster data yet.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const studentMap = new Map<Id<'users'>, RosterStudent>();
  roster.registrations.forEach((r) => {
    if (r.student) studentMap.set(r.student._id, r.student);
  });
  roster.assignments.forEach((a) => {
    if (a.student) studentMap.set(a.student._id, a.student);
  });

  const attendanceMap = new Map<Id<'users'>, AttendanceStatus>();
  roster.attendances.forEach((a) => attendanceMap.set(a.studentId, a.status));

  const students = Array.from(studentMap.values()).sort((a, b) =>
    a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName)
  );

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground">Attendance roster</h3>
        <Badge variant="dot" color="gray" size="sm">
          {students.length} {students.length === 1 ? 'student' : 'students'}
        </Badge>
      </div>

      <div className="grid gap-2">
        {students.map((student) => {
          const status = attendanceMap.get(student._id);
          return (
            <div key={student._id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-background p-2.5 transition-colors hover:bg-hover">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {student.lastName}, {student.firstName}
                </p>
                <p className="text-xs text-muted-foreground">
                  Grade {student.gradeLevel || '—'} · {student.uniqueId}
                </p>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className={cn(
                    status === 'PRESENT' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'text-muted-foreground hover:bg-emerald-500/10 hover:text-emerald-700'
                  )}
                  aria-label={`${status === 'PRESENT' ? 'Clear present status for' : 'Mark present:'} ${student.firstName} ${student.lastName}`}
                  aria-pressed={status === 'PRESENT'}
                  onClick={() => status === 'PRESENT' ? onClear(student._id) : onMark(student._id, 'PRESENT')}
                  disabled={isMarking}
                >
                  <Check />
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className={cn(
                    status === 'ABSENT' ? 'bg-destructive/15 text-destructive' : 'text-muted-foreground hover:bg-destructive/10 hover:text-destructive'
                  )}
                  aria-label={`${status === 'ABSENT' ? 'Clear absent status for' : 'Mark absent:'} ${student.firstName} ${student.lastName}`}
                  aria-pressed={status === 'ABSENT'}
                  onClick={() => status === 'ABSENT' ? onClear(student._id) : onMark(student._id, 'ABSENT')}
                  disabled={isMarking}
                >
                  <X />
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className={cn(
                    status === 'TARDY' ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300' : 'text-muted-foreground hover:bg-sky-500/10 hover:text-sky-700'
                  )}
                  aria-label={`${status === 'TARDY' ? 'Clear tardy status for' : 'Mark tardy:'} ${student.firstName} ${student.lastName}`}
                  aria-pressed={status === 'TARDY'}
                  onClick={() => status === 'TARDY' ? onClear(student._id) : onMark(student._id, 'TARDY')}
                  disabled={isMarking}
                >
                  <Clock />
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className={cn(
                    status === 'EXCUSED' ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300' : 'text-muted-foreground hover:bg-amber-500/10 hover:text-amber-700'
                  )}
                  aria-label={`${status === 'EXCUSED' ? 'Clear excused status for' : 'Mark excused:'} ${student.firstName} ${student.lastName}`}
                  aria-pressed={status === 'EXCUSED'}
                  onClick={() => status === 'EXCUSED' ? onClear(student._id) : onMark(student._id, 'EXCUSED')}
                  disabled={isMarking}
                >
                  <Minus />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
