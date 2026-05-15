'use client';

import { useDeferredValue, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { auditApi } from '@/lib/api';
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

  const { data: auditEvents = [], isLoading: isAuditLoading } = useQuery<AuditEventRecord[]>({
    queryKey: ['audit', auditQueryParams],
    queryFn: () => auditApi.getAll(auditQueryParams).then((r) => r.data),
    enabled: activeTab === 'audit',
  });

  const displayedAuditEvents = useMemo(() => {
    if (auditSubView === 'flex') {
      return auditEvents.filter((e) => FLEX_ENTITY_TYPES.includes(e.entityType));
    }
    return auditEvents.filter((e) => !FLEX_ENTITY_TYPES.includes(e.entityType));
  }, [auditEvents, auditSubView]);

  const { data: auditFilterSource = [] } = useQuery<AuditEventRecord[]>({
    queryKey: ['audit', 'filter-source'],
    queryFn: () => auditApi.getAll({ limit: 500 }).then((r) => r.data),
    enabled: activeTab === 'audit',
  });

  const { data: auditEventDetail, isLoading: isAuditDetailLoading } = useQuery<AuditEventDetail>({
    queryKey: ['audit', 'entry', selectedAuditEventId],
    queryFn: () => auditApi.getOne(selectedAuditEventId!).then((r) => r.data),
    enabled: !!selectedAuditEventId,
  });

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
    auditEventDetail,
    isAuditDetailLoading,
  };
}
