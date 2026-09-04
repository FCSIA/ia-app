import { useState } from 'react';
import { useMutation } from '@/lib/convex-react';
import { api } from '~/apps/convex/src/_generated/api';
import { useToast } from '@/hooks/use-toast';

export function useFlexActions() {
  const { toast } = useToast();
  const [actionPending, setActionPending] = useState<string | null>(null);

  const createFriday = useMutation(api.flexFriday.fridays.create);
  const createSession = useMutation(api.flexFriday.sessions.create);
  const updateSession = useMutation(api.flexFriday.sessions.update);
  const deleteSession = useMutation(api.flexFriday.sessions.remove);
  const createWorkshop = useMutation(api.flexFriday.workshops.create);
  const updateWorkshop = useMutation(api.flexFriday.workshops.update);
  const deleteWorkshop = useMutation(api.flexFriday.workshops.remove);
  const register = useMutation(api.flexFriday.registration.register);
  const unregister = useMutation(api.flexFriday.registration.unregister);
  const markAttendance = useMutation(api.flexFriday.attendance.markAttendance);
  const clearAttendance = useMutation(api.flexFriday.attendance.clearAttendance);

  const runAction = async (key: string, fn: () => Promise<unknown>) => {
    setActionPending(key);
    try {
      await fn();
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : 'Failed',
        variant: 'destructive',
      });
      throw error;
    } finally {
      setActionPending(null);
    }
  };

  return {
    actionPending,
    runAction,
    mutations: {
      createFriday,
      createSession,
      updateSession,
      deleteSession,
      createWorkshop,
      updateWorkshop,
      deleteWorkshop,
      register,
      unregister,
      markAttendance,
      clearAttendance,
    },
  };
}
