import {
  FLEX_ATTENDANCE_ROLES,
  FLEX_FRIDAY_CREATOR_ROLES,
  FLEX_MANAGER_ROLES,
  FLEX_SESSION_CREATOR_ROLES,
  hasAnyRole,
  isAdmin,
  STUDENT_ROLES,
} from '~/apps/shared/roles';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@/lib/convex-react';
import { api } from '~/apps/convex/src/_generated/api';
import type { Id } from '~/apps/convex/src/_generated/dataModel';
import { useCurrentUser } from '@/lib/auth';
import { filterBySearchQuery } from '@/lib/search';
import type { FlexFriday, FlexSession } from '../_types';

export function useFlexFriday() {
  const user = useCurrentUser();
  const searchParams = useSearchParams();
  const urlFridayId = searchParams?.get('friday') ?? null;
  const urlSessionId = searchParams?.get('session') ?? null;
  const urlAttendanceId = searchParams?.get('attendance') ?? null;

  const [selectedFridayId, setSelectedFridayId] = useState<string | null>(urlFridayId);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(urlSessionId);
  const [sessionSearch, setSessionSearch] = useState('');
  const deferredSessionSearch = useDeferredValue(sessionSearch);
  const [workshopSearch, setWorkshopSearch] = useState('');
  const deferredWorkshopSearch = useDeferredValue(workshopSearch);

  const canManage = isAdmin(user);
  // Activity retains the existing audit-query role contract. A query string
  // selects a destination, never permission to read staff activity.
  const requestedView = searchParams?.get('view');
  const activeView =
    canManage && (requestedView === 'activity' || requestedView === 'audit')
      ? 'audit'
      : 'schedule';
  const canCreateFriday = hasAnyRole(user, FLEX_FRIDAY_CREATOR_ROLES);
  const canCreateSession = hasAnyRole(user, FLEX_SESSION_CREATOR_ROLES);
  const canManageSessions = hasAnyRole(user, FLEX_MANAGER_ROLES);
  const canManageWorkshops = hasAnyRole(user, FLEX_MANAGER_ROLES);
  const canManageAttendance = hasAnyRole(user, FLEX_ATTENDANCE_ROLES);
  const isStudent = hasAnyRole(user, STUDENT_ROLES);

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

  const myRegs = useQuery(api.flexFriday.registration.getMyRegistrations, {});
  const myRegWorkshopIds = useMemo(
    () => new Set((myRegs ?? []).map((registration) => registration.workshopId)),
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
    useState<Id<'flexWorkshops'> | null>(urlAttendanceId as Id<'flexWorkshops'> | null);
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
      sessions,
      deferredSessionSearch,
      (session) => [session.title, session.description ?? ''],
    );
  }, [sessions, deferredSessionSearch]);

  const filteredWorkshops = useMemo(() => {
    return filterBySearchQuery(
      workshops,
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
    setSelectedFriday: (f: FlexFriday | null) => {
      setSelectedFridayId(f?._id ?? null);
      setSelectedSessionId(null);
    },
    selectedSession,
    setSelectedSession: (session: FlexSession | null) => {
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
