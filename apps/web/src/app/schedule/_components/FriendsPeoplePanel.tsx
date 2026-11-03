"use client";

import { displayName, greetingName } from "~/apps/shared/user-name";

import { useState } from "react";
import {
  Ellipsis,
  Pencil,
  Plus,
  Trash2,
  UserMinus,
  UserPlus,
  Users,
} from "lucide-react";
import type { FunctionReturnType } from "convex/server";
import { useMutation, useQuery } from "@/lib/convex-react";
import { api } from "~/apps/convex/src/_generated/api";
import type { Id } from "~/apps/convex/src/_generated/dataModel";
import { Panel } from "@/components/layout/page-frame";
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
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardGroup,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownContent,
  DropdownMenu,
  DropdownSeparator,
  DropdownTrigger,
} from "@/components/ui/dropdown";
import { MenuItem } from "@/components/ui/menu-item";
import { Empty, EmptyDescription } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { UserAvatar } from "@/components/ui/user-avatar";
import type { ScheduleFriend } from "@/components/schedule/types";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";
import { useIsMobile } from "@/hooks/use-mobile";
import { FriendLinkSection } from "./FriendLinkSection";
import { FriendSearch } from "./FriendSearch";
import { useScheduleWorkspace } from "./ScheduleWorkspaceProvider";
import type { GroupId } from "./FriendsDayPanel";

export type Together = { classes: number; lunch: boolean };
type GroupDetail = FunctionReturnType<typeof api.schedule.groups.get>;

/** The selected group's people ("All friends" is the default group). */
export function FriendsPeoplePanel({
  groupId,
  group,
  friends,
  together,
  dayName,
  onCompare,
  onGroupDeleted,
}: {
  groupId: GroupId | "all";
  group: GroupDetail | undefined;
  friends: ScheduleFriend[];
  together: Map<string, Together>;
  dayName: string;
  onCompare: (userId: string) => void;
  onGroupDeleted: () => void;
}) {
  const isGroup = groupId !== "all";
  return (
    <Panel
      title={isGroup ? (group?.group.name ?? "Group") : "All friends"}
      count={friends.length}
      actions={
        isGroup ? (
          <div className="flex items-center gap-1">
            <AddToGroup groupId={groupId} members={friends} />
            <GroupMenu
              groupId={groupId}
              name={group?.group.name ?? ""}
              onDeleted={onGroupDeleted}
            />
          </div>
        ) : (
          <AddFriend />
        )
      }
      loading={isGroup && group === undefined}
      loadingRows={4}
      flush
    >
      {friends.length > 0 ? (
        <CardGroup orientation="inline" corners="panel">
          {friends.map((friend) => (
            <PersonRow
              key={friend.id}
              friend={friend}
              together={together.get(friend.user._id)}
              dayName={dayName}
              groupId={isGroup ? groupId : null}
              onCompare={() => onCompare(friend.user._id)}
            />
          ))}
        </CardGroup>
      ) : (
        <Empty size="inline">
          <EmptyDescription>Nobody in this group yet.</EmptyDescription>
        </Empty>
      )}
    </Panel>
  );
}

