"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import Link from "next/link";
import {
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { api } from "~/apps/convex/src/_generated/api";
import { useClubId } from "../../club-route";
import { ClubWorkspace } from "@/components/clubs/club-workspace";
import { ClubStructureActions } from "@/components/clubs/dialogs/hierarchy-dialog";
import { PeopleGroupsSettings } from "@/components/clubs/people-groups-settings";
import type { ClubDetail } from "@/components/clubs/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardGroup,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldContent,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Tooltip } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { isSuperAdmin, useCurrentUser } from "@/lib/auth";
import { Elevated } from "@/lib/elevated";

type ClubRole = FunctionReturnType<
  typeof api.clubs.management.listRoles
>[number];
type RolePermissions = ClubRole["permissions"];
type PermissionKey = keyof RolePermissions;

const permissionGroups: Array<{
  title: string;
  description: string;
  items: Array<{ key: PermissionKey; label: string; description: string }>;
}> = [
  {
    title: "Publishing",
    description: "Create club content and activities.",
    items: [
      {
        key: "createAnnouncementDrafts",
        label: "Announcement drafts",
        description: "Write announcements for sponsor review.",
      },
      {
        key: "createEvents",
        label: "Events",
        description: "Create events for this club.",
      },
      {
        key: "createPolls",
        label: "Polls",
        description: "Publish polls in club channels.",
      },
    ],
  },
  {
    title: "Channels",
    description: "Control channel structure, visibility, and moderation.",
    items: [
      {
        key: "createChannels",
        label: "Create channels",
        description: "Add new public, read-only, or private channels.",
      },
      {
        key: "editChannels",
        label: "Rename and edit channels",
        description: "Change channel names, descriptions, and visibility.",
      },
      {
        key: "deleteChannels",
        label: "Delete channels",
        description: "Permanently remove club channels.",
      },
      {
        key: "viewPrivateChannels",
        label: "View every private channel",
        description: "Bypass channel access filters across the club.",
      },
      {
        key: "postToReadOnlyChannels",
        label: "Post in read-only channels",
        description: "Send messages where ordinary posting is disabled.",
      },
      {
        key: "pinMessages",
        label: "Pin messages",
        description: "Pin and unpin important channel messages.",
      },
      {
        key: "moderateMessages",
        label: "Moderate messages",
        description: "Delete messages written by other people.",
      },
      {
        key: "mentionEveryone",
        label: "Mention everyone",
        description: "Use the @everyone mention in channels.",
      },
    ],
  },
  {
    title: "People",
    description: "Invite members and organize the club directory.",
    items: [
      {
        key: "inviteMembers",
        label: "Invite members",
        description: "Send invitations and use club join links.",
      },
      {
        key: "manageJoinRequests",
        label: "Manage join requests",
        description: "Approve or decline requests to join.",
      },
      {
        key: "removeMembers",
        label: "Remove members",
        description: "Remove people from the club.",
      },
      {
        key: "assignRoles",
        label: "Assign roles",
        description: "Change a member's club-wide role.",
      },
      {
        key: "manageMemberTags",
        label: "Manage member tags",
        description: "Create tags and organize members with them.",
      },
    ],
  },
  {
    title: "Administration",
    description: "Change how the club itself is configured.",
    items: [
      {
        key: "manageRoles",
        label: "Manage roles",
        description: "Create, rename, and configure club roles.",
      },
      {
        key: "manageClubSettings",
        label: "Club settings",
        description: "Edit the club name, description, and appearance.",
      },
      {
        key: "manageClubStructure",
        label: "Club structure",
        description: "Organize members into school, house, room, or team units.",
      },
      {
        key: "manageJoinCodes",
        label: "Join codes",
        description: "Create and revoke shareable join codes.",
      },
    ],
  },
];

type Editor = { mode: "create" } | { mode: "rename"; role: ClubRole } | null;

const settingsTitle = (
  <div className="min-w-0">
    <h1 className="truncate text-base font-semibold text-foreground">
      Club settings
    </h1>
    <p className="truncate text-xs text-muted-foreground">
      Roles and administration
    </p>
  </div>
);

export default function ClubSettingsPage() {
  const clubId = useClubId();
  const { toast } = useToast();
  const user = useCurrentUser();
  const roles = useQuery(api.clubs.management.listRoles, { clubId });
  const navigation = useQuery(api.clubs.detail.getWorkspaceNavigation, {
    clubId,
  });
  const club = useQuery(api.clubs.detail.get, { clubId }) as
    ClubDetail | undefined;
  const initializeRoles = useMutation(api.clubs.management.initializeRoles);
  const createRole = useMutation(api.clubs.management.createRole);
  const renameRole = useMutation(api.clubs.management.renameRole);
  const removeRole = useMutation(api.clubs.management.removeRole);
  const setRolePermission = useMutation(
    api.clubs.management.setRolePermission,
  ).withOptimisticUpdate((localStore, args) => {
    const roles = localStore.getQuery(api.clubs.management.listRoles, {
      clubId: args.clubId,
    });
    if (roles === undefined) return;
    localStore.setQuery(
      api.clubs.management.listRoles,
      { clubId: args.clubId },
      roles.map((role) =>
        role._id === args.roleId
          ? {
              ...role,
              permissions: {
                ...role.permissions,
                [args.permission]: args.enabled,
              },
            }
          : role,
      ),
    );
  });
  const setRolePermissionGroup = useMutation(
    api.clubs.management.setRolePermissionGroup,
  ).withOptimisticUpdate((localStore, args) => {
    const roles = localStore.getQuery(api.clubs.management.listRoles, {
      clubId: args.clubId,
    });
    if (roles === undefined) return;
    localStore.setQuery(
      api.clubs.management.listRoles,
      { clubId: args.clubId },
      roles.map((role) =>
        role._id === args.roleId
          ? {
              ...role,
              permissions: {
                ...role.permissions,
                ...Object.fromEntries(
                  args.permissions.map((permission) => [
                    permission,
                    args.enabled,
                  ]),
                ),
              },
            }
          : role,
      ),
    );
  });
  const setRoleDirectoryVisibility = useMutation(
    api.clubs.management.setRoleDirectoryVisibility,
  ).withOptimisticUpdate((localStore, args) => {
    const roles = localStore.getQuery(api.clubs.management.listRoles, {
      clubId: args.clubId,
    });
    if (roles !== undefined) {
      localStore.setQuery(
        api.clubs.management.listRoles,
        { clubId: args.clubId },
        roles.map((role) =>
          role._id === args.roleId
            ? { ...role, showInDirectory: args.showInDirectory }
            : role,
        ),
      );
    }
    const detail = localStore.getQuery(api.clubs.detail.get, {
      clubId: args.clubId,
    });
    if (detail) {
      localStore.setQuery(
        api.clubs.detail.get,
        { clubId: args.clubId },
        {
          ...detail,
          roles: detail.roles.map((role) =>
            role._id === args.roleId
              ? { ...role, showInDirectory: args.showInDirectory }
              : role,
          ),
        },
      );
    }
  });
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [editor, setEditor] = useState<Editor>(null);
  const [roleName, setRoleName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [removeRoleOpen, setRemoveRoleOpen] = useState(false);
  const [removingRole, setRemovingRole] = useState(false);
  const [savingPermissionGroup, setSavingPermissionGroup] = useState<
    string | null
  >(null);
  const canManageRoles = navigation?.viewer.canManageRoles ?? false;
  const canManageStructure = navigation?.viewer.canManageClubStructure ?? false;
  const canManageChannels = navigation?.viewer.canManageChannels ?? false;
  const canDeleteClub = isSuperAdmin(user);

  useEffect(() => {
    if (roles?.length === 0 && canManageRoles) {
      void initializeRoles({ clubId }).catch((error) => {
        toast({
          title:
            error instanceof Error
              ? error.message
              : "Could not initialize roles",
          variant: "destructive",
        });
      });
    }
  }, [canManageRoles, clubId, initializeRoles, roles?.length, toast]);

  useEffect(() => {
    if (!roles?.length) return;
    if (!roles.some((role) => role._id === selectedRoleId)) {
      setSelectedRoleId(roles[0]._id);
    }
  }, [roles, selectedRoleId]);

  const selectedRole =
    roles?.find((role) => role._id === selectedRoleId) ?? roles?.[0];
  const roleRemovalImpact = useQuery(
    api.clubs.management.getRoleRemovalImpact,
    removeRoleOpen && selectedRole
      ? { clubId, roleId: selectedRole._id }
      : "skip",
  );

  const openEditor = (next: Exclude<Editor, null>) => {
    setEditor(next);
    setRoleName(next.mode === "rename" ? next.role.name : "");
  };

  const saveName = async () => {
    const name = roleName.trim();
    if (!name || !editor) return;
    setSavingName(true);
    try {
      if (editor.mode === "create") {
        const role = await createRole({ clubId, name });
        setSelectedRoleId(role._id);
      } else {
        await renameRole({ clubId, roleId: editor.role._id, name });
      }
      setEditor(null);
      toast({
        title: editor.mode === "create" ? "Role added" : "Role renamed",
      });
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : "Could not save role",
        variant: "destructive",
      });
    } finally {
      setSavingName(false);
    }
  };

  const setPermission = async (key: PermissionKey, checked: boolean) => {
    if (!selectedRole) return;
    try {
      await setRolePermission({
        clubId,
        roleId: selectedRole._id,
        permission: key,
        enabled: checked,
      });
    } catch (error) {
      toast({
        title:
          error instanceof Error
            ? error.message
            : "Could not update permission",
        variant: "destructive",
      });
    }
  };

  const setPermissionGroup = async (
    group: (typeof permissionGroups)[number],
  ) => {
    if (!selectedRole) return;
    const enabled = !group.items.every(
      (item) => selectedRole.permissions[item.key],
    );
    setSavingPermissionGroup(group.title);
    try {
      await setRolePermissionGroup({
        clubId,
        roleId: selectedRole._id,
        permissions: group.items.map((item) => item.key),
        enabled,
      });
    } catch (error) {
      toast({
        title:
          error instanceof Error
            ? error.message
            : "Could not update permissions",
        variant: "destructive",
      });
    } finally {
      setSavingPermissionGroup(null);
    }
  };

  const setDirectoryVisibility = async (showInDirectory: boolean) => {
    if (!selectedRole) return;
    try {
      await setRoleDirectoryVisibility({
        clubId,
        roleId: selectedRole._id,
        showInDirectory,
      });
    } catch (error) {
      toast({
        title:
          error instanceof Error
            ? error.message
            : "Could not update People group",
        variant: "destructive",
      });
    }
  };

  const deleteSelectedRole = async () => {
    if (!selectedRole) return;
    setRemovingRole(true);
    try {
      await removeRole({
        clubId,
        roleId: selectedRole._id,
        confirmChannelAccessUpdates:
          (roleRemovalImpact?.channels.length ?? 0) > 0,
      });
      setRemoveRoleOpen(false);
      setSelectedRoleId("");
      toast({ title: `${selectedRole.name} removed` });
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : "Could not remove role",
        variant: "destructive",
      });
    } finally {
      setRemovingRole(false);
    }
  };

  if (
    navigation !== undefined &&
    !canManageRoles &&
    !canManageStructure &&
    !canManageChannels &&
    !canDeleteClub
  ) {
    return (
      <ClubWorkspace title={settingsTitle}>
        <div className="mx-auto max-w-3xl px-4 py-12 text-center">
          <ShieldCheck className="mx-auto size-6 text-muted-foreground" />
          <h2 className="mt-3 text-base font-semibold">
            Club settings are restricted
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Your role cannot manage this club.
          </p>
        </div>
      </ClubWorkspace>
    );
  }

  return (
    <ClubWorkspace title={settingsTitle}>
      <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex flex-col gap-5">
          {club && (canManageStructure || canDeleteClub) ? (
            <Elevated offset={1} className="overflow-hidden rounded-xl">
              <Card className="pb-0">
                <CardHeader className="border-b border-border/70 px-5 py-4">
                  <h2>
                    <CardTitle className="text-xl tracking-tight">
                      Club administration
                    </CardTitle>
                  </h2>
                </CardHeader>
                <CardContent className="px-5 py-0">
                  <ClubStructureActions
                    club={club}
                    canManageStructure={canManageStructure}
                    canDelete={canDeleteClub}
                  />
                </CardContent>
              </Card>
            </Elevated>
          ) : null}

          {canManageChannels ? (
            <Link
              href={`/clubs/${clubId}/settings/channels`}
              className="flex items-center justify-between gap-4 rounded-xl border border-border/70 bg-card px-5 py-4 transition-colors hover:bg-hover"
            >
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Channels
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Configure access, posting, and sidebar placement.
                </p>
              </div>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </Link>
          ) : null}

          {canManageRoles ? (
            <Elevated offset={1} className="overflow-hidden rounded-xl">
              <Card className="pb-0">
                <CardContent className="p-0">
                  {roles && roles.length > 0 && selectedRole ? (
                    <div className="grid md:grid-cols-[13rem_minmax(0,1fr)]">
                      <aside className="border-b border-border/70 md:border-b-0 md:border-r">
                        <CardHeader className="border-b border-border/70 px-5 py-4">
                          <h2>
                            <CardTitle className="text-xl tracking-tight">
                              Club roles
                            </CardTitle>
                          </h2>
                        </CardHeader>
                        <div className="p-2">
                          <CardGroup
                            orientation="inline"
                            separated
                            className="gap-0.5"
                            aria-label="Club roles"
                          >
                            {roles.map((role) => {
                              const enabledCount = Object.values(
                                role.permissions,
                              ).filter(Boolean).length;

                              return (
                                <Card
                                  key={role._id}
                                  label={`Edit ${role.name} role`}
                                  selected={role._id === selectedRole._id}
                                  onClick={() => setSelectedRoleId(role._id)}
                                  className="min-h-8 gap-2 rounded-md px-3 text-sm font-medium"
                                >
                                  <span className="min-w-0 flex-1 truncate">
                                    {role.name}
                                  </span>
                                  <span className="text-xs tabular-nums text-muted-foreground">
                                    {enabledCount}
                                  </span>
                                </Card>
                              );
                            })}
                          </CardGroup>
                          <Button
                            variant="ghost"
                            size="sm"
                            leadingIcon={Plus}
                            className="mt-1 w-full justify-start"
                            onClick={() => openEditor({ mode: "create" })}
                          >
                            New role
                          </Button>
                        </div>
                      </aside>

                      <div className="min-w-0">
                        <div className="flex items-start justify-between gap-3 border-b border-border/70 px-5 py-4">
                          <div className="min-w-0">
                            <h3 className="truncate text-lg font-semibold text-foreground">
                              {selectedRole.name}
                            </h3>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              Club-wide ·{" "}
                              {
                                Object.values(selectedRole.permissions).filter(
                                  Boolean,
                                ).length
                              }{" "}
                              of {Object.keys(selectedRole.permissions).length}{" "}
                              permissions enabled
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <Button
                              variant="tertiary"
                              size="sm"
                              leadingIcon={Pencil}
                              onClick={() =>
                                openEditor({
                                  mode: "rename",
                                  role: selectedRole,
                                })
                              }
                            >
                              Rename
                            </Button>
                            <Button
                              variant="tertiary"
                              size="sm"
                              leadingIcon={Trash2}
                              onClick={() => setRemoveRoleOpen(true)}
                            >
                              Remove
                            </Button>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-4 border-b border-border/70 px-5 py-4">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1">
                              <p className="text-sm font-medium text-foreground">
                                Make this role a group
                              </p>
                              <Tooltip content="This role will appear as a tab in People.">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-compact"
                                  aria-label="About role groups"
                                >
                                  <CircleHelp />
                                </Button>
                              </Tooltip>
                            </div>
                          </div>
                          <Switch
                            aria-label={`Show ${selectedRole.name} as a People group`}
                            checked={selectedRole.showInDirectory}
                            onCheckedChange={(checked) =>
                              void setDirectoryVisibility(checked)
                            }
                          />
                        </div>

                        <div className="divide-y divide-border/70 px-5">
                          {permissionGroups.map((group) => (
                            <Collapsible
                              key={group.title}
                              className="group/permission py-5"
                            >
                              <section>
                                <div className="flex items-center justify-between gap-3">
                                  <CollapsibleTrigger asChild>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      trailingIcon={ChevronDown}
                                      className="-ml-3 justify-start font-semibold text-foreground group-data-[state=open]/permission:[&_svg]:rotate-180"
                                    >
                                      {group.title}
                                    </Button>
                                  </CollapsibleTrigger>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="shrink-0"
                                    disabled={savingPermissionGroup !== null}
                                    loading={
                                      savingPermissionGroup === group.title
                                    }
                                    onClick={() =>
                                      void setPermissionGroup(group)
                                    }
                                  >
                                    {group.items.every(
                                      (item) =>
                                        selectedRole.permissions[item.key],
                                    )
                                      ? "Disable all"
                                      : "Enable all"}
                                  </Button>
                                </div>
                                <CollapsibleContent className="overflow-hidden [--radix-accordion-content-height:var(--radix-collapsible-content-height)] data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down motion-reduce:animate-none">
                                  <div className="pt-3">
                                    <FieldGroup className="gap-0 divide-y divide-border/60">
                                      {group.items.map((item) => (
                                        <Field
                                          key={item.key}
                                          orientation="horizontal"
                                          className="min-h-14 items-center py-2.5"
                                        >
                                          <FieldContent>
                                            <div className="flex items-center gap-2">
                                              <FieldLabel
                                                htmlFor={`${selectedRole._id}-${item.key}`}
                                              >
                                                {item.label}
                                              </FieldLabel>
                                              <Tooltip content={item.description}>
                                                <Button
                                                  type="button"
                                                  variant="ghost"
                                                  size="icon-compact"
                                                  aria-label={`About ${item.label}`}
                                                >
                                                  <CircleHelp />
                                                </Button>
                                              </Tooltip>
                                            </div>
                                          </FieldContent>
                                          <Switch
                                            id={`${selectedRole._id}-${item.key}`}
                                            aria-label={item.label}
                                            checked={
                                              selectedRole.permissions[item.key]
                                            }
                                            onCheckedChange={(enabled) =>
                                              void setPermission(
                                                item.key,
                                                enabled,
                                              )
                                            }
                                          />
                                        </Field>
                                      ))}
                                    </FieldGroup>
                                  </div>
                                </CollapsibleContent>
                              </section>
                            </Collapsible>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="py-12 text-center text-sm text-muted-foreground">
                      Loading club roles…
                    </div>
                  )}
                </CardContent>
              </Card>
            </Elevated>
          ) : null}

          {club && canManageRoles ? <PeopleGroupsSettings club={club} /> : null}
        </div>
      </div>

      <Dialog
        open={editor !== null}
        onOpenChange={(open) => !open && setEditor(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {editor?.mode === "rename" ? "Rename role" : "New role"}
            </DialogTitle>
            <DialogDescription>
              {editor?.mode === "rename"
                ? "The new name appears everywhere this role is shown."
                : "New club-wide roles start without permissions."}
            </DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            value={roleName}
            maxLength={64}
            placeholder="Role name"
            onChange={(event) => setRoleName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void saveName();
              }
            }}
          />
          <DialogFooter>
            <Button
              variant="tertiary"
              disabled={savingName}
              onClick={() => setEditor(null)}
            >
              Cancel
            </Button>
            <Button
              loading={savingName}
              disabled={!roleName.trim()}
              onClick={() => void saveName()}
            >
              {editor?.mode === "rename" ? "Save" : "Add role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={removeRoleOpen} onOpenChange={setRemoveRoleOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {selectedRole?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the role. Everyone assigned to it will
              {selectedRole?.isDefault
                ? " no longer have a club role."
                : " move to the default club role."} Its permissions will no
              longer apply.
            </AlertDialogDescription>
            {roleRemovalImpact === undefined ? (
              <p className="text-sm text-muted-foreground">
                Checking affected channel access…
              </p>
            ) : roleRemovalImpact.channels.length > 0 ? (
              <p
                className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                role="alert"
              >
                {roleRemovalImpact.channels.length} {roleRemovalImpact.channels.length === 1 ? "channel" : "channels"} will be updated to remove this role.
                {roleRemovalImpact.channels.filter((channel) => channel.broadensAccess).length > 0
                  ? ` ${roleRemovalImpact.channels.filter((channel) => channel.broadensAccess).map((channel) => `#${channel.name}`).join(", ")} will become visible to all club members because this role is their only access restriction.`
                  : " Their other access restrictions will remain in place."}
              </p>
            ) : null}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removingRole}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={removingRole || roleRemovalImpact === undefined}
              onClick={(event) => {
                event.preventDefault();
                void deleteSelectedRole();
              }}
            >
              {removingRole
                ? "Removing…"
                : roleRemovalImpact?.channels.length
                  ? `Remove role and update ${roleRemovalImpact.channels.length} ${roleRemovalImpact.channels.length === 1 ? "channel" : "channels"}`
                  : "Remove role"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ClubWorkspace>
  );
}
