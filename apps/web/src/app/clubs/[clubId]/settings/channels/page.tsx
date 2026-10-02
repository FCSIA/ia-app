"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery } from "@/lib/convex-react";
import {
  GripVertical,
  IndentDecrease,
  IndentIncrease,
  Plus,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { api } from "~/apps/convex/src/_generated/api";
import type { Id } from "~/apps/convex/src/_generated/dataModel";
import { useClubId } from "../../../club-route";
import { ClubWorkspace } from "@/components/clubs/club-workspace";
import { ChannelDialog } from "@/components/clubs/dialogs/channel-dialog";
import type { ClubDetail } from "@/components/clubs/types";
import { Button } from "@/components/ui/button";
import { CARD_SURFACE_FOREGROUND } from "@/lib/surface-classes";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownContent,
  DropdownMenu,
  DropdownTrigger,
} from "@/components/ui/dropdown";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldTitle,
} from "@/components/ui/field";
import { MenuItem } from "@/components/ui/menu-item";
import { Switch } from "@/components/ui/switch";
import {
  Sortable,
  SortableItem,
  SortableItemHandle,
} from "@/components/reui/sortable";
import { useToast } from "@/hooks/use-toast";
import { Elevated } from "@/lib/elevated";

function audienceLabel(
  channel: NonNullable<ClubDetail>["channels"][number],
  units: readonly { _id: string; name: string }[],
  roles: readonly { _id: string; name: string }[],
) {
  if (channel.accessPolicyVersion === 2) {
    const roleNames = (channel.accessRoleIds ?? [])
      .map((roleId) => roles.find((role) => role._id === roleId)?.name)
      .filter((name): name is string => !!name);
    const unitName = units.find(
      (unit) => unit._id === channel.accessUnitId,
    )?.name;
    const filters = [
      roleNames.length === 1
        ? roleNames[0]
        : roleNames.length > 1
          ? `${roleNames.length} roles`
          : null,
      unitName ? `${unitName} branch` : null,
    ].filter(Boolean);
    const exceptions = channel.memberships.length;
    if (filters.length === 0 && exceptions === 0) return "Everyone in the club";
    return `${filters.join(" + ") || "No filters"}${exceptions ? ` or ${exceptions} selected` : ""}`;
  }
  if (
    channel.audienceKind === "CUSTOM" ||
    (!channel.audienceKind && channel.visibility === "PRIVATE")
  )
    return "Selected people";
  const unitName =
    units.find((unit) => unit._id === channel.audienceUnitId)?.name ?? "Unit";
  if (channel.audienceKind === "UNIT_LEADERS") return `${unitName} branch`;
  if (channel.audienceKind === "UNIT_MEMBERS")
    return `${unitName} conversation${channel.includeDescendants ? " with child units" : ""}`;
  return "Everyone in the club";
}

type Channel = NonNullable<ClubDetail>["channels"][number];
type Unit = {
  _id: Id<"clubUnits">;
  parentUnitId: Id<"clubUnits"> | null;
  name: string;
  kind: string | null;
  position: number;
};

function sortChannels(channels: Channel[]) {
  return [...channels].sort(
    (a, b) =>
      (a.position ?? Number.MAX_SAFE_INTEGER) -
        (b.position ?? Number.MAX_SAFE_INTEGER) ||
      a.createdAt - b.createdAt,
  );
}

function sortUnits(units: Unit[]) {
  return [...units].sort(
    (a, b) => a.position - b.position || a.name.localeCompare(b.name),
  );
}

function ChannelPlacementEditor({
  clubId,
  channels,
  units,
  roles,
}: {
  clubId: Id<"clubs">;
  channels: Channel[];
  units: Unit[];
  roles: NonNullable<ClubDetail>["roles"];
}) {
  const rootUnits = sortUnits(units.filter((unit) => !unit.parentUnitId));

  return (
    <Elevated offset={1} className="rounded-xl">
      <Card>
        <CardHeader>
          <h2>
            <CardTitle>Channel order</CardTitle>
          </h2>
          <CardDescription>Drag to reorder. Indent into units.</CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-3 pt-2">
          <ChannelPlacementGroup
            key={`club:${channels.filter((channel) => !channel.ownerUnitId).map((channel) => `${channel._id}:${channel.position ?? "new"}`).join("|")}`}
            clubId={clubId}
            label="Club"
            ownerUnit={null}
            depth={0}
            channels={channels}
            units={units}
            roles={roles}
          />
          {rootUnits.map((unit) => (
            <UnitPlacementTree
              key={unit._id}
              clubId={clubId}
              unit={unit}
              depth={0}
              channels={channels}
              units={units}
              roles={roles}
            />
          ))}
        </CardContent>
      </Card>
    </Elevated>
  );
}