function PersonRow({
  friend,
  together,
  dayName,
  groupId,
  onCompare,
}: {
  friend: ScheduleFriend;
  together: Together | undefined;
  dayName: string;
  groupId: GroupId | null;
  onCompare: () => void;
}) {
  const { pendingAction, removeFriend, runScheduleAction } =
    useScheduleWorkspace();
  const removeMember = useMutation(api.schedule.groups.removeMember);
  const removeKey = `friend-remove:${friend.user._id}`;
  const groupRemoveKey = `group-remove:${friend.user._id}`;
  const shares = friend.visibility === "PUBLIC" && !!friend.schedule;
  const summary = !shares
    ? "Doesn't share their schedule"
    : together && (together.classes > 0 || together.lunch)
      ? [
          together.classes > 0
            ? `${together.classes} ${together.classes === 1 ? "class" : "classes"} together`
            : null,
          together.lunch ? "same lunch" : null,
        ]
          .filter(Boolean)
          .join(" · ")
      : `No overlap ${dayName}`;

  return (
    <Card
      onClick={shares ? onCompare : undefined}
      label={`Compare schedules with ${displayName(friend.user)}`}
    >
      <UserAvatar person={friend.user} size={32} />
      <CardHeader>
        <CardTitle className="truncate">{displayName(friend.user)}</CardTitle>
        <CardDescription className="truncate text-xs">
          {summary}
        </CardDescription>
      </CardHeader>
      <CardFooter>
        <DropdownMenu>
          <DropdownTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Options for ${greetingName(friend.user)}`}
                loading={
                  pendingAction === removeKey ||
                  pendingAction === groupRemoveKey
                }
              >
                <Ellipsis />
              </Button>
            }
          />
          <DropdownContent align="end">
            <MenuItem
              index={0}
              icon={Users}
              label="Compare schedules"
              disabled={!shares}
              onSelect={onCompare}
            />
            <DropdownSeparator />
            {groupId ? (
              <MenuItem
                index={1}
                icon={UserMinus}
                label="Remove from group"
                onSelect={() =>
                  void runScheduleAction(
                    groupRemoveKey,
                    () => removeMember({ groupId, friendId: friend.user._id }),
                    "Removed from group",
                  )
                }
              />
            ) : (
              <MenuItem
                index={1}
                icon={UserMinus}
                label="Remove friend"
                destructive
                onSelect={() =>
                  void runScheduleAction(
                    removeKey,
                    () => removeFriend({ otherUserId: friend.user._id }),
                    "Removed",
                  )
                }
              />
            )}
          </DropdownContent>
        </DropdownMenu>
      </CardFooter>
    </Card>
  );
}

function AddToGroup({
  groupId,
  members,
}: {
  groupId: GroupId;
  members: ScheduleFriend[];
}) {
  const eligible = useQuery(api.schedule.groups.listEligibleFriends, {});
  const addMember = useMutation(api.schedule.groups.addMember);
  const { pendingAction, runScheduleAction } = useScheduleWorkspace();
  const memberIds = new Set(members.map((member) => member.user._id));
  const available = (eligible ?? []).filter(
    (friend) => !memberIds.has(friend._id),
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" leadingIcon={Plus}>
          Add
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-1">
        {eligible === undefined ? null : available.length > 0 ? (
          <CardGroup orientation="inline">
            {available.map((friend) => {
              const key = `group-add:${friend._id}`;
              return (
                <Card
                  key={friend._id}
                  onClick={() =>
                    void runScheduleAction(
                      key,
                      () => addMember({ groupId, friendId: friend._id }),
                      "Added to group",
                    )
                  }
                  label={`Add ${displayName(friend)}`}
                  disabled={pendingAction === key}
                  className="min-h-11"
                >
                  <UserAvatar person={friend} size={24} />
                  <CardHeader className="py-2">
                    <CardTitle className="truncate">
                      {displayName(friend)}
                    </CardTitle>
                  </CardHeader>
                  <CardFooter>
                    <Plus className="size-4 text-muted-foreground" />
                  </CardFooter>
                </Card>
              );
            })}
          </CardGroup>
        ) : (
          <p className="px-3 py-2.5 text-sm text-muted-foreground">
            Everyone is already in this group.
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}

function GroupMenu({
  groupId,
  name,
  onDeleted,
}: {
  groupId: Id<"studentScheduleGroups">;
  name: string;
  onDeleted: () => void;
}) {
  const renameGroup = useMutation(api.schedule.groups.rename);
  const deleteGroup = useMutation(api.schedule.groups.remove);
  const { toast } = useToast();
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [nextName, setNextName] = useState(name);

  const run = async (action: () => Promise<unknown>, fallback: string) => {
    try {
      await action();
      return true;
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : fallback,
        variant: "destructive",
      });
      return false;
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownTrigger
          render={
            <Button variant="ghost" size="icon-sm" aria-label="Group options">
              <Ellipsis />
            </Button>
          }
        />
        <DropdownContent align="end">
          <MenuItem
            index={0}
            icon={Pencil}
            label="Rename group"
            onSelect={() => {
              setNextName(name);
              setRenameOpen(true);
            }}
          />
          <DropdownSeparator />
          <MenuItem
            index={1}
            icon={Trash2}
            label="Delete group"
            destructive
            onSelect={() => setDeleteOpen(true)}
          />
        </DropdownContent>
      </DropdownMenu>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              if (!nextName.trim()) return;
              const ok = await run(
                () => renameGroup({ groupId, name: nextName.trim() }),
                "Could not rename group",
              );
              if (ok) setRenameOpen(false);
            }}
          >
            <DialogHeader>
              <DialogTitle>Rename group</DialogTitle>
            </DialogHeader>
            <Input
              autoFocus
              aria-label="Group name"
              value={nextName}
              maxLength={60}
              onChange={(event) => setNextName(event.target.value)}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setRenameOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!nextName.trim()}>
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the group only. Your friendships and schedules stay
              unchanged.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={async () => {
                const ok = await run(
                  () => deleteGroup({ groupId }),
                  "Could not delete group",
                );
                if (ok) onDeleted();
              }}
            >
              Delete group
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** Search for classmates; invite links sit underneath. Popover on desktop,
 *  dialog on phones (room for the keyboard and the QR code). */
function AddFriend() {
  const isMobile = useIsMobile();
  const trigger = (
    <Button size="sm" leadingIcon={UserPlus}>
      Add friend
    </Button>
  );
  const body = (
    <div className="flex flex-col gap-4">
      <FriendSearch autoFocus />
      <Separator />
      <FriendLinkSection />
    </div>
  );

  if (isMobile) {
    return (
      <Dialog>
        <DialogTrigger asChild>{trigger}</DialogTrigger>
        <DialogContent mobilePosition="top">
          <DialogHeader>
            <DialogTitle>Add friends</DialogTitle>
          </DialogHeader>
          {body}
        </DialogContent>
      </Dialog>
    );
  }
  return (
    <Popover>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align="end"
        className="max-h-[min(40rem,var(--radix-popover-content-available-height))] w-80 overflow-y-auto p-3"
      >
        {body}
      </PopoverContent>
    </Popover>
  );
}
