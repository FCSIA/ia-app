"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery } from "@/lib/convex-react";
import { ChevronDown, CircleHelp, ShieldCheck } from "lucide-react";
import { api } from "~/apps/convex/src/_generated/api";
import type { Id } from "~/apps/convex/src/_generated/dataModel";
import { useClubId } from "../../../../club-route";
import { ClubWorkspace } from "@/components/clubs/club-workspace";
import { PeoplePicker } from "@/components/clubs/people-picker";
import { UnitTreePicker } from "@/components/clubs/unit-tree-picker";
import type { ClubChannel, ClubDetail } from "@/components/clubs/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  CheckboxGroup,
  CheckboxItem,
} from "@/components/ui/checkbox-group";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { Elevated } from "@/lib/elevated";

type PostingPolicy = "AUDIENCE" | "CLUB_MANAGERS";

function hasSameIds(left: string[], right: string[]) {
  if (left.length !== right.length) return false;
  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();
  return sortedLeft.every((value, index) => value === sortedRight[index]);
}

function legacyUnitId(channel: ClubChannel) {
  if (channel.accessPolicyVersion === 2) return channel.accessUnitId ?? null;
  return channel.audienceKind === "UNIT_MEMBERS" ||
    channel.audienceKind === "UNIT_LEADERS"
    ? channel.audienceUnitId ?? null
    : null;
}

export default function ChannelSettingsPage() {
  const clubId = useClubId();
  const channelId = useParams<{ channelId: string }>()?.channelId;
  const club = useQuery(api.clubs.detail.get, { clubId }) as
    | ClubDetail
    | undefined;
  const hierarchy = useQuery(api.clubs.hierarchy.list, { clubId });
  const navigation = useQuery(api.clubs.detail.getWorkspaceNavigation, {
    clubId,
  });
  const channel = club?.channels.find((item) => item._id === channelId);
  const canEdit = navigation?.viewer.canEditChannels ?? false;

  if (navigation !== undefined && !canEdit) {
    return (
      <ClubWorkspace title="Channel settings">
        <div className="mx-auto max-w-3xl px-4 py-12 text-center">
          <ShieldCheck className="mx-auto size-6 text-muted-foreground" />
          <h2 className="mt-3 text-base font-semibold">Channel settings are restricted</h2>
        </div>
      </ClubWorkspace>
    );
  }

  return (
    <ClubWorkspace
      title={channel ? `#${channel.name}` : "Channel settings"}
      actions={
        <Button asChild variant="tertiary" size="sm">
          <Link href={`/clubs/${clubId}/settings/channels`}>All channels</Link>
        </Button>
      }
    >
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
        {club && channel ? (
          <ChannelSettingsEditor
            key={`${channel._id}:${channel.updatedAt}`}
            club={club}
            channel={channel}
            units={hierarchy?.units ?? []}
          />
        ) : club && navigation ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Channel not found.
          </p>
        ) : null}
      </div>
    </ClubWorkspace>
  );
}