function UnitPlacementTree({
  clubId,
  unit,
  depth,
  channels,
  units,
  roles,
}: {
  clubId: Id<"clubs">;
  unit: Unit;
  depth: number;
  channels: Channel[];
  units: Unit[];
  roles: NonNullable<ClubDetail>["roles"];
}) {
  const children = sortUnits(
    units.filter((candidate) => candidate.parentUnitId === unit._id),
  );
  const groupKey = channels
    .filter((channel) => channel.ownerUnitId === unit._id)
    .map((channel) => `${channel._id}:${channel.position ?? "new"}`)
    .join("|");

  return (
    <>
      <ChannelPlacementGroup
        key={`${unit._id}:${groupKey}`}
        clubId={clubId}
        label={unit.name}
        ownerUnit={unit}
        depth={depth + 1}
        channels={channels}
        units={units}
        roles={roles}
      />
      {children.map((child) => (
        <UnitPlacementTree
          key={child._id}
          clubId={clubId}
          unit={child}
          depth={depth + 1}
          channels={channels}
          units={units}
          roles={roles}
        />
      ))}
    </>
  );
}

function ChannelPlacementGroup({
  clubId,
  label,
  ownerUnit,
  depth,
  channels,
  units,
  roles,
}: {
  clubId: Id<"clubs">;
  label: string;
  ownerUnit: Unit | null;
  depth: number;
  channels: Channel[];
  units: Unit[];
  roles: NonNullable<ClubDetail>["roles"];
}) {
  const sourceChannels = sortChannels(
    channels.filter(
      (channel) => (channel.ownerUnitId ?? null) === (ownerUnit?._id ?? null),
    ),
  );
  const [orderedChannels, setOrderedChannels] = useState(sourceChannels);
  const reorderChannels = useMutation(api.clubs.channels.reorderChannels);
  const moveChannel = useMutation(api.clubs.channels.moveChannel);
  const { toast } = useToast();
  const childUnits = sortUnits(
    units.filter(
      (unit) => (unit.parentUnitId ?? null) === (ownerUnit?._id ?? null),
    ),
  );
  const parentUnitId = ownerUnit?.parentUnitId ?? null;

  const move = (channel: Channel, targetUnitId: Id<"clubUnits"> | null) => {
    void moveChannel({ channelId: channel._id, ownerUnitId: targetUnitId }).catch(
      (error) =>
        toast({
          title: error instanceof Error ? error.message : "Could not move channel",
          variant: "destructive",
        }),
    );
  };

  return (
    <section aria-label={`${label} channels`}>
      <div
        className={`flex min-h-9 items-center border-y border-border/50 bg-surface-2 pr-4 text-sm font-semibold text-foreground ${CARD_SURFACE_FOREGROUND}`}
        style={{ paddingLeft: `${16 + depth * 16}px` }}
      >
        {label}
      </div>
      {orderedChannels.length ? (
        <Sortable
          value={orderedChannels}
          onValueChange={setOrderedChannels}
          onValueCommit={(nextChannels) => {
            void reorderChannels({
              clubId,
              ownerUnitId: ownerUnit?._id ?? null,
              channelIds: nextChannels.map((channel) => channel._id),
            }).catch((error) => {
              setOrderedChannels(sourceChannels);
              toast({
                title:
                  error instanceof Error
                    ? error.message
                    : "Could not reorder channels",
                variant: "destructive",
              });
            });
          }}
          getItemValue={(channel) => channel._id}
          strategy="vertical"
          className="divide-y divide-border/40"
        >
          {orderedChannels.map((channel) => (
            <SortableItem
              key={channel._id}
              value={channel._id}
              className={`group bg-card data-[dragging=true]:relative data-[dragging=true]:rounded-lg data-[dragging=true]:shadow-surface-3 ${CARD_SURFACE_FOREGROUND}`}
            >
              <div
                className="flex min-h-11 items-center gap-1.5 py-1.5 pr-2"
                style={{ paddingLeft: `${16 + (depth + 1) * 16}px` }}
              >
                <SortableItemHandle
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-compact"
                      aria-label={`Drag ${channel.name} to reorder`}
                    />
                  }
                >
                  <GripVertical />
                </SortableItemHandle>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">#{channel.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {audienceLabel(channel, units, roles)}
                  </p>
                </div>
                {ownerUnit ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-compact"
                    aria-label={`Move ${channel.name} out of ${ownerUnit.name}`}
                    onClick={() => move(channel, parentUnitId)}
                  >
                    <IndentDecrease />
                  </Button>
                ) : null}
                {childUnits.length ? (
                  <DropdownMenu>
                    <DropdownTrigger
                      render={
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-compact"
                          aria-label={`Indent ${channel.name}`}
                        >
                          <IndentIncrease />
                        </Button>
                      }
                    />
                    <DropdownContent align="end">
                      {childUnits.map((unit, index) => (
                        <MenuItem
                          key={unit._id}
                          index={index}
                          label={unit.name}
                          onSelect={() => move(channel, unit._id)}
                        />
                      ))}
                    </DropdownContent>
                  </DropdownMenu>
                ) : null}
                <Button
                  asChild
                  variant="ghost"
                  size="icon-compact"
                  aria-label={`Settings for ${channel.name}`}
                >
                  <Link href={`/clubs/${clubId}/settings/channels/${channel._id}`}>
                    <Settings />
                  </Link>
                </Button>
              </div>
            </SortableItem>
          ))}
        </Sortable>
      ) : null}
    </section>
  );
}

