import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '~/apps/convex/src/_generated/api';
import type { Id } from '~/apps/convex/src/_generated/dataModel';
import { hasRole, useCurrentUser } from '@/lib/auth';
import { filterBySearchQuery } from '@/lib/search';
import { FlexFridayDoc, FlexSessionDoc, FlexWorkshopDoc } from '../_types';

export function useFlexFriday() {
  const user = useCurrentUser();

  const [selectedFriday, setSelectedFriday] = useState<FlexFridayDoc | null>(null);
  const [selectedSession, setSelectedSession] = useState<FlexSessionDoc | null>(null);
  const [activeView, setActiveView] = useState<'schedule' | 'audit'>('schedule');

  const [sessionSearch, setSessionSearch] = useState('');
  const deferredSessionSearch = useDeferredValue(sessionSearch);
  const [workshopSearch, setWorkshopSearch] = useState('');
  const deferredWorkshopSearch = useDeferredValue(workshopSearch);

  const canManage = !!user && hasRole(user, 'ADMIN', 'SUPER_ADMIN');
  const canCreateSession = !!user && hasRole(user, 'TEACHER', 'ADMIN', 'SUPER_ADMIN');
  const isStudent = !!user && hasRole(user, 'STUDENT');

  const fridays = useQuery(api.flexFriday.fridays.list, {}) ?? [];
  const isLoading = fridays.length === 0 && !selectedFriday;

  // Auto-select first Friday when data loads
  useEffect(() => {
    if (fridays.length > 0 && !selectedFriday) {
      setSelectedFriday(fridays[0]);
    }
  }, [fridays, selectedFriday]);

  const sessions =
    useQuery(
      api.flexFriday.sessions.listByFriday,
      selectedFriday ? { flexFridayId: selectedFriday._id as Id<'flexFridays'> } : 'skip',
    ) ?? [];

  // Auto-select first session when sessions load
  useEffect(() => {
    if (sessions.length > 0 && !selectedSession) {
      setSelectedSession(sessions[0]);
    }
  }, [sessions, selectedSession]);

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
    attendanceWorkshopId && canCreateSession
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
    canCreateSession,
    isStudent,
    
    selectedFriday,
    setSelectedFriday: (f: FlexFridayDoc | null) => {
      setSelectedFriday(f);
      setSelectedSession(null); 
    },
    selectedSession,
    setSelectedSession,
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
