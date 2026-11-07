import { useState } from 'react';
import { useMutation } from '@/lib/convex-react';
import { useToast } from '@/hooks/use-toast';
import { api } from '~/apps/convex/src/_generated/api';
import type { Id } from '~/apps/convex/src/_generated/dataModel';
import type { FlexAttendanceStatus } from '~/apps/convex/src/validators';

export type RunFlexAction = (key: string, action: () => Promise<unknown>) => Promise<boolean>;

/** Runs `action`; a failure goes to `onFailure` with its message and is reported as `false`. */
export async function runFlexAction(
  action: () => Promise<unknown>,
  onFailure: (message: string) => void,
) {
  try {
    await action();
    return true;
  } catch (error) {
    onFailure(error instanceof Error ? error.message : 'Failed');
    return false;
  }
}

/**
 * Flex Friday mutations, one pending key at a time. Each operation toasts its
 * own failure (and success text where it has one) and reports success as a
 * boolean, so callers only handle the happy path.
 */
export function useFlexActions() {
  const { toast } = useToast();
  const [actionPending, setActionPending] = useState<string | null>(null);
  const removeSession = useMutation(api.flexFriday.sessions.remove);
  const removeWorkshop = useMutation(api.flexFriday.workshops.remove);
  const register = useMutation(api.flexFriday.registration.register);
  const unregister = useMutation(api.flexFriday.registration.unregister);
  const markAttendance = useMutation(api.flexFriday.attendance.markAttendance);
  const clearAttendance = useMutation(api.flexFriday.attendance.clearAttendance);

  const runAction: RunFlexAction = async (key, action) => {
    setActionPending(key);
    try {
      return await runFlexAction(action, (title) => toast({ title, variant: 'destructive' }));
    } finally {
      setActionPending(null);
    }
  };

  const runAndToast = async (key: string, action: () => Promise<unknown>, title: string) => {
    if (await runAction(key, action)) toast({ title });
  };

  return {
    actionPending,
    runAction,
    deleteSession: (sessionId: Id<'flexSessions'>) =>
      runAndToast('session-delete', () => removeSession({ sessionId }), 'Session deleted'),
    deleteWorkshop: (workshopId: Id<'flexWorkshops'>) =>
      runAndToast('workshop-delete', () => removeWorkshop({ workshopId }), 'Workshop deleted'),
    register: (workshopId: Id<'flexWorkshops'>) =>
      runAndToast('register', () => register({ workshopId }), 'Registered successfully'),
    unregister: (workshopId: Id<'flexWorkshops'>) =>
      runAndToast('unregister', () => unregister({ workshopId }), 'Registration removed'),
    markAttendance: (
      workshopId: Id<'flexWorkshops'>,
      studentId: Id<'users'>,
      status: FlexAttendanceStatus,
    ) => runAction('attendance-mark', () => markAttendance({ workshopId, studentId, status })),
    clearAttendance: (workshopId: Id<'flexWorkshops'>, studentId: Id<'users'>) =>
      runAction('attendance-clear', () => clearAttendance({ workshopId, studentId })),
  };
}
