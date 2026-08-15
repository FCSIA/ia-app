"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { CircleHelp, ShieldCheck } from "lucide-react";
import { api } from "~/apps/convex/src/_generated/api";
import type { Id } from "~/apps/convex/src/_generated/dataModel";
import { useClubId } from "../../../../club-route";
import { ClubWorkspace } from "@/components/clubs/club-workspace";
import { PeoplePicker } from "@/components/clubs/people-picker";
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
import { Textarea } from "@/components/ui/textarea";
import { Tooltip } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { Elevated } from "@/lib/elevated";

type PostingPolicy = "AUDIENCE" | "CLUB_MANAGERS";

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
    name: string;
    kind: string | null;
  }>;
}) {
  const { toast } = useToast();
  const updateChannel = useMutation(api.clubs.channels.update);
  const [name, setName] = useState(channel.name);
  const [description, setDescription] = useState(channel.description ?? "");
  const [roleIds, setRoleIds] = useState<string[]>(
    channel.accessPolicyVersion === 2 ? channel.accessRoleIds ?? [] : [],
  );
  const [unitId, setUnitId] = useState(legacyUnitId(channel) ?? "any");
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

  const save = async () => {
    setSaving(true);
    try {
      await updateChannel({
        channelId: channel._id,
        name: name.trim(),
        description: description.trim() || undefined,
        accessRoleIds: roleIds as Id<"clubRoles">[],
        accessUnitId:
          unitId === "any" ? null : unitId as Id<"clubUnits">,
        memberIds: memberIds as Id<"users">[],
        postingPolicy,
      });
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
              <FieldLabel htmlFor="channel-unit">Club structure</FieldLabel>
              <Select value={unitId} onValueChange={setUnitId}>
                <SelectTrigger id="channel-unit" className="w-full" />
                <SelectContent>
                  <SelectGroup>
                    <SelectItem index={0} value="any">Any unit</SelectItem>
                    {units.map((unit, index) => (
                      <SelectItem key={unit._id} index={index + 1} value={unit._id}>
                        {unit.name}{unit.kind ? ` · ${unit.kind}` : ""}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
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
        </CardContent>
        <CardFooter className="justify-end">
          <Button loading={saving} disabled={!name.trim()} onClick={() => void save()}>
            Save changes
          </Button>
        </CardFooter>
      </Card>
    </Elevated>
  );
}
