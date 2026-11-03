'use client';

import { useDeferredValue, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@/lib/convex-react';
import { api } from '~/apps/convex/src/_generated/api';
import type { Doc, Id } from '~/apps/convex/src/_generated/dataModel';
import { useToast } from '@/hooks/use-toast';
import type { AdminTabId } from './use-admin-tab';

export function useAdminModeration(activeTab: AdminTabId) {
  const { toast } = useToast();

  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [moderationSearch, setModerationSearch] = useState('');
  const deferredModerationSearch = useDeferredValue(moderationSearch);

  const keywordResult = useQuery(
    api.moderation.keywords.list,
    activeTab === 'moderation' ? {} : 'skip',
  );
  const keywords = keywordResult ?? [];
  const reportResult = useQuery(
    api.moderation.reports.list,
    activeTab === 'moderation' ? {} : 'skip',
  );
  const reports = useMemo(() => reportResult ?? [], [reportResult]);

  const addKeyword = useMutation(api.moderation.keywords.add);
  const removeKeyword = useMutation(api.moderation.keywords.remove);
  const updateReport = useMutation(api.moderation.reports.update);

  const filteredReports = useMemo(() => {
    const query = deferredModerationSearch.trim().toLowerCase();
    if (!query) return reports;
    return reports.filter((r) => {
      const searchable = [
        r.reason,
        r.contentType,
        r.submitter?.firstName,
        r.submitter?.lastName,
        r.submitter?.preferredName,
        r.status,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return searchable.includes(query);
    });
  }, [reports, deferredModerationSearch]);

  const addKeywordMutation = {
    mutate: (kw: string) => {
      if (adding) return;
      setAdding(true);
      void addKeyword({ keyword: kw })
        .then(() => {
          setKeyword('');
          toast({ title: 'Keyword added' });
        })
        .catch((error: unknown) =>
          toast({
            title:
              error instanceof Error ? error.message : 'Failed to add keyword',
            variant: 'destructive',
          }),
        )
        .finally(() => setAdding(false));
    },
    isPending: adding,
  };

  const removeKeywordMutation = {
    mutate: (ruleId: string) => {
      if (removing) return;
      setRemoving(true);
      void removeKeyword({ ruleId: ruleId as Id<'moderationKeywordRules'> })
        .then(() => toast({ title: 'Removed' }))
        .catch((error: unknown) =>
          toast({
            title:
              error instanceof Error
                ? error.message
                : 'Failed to remove keyword',
            variant: 'destructive',
          }),
        )
        .finally(() => setRemoving(false));
    },
    isPending: removing,
  };

  const reportMutation = {
    mutate: ({
      id,
      status,
      reviewNote,
    }: {
      id: string;
      status: Doc<'moderationReports'>['status'];
      reviewNote: string;
    }) => {
      if (updating) return;
      setUpdating(true);
      void updateReport({
        reportId: id as Id<'moderationReports'>,
        status,
        reviewNote,
      })
        .then(() => toast({ title: 'Report updated' }))
        .catch((error: unknown) =>
          toast({
            title:
              error instanceof Error
                ? error.message
                : 'Failed to update report',
            variant: 'destructive',
          }),
        )
        .finally(() => setUpdating(false));
    },
    isPending: updating,
  };

  return {
    isLoading: reportResult === undefined,
    isKeywordsLoading: keywordResult === undefined,
    keyword,
    setKeyword,
    keywords,
    addKeywordMutation,
    removeKeywordMutation,
    moderationSearch,
    setModerationSearch,
    deferredModerationSearch,
    filteredReports,
    reportMutation,
  };
}