function ChannelSettingsEditor({
  club,
  channel,
  units,
}: {
  club: ClubDetail;
  channel: ClubChannel;
  units: Array<{
    _id: Id<"clubUnits">;
    parentUnitId: Id<"clubUnits"> | null;
    name: string;
    kind: string | null;
  }>;
}) {
  const { toast } = useToast();
  const updateChannel = useMutation(api.clubs.channels.update);
  const setWhiteboardsEnabled = useMutation(api.clubs.whiteboards.setEnabledForChannel);
  const savedWhiteboards = channel.whiteboardsEnabled !== false;
  const [whiteboards, setWhiteboards] = useState(savedWhiteboards);
  const [name, setName] = useState(channel.name);
  const [description, setDescription] = useState(channel.description ?? "");
  const [roleIds, setRoleIds] = useState<string[]>(
    channel.accessPolicyVersion === 2 ? channel.accessRoleIds ?? [] : [],
  );
  const [unitId, setUnitId] = useState<Id<"clubUnits"> | null>(
    legacyUnitId(channel),
  );
  const [unitPickerOpen, setUnitPickerOpen] = useState(false);
  const [memberIds, setMemberIds] = useState<string[]>(
    channel.memberships.map((membership) => membership.userId),
  );
  const [postingPolicy, setPostingPolicy] = useState<PostingPolicy>(
    channel.postingPolicy === "CLUB_MANAGERS"
      ? "CLUB_MANAGERS"
      : "AUDIENCE",
  );
  const [saving, setSaving] = useState(false);
  const people = useMemo(
    () => club.directory.filter((person) => person.kind === "MEMBER"),
    [club.directory],
  );
  const checkedRoleIndices = new Set(
    club.roles.flatMap((role, index) => roleIds.includes(role._id) ? [index] : []),
  );
  const selectedUnitName = units.find((unit) => unit._id === unitId)?.name;
  const hasUnsavedChanges =
    name.trim() !== channel.name ||
    (description.trim() || "") !== (channel.description ?? "") ||
    !hasSameIds(
      roleIds,
      channel.accessPolicyVersion === 2 ? channel.accessRoleIds ?? [] : [],
    ) ||
    unitId !== legacyUnitId(channel) ||
    !hasSameIds(
      memberIds,
      channel.memberships.map((membership) => membership.userId),
    ) ||
    postingPolicy !==
      (channel.postingPolicy === "CLUB_MANAGERS"
        ? "CLUB_MANAGERS"
        : "AUDIENCE") ||
    whiteboards !== savedWhiteboards;

  const save = async () => {
    setSaving(true);
    try {
      await updateChannel({
        channelId: channel._id,
        name: name.trim(),
        description: description.trim() || undefined,
        accessRoleIds: roleIds as Id<"clubRoles">[],
        accessUnitId: unitId,
        memberIds: memberIds as Id<"users">[],
        postingPolicy,
      });
      if (whiteboards !== savedWhiteboards) {
        await setWhiteboardsEnabled({ channelId: channel._id, enabled: whiteboards });
      }
      toast({ title: "Channel saved" });
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : "Could not save channel",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Elevated offset={1} className="rounded-xl">
      <Card>
        <CardHeader>
          <h1>
            <CardTitle>General</CardTitle>
          </h1>
        </CardHeader>
        <CardContent className="flex flex-col gap-6 pb-5">
          <FieldGroup className="gap-5">
            <Field>
              <FieldLabel htmlFor="channel-name">Name</FieldLabel>
              <Input
                id="channel-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="channel-description">Description</FieldLabel>
              <Textarea
                id="channel-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={3}
              />
            </Field>
          </FieldGroup>

          <Separator />

          <div className="flex flex-col gap-5">
            <div>
              <h2 className="text-sm font-semibold">Access</h2>
              <p className="text-sm text-muted-foreground">
                Role and structure filters are combined.
              </p>
            </div>

            <FieldSet className="gap-2">
              <FieldLegend variant="label">Roles</FieldLegend>
              <FieldDescription>Leave empty for any role.</FieldDescription>
              <ScrollArea className="max-h-64">
                <CheckboxGroup
                  checkedIndices={checkedRoleIndices}
                  className="w-full"
                  aria-label="Roles with channel access"
                >
                  {club.roles.map((role, index) => (
                    <CheckboxItem
                      key={role._id}
                      index={index}
                      label={role.name}
                      checked={roleIds.includes(role._id)}
                      onToggle={() =>
                        setRoleIds((current) =>
                          current.includes(role._id)
                            ? current.filter((roleId) => roleId !== role._id)
                            : [...current, role._id],
                        )
                      }
                      className="w-full"
                    />
                  ))}
                </CheckboxGroup>
              </ScrollArea>
            </FieldSet>

            <Field>
              <FieldLabel>Club structure</FieldLabel>
              <UnitTreePicker
                open={unitPickerOpen}
                onOpenChange={setUnitPickerOpen}
                trigger={
                  <Button
                    type="button"
                    variant="tertiary"
                    size="md"
                    className="w-full justify-between"
                    trailingIcon={ChevronDown}
                  >
                    {selectedUnitName ?? "Any unit"}
                  </Button>
                }
                units={units}
                value={unitId}
                onValueChange={setUnitId}
                title="Choose unit"
                subtitle="Channel access"
                ariaLabel="Club structure with channel access"
                anyUnitLabel="Any unit"
              />
              <FieldDescription>
                Members assigned here or above can access this channel.
              </FieldDescription>
            </Field>

            <Field>
              <FieldTitle>
                Selected people
                <Tooltip content="Prefer roles or units for recurring access.">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-compact"
                    aria-label="About selected people"
                  >
                    <CircleHelp />
                  </Button>
                </Tooltip>
              </FieldTitle>
              <PeoplePicker
                people={people}
                selectedIds={memberIds}
                onChange={setMemberIds}
                placeholder="Add an exception"
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="channel-posting">Who can post</FieldLabel>
              <Select
                value={postingPolicy}
                onValueChange={(value) => setPostingPolicy(value as PostingPolicy)}
              >
                <SelectTrigger id="channel-posting" className="w-full" />
                <SelectContent>
                  <SelectGroup>
                    <SelectItem index={0} value="AUDIENCE">Everyone with access</SelectItem>
                    <SelectItem index={1} value="CLUB_MANAGERS">Club managers</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Separator />

          <Field orientation="horizontal" className="items-center">
            <FieldContent>
              <FieldLabel htmlFor="channel-whiteboards">Whiteboards</FieldLabel>
              <FieldDescription>Shared drawing boards in this channel.</FieldDescription>
            </FieldContent>
            <Switch
              id="channel-whiteboards"
              checked={whiteboards}
              onCheckedChange={setWhiteboards}
            />
          </Field>
        </CardContent>
        {hasUnsavedChanges ? (
          <CardFooter className="justify-end">
            <Button
              loading={saving}
              disabled={!name.trim()}
              onClick={() => void save()}
            >
              Save changes
            </Button>
          </CardFooter>
        ) : null}
      </Card>
    </Elevated>
  );
}
