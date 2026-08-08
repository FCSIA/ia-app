import { useDeferredValue, useMemo, useState } from "react";
import { Alert, ScrollView, View } from "react-native";
import { useMutation, usePaginatedQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Search, UserRoundX, Users } from "lucide-react-native";
import { AppHeader } from "@/components/app-header";
import { Screen } from "@/components/screen";
import {
  Avatar,
  Badge,
  Button,
  ChipGroup,
  Empty,
  FilterChip,
  ListRow,
  Sheet,
  TextField,
  Txt,
  useToast,
} from "@/components/ui";
import { hasRole, useLiveCurrentUser } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { spacing } from "@/lib/tokens";
import type { AppRole } from "~/apps/convex/lib/roles";
import { api } from "~/apps/convex/src/_generated/api";

type AdminUser = FunctionReturnType<typeof api.users.admin.list>["page"][number];
type RoleGroup = "all" | "students" | "teachers" | "student-admin" | "other";

const ROLE_GROUPS = [
  { label: "All", value: "all" },
  { label: "Students", value: "students" },
  { label: "Staff", value: "teachers" },
  { label: "Student admin", value: "student-admin" },
  { label: "Other", value: "other" },
] as const satisfies readonly { label: string; value: RoleGroup }[];

const ROLES = [
  "STUDENT",
  "STUDENT_LEADER",
  "STUDENT_ADMIN",
  "TEACHER",
  "SPONSOR",
  "SUPPORT_STAFF",
  "ADMIN",
  "SUPER_ADMIN",
] as const satisfies readonly AppRole[];

const ROLE_LABELS: Record<AppRole, string> = {
  STUDENT: "Student",
  STUDENT_LEADER: "Student leader",
  STUDENT_ADMIN: "Student admin",
  TEACHER: "Teacher",
  SPONSOR: "Sponsor",
  SUPPORT_STAFF: "Support staff",
  ADMIN: "Admin",
  SUPER_ADMIN: "Super admin",
};