export default function ClubChannelSettingsPage() {
  const clubId = useClubId();
  const navigation = useQuery(api.clubs.detail.getWorkspaceNavigation, {
    clubId,
  });
  const club = useQuery(api.clubs.detail.get, { clubId }) as
    ClubDetail | undefined;
  const [createOpen, setCreateOpen] = useState(false);
  const { toast } = useToast();
  const setAutoCreate = useMutation(
    api.clubs.channels.setAutoCreateUnitChannels,
  );
  const createMissing = useMutation(
    api.clubs.channels.createMissingUnitChannels,
  );
  const canManage = navigation?.viewer.canManageChannels ?? false;

  if (navigation !== undefined && !canManage) {
    return (
      <ClubWorkspace title="Channel settings">
        <div className="mx-auto max-w-3xl px-4 py-12 text-center">
          <ShieldCheck className="mx-auto size-6 text-muted-foreground" />
          <h2 className="mt-3 text-base font-semibold">
            Channel settings are restricted
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Your role cannot manage club channels.
          </p>
        </div>
      </ClubWorkspace>
    );
  }

  return (
    <ClubWorkspace
      title="Channels"
      actions={
        <>
          <Button asChild size="sm" variant="tertiary">
            <Link href={`/clubs/${clubId}/settings`}>Back</Link>
          </Button>
          <Button
            size="sm"
            leadingIcon={Plus}
            onClick={() => setCreateOpen(true)}
          >
            New channel
          </Button>
        </>
      }
    >
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-4 py-6 sm:px-6">
        <Elevated offset={1} className="rounded-xl">
          <Card>
            <CardHeader>
              <h2>
                <CardTitle>Unit channels</CardTitle>
              </h2>
            </CardHeader>
            <CardContent className="flex flex-col gap-0 pb-4 pt-2">
              <Field orientation="horizontal" className="min-h-14 items-center border-b border-border/60 py-2.5">
                <FieldContent>
                  <FieldTitle>New units</FieldTitle>
                  <FieldDescription>Create a restricted channel automatically.</FieldDescription>
                </FieldContent>
                <Switch
                  checked={club?.autoCreateUnitChannels ?? false}
                  aria-label="Create a channel for every new unit"
                  onCheckedChange={(enabled) =>
                    void setAutoCreate({ clubId, enabled }).catch((error) =>
                      toast({
                        title:
                          error instanceof Error
                            ? error.message
                            : "Could not update channel default",
                        variant: "destructive",
                      }),
                    )
                  }
                />
              </Field>
              <Field orientation="horizontal" className="min-h-14 items-center py-2.5">
                <FieldContent>
                  <FieldTitle>Existing units</FieldTitle>
                  <FieldDescription>Create any missing unit channels.</FieldDescription>
                </FieldContent>
                <Button
                  size="sm"
                  variant="tertiary"
                  onClick={() =>
                    void createMissing({ clubId })
                      .then((created) =>
                        toast({
                          title: created
                            ? `${created} unit ${created === 1 ? "channel" : "channels"} created`
                            : "Every unit already has a channel",
                        }),
                      )
                      .catch((error) =>
                        toast({
                          title:
                            error instanceof Error
                              ? error.message
                              : "Could not create unit channels",
                          variant: "destructive",
                        }),
                      )
                  }
                >
                  Create missing
                </Button>
              </Field>
            </CardContent>
          </Card>
        </Elevated>
        {club?.channels.length && navigation ? (
          <ChannelPlacementEditor
            clubId={clubId}
            channels={club.channels}
            units={navigation.units}
            roles={club.roles}
          />
        ) : club && navigation ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No channels yet.
          </div>
        ) : null}
      </div>
      <ChannelDialog
        clubId={clubId}
        open={createOpen}
        onOpenChange={setCreateOpen}
      />
    </ClubWorkspace>
  );
}
