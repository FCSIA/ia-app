'use client';

import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AUDIT_ACTIONS, AUDIT_CATEGORIES, auditActionLabel, auditRecordLabel, parseAuditSearch, type AuditCategory } from '~/apps/shared/audit';
import { usePaginatedQuery, useQuery } from '@/lib/convex-react';
import { useCurrentUser } from '@/lib/auth';
import { api } from '~/apps/convex/src/_generated/api';
import type { Id } from '~/apps/convex/src/_generated/dataModel';
import { AUDIT_FETCH_LIMIT } from '../_lib/admin-utils';
import type { AdminTabId } from './use-admin-tab';
import type { AuditActorScope } from '../_lib/types';

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value ? value : '';
}

export function useAdminAudit(activeTab: AdminTabId) {
  const user = useCurrentUser();
  const searchParams = useSearchParams();
  const param = (name: string, fallback = '') => searchParams?.get(`audit_${name}`) ?? fallback;
  const query = param('q');
  const [auditSearch, setDraft] = useState(query);
  useEffect(() => setDraft(query), [query]);
  const parsed = parseAuditSearch(auditSearch);
  const deferredQuery = useDeferredValue(parseAuditSearch(query).error ? '' : query);
  const auditActor = param('person');
  const auditActorId = param('actor');
  const auditEntityId = param('record');
  const actionParam = param('action');
  const auditActionFilters = useMemo(() => [...new Set(actionParam.split(',').filter((value) => !!value && value !== 'ALL'))], [actionParam]);
  const auditEntityTypeFilter = param('type', 'ALL');
  const source = param('source', 'ALL');
  const auditActorScope: AuditActorScope = source === 'USER' || source === 'SYSTEM' ? source : 'ALL';
  const auditStartDate = validDate(param('from'));
  const auditEndDate = validDate(param('to'));
  const categoryParam = param('category');
  const auditCategoryFilters = useMemo(() => [...new Set(categoryParam.split(',').filter((value): value is AuditCategory => Object.hasOwn(AUDIT_CATEGORIES, value)))], [categoryParam]);
  const [selectedAuditEventId, setSelectedAuditEventId] = useState<string | null>(null);

  const update = (changes: Record<string, string>) => {
    const params = new URLSearchParams(window.location.search);
    if (!Object.hasOwn(changes, 'q')) {
      const fields: Record<string, string> = { person: 'person', actor: 'person', action: 'action', type: 'type', record: 'record', source: 'source', from: 'after', to: 'before' };
      const replaced = new Set(Object.keys(changes).map((key) => fields[key]).filter(Boolean));
      const current = parseAuditSearch(params.get('audit_q') ?? '');
      if (!current.error && current.terms.some((term) => replaced.has(term.field))) {
        changes.q = current.terms.filter((term) => !replaced.has(term.field)).map((term) => `${term.exclude ? '-' : ''}${term.field}:${JSON.stringify(term.value)}`).join(' ');
        setDraft(changes.q);
      }
    }
    for (const [key, value] of Object.entries(changes)) {
      if (value && value !== 'ALL') params.set(`audit_${key}`, value);
      else params.delete(`audit_${key}`);
    }
    window.history.replaceState(null, '', `${window.location.pathname}${params.size ? `?${params}` : ''}`);
  };
  const setAuditSearch = (value: string) => {
    setDraft(value);
    const result = parseAuditSearch(value);
    if (result.error) return;
    const changes: Record<string, string> = { q: value };
    // A typed field replaces the corresponding explicit filter rather than
    // silently ANDing two contradictory values for the same column.
    for (const term of result.terms) {
      if (term.field === 'person') Object.assign(changes, { person: '', actor: '', actor_name: '' });
      if (term.field === 'action') changes.action = '';
      if (term.field === 'type') changes.type = '';
      if (term.field === 'record') changes.record = '';
      if (term.field === 'source') changes.source = '';
      if (term.field === 'after') changes.from = '';
      if (term.field === 'before') changes.to = '';
    }
    update(changes);
  };
  const auditQueryParams = useMemo(() => ({
    advancedQuery: deferredQuery.trim() || undefined,
    actor: auditActor.trim() || undefined,
    actorId: auditActorId ? auditActorId as Id<'users'> : undefined,
    recordId: auditEntityId.trim() || undefined,
    actions: auditActionFilters.length ? auditActionFilters : undefined,
    entityType: auditEntityTypeFilter !== 'ALL' ? auditEntityTypeFilter : undefined,
    actorScope: auditActorScope !== 'ALL' ? auditActorScope : undefined,
    startAt: auditStartDate ? new Date(`${auditStartDate}T00:00:00`).getTime() : undefined,
    endAt: auditEndDate ? new Date(`${auditEndDate}T23:59:59.999`).getTime() : undefined,
    categories: auditCategoryFilters.length ? auditCategoryFilters : undefined,
  }), [deferredQuery, auditActor, auditActorId, auditEntityId, auditActionFilters, auditEntityTypeFilter, auditActorScope, auditStartDate, auditEndDate, auditCategoryFilters]);
  const { results: auditEvents, status: auditStatus, loadMore: loadMoreAuditEvents, isStale } = usePaginatedQuery(
    api.audit.events.listPage, activeTab === 'audit' ? auditQueryParams : 'skip',
    { initialNumItems: AUDIT_FETCH_LIMIT, keepPreviousResults: true, scopeKey: user?._id ?? 'signed-out' },
  );
  const auditCounts = useQuery(api.audit.events.counts, activeTab === 'audit' ? auditQueryParams : 'skip');
  const auditFilterOptions = useQuery(api.audit.events.listFilterOptions, activeTab === 'audit' ? {} : 'skip');
  const auditEventDetail = useQuery(api.audit.events.get, selectedAuditEventId ? { auditEventId: selectedAuditEventId as Id<'auditEvents'> } : 'skip');
  const clearAuditFilters = () => {
    setDraft('');
    update(Object.fromEntries(['q', 'person', 'actor', 'actor_name', 'record', 'action', 'type', 'source', 'from', 'to', 'category'].map((key) => [key, ''])));
  };
  const chips = [
    auditActorId ? { label: `Person: ${param('actor_name', 'Selected person')}`, clear: () => update({ actor: '', actor_name: '' }) } : null,
    auditActor ? { label: `Person: ${auditActor}`, clear: () => update({ person: '' }) } : null,
    ...auditCategoryFilters.map((category) => ({ label: AUDIT_CATEGORIES[category], clear: () => update({ category: auditCategoryFilters.filter((value) => value !== category).join(',') }) })),
    ...auditActionFilters.map((action) => ({ label: auditActionLabel(action), clear: () => update({ action: auditActionFilters.filter((value) => value !== action).join(',') }) })),
    auditEntityTypeFilter !== 'ALL' ? { label: auditRecordLabel(auditEntityTypeFilter), clear: () => update({ type: '' }) } : null,
    auditEntityId ? { label: 'Selected record', clear: () => update({ record: '' }) } : null,
    auditActorScope !== 'ALL' ? { label: auditActorScope === 'SYSTEM' ? 'System' : 'People', clear: () => update({ source: '' }) } : null,
    auditStartDate || auditEndDate ? { label: `${auditStartDate || 'Any date'} – ${auditEndDate || 'Now'}`, clear: () => update({ from: '', to: '' }) } : null,
  ].filter((chip): chip is { label: string; clear: () => void } => !!chip);
  return {
    auditSearch, setAuditSearch, advancedError: parsed.error,
    auditActor, setAuditActor: (value: string) => update({ person: value, actor: '', actor_name: '' }),
    auditActorId, setAuditActorId: (id: string, name: string) => update({ actor: id, actor_name: name, person: '' }),
    auditEntityId, setAuditEntityId: (value: string) => update({ record: value }),
    auditActionFilters, setAuditActionFilters: (values: string[]) => update({ action: values.join(',') }),
    auditEntityTypeFilter, setAuditEntityTypeFilter: (value: string) => update({ type: value }),
    auditActorScope, setAuditActorScope: (value: AuditActorScope) => update({ source: value }),
    auditStartDate, auditEndDate,
    setAuditStartDateWithBounds: (value: string) => update({ from: value, ...(value && auditEndDate && value > auditEndDate ? { to: value } : {}) }),
    setAuditEndDateWithBounds: (value: string) => update({ to: value, ...(value && auditStartDate && value < auditStartDate ? { from: value } : {}) }),
    auditCategoryFilters, setAuditCategoryFilters: (values: AuditCategory[]) => update({ category: values.join(','), action: auditActionFilters.filter((action) => !values.length || !!AUDIT_ACTIONS[action] && values.includes(AUDIT_ACTIONS[action].category)).join(',') }),
    selectedAuditEventId, setSelectedAuditEventId, auditEvents, displayedAuditEvents: auditEvents,
    isAuditLoading: auditStatus === 'LoadingFirstPage' && !isStale, isStale,
    auditStatus, loadMoreAuditEvents, auditCounts,
    auditActionOptions: auditFilterOptions?.actions ?? [], auditEntityTypeOptions: auditFilterOptions?.entityTypes ?? [],
    hasActiveAuditFilters: chips.length > 0 || !!query, clearAuditFilters, auditFilterChips: chips,
    auditEventDetail: auditEventDetail ?? undefined, isAuditDetailLoading: !!selectedAuditEventId && auditEventDetail === undefined,
  };
}
