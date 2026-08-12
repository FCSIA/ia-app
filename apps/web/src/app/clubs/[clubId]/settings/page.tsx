"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Pencil, Plus, ShieldCheck } from "lucide-react";
import { api } from "~/apps/convex/src/_generated/api";
import { useClubId } from "../../club-route";
import { ClubWorkspace } from "@/components/clubs/club-workspace";
import { ClubStructureActions } from "@/components/clubs/dialogs/hierarchy-dialog";
import type { ClubDetail } from "@/components/clubs/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { TabItem, Tabs, TabsList } from "@/components/ui/tabs";
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
        label: "View private channels",
        description: "See private channels without being individually added.",
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
        description: "Change the role assigned to a member.",
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
        description: "Manage teams, committees, and leadership structure.",
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
  const [savingPermissionGroup, setSavingPermissionGroup] = useState<
    string | null
  >(null);
  const canManageRoles = navigation?.viewer.canManageRoles ?? false;
  const canManageStructure = navigation?.viewer.canManageClubStructure ?? false;
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

  if (
    navigation !== undefined &&
    !canManageRoles &&
    !canManageStructure &&
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

          {canManageRoles ? (
            <Elevated offset={1} className="overflow-hidden rounded-xl">
              <Card className="pb-0">
                <CardHeader className="border-b border-border/70 px-5 py-4">
                  <h2>
                    <CardTitle className="text-xl tracking-tight">
                      Roles
                    </CardTitle>
                  </h2>
                  <CardAction>
                    <Button
                      size="sm"
                      leadingIcon={Plus}
                      onClick={() => openEditor({ mode: "create" })}
                    >
                      New role
                    </Button>
                  </CardAction>
                </CardHeader>
                <CardContent className="p-5 pt-4">
                  {roles && roles.length > 0 && selectedRole ? (
                    <>
                      <div className="min-w-0 overflow-x-auto pb-1">
                        <Tabs
                          value={selectedRole._id}
                          onValueChange={setSelectedRoleId}
                        >
                          <TabsList>
                            {roles.map((role) => (
                              <TabItem
                                key={role._id}
                                value={role._id}
                                label={role.name}
                              />
                            ))}
                          </TabsList>
                        </Tabs>
                      </div>

                      <div className="flex items-center justify-between gap-3 py-1">
                        <div className="min-w-0">
                          <h3 className="truncate text-lg font-semibold text-foreground">
                            {selectedRole.name}
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            {
                              Object.values(selectedRole.permissions).filter(
                                Boolean,
                              ).length
                            }{" "}
                            permissions enabled
                          </p>
                        </div>
                        <Button
                          variant="tertiary"
                          size="sm"
                          leadingIcon={Pencil}
                          onClick={() =>
                            openEditor({ mode: "rename", role: selectedRole })
                          }
                        >
                          Rename
                        </Button>
                      </div>

                      <div className="flex items-center justify-between gap-4 border-y border-border/70 py-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground">
                            People group
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            Show {selectedRole.name} as a filter in People.
                            Hidden roles still appear on member profiles.
                          </p>
                        </div>
                        <Switch
                          aria-label={`Show ${selectedRole.name} as a People group`}
                          checked={selectedRole.showInDirectory}
                          onCheckedChange={(checked) =>
                            void setDirectoryVisibility(checked)
                          }
                        />
                      </div>

                      <div className="divide-y divide-border/70">
                        {permissionGroups.map((group) => (
                          <section
                            key={group.title}
                            className="grid gap-4 py-5 md:grid-cols-[13rem_1fr] md:gap-8"
                          >
                            <div className="flex items-start justify-between gap-3 md:block">
                              <div>
                                <h4 className="text-sm font-semibold text-foreground">
                                  {group.title}
                                </h4>
                                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                                  {group.description}
                                </p>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="shrink-0 md:mt-2"
                                disabled={savingPermissionGroup !== null}
                                loading={savingPermissionGroup === group.title}
                                onClick={() => void setPermissionGroup(group)}
                              >
                                {group.items.every(
                                  (item) => selectedRole.permissions[item.key],
                                )
                                  ? "Turn off all"
                                  : "Turn on all"}
                              </Button>
                            </div>
                            <div className="divide-y divide-border/60">
                              {group.items.map((item) => (
                                <div
                                  key={item.key}
                                  className="flex min-h-14 items-center justify-between gap-4 py-2.5"
                                >
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium text-foreground">
                                      {item.label}
                                    </p>
                                    <p className="mt-0.5 text-xs text-muted-foreground">
                                      {item.description}
                                    </p>
                                  </div>
                                  <Switch
                                    aria-label={item.label}
                                    checked={selectedRole.permissions[item.key]}
                                    onCheckedChange={(checked) =>
                                      void setPermission(item.key, checked)
                                    }
                                  />
                                </div>
                              ))}
                            </div>
                          </section>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="py-12 text-center text-sm text-muted-foreground">
                      Loading club roles…
                    </div>
                  )}
                </CardContent>
              </Card>
            </Elevated>
          ) : null}
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
                : "New roles start without permissions."}
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
    </ClubWorkspace>
  );
}
