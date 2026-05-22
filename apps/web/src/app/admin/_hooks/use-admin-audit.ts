'use client';

import { useDeferredValue, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { useQuery as useConvexQuery } from 'convex/react';
import { api } from '~/apps/convex/src/_generated/api';
import type { Id } from '~/apps/convex/src/_generated/dataModel';
import { AUDIT_FETCH_LIMIT } from '../_lib/admin-utils';
import type { AdminTabId } from './use-admin-tab';
import type { AuditActorScope, AuditEventDetail, AuditEventRecord } from '../_lib/types';

const FLEX_ENTITY_TYPES = [
  'FlexFriday',
  'FlexSession',
  'FlexWorkshop',
  'FlexRegistration',
  'FlexAssignment',
  'Event',
];

export function useAdminAudit(activeTab: AdminTabId) {
  const [auditSearch, setAuditSearch] = useState('');
  const deferredAuditSearch = useDeferredValue(auditSearch);
  const [auditActor, setAuditActor] = useState('');
  const deferredAuditActor = useDeferredValue(auditActor);
  const [auditEntityId, setAuditEntityId] = useState('');
  const deferredAuditEntityId = useDeferredValue(auditEntityId);
  const [auditActionFilter, setAuditActionFilter] = useState('ALL');
  const [auditEntityTypeFilter, setAuditEntityTypeFilter] = useState('ALL');
  const [auditActorScope, setAuditActorScope] = useState<AuditActorScope>('ALL');
  const [auditStartDate, setAuditStartDate] = useState('');
  const [auditEndDate, setAuditEndDate] = useState('');
  const [selectedAuditEventId, setSelectedAuditEventId] = useState<string | null>(null);
  const [auditSubView, setAuditSubView] = useState<'general' | 'flex'>('general');

  const auditQueryParams = useMemo(
    () => ({
      limit: AUDIT_FETCH_LIMIT,
      query: deferredAuditSearch.trim() || undefined,
      actor: deferredAuditActor.trim() || undefined,
      entityId: deferredAuditEntityId.trim() || undefined,
      action: auditActionFilter !== 'ALL' ? auditActionFilter : undefined,
      entityType: auditEntityTypeFilter !== 'ALL' ? auditEntityTypeFilter : undefined,
      actorScope: auditActorScope !== 'ALL' ? auditActorScope : undefined,
      startDate: auditStartDate || undefined,
      endDate: auditEndDate || undefined,
    }),
    [
      auditActionFilter,
      auditActorScope,
      auditEndDate,
      auditEntityTypeFilter,
      auditStartDate,
      deferredAuditSearch,
      deferredAuditActor,
      deferredAuditEntityId,
    ],
  );

  const auditEvents =
    (useConvexQuery(
      api.audit.list,
      activeTab === 'audit' ? auditQueryParams : 'skip',
    ) as AuditEventRecord[] | undefined) ?? [];
  const isAuditLoading = activeTab === 'audit' && auditEvents.length === 0;

  const displayedAuditEvents = useMemo(() => {
    if (auditSubView === 'flex') {
      return auditEvents.filter((e) => FLEX_ENTITY_TYPES.includes(e.entityType));
    }
    return auditEvents.filter((e) => !FLEX_ENTITY_TYPES.includes(e.entityType));
  }, [auditEvents, auditSubView]);

  const auditFilterSource =
    (useConvexQuery(
      api.audit.list,
      activeTab === 'audit' ? { limit: 500 } : 'skip',
    ) as AuditEventRecord[] | undefined) ?? [];

  const auditEventDetail = useConvexQuery(
    api.audit.getOne,
    selectedAuditEventId
      ? { auditEventId: selectedAuditEventId as Id<'auditEvents'> }
      : 'skip',
  ) as AuditEventDetail | null | undefined;
  const isAuditDetailLoading = !!selectedAuditEventId && auditEventDetail === undefined;

  const auditActionOptions = useMemo(
    () => Array.from(new Set(auditFilterSource.map((event) => event.action))).sort(),
    [auditFilterSource],
  );

  const auditEntityTypeOptions = useMemo(
    () => Array.from(new Set(auditFilterSource.map((event) => event.entityType))).sort(),
    [auditFilterSource],
  );

  const hasActiveAuditFilters =
    !!auditSearch.trim() ||
    !!auditActor.trim() ||
    !!auditEntityId.trim() ||
    auditActionFilter !== 'ALL' ||
    auditEntityTypeFilter !== 'ALL' ||
    auditActorScope !== 'ALL' ||
    !!auditStartDate ||
    !!auditEndDate;

  const clearAuditFilters = () => {
    setAuditSearch('');
    setAuditActor('');
    setAuditEntityId('');
    setAuditActionFilter('ALL');
    setAuditEntityTypeFilter('ALL');
    setAuditActorScope('ALL');
    setAuditStartDate('');
    setAuditEndDate('');
  };

  const setAuditStartDateWithBounds = (value: string) => {
    setAuditStartDate(value);
    if (value && auditEndDate && value > auditEndDate) {
      setAuditEndDate(value);
    }
  };

  const setAuditEndDateWithBounds = (value: string) => {
    setAuditEndDate(value);
    if (value && auditStartDate && value < auditStartDate) {
      setAuditStartDate(value);
    }
  };

  const auditFilterChips = [
    auditSearch.trim() ? `Search: ${auditSearch.trim()}` : null,
    auditActor.trim() ? `Actor: ${auditActor.trim()}` : null,
    auditEntityId.trim() ? `Entity ID: ${auditEntityId.trim()}` : null,
    auditActionFilter !== 'ALL' ? `Action: ${auditActionFilter}` : null,
    auditEntityTypeFilter !== 'ALL' ? `Entity: ${auditEntityTypeFilter}` : null,
    auditActorScope !== 'ALL'
      ? `Source: ${auditActorScope === 'SYSTEM' ? 'System' : 'User'}`
      : null,
    auditStartDate
      ? `From: ${format(new Date(`${auditStartDate}T00:00:00`), 'MMM d, yyyy')}`
      : null,
    auditEndDate ? `To: ${format(new Date(`${auditEndDate}T00:00:00`), 'MMM d, yyyy')}` : null,
  ].filter((value): value is string => !!value);

  return {
    auditSearch,
    setAuditSearch,
    auditActor,
    setAuditActor,
    auditEntityId,
    setAuditEntityId,
    auditActionFilter,
    setAuditActionFilter,
    auditEntityTypeFilter,
    setAuditEntityTypeFilter,
    auditActorScope,
    setAuditActorScope,
    auditStartDate,
    auditEndDate,
    setAuditStartDateWithBounds,
    setAuditEndDateWithBounds,
    auditSubView,
    setAuditSubView,
    selectedAuditEventId,
    setSelectedAuditEventId,
    displayedAuditEvents,
    auditEvents,
    isAuditLoading,
    auditActionOptions,
    auditEntityTypeOptions,
    hasActiveAuditFilters,
    clearAuditFilters,
    auditFilterChips,
    auditEventDetail: auditEventDetail ?? undefined,
    isAuditDetailLoading,
  };
}
