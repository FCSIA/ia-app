import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@/lib/convex-react';
import { api } from '~/apps/convex/src/_generated/api';
import type { Id } from '~/apps/convex/src/_generated/dataModel';
import { hasRole, useCurrentUser } from '@/lib/auth';
import { filterBySearchQuery } from '@/lib/search';
import { FlexFridayDoc, FlexSessionDoc, FlexWorkshopDoc } from '../_types';

export function useFlexFriday() {
  const user = useCurrentUser();
  const searchParams = useSearchParams();
  const urlFridayId = searchParams?.get('friday') ?? null;
  const urlSessionId = searchParams?.get('session') ?? null;
  const urlAttendanceId = searchParams?.get('attendance') ?? null;

  const [selectedFridayId, setSelectedFridayId] = useState<string | null>(
    () => searchParams?.get('friday') ?? null,
  );
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    () => searchParams?.get('session') ?? null,
  );
  const [sessionSearch, setSessionSearch] = useState('');
  const deferredSessionSearch = useDeferredValue(sessionSearch);
  const [workshopSearch, setWorkshopSearch] = useState('');
  const deferredWorkshopSearch = useDeferredValue(workshopSearch);

  const canManage = !!user && hasRole(user, 'ADMIN', 'SUPER_ADMIN');
  // Activity retains the existing audit-query role contract. A query string
  // selects a destination, never permission to read staff activity.
  const requestedView = searchParams?.get('view');
  const activeView =
    canManage && (requestedView === 'activity' || requestedView === 'audit')
      ? 'audit'
      : 'schedule';
  const canCreateFriday =
    !!user && hasRole(user, 'ADMIN', 'SUPER_ADMIN', 'STUDENT_ADMIN');
  const canCreateSession =
    !!user && hasRole(user, 'TEACHER', 'ADMIN', 'SUPER_ADMIN', 'STUDENT_ADMIN');
  const canManageSessions =
    !!user && hasRole(user, 'TEACHER', 'ADMIN', 'SUPER_ADMIN');
  const canManageWorkshops =
    !!user && hasRole(user, 'TEACHER', 'ADMIN', 'SUPER_ADMIN');
  const canManageAttendance =
    !!user &&
    hasRole(
      user,
      'TEACHER',
      'ADMIN',
      'SUPER_ADMIN',
      'SUPPORT_STAFF',
      'STUDENT_ADMIN',
    );
  const isStudent =
    !!user && hasRole(user, 'STUDENT', 'STUDENT_LEADER', 'STUDENT_ADMIN');

  const fridaysQuery = useQuery(api.flexFriday.fridays.list, {});
  const fridays = fridaysQuery ?? [];
  const selectedFriday =
    fridays.find((friday) => friday._id === selectedFridayId) ??
    fridays[0] ??
    null;
  const isLoading = fridaysQuery === undefined;

  const sessions =
    useQuery(
      api.flexFriday.sessions.listByFriday,
      selectedFriday
        ? { flexFridayId: selectedFriday._id as Id<'flexFridays'> }
        : 'skip',
    ) ?? [];
  const selectedSession =
    sessions.find((session) => session._id === selectedSessionId) ??
    sessions[0] ??
    null;

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

  const myRegs =
    useQuery(api.flexFriday.registration.getMyRegistrations, {}) ?? [];
  const myRegWorkshopIds = useMemo(
    () => new Set((myRegs as any[]).map((r: any) => r.workshopId)),
    [myRegs],
  );

  const auditQuery = useQuery(
    api.audit.events.list,
    canManage && activeView === 'audit' ? { query: 'Flex', limit: 10 } : 'skip',
  );
  const auditEvents = auditQuery ?? [];
  const auditLoading =
    canManage && activeView === 'audit' && auditQuery === undefined;

  const credits = useQuery(
    api.flexFriday.credits.getMyCredits,
    user ? {} : 'skip',
  );

  const [attendanceWorkshopId, setAttendanceWorkshopId] =
    useState<Id<'flexWorkshops'> | null>(
      () =>
        (searchParams?.get('attendance') ?? null) as Id<'flexWorkshops'> | null,
    );
  useEffect(() => {
    setSelectedFridayId(urlFridayId);
    setSelectedSessionId(urlSessionId);
    setAttendanceWorkshopId(urlAttendanceId as Id<'flexWorkshops'> | null);
  }, [urlFridayId, urlSessionId, urlAttendanceId]);
  // URL values select only records already returned by the authorized queries.
  const visibleAttendanceWorkshopId =
    canManageAttendance &&
    workshops.some((workshop) => workshop._id === attendanceWorkshopId)
      ? attendanceWorkshopId
      : null;
  const rosterData = useQuery(
    api.flexFriday.attendance.getRoster,
    visibleAttendanceWorkshopId
      ? { workshopId: visibleAttendanceWorkshopId }
      : 'skip',
  );
  const rosterLoading =
    visibleAttendanceWorkshopId != null && rosterData === undefined;

  const destinationHref = (view: 'schedule' | 'activity') => {
    const params = new URLSearchParams(searchParams?.toString());
    params.set('view', view);
    // The old view switch retained these local selections. Carry them into
    // the destination URL so sidebar navigation does the same.
    if (selectedFriday) params.set('friday', selectedFriday._id);
    if (selectedSession) params.set('session', selectedSession._id);
    if (visibleAttendanceWorkshopId)
      params.set('attendance', visibleAttendanceWorkshopId);
    return `/flex-friday?${params.toString()}`;
  };

  const filteredSessions = useMemo(() => {
    return filterBySearchQuery(
      sessions as FlexSessionDoc[],
      deferredSessionSearch,
      (session) => [session.title, session.description ?? ''],
    );
  }, [sessions, deferredSessionSearch]);

  const filteredWorkshops = useMemo(() => {
    return filterBySearchQuery(
      workshops as FlexWorkshopDoc[],
      deferredWorkshopSearch,
      (workshop) => [
        workshop.title,
        workshop.description ?? '',
        workshop.location ?? '',
      ],
    );
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
    canViewActivity: canManage,
    scheduleHref: destinationHref('schedule'),
    activityHref: destinationHref('activity'),

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

    attendanceWorkshopId: visibleAttendanceWorkshopId,
    setAttendanceWorkshopId,
    rosterData,
    rosterLoading,
  };
}
