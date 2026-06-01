'use client';

import { Plus, Trash2, Info } from 'lucide-react';
import type { Id, Doc } from '~/apps/convex/src/_generated/dataModel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2 gap-4">
          <div className="flex items-center gap-2 shrink-0">
            <CardTitle className="text-base">Moderation Queue</CardTitle>
            {pendingReports > 0 ? (
              <Badge variant="solid" color="red">{pendingReports} pending</Badge>
            ) : null}
          </div>
          <div className="flex items-center gap-2 flex-1 justify-end max-w-md">
            <div className="w-full max-w-xs">
              <SearchInput
                value={moderationSearch}
                onValueChange={onModerationSearchChange}
                placeholder="Search reports..."
                size="sm"
              />
            </div>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon-sm" className="h-9 w-9 shrink-0">
                  <Info className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent size="lg">
                <DialogHeader>
                  <DialogTitle>Local Safety Rules</DialogTitle>
                  <DialogDescription className="text-sm leading-relaxed pt-2">
                    Our glin-profanity system automatically monitors all club channels. Additionally, students can report concerning messages to club sponsors, who may escalate them to administrators. Sponsors also have the ability to report issues directly to admin.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-4 rounded-xl border bg-muted/30 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">Custom Keywords</p>
                      <Badge variant="dot" color="blue" size="sm">
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
                        onClick={() => keyword.trim() && addKeywordMutation.mutate(keyword.trim())}
                        leadingIcon={Plus}
                        disabled={!keyword.trim() || addKeywordMutation.isPending}
                        className="shrink-0"
                      >
                        Add rule
                      </Button>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {keywords.map((kw: ModerationKeyword) => (
                        <Badge key={kw._id} variant="solid" color="red" className="gap-1.5 px-3 py-1.5">
                          {kw.keyword}
                          <button
                            onClick={() => removeKeywordMutation.mutate(kw._id)}
                            className="ml-1 rounded-full p-0.5 transition-colors hover:bg-red-500/15 hover:text-red-500"
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
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {filteredReports.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm text-muted-foreground">
                {deferredModerationSearch ? 'No reports match your search' : 'No reports submitted'}
              </p>
              {deferredModerationSearch ? (
                <Button variant="ghost" size="sm" onClick={() => onModerationSearchChange('')} className="mt-1 font-semibold text-accent-500">
                  Clear search
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredReports.map((r: ModerationReport) => (
                <div key={r._id} className="rounded-xl border bg-card p-4 transition-colors hover:bg-muted/30">
                  <div className="flex flex-col items-start justify-between gap-4 sm:flex-row">
                    <div>
                      <div className="mb-2 flex items-center gap-2">
                        <Badge
                          variant={r.status === 'RESOLVED' ? 'dot' : 'solid'}
                          color={r.status === 'PENDING' ? 'amber' : r.status === 'RESOLVED' ? 'emerald' : 'gray'}
                        >
                          {r.status}
                        </Badge>
                        <Badge variant="dot">{r.contentType}</Badge>
                      </div>
                      <p className="text-sm font-medium">{r.reason}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        By {r.submitter?.firstName} {r.submitter?.lastName}
                      </p>
                    </div>
                    {r.status === 'PENDING' ? (
                      <div className="flex shrink-0 gap-2">
                        <Button size="sm" onClick={() => reportMutation.mutate({ id: r._id, status: 'RESOLVED', reviewNote: 'Reviewed' })}>
                          Resolve
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => reportMutation.mutate({ id: r._id, status: 'DISMISSED', reviewNote: 'Dismissed' })}>
                          Dismiss
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
