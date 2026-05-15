'use client';

import { useDeferredValue, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { moderationApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import type { AdminTabId } from './use-admin-tab';

export function useAdminModeration(activeTab: AdminTabId) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [keyword, setKeyword] = useState('');
  const [moderationSearch, setModerationSearch] = useState('');
  const deferredModerationSearch = useDeferredValue(moderationSearch);

  const { data: keywords = [] } = useQuery({
    queryKey: ['keywords'],
    queryFn: () => moderationApi.getKeywords().then((r) => r.data),
    enabled: activeTab === 'moderation',
  });

  const { data: reports = [] } = useQuery({
    queryKey: ['reports'],
    queryFn: () => moderationApi.getReports().then((r) => r.data),
    enabled: activeTab === 'moderation',
  });

  const filteredReports = useMemo(() => {
    const query = deferredModerationSearch.trim().toLowerCase();
    if (!query) return reports;
    return (reports as any[]).filter((r) => {
      const searchable = [
        r.reason,
        r.contentType,
        r.submitter?.firstName,
        r.submitter?.lastName,
        r.status,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return searchable.includes(query);
    });
  }, [reports, deferredModerationSearch]);

  const addKeywordMutation = useMutation({
    mutationFn: (kw: string) => moderationApi.addKeyword(kw),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['keywords'] });
      setKeyword('');
      toast({ title: 'Keyword added' });
    },
  });

  const removeKeywordMutation = useMutation({
    mutationFn: (id: string) => moderationApi.removeKeyword(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['keywords'] });
      toast({ title: 'Removed' });
    },
  });

  const reportMutation = useMutation({
    mutationFn: ({ id, status, reviewNote }: any) =>
      moderationApi.updateReport(id, { status, reviewNote }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reports'] });
      toast({ title: 'Report updated' });
    },
  });

  return {
    keyword,
    setKeyword,
    keywords: keywords as any[],
    addKeywordMutation,
    removeKeywordMutation,
    moderationSearch,
    setModerationSearch,
    deferredModerationSearch,
    filteredReports,
    reportMutation,
  };
}
