'use client';

import { useDeferredValue, useState } from 'react';
import { useMutation, useQuery } from '@/lib/convex-react';
import { hasRole, useCurrentUser } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { api } from '~/apps/convex/src/_generated/api';
import type { Id } from '~/apps/convex/src/_generated/dataModel';
import { getUserRoles, USER_ROLE_GROUP_META } from '../_lib/admin-utils';
import type { AdminTabId } from './use-admin-tab';
import type { AdminUserRecord, AdminUserRoleGroup } from '../_lib/types';
import type { AppRole } from '~/apps/convex/lib/roles';

const USERS_PAGE_SIZE = 30;

type UsersPage = {
  page: AdminUserRecord[];
  isDone: boolean;
  continueCursor: string;
};

type UsersPageStatus = 'LoadingFirstPage' | 'CanLoadMore' | 'LoadingMore' | 'Exhausted';

type DisplayedUsersPageState = {
  activeTab: AdminTabId;
  search: string;
  userRoleGroup: AdminUserRoleGroup;
  page: UsersPage | undefined;
};

export function useAdminUsers(activeTab: AdminTabId, initialSearch = '') {
  const user = useCurrentUser();
  const { toast } = useToast();

  const [search, setSearch] = useState(() => initialSearch);
  const deferredSearch = useDeferredValue(search);
  const [userRoleGroup, setUserRoleGroup] = useState<AdminUserRoleGroup>('students');
  const [isUserMutationPending, setIsUserMutationPending] = useState(false);
  const [currentCursor, setCurrentCursor] = useState<string | null>(null);
  const [previousCursors, setPreviousCursors] = useState<(string | null)[]>([]);
  const [displayedPageState, setDisplayedPageState] = useState<DisplayedUsersPageState>({
    activeTab,
    search: deferredSearch,
    userRoleGroup,
    page: undefined,
  });

  const canManageUser = (targetUser: AdminUserRecord) => {
    if (!user) return false;
    const targetRoles = getUserRoles(targetUser);
    const isTargetPrivileged = targetRoles.includes('ADMIN') || targetRoles.includes('SUPER_ADMIN');
    if (isTargetPrivileged) return hasRole(user, 'SUPER_ADMIN');
    return hasRole(user, 'ADMIN', 'SUPER_ADMIN');
  };

  const canDeactivate = canManageUser;
  const canResetPassword = canManageUser;

  const usersPage = useQuery(
    api.users.admin.list,
    activeTab === 'users'
      ? {
          search: deferredSearch || undefined,
          roleGroup: userRoleGroup === 'all' ? undefined : userRoleGroup,
          paginationOpts: {
            numItems: USERS_PAGE_SIZE,
            cursor: currentCursor,
          },
        }
      : 'skip',
  );

  let displayedPage = displayedPageState.page;
  const isSearchChangeOnly =
    displayedPageState.activeTab === activeTab &&
    displayedPageState.userRoleGroup === userRoleGroup &&
    displayedPageState.search !== deferredSearch;

  if (
    displayedPageState.activeTab !== activeTab ||
    displayedPageState.search !== deferredSearch ||
    displayedPageState.userRoleGroup !== userRoleGroup
  ) {
    if (!isSearchChangeOnly) {
      displayedPage = undefined;
    }
    setDisplayedPageState({
      activeTab,
      search: deferredSearch,
      userRoleGroup,
      page: isSearchChangeOnly ? displayedPageState.page : undefined,
    });
  } else if (usersPage && displayedPageState.page !== usersPage) {
    displayedPage = usersPage;
    setDisplayedPageState({
      ...displayedPageState,
      page: usersPage,
    });
  }

  // Actual total count for the selected role group (shown in the header badge).
  const totalCount = useQuery(
    api.users.admin.count,
    activeTab === 'users'
      ? { roleGroup: userRoleGroup === 'all' ? undefined : userRoleGroup }
      : 'skip',
  );

  const deactivateUser = useMutation(api.users.admin.deactivate);
  const activateUser = useMutation(api.users.admin.activate);
  const assignRoles = useMutation(api.users.admin.assignRoles);
  const resetPassword = useMutation(api.users.admin.resetPassword);
  const deleteUsers = useMutation(api.users.admin.deleteUsers);
  const setDeveloper = useMutation(api.users.admin.setDeveloper);

  const runUserMutation = async <T, TResult = boolean>(
    action: () => Promise<T>,
    successTitle: string,
    successDescription?: (result: T) => string,
    resultMapper?: (result: T) => TResult,
  ) => {
    try {
      setIsUserMutationPending(true);
      const result = await action();
      toast({ title: successTitle, description: successDescription?.(result) });
      return (resultMapper ? resultMapper(result) : true) as TResult;
    } catch (e: unknown) {
      toast({
        title: e instanceof Error ? e.message : 'Request failed',
        variant: 'destructive',
      });
      return undefined;
    } finally {
      setIsUserMutationPending(false);
    }
  };

  const selectedUserRoleMeta = USER_ROLE_GROUP_META[userRoleGroup];
  const isSuperAdmin = hasRole(user, 'SUPER_ADMIN');
  const status: UsersPageStatus = displayedPage
    ? usersPage
      ? usersPage.isDone
        ? 'Exhausted'
        : 'CanLoadMore'
      : 'LoadingMore'
    : usersPage
      ? usersPage.isDone
        ? 'Exhausted'
        : 'CanLoadMore'
      : 'LoadingFirstPage';

  return {
    search,
    setSearch: (value: string) => {
      setSearch(value);
      setCurrentCursor(null);
      setPreviousCursors([]);
    },
    userRoleGroup,
    setUserRoleGroup: (value: AdminUserRoleGroup) => {
      setUserRoleGroup(value);
      setCurrentCursor(null);
      setPreviousCursors([]);
    },
    users: displayedPage?.page ?? [],
    totalCount: totalCount ?? undefined,
    status,
    canLoadPrevious: previousCursors.length > 0,
    pageIndex: previousCursors.length,
    loadNextPage: () => {
      if (!displayedPage || displayedPage.isDone || !usersPage) return;
      setPreviousCursors((cursors) => [...cursors, currentCursor]);
      setCurrentCursor(displayedPage.continueCursor);
    },
    loadPreviousPage: () => {
      if (previousCursors.length === 0) return;
      setCurrentCursor(previousCursors[previousCursors.length - 1] ?? null);
      setPreviousCursors((cursors) => cursors.slice(0, -1));
    },
    isUsersLoading: activeTab === 'users' && !displayedPage && !usersPage,
    isUsersError: false,
    usersError: null,
    refetchUsers: () => undefined,
    selectedUserRoleMeta,
    currentUserId: user?._id,
    canDeactivate,
    canResetPassword,
    canDeleteUsers: isSuperAdmin,
    onDeactivate: (userId: string) =>
      void runUserMutation(
        () => deactivateUser({ userId: userId as Id<'users'> }),
        'Deactivated',
      ),
    onActivate: (userId: string) =>
      void runUserMutation(
        () => activateUser({ userId: userId as Id<'users'> }),
        'Activated',
      ),
    onResetPassword: async (targetUser: AdminUserRecord) => {
      return await runUserMutation(
        () => resetPassword({ userId: targetUser._id as Id<'users'> }),
        'Temporary password generated',
        undefined,
        (result) => result.temporaryPassword,
      );
    },
    onDeleteUsers: async (userIds: string[]) =>
      await runUserMutation(
        () => deleteUsers({ userIds: userIds as Id<'users'>[] }),
        `Deleted ${userIds.length} ${userIds.length === 1 ? 'user' : 'users'}`,
        (result) => `${result.deleted} account${result.deleted === 1 ? '' : 's'} permanently removed.`,
      ),
    isDeleteUsersPending: isUserMutationPending,
    isResetPasswordPending: isUserMutationPending,
    isSuperAdmin,
    isSetDeveloperPending: isUserMutationPending,
    onSetDeveloper: (payload: { _id: string; enabled: boolean }) =>
      void runUserMutation(
        () => setDeveloper({ userId: payload._id as Id<'users'>, enabled: payload.enabled }),
        payload.enabled ? 'Developer badge granted' : 'Developer badge removed',
      ),
    isAssignRolesPending: isUserMutationPending,
    onAssignRoles: (payload: { _id: string; roles: string[] }) =>
      void runUserMutation(
        () =>
          assignRoles({
            userId: payload._id as Id<'users'>,
            roles: payload.roles as AppRole[],
          }),
        'Permissions updated',
      ),
  };
}
