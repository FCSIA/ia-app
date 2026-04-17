'use client';

import { use, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AtSign, Plus } from 'lucide-react';
import type { ClubDetail } from '@ia/contracts/clubs';
import { ClubWorkspace } from '@/components/clubs/club-workspace';
import { CreateTagDialog } from '@/components/clubs/dialogs/create-tag-dialog';
import { fullName } from '@/components/clubs/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { clubsApi } from '@/lib/api';
import { hasRole, useCurrentUser } from '@/lib/auth';

const BUILT_IN_TAGS = [
  { token: '@all', description: 'Everyone who can see the channel' },
  { token: '@leaders', description: 'Members with club roles' },
  { token: '@sponsors', description: 'Faculty sponsors' },
];

export default function ClubTagsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const user = useCurrentUser();
  const [createOpen, setCreateOpen] = useState(false);

  const { data: club } = useQuery<ClubDetail>({
    queryKey: ['club', id],
    queryFn: () => clubsApi.getOne(id).then((r) => r.data),
  });

  const isSponsor = club?.sponsors?.some((sponsor) => sponsor.userId === user?.id);
  const myMembership = club?.members?.find((member) => member.userId === user?.id);
  const isAdmin = !!user && hasRole(user, 'ADMIN', 'SUPER_ADMIN');
  const canCreate = isSponsor || !!myMembership?.role || isAdmin;

  const tags = club?.tags ?? [];

  const title = (
    <div className="min-w-0">
      <h1 className="truncate text-base font-semibold text-foreground">Tags</h1>
      <p className="truncate text-xs text-muted-foreground">
        Reusable mention groups for this club
      </p>
    </div>
  );

  const actions = canCreate ? (
    <Button size="sm" onClick={() => setCreateOpen(true)}>
      <Plus className="mr-1.5 size-4" />
      New tag
    </Button>
  ) : null;

  return (
    <ClubWorkspace clubId={id} title={title} actions={actions}>
      <div className="mx-auto w-full max-w-3xl space-y-6 p-6">
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Built-in mentions
          </h2>
          <div className="divide-y rounded-lg border bg-card">
            {BUILT_IN_TAGS.map((tag) => (
              <div key={tag.token} className="flex items-center gap-3 px-4 py-3">
                <AtSign className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-sm font-medium text-foreground">{tag.token}</p>
                  <p className="text-xs text-muted-foreground">{tag.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Custom tags
          </h2>

          {tags.length > 0 ? (
            <div className="space-y-3">
              {tags.map((tag) => (
                <div key={tag.id} className="rounded-lg border bg-card p-4">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="font-mono">@{tag.slug}</Badge>
                    <span className="text-sm font-medium">{tag.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {tag.members.length} {tag.members.length === 1 ? 'member' : 'members'}
                    </span>
                  </div>
                  {tag.members.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {tag.members.map((member) => (
                        <Badge
                          key={`${tag.id}-${member.user.id}`}
                          variant="outline"
                          className="font-normal"
                        >
                          {fullName(member.user)}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <Empty className="rounded-lg border bg-muted/20">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <AtSign />
                </EmptyMedia>
                <EmptyTitle>No custom tags yet</EmptyTitle>
                <EmptyDescription>
                  Create reusable groups like `@officers` or `@build-team` to mention in channels.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </section>
      </div>

      <CreateTagDialog clubId={id} open={createOpen} onOpenChange={setCreateOpen} />
    </ClubWorkspace>
  );
}
