'use client';

import { Plus, Trash2, Info } from 'lucide-react';
import type { Id, Doc } from '~/apps/convex/src/_generated/dataModel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SearchInput } from '@/components/ui/search';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog';
import { AdminNotice, AdminPanel } from './admin-ui';

type ModerationMutation<TArgs> = {
  mutate: (args: TArgs) => void;
  isPending: boolean;
};

type ModerationKeyword = Doc<'moderationKeywordRules'>;
type ModerationReport = Doc<'moderationReports'> & {
  submitter: { firstName: string; lastName: string } | null;
  reportedUser: { firstName: string; lastName: string } | null;
};
type ModerationReportStatus = ModerationReport['status'];

export function ModerationTab({
  keyword,
  onKeywordChange,
  keywords,
  addKeywordMutation,
  removeKeywordMutation,
  moderationSearch,
  onModerationSearchChange,
  deferredModerationSearch,
  filteredReports,
  pendingReports,
  reportMutation,
}: {
  keyword: string;
  onKeywordChange: (value: string) => void;
  keywords: ModerationKeyword[];
  addKeywordMutation: ModerationMutation<string>;
  removeKeywordMutation: ModerationMutation<string>;
  moderationSearch: string;
  onModerationSearchChange: (value: string) => void;
  deferredModerationSearch: string;
  filteredReports: ModerationReport[];
  pendingReports: number;
  reportMutation: ModerationMutation<{ id: Id<'moderationReports'>; status: ModerationReportStatus; reviewNote: string }>;
}) {
  const actions = (
    <>
      <SearchInput
        className="w-full sm:w-72"
        value={moderationSearch}
        onValueChange={onModerationSearchChange}
        placeholder="Search reports..."
        size="sm"
      />
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Manage local safety rules" title="Safety rules">
            <Info className="size-4" />
          </Button>
        </DialogTrigger>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>Local Safety Rules</DialogTitle>
            <DialogDescription className="pt-2 text-sm leading-relaxed">
              The profanity system monitors club channels. Students can also report concerning messages to sponsors, who can escalate issues to administrators.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-foreground">Custom Keywords</p>
              <Badge variant="solid" color="blue" size="sm">
                glin-profanity enabled
              </Badge>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                className="bg-background"
                placeholder="Add local term..."
                value={keyword}
                onChange={(e) => onKeywordChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && keyword.trim()) addKeywordMutation.mutate(keyword.trim());
                }}
              />
              <Button
                type="button"
                onClick={() => keyword.trim() && addKeywordMutation.mutate(keyword.trim())}
                leadingIcon={Plus}
                disabled={!keyword.trim()}
                loading={addKeywordMutation.isPending}
                className="shrink-0"
              >
                Add rule
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              {keywords.map((kw: ModerationKeyword) => (
                <Badge key={kw._id} variant="solid" color="red" className="gap-1.5">
                  {kw.keyword}
                  <button
                    type="button"
                    onClick={() => removeKeywordMutation.mutate(kw._id)}
                    className="rounded-full p-0.5 transition-colors hover:bg-red-500/15 hover:text-red-500"
                    aria-label={`Remove ${kw.keyword}`}
                  >
                    <Trash2 size={12} />
                  </button>
                </Badge>
              ))}
              {keywords.length === 0 ? (
                <p className="text-sm text-muted-foreground">No local safety rules configured.</p>
              ) : null}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );

  return (
    <div>
      <AdminPanel
        title="Report queue"
        actions={actions}
        contentClassName="space-y-3"
      >
          {pendingReports > 0 ? (
            <Badge variant="solid" color="red" size="sm">
              {pendingReports} pending
            </Badge>
          ) : null}
          {filteredReports.length === 0 ? (
            <AdminNotice
              message={deferredModerationSearch ? 'No reports match your search.' : 'No reports submitted.'}
              actionLabel={deferredModerationSearch ? 'Clear search' : undefined}
              onAction={deferredModerationSearch ? () => onModerationSearchChange('') : undefined}
            />
          ) : (
            <div className="divide-y rounded-lg border">
              {filteredReports.map((r: ModerationReport) => (
                <div key={r._id} className="p-3">
                  <div className="flex flex-col items-start justify-between gap-3 sm:flex-row">
                    <div className="min-w-0">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <Badge
                          size="sm"
                          variant="solid"
                          color={r.status === 'PENDING' ? 'amber' : r.status === 'RESOLVED' ? 'emerald' : 'gray'}
                        >
                          {r.status}
                        </Badge>
                        <Badge variant="solid" size="sm">{r.contentType}</Badge>
                      </div>
                      <p className="text-sm font-medium text-foreground">{r.reason}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        By {r.submitter?.firstName} {r.submitter?.lastName}
                      </p>
                    </div>
                    {r.status === 'PENDING' ? (
                      <div className="flex shrink-0 gap-2">
                        <Button
                          size="sm"
                          loading={reportMutation.isPending}
                          onClick={() => reportMutation.mutate({ id: r._id, status: 'RESOLVED', reviewNote: 'Reviewed' })}
                        >
                          Resolve
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={reportMutation.isPending}
                          onClick={() => reportMutation.mutate({ id: r._id, status: 'DISMISSED', reviewNote: 'Dismissed' })}
                        >
                          Dismiss
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
      </AdminPanel>
    </div>
  );
}
