"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "convex/react";
import { ChevronRight, Plus, ShieldCheck } from "lucide-react";
import { api } from "~/apps/convex/src/_generated/api";
import { useClubId } from "../../../club-route";
import { ClubWorkspace } from "@/components/clubs/club-workspace";
import { ChannelDialog } from "@/components/clubs/dialogs/channel-dialog";
import type { ClubDetail } from "@/components/clubs/types";
import { Button } from "@/components/ui/button";
import { Card, CardGroup } from "@/components/ui/card";

function audienceLabel(channel: NonNullable<ClubDetail>["channels"][number], units: readonly { _id: string; name: string }[]) {
  if (channel.audienceKind === "CUSTOM" || (!channel.audienceKind && channel.visibility === "PRIVATE")) return "Selected people";
  const unitName = units.find((unit) => unit._id === channel.audienceUnitId)?.name ?? "Unit";
  if (channel.audienceKind === "UNIT_LEADERS") return `${unitName} leaders`;
  if (channel.audienceKind === "UNIT_MEMBERS") return `${unitName}${channel.includeDescendants ? " and descendants" : ""}`;
  return "Everyone in the club";
}

export default function ClubChannelSettingsPage() {
  const clubId = useClubId();
  const navigation = useQuery(api.clubs.detail.getWorkspaceNavigation, { clubId });
  const club = useQuery(api.clubs.detail.get, { clubId }) as ClubDetail | undefined;
  const [createOpen, setCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const canManage = navigation?.viewer.canManageChannels ?? false;
  const editing = club?.channels.find((channel) => channel._id === editingId) ?? null;

  if (navigation !== undefined && !canManage) {
    return <ClubWorkspace title="Channel settings"><div className="mx-auto max-w-3xl px-4 py-12 text-center"><ShieldCheck className="mx-auto size-6 text-muted-foreground" /><h2 className="mt-3 text-base font-semibold">Channel settings are restricted</h2><p className="mt-1 text-sm text-muted-foreground">Your role cannot manage club channels.</p></div></ClubWorkspace>;
  }

  return <ClubWorkspace
    title={<div><h1 className="text-base font-semibold">Channels</h1><p className="text-xs text-muted-foreground">Audience, posting, and structure placement</p></div>}
    actions={<><Button asChild size="sm" variant="tertiary"><Link href={`/clubs/${clubId}/settings`}>Back</Link></Button><Button size="sm" leadingIcon={Plus} onClick={() => setCreateOpen(true)}>New channel</Button></>}
  >
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
      <p className="mb-4 text-sm text-muted-foreground">Audience controls access. Sidebar location only controls where the channel appears.</p>
      {club?.channels.length ? <CardGroup orientation="inline" separated className="gap-2">
        {club.channels.map((channel) => <Card key={channel._id} onClick={() => setEditingId(channel._id)} label={`Edit #${channel.name}`} className="min-h-16 cursor-pointer rounded-lg px-3">
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">#{channel.name}</p><p className="mt-0.5 truncate text-xs text-muted-foreground">{audienceLabel(channel, navigation?.units ?? [])} · {channel.postingPolicy === "CLUB_MANAGERS" ? "Managers post" : channel.postingPolicy === "UNIT_LEADERS" ? "Leaders post" : "Audience posts"}</p></div><ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        </Card>)}
      </CardGroup> : <div className="py-12 text-center text-sm text-muted-foreground">No channels yet.</div>}
    </div>
    <ChannelDialog clubId={clubId} open={createOpen} onOpenChange={setCreateOpen} />
    {editing ? <ChannelDialog clubId={clubId} channel={editing} open onOpenChange={(open) => !open && setEditingId(null)} /> : null}
  </ClubWorkspace>;
}
