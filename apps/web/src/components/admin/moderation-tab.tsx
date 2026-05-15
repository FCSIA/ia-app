'use client';

import { Plus, Trash2 } from 'lucide-react';
import type { UseMutationResult } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { SearchInput } from '@/components/ui/search';

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
  keywords: any[];
  addKeywordMutation: UseMutationResult<any, unknown, string>;
  removeKeywordMutation: UseMutationResult<any, unknown, string>;
  moderationSearch: string;
  onModerationSearchChange: (value: string) => void;
  deferredModerationSearch: string;
  filteredReports: any[];
  pendingReports: number;
  reportMutation: UseMutationResult<any, unknown, any>;
}) {
  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-base">Local Safety Rules</CardTitle>
            <Badge variant="dot" color="blue" size="sm">
              glin-profanity enabled
            </Badge>
          </div>
          <CardDescription>
            External profanity filtering handles the main dictionary. Add IA-specific words only when local policy needs extra tracking.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-5 grid gap-3 rounded-xl border bg-muted/20 p-3 text-sm text-muted-foreground md:grid-cols-3">
            <ModerationNote title="Detected automatically" body="Profanity library, Unicode normalization, and package defaults." />
            <ModerationNote title="Tracked locally" body="Only active school-added terms below create keyword match records." />
            <ModerationNote title="Admin visibility" body="Filtered content creates a report in the moderation queue." />
          </div>

          <div className="mb-5 flex flex-col gap-2 sm:flex-row">
            <Input
              className="max-w-sm"
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
            >
              Add rule
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {keywords.map((kw: any) => (
              <Badge key={kw.id} variant="solid" color="red" className="gap-1.5 px-3 py-1.5">
                {kw.keyword}
                <button
                  onClick={() => removeKeywordMutation.mutate(kw.id)}
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">Moderation Queue</CardTitle>
            {pendingReports > 0 ? (
              <Badge variant="solid" color="red">{pendingReports} pending</Badge>
            ) : null}
          </div>
          <div className="w-full max-w-xs">
            <SearchInput
              value={moderationSearch}
              onValueChange={onModerationSearchChange}
              placeholder="Search reports..."
              size="sm"
            />
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
              {filteredReports.map((r: any) => (
                <div key={r.id} className="rounded-xl border bg-card p-4 transition-colors hover:bg-muted/30">
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
                        <Button size="sm" onClick={() => reportMutation.mutate({ id: r.id, status: 'RESOLVED', reviewNote: 'Reviewed' })}>
                          Resolve
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => reportMutation.mutate({ id: r.id, status: 'DISMISSED', reviewNote: 'Dismissed' })}>
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

function ModerationNote({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <p className="font-medium text-foreground">{title}</p>
      <p className="mt-1 text-xs leading-5">{body}</p>
    </div>
  );
}

