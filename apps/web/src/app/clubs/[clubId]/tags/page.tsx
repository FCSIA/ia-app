'use client';

import { useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '~/apps/convex/src/_generated/api';
import { AtSign, Plus } from 'lucide-react';
import { useClubId } from '../../club-route';
import { ClubWorkspace } from '@/components/clubs/club-workspace';
import { CreateTagDialog } from '@/components/clubs/dialogs/create-tag-dialog';
import { fullName, hasClubLeadershipRole, type ClubDetail } from '@/components/clubs/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { hasRole, useCurrentUser } from '@/lib/auth';

const BUILT_IN_TAGS = [
  { token: '@all', description: 'Everyone who can see the channel' },
  { token: '@leaders', description: 'Members with club roles' },
  { token: '@sponsors', description: 'Faculty sponsors' },
];

export default function ClubTagsPage() {
  const clubId = useClubId();
  const user = useCurrentUser();
  const [createOpen, setCreateOpen] = useState(false);

  const club = useQuery(api.clubs.detail.get, { clubId }) as ClubDetail | undefined;

  const isSponsor = club?.sponsors?.some((sponsor) => sponsor.userId === user?._id);
  const myMembership = club?.members?.find((member) => member.userId === user?._id);
  const isAdmin = !!user && hasRole(user, 'ADMIN', 'SUPER_ADMIN');
  const canCreate = isSponsor || hasClubLeadershipRole(myMembership?.role) || isAdmin;

  const tags = club?.tags ?? [];

  const title = (
    <div className="min-w-0">
      <h1 className="truncate text-base font-semibold text-foreground">Tags</h1>
    </div>
  );

  const actions = canCreate ? (
    <Button size="sm" onClick={() => setCreateOpen(true)}>
      <Plus className="mr-1.5 size-4" />
      New tag
    </Button>
  ) : null;

  if (!club) return null;

  return (
    <ClubWorkspace title={title} actions={actions}>
      <div className="mx-auto w-full max-w-4xl space-y-4 p-3 sm:p-4">
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Built-in mentions
          </h2>
          <div className="divide-y divide-border/70 overflow-hidden rounded-lg border bg-card">
            {BUILT_IN_TAGS.map((tag) => (
              <div key={tag.token} className="flex min-h-12 items-center gap-3 px-3 py-2">
                <AtSign className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">{tag.token}</p>
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
            <div className="divide-y divide-border/70 overflow-hidden rounded-lg border bg-card">
              {tags.map((tag) => (
                <div key={tag._id} className="px-3 py-2.5 transition-colors hover:bg-hover">
                  <div className="flex items-center gap-2">
                    <Badge variant="solid">
                      @{tag.slug}
                    </Badge>
                    <span className="text-sm font-medium">{tag.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {tag.members.length} {tag.members.length === 1 ? 'member' : 'members'}
                    </span>
                  </div>
                  {tag.members.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {tag.members.map((member) => (
                        <Badge
                          key={`${tag._id}-${member.user._id}`}
                          variant="dot"
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
                  Create a group to mention several people at once.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </section>
      </div>

      <CreateTagDialog open={createOpen} onOpenChange={setCreateOpen} />
    </ClubWorkspace>
  );
}