export function UserManagementScreen() {
  const actor = useLiveCurrentUser();
  const { color } = useTheme();
  const { showToast } = useToast();
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim());
  const [roleGroup, setRoleGroup] = useState<RoleGroup>("all");
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [draftRoles, setDraftRoles] = useState<AppRole[]>([]);
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const queryArgs = useMemo(
    () => ({
      search: deferredSearch || undefined,
      roleGroup: roleGroup === "all" ? undefined : roleGroup,
    }),
    [deferredSearch, roleGroup],
  );
  const { results, status, loadMore } = usePaginatedQuery(api.users.admin.list, queryArgs, {
    initialNumItems: 30,
  });
  const activate = useMutation(api.users.admin.activate);
  const deactivate = useMutation(api.users.admin.deactivate);
  const assignRoles = useMutation(api.users.admin.assignRoles);
  const resetPassword = useMutation(api.users.admin.resetPassword);

  const actorIsAdmin = !!actor && hasRole(actor, "ADMIN", "SUPER_ADMIN");
  const actorIsSuperAdmin = !!actor && hasRole(actor, "SUPER_ADMIN");
  const targetIsPrivileged = selectedUser?.roles.some((role) => role === "ADMIN" || role === "SUPER_ADMIN") ?? false;
  const targetIsStudent = selectedUser?.roles.some((role) =>
    role === "STUDENT" || role === "STUDENT_LEADER" || role === "STUDENT_ADMIN",
  ) ?? false;
  const isSelf = selectedUser?._id === actor?._id;
  const canManageSelected = !!selectedUser && actorIsAdmin && (!targetIsPrivileged || actorIsSuperAdmin);
  const canResetSelected = !!selectedUser && (
    canManageSelected || (!!actor && hasRole(actor, "SUPPORT_STAFF") && targetIsStudent)
  );
  const availableRoles = actorIsSuperAdmin
    ? ROLES
    : ROLES.filter((role) => role !== "ADMIN" && role !== "SUPER_ADMIN");

  function openUser(user: AdminUser) {
    setSelectedUser(user);
    setDraftRoles([...user.roles]);
    setTemporaryPassword(null);
  }

  function closeUser() {
    if (pendingAction) return;
    setSelectedUser(null);
    setTemporaryPassword(null);
  }

  async function runAction(label: string, action: () => Promise<unknown>, success: string) {
    setPendingAction(label);
    try {
      await action();
      showToast({ title: success, tone: "success" });
      return true;
    } catch (error) {
      showToast({
        title: `${label} failed`,
        body: error instanceof Error ? error.message : "Try again.",
        tone: "warning",
      });
      return false;
    } finally {
      setPendingAction(null);
    }
  }

  function confirmAccountStatusChange() {
    if (!selectedUser || !canManageSelected || isSelf) return;
    const nextActive = !selectedUser.isActive;
    Alert.alert(
      nextActive ? "Activate account?" : "Deactivate account?",
      `${selectedUser.firstName} ${selectedUser.lastName} will ${nextActive ? "regain" : "lose"} access to the app.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: nextActive ? "Activate" : "Deactivate",
          style: nextActive ? "default" : "destructive",
          onPress: () => {
            const mutation = nextActive ? activate : deactivate;
            void runAction(
              nextActive ? "Activation" : "Deactivation",
              () => mutation({ userId: selectedUser._id }),
              nextActive ? "Account activated" : "Account deactivated",
            ).then((succeeded) => {
              if (succeeded) {
                setSelectedUser((current) => current ? { ...current, isActive: nextActive } : null);
              }
            });
          },
        },
      ],
    );
  }

  async function saveRoles() {
    if (!selectedUser || !canManageSelected || draftRoles.length === 0) return;
    const succeeded = await runAction(
      "Role update",
      () => assignRoles({ userId: selectedUser._id, roles: draftRoles }),
      "Access updated",
    );
    if (succeeded) {
      setSelectedUser((current) => current ? { ...current, roles: draftRoles } : null);
    }
  }

  async function createTemporaryPassword() {
    if (!selectedUser || !canResetSelected) return;
    setPendingAction("Password reset");
    try {
      const result = await resetPassword({ userId: selectedUser._id });
      setTemporaryPassword(result.temporaryPassword);
      showToast({ title: "Temporary password created", tone: "success" });
    } catch (error) {
      showToast({
        title: "Password reset failed",
        body: error instanceof Error ? error.message : "Try again.",
        tone: "warning",
      });
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <>
      <Screen
        header={<AppHeader title="People" subtitle="Accounts and access" />}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ gap: spacing.lg }}
      >
        <View style={{ gap: spacing.sm }}>
          <View style={{ position: "relative", justifyContent: "center" }}>
            <Search
              pointerEvents="none"
              size={18}
              color={color("mutedForeground")}
              style={{ position: "absolute", left: spacing.md, zIndex: 1 }}
            />
            <TextField
              accessibilityLabel="Search people"
              value={search}
              onChangeText={setSearch}
              placeholder="Name or email"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              style={{ paddingLeft: 42 }}
            />
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing.sm }}
          >
            {ROLE_GROUPS.map((group) => (
              <FilterChip
                key={group.value}
                label={group.label}
                selected={roleGroup === group.value}
                onPress={() => setRoleGroup(group.value)}
              />
            ))}
          </ScrollView>
        </View>

        <View style={{ gap: spacing.sm }}>
          {results.map((user) => (
            <ListRow
              key={user._id}
              leading={(
                <Avatar
                  uri={user.avatarUrl}
                  name={`${user.firstName} ${user.lastName}`}
                  size={42}
                />
              )}
              title={`${user.firstName} ${user.lastName}`}
              subtitle={summarizeRoles(user.roles)}
              trailing={!user.isActive ? <Badge label="Inactive" color="red" variant="dot" /> : undefined}
              onPress={() => openUser(user)}
            />
          ))}
          {status === "LoadingFirstPage" ? (
            <Empty title="Loading people…" icon={Users} />
          ) : null}
          {status !== "LoadingFirstPage" && results.length === 0 ? (
            <Empty
              title="No people found"
              body={search ? "Try a different name or email." : "No accounts match this group."}
              icon={UserRoundX}
            />
          ) : null}
          {status === "CanLoadMore" || status === "LoadingMore" ? (
            <Button
              title="Load more"
              variant="secondary"
              loading={status === "LoadingMore"}
              onPress={() => loadMore(30)}
            />
          ) : null}
        </View>
      </Screen>

      <Sheet
        open={!!selectedUser}
        onClose={closeUser}
        title={selectedUser ? `${selectedUser.firstName} ${selectedUser.lastName}` : undefined}
        snapPoints={["72%", "92%"]}
      >
        {selectedUser ? (
          <View style={{ gap: spacing.lg }}>
            <View style={{ gap: spacing.xs }}>
              {selectedUser.email ? <Txt tone="muted" selectable>{selectedUser.email}</Txt> : null}
              <Badge
                label={selectedUser.isActive ? "Active" : "Inactive"}
                color={selectedUser.isActive ? "green" : "red"}
                variant="dot"
              />
            </View>

            {canManageSelected ? (
              <View style={{ gap: spacing.sm }}>
                <Txt variant="overline" tone="muted">Roles</Txt>
                <ChipGroup
                  values={availableRoles}
                  selected={draftRoles}
                  labels={ROLE_LABELS}
                  onToggle={(role) => {
                    setDraftRoles((current) => current.includes(role)
                      ? current.filter((value) => value !== role)
                      : [...current, role]);
                  }}
                />
                <Button
                  title="Save access"
                  loading={pendingAction === "Role update"}
                  disabled={draftRoles.length === 0 || sameRoles(draftRoles, selectedUser.roles)}
                  onPress={() => void saveRoles()}
                />
              </View>
            ) : (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
                {selectedUser.roles.map((role) => <Badge key={role} label={ROLE_LABELS[role]} />)}
              </View>
            )}

            {temporaryPassword ? (
              <View style={{ gap: spacing.xs }}>
                <Txt variant="overline" tone="muted">Temporary password</Txt>
                <Txt variant="section" selectable>{temporaryPassword}</Txt>
                <Txt variant="caption" tone="muted">Share it securely. It is only shown here once.</Txt>
              </View>
            ) : null}

            <View style={{ gap: spacing.sm }}>
              {canResetSelected ? (
                <Button
                  title="Reset password"
                  variant="secondary"
                  loading={pendingAction === "Password reset"}
                  onPress={() => void createTemporaryPassword()}
                />
              ) : null}
              {canManageSelected && !isSelf ? (
                <Button
                  title={selectedUser.isActive ? "Deactivate account" : "Activate account"}
                  variant="tertiary"
                  loading={pendingAction === "Activation" || pendingAction === "Deactivation"}
                  onPress={confirmAccountStatusChange}
                />
              ) : null}
            </View>
          </View>
        ) : null}
      </Sheet>
    </>
  );
}

function summarizeRoles(roles: readonly AppRole[]) {
  return roles.map((role) => ROLE_LABELS[role]).join(", ");
}

function sameRoles(left: readonly AppRole[], right: readonly AppRole[]) {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  return left.every((role) => rightSet.has(role));
}
