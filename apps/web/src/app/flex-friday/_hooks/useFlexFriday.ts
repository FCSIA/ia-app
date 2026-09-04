import { useDeferredValue, useMemo, useState } from 'react';
import { useQuery } from '@/lib/convex-react';
import { api } from '~/apps/convex/src/_generated/api';
import type { Id } from '~/apps/convex/src/_generated/dataModel';
import { hasRole, useCurrentUser } from '@/lib/auth';
import { filterBySearchQuery } from '@/lib/search';
import { FlexFridayDoc, FlexSessionDoc, FlexWorkshopDoc } from '../_types';

export function useFlexFriday() {
  const user = useCurrentUser();

  const [selectedFridayId, setSelectedFridayId] = useState<Id<'flexFridays'> | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<Id<'flexSessions'> | null>(null);
  const [activeView, setActiveView] = useState<'schedule' | 'audit'>('schedule');

  const [sessionSearch, setSessionSearch] = useState('');
  const deferredSessionSearch = useDeferredValue(sessionSearch);
  const [workshopSearch, setWorkshopSearch] = useState('');
  const deferredWorkshopSearch = useDeferredValue(workshopSearch);

  const canManage = !!user && hasRole(user, 'ADMIN', 'SUPER_ADMIN');
  const canCreateFriday = !!user && hasRole(user, 'ADMIN', 'SUPER_ADMIN', 'STUDENT_ADMIN');
  const canCreateSession = !!user && hasRole(user, 'TEACHER', 'ADMIN', 'SUPER_ADMIN', 'STUDENT_ADMIN');
  const canManageSessions = !!user && hasRole(user, 'TEACHER', 'ADMIN', 'SUPER_ADMIN');
  const canManageWorkshops = !!user && hasRole(user, 'TEACHER', 'ADMIN', 'SUPER_ADMIN');
  const canManageAttendance = !!user && hasRole(user, 'TEACHER', 'ADMIN', 'SUPER_ADMIN', 'SUPPORT_STAFF', 'STUDENT_ADMIN');
  const isStudent = !!user && hasRole(user, 'STUDENT', 'STUDENT_LEADER', 'STUDENT_ADMIN');

  const fridaysQuery = useQuery(api.flexFriday.fridays.list, {});
  const fridays = fridaysQuery ?? [];
  const selectedFriday =
    fridays.find((friday) => friday._id === selectedFridayId) ?? fridays[0] ?? null;
  const isLoading = fridaysQuery === undefined;

  const sessions =
    useQuery(
      api.flexFriday.sessions.listByFriday,
      selectedFriday ? { flexFridayId: selectedFriday._id as Id<'flexFridays'> } : 'skip',
    ) ?? [];
  const selectedSession =
    sessions.find((session) => session._id === selectedSessionId) ?? sessions[0] ?? null;

  const workshops =
    useQuery(
      api.flexFriday.workshops.listBySession,
      selectedFriday && selectedSession
        ? {
            flexFridayId: selectedFriday._id as Id<'flexFridays'>,
            sessionId: selectedSession._id as Id<'flexSessions'>,
          }
        : 'skip',
    ) ?? [];

  const myRegs = useQuery(api.flexFriday.registration.getMyRegistrations, {}) ?? [];
  const myRegWorkshopIds = useMemo(() => new Set((myRegs as any[]).map((r: any) => r.workshopId)), [myRegs]);

  const auditQuery = useQuery(
    api.audit.events.list,
    canManage && activeView === 'audit' ? { query: 'Flex', limit: 10 } : 'skip',
  );
  const auditEvents = auditQuery ?? [];
  const auditLoading = canManage && activeView === 'audit' && auditQuery === undefined;

  const credits = useQuery(
    api.flexFriday.credits.getMyCredits,
    user ? {} : 'skip',
  );

  const [attendanceWorkshopId, setAttendanceWorkshopId] = useState<Id<'flexWorkshops'> | null>(null);
  const rosterData = useQuery(
    api.flexFriday.attendance.getRoster,
    attendanceWorkshopId && canManageAttendance
      ? { workshopId: attendanceWorkshopId }
      : 'skip',
  );
  const rosterLoading = attendanceWorkshopId != null && rosterData === undefined;

  const filteredSessions = useMemo(() => {
    return filterBySearchQuery(sessions as FlexSessionDoc[], deferredSessionSearch, (session) => [
      session.title,
      session.description ?? '',
    ]);
  }, [sessions, deferredSessionSearch]);

  const filteredWorkshops = useMemo(() => {
    return filterBySearchQuery(workshops as FlexWorkshopDoc[], deferredWorkshopSearch, (workshop) => [
      workshop.title,
      workshop.description ?? '',
      workshop.location ?? '',
    ]);
  }, [workshops, deferredWorkshopSearch]);

  return {
    user,
    canManage,
    canCreateFriday,
    canCreateSession,
    canManageSessions,
    canManageWorkshops,
    canManageAttendance,
    isStudent,
    
    selectedFriday,
    setSelectedFriday: (f: FlexFridayDoc | null) => {
      setSelectedFridayId(f?._id ?? null);
      setSelectedSessionId(null);
    },
    selectedSession,
    setSelectedSession: (session: FlexSessionDoc | null) => {
      setSelectedSessionId(session?._id ?? null);
    },
    activeView,
    setActiveView,

    fridays,
    sessions: filteredSessions,
    workshops: filteredWorkshops,
    isLoading,
    
    sessionSearch,
    setSessionSearch,
    workshopSearch,
    setWorkshopSearch,

    myRegs,
    myRegWorkshopIds,
    auditEvents,
    auditLoading,
    credits,

    attendanceWorkshopId,
    setAttendanceWorkshopId,
    rosterData,
    rosterLoading,
  };
}
