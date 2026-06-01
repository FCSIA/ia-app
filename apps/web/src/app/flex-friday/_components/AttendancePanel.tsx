import React from 'react';
import type { FunctionReturnType } from 'convex/server';
import { api } from '~/apps/convex/src/_generated/api';
import type { Id } from '~/apps/convex/src/_generated/dataModel';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Clock, X, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
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
      <div className="mt-4 p-6 text-center rounded-xl border border-dashed border-foreground/10 bg-foreground/[0.01]">
        <p className="text-xs font-bold text-muted-foreground animate-pulse uppercase tracking-widest">Loading roster...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-4 p-4 rounded-xl border border-red-500/20 bg-red-500/5 text-red-600">
        <p className="text-xs font-bold uppercase tracking-wider mb-1">Roster Error</p>
        <p className="text-xs font-medium opacity-80">{error.message}</p>
      </div>
    );
  }

  if (!roster) {
    return (
      <div className="mt-4 p-6 text-center rounded-xl border border-dashed border-foreground/10 bg-foreground/[0.01]">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">No roster data available</p>
      </div>
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
    <div className="mt-4 space-y-2 border-t pt-4 border-foreground/5">
      <div className="flex items-center justify-between mb-3 px-1">
        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Attendance Roster</h4>
        <Badge variant="dot" color="gray" className="text-[9px] font-bold border-foreground/10 text-muted-foreground">
          {students.length} STUDENTS
        </Badge>
      </div>

      <div className="grid gap-2">
        {students.map((student) => {
          const status = attendanceMap.get(student._id);
          return (
            <div key={student._id} className="flex items-center justify-between p-2.5 rounded-xl border border-foreground/5 bg-foreground/[0.01] hover:bg-foreground/[0.02] transition-colors group">
              <div className="min-w-0">
                <p className="text-xs font-bold text-foreground truncate">
                  {student.lastName}, {student.firstName}
                </p>
                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-tight">
                  Grade {student.gradeLevel || '—'} · {student.uniqueId}
                </p>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className={cn(
                    "h-8 w-8 rounded-lg transition-all",
                    status === 'PRESENT' ? "bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm" : "text-muted-foreground hover:bg-emerald-500/10 hover:text-emerald-600"
                  )}
                  onClick={() => status === 'PRESENT' ? onClear(student._id) : onMark(student._id, 'PRESENT')}
                  disabled={isMarking}
                >
                  <Check size={14} strokeWidth={3} />
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className={cn(
                    "h-8 w-8 rounded-lg transition-all",
                    status === 'ABSENT' ? "bg-red-500 text-white hover:bg-red-600 shadow-sm" : "text-muted-foreground hover:bg-red-500/10 hover:text-red-600"
                  )}
                  onClick={() => status === 'ABSENT' ? onClear(student._id) : onMark(student._id, 'ABSENT')}
                  disabled={isMarking}
                >
                  <X size={14} strokeWidth={3} />
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className={cn(
                    "h-8 w-8 rounded-lg transition-all",
                    status === 'TARDY' ? "bg-sky-500 text-white hover:bg-sky-600 shadow-sm" : "text-muted-foreground hover:bg-sky-500/10 hover:text-sky-600"
                  )}
                  onClick={() => status === 'TARDY' ? onClear(student._id) : onMark(student._id, 'TARDY')}
                  disabled={isMarking}
                >
                  <Clock size={14} strokeWidth={3} />
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className={cn(
                    "h-8 w-8 rounded-lg transition-all",
                    status === 'EXCUSED' ? "bg-amber-500 text-white hover:bg-amber-600 shadow-sm" : "text-muted-foreground hover:bg-amber-500/10 hover:text-amber-600"
                  )}
                  onClick={() => status === 'EXCUSED' ? onClear(student._id) : onMark(student._id, 'EXCUSED')}
                  disabled={isMarking}
                >
                  <Minus size={14} strokeWidth={3} />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
