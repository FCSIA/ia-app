'use client';

import { ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useQuery } from 'convex/react';
import { api } from '~/apps/convex/src/_generated/api';
import { useClubId } from '../../../club-route';
import { ClubWorkspace } from '@/components/clubs/club-workspace';
import { ClubStructureEditor } from '@/components/clubs/dialogs/hierarchy-dialog';
import type { ClubDetail } from '@/components/clubs/types';
import { Button } from '@/components/ui/button';

export default function ClubStructureSettingsPage() {
  const clubId = useClubId();
  const club = useQuery(api.clubs.detail.get, { clubId }) as ClubDetail | undefined;
  const navigation = useQuery(api.clubs.detail.getWorkspaceNavigation, { clubId });
  const canManageStructure = navigation?.viewer.canManageClubStructure ?? false;

  const title = (
    <div className="min-w-0">
      <h1 className="truncate text-base font-semibold text-foreground">Club structure</h1>
      <p className="truncate text-xs text-muted-foreground">Teams, committees, and membership</p>
    </div>
  );

  if (navigation !== undefined && !canManageStructure) {
    return (
      <ClubWorkspace title={title}>
        <div className="mx-auto max-w-3xl px-4 py-12 text-center">
          <ShieldCheck className="mx-auto size-6 text-muted-foreground" />
          <h2 className="mt-3 text-base font-semibold">Club structure is restricted</h2>
          <p className="mt-1 text-sm text-muted-foreground">Your role cannot manage this club.</p>
        </div>
      </ClubWorkspace>
    );
  }

  return (
    <ClubWorkspace
      title={title}
      contentClassName="flex flex-col overflow-hidden"
      actions={
        <Button asChild variant="tertiary" size="sm">
          <Link href={`/clubs/${clubId}/settings`}>Back to settings</Link>
        </Button>
      }
    >
      {club ? <ClubStructureEditor club={club} /> : null}
    </ClubWorkspace>
  );
}
