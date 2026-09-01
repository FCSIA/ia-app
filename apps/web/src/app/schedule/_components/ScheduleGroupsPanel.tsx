'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useConvexAuth, useMutation, useQuery } from 'convex/react';
import { Plus, Users } from 'lucide-react';
import { api } from '~/apps/convex/src/_generated/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardGroup } from '@/components/ui/card';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { TabPanel } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { CARD_SURFACE_FOREGROUND } from '@/lib/surface-classes';

export function ScheduleGroupsPanel() {
  const { isAuthenticated } = useConvexAuth();
  const groups = useQuery(
    api.schedule.groups.listMine,
    isAuthenticated ? {} : 'skip',
  );
  const createGroup = useMutation(api.schedule.groups.create);
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [pending, setPending] = useState(false);

  const handleCreate = async () => {
    const groupName = name.trim();
    if (!groupName || pending) return;
    setPending(true);
    try {
      const result = await createGroup({ name: groupName });
      setOpen(false);
      setName('');
      router.push(`/schedule/groups/${result.id}`);
    } catch (error) {
      toast({
        title:
          error instanceof Error ? error.message : 'Could not create group',
        variant: 'destructive',
      });
    } finally {
      setPending(false);
    }
  };

  return (
    <TabPanel value="groups" className="mt-5">
      <section className="flex w-full max-w-3xl min-w-0 flex-col gap-4">
        <header className="flex min-h-9 items-center justify-end">
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button size="sm" leadingIcon={Plus}>
                New group
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 p-3">
              <form
                className="flex flex-col gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleCreate();
                }}
              >
                <Input
                  autoFocus
                  aria-label="Group name"
                  value={name}
                  maxLength={60}
                  placeholder="Group name"
                  onChange={(event) => setName(event.target.value)}
                />
                <Button type="submit" loading={pending} disabled={!name.trim()}>
                  Create
                </Button>
              </form>
            </PopoverContent>
          </Popover>
        </header>

        {groups === undefined ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-14 w-full" />
            ))}
          </div>
        ) : groups.length > 0 ? (
          <CardGroup orientation="inline" separated proximityHover>
            {groups.map((group) => (
              <Card
                key={group.id}
                href={`/schedule/groups/${group.id}`}
                label={`Open ${group.name}`}
                className="min-h-14 px-3 py-2.5"
              >
                <CardContent className="flex min-w-0 items-center gap-3 p-0">
                  <Users
                    className="size-4 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  <p className="min-w-0 flex-1 truncate text-sm font-medium">
                    {group.name}
                  </p>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {group.memberCount}
                  </span>
                </CardContent>
              </Card>
            ))}
          </CardGroup>
        ) : (
          <Empty className={`min-h-64 bg-surface-2 shadow-surface-1 ${CARD_SURFACE_FOREGROUND}`}>
            <EmptyHeader>
              <EmptyMedia>
                <Users className="size-6 text-muted-foreground" />
              </EmptyMedia>
              <EmptyTitle>No groups yet</EmptyTitle>
              <EmptyDescription>
                Create a group to compare schedules with friends.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </section>
    </TabPanel>
  );
}
