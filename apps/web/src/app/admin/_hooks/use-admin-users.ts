'use client';

import { useDeferredValue, useState } from 'react';
import { useMutation, usePaginatedQuery, useQuery } from 'convex/react';
import { hasRole, useCurrentUser } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { api } from '~/apps/convex/src/_generated/api';
import type { Id } from '~/apps/convex/src/_generated/dataModel';
import { getUserRoles, USER_ROLE_GROUP_META } from '../_lib/admin-utils';
import type { AdminTabId } from './use-admin-tab';
import type { AdminUserRecord, AdminUserRoleGroup } from '../_lib/types';
import type { AppRole } from '~/apps/convex/lib/roles';

/** Number of users to load in each batch when scrolling. */
const USERS_PAGE_SIZE = 30;

export function useAdminUsers(activeTab: AdminTabId) {
  const user = useCurrentUser();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [userRoleGroup, setUserRoleGroup] = useState<AdminUserRoleGroup>('students');
  const [isUserMutationPending, setIsUserMutationPending] = useState(false);

  const canManageUser = (targetUser: AdminUserRecord) => {
    if (!user) return false;
    const targetRoles = getUserRoles(targetUser);
    const isTargetPrivileged = targetRoles.includes('ADMIN') || targetRoles.includes('SUPER_ADMIN');
    if (isTargetPrivileged) return hasRole(user, 'SUPER_ADMIN');
    return hasRole(user, 'ADMIN', 'SUPER_ADMIN');
  };

  const canDeactivate = canManageUser;
  const canResetPassword = canManageUser;

  // Infinite-scroll pagination via Convex's usePaginatedQuery.
  const {
    results: users,
    status,
    loadMore,
  } = usePaginatedQuery(
    api.users.admin.list,
    activeTab === 'users'
      ? {
          search: deferredSearch || undefined,
          roleGroup: userRoleGroup === 'all' ? undefined : userRoleGroup,
        }
      : 'skip',
    { initialNumItems: USERS_PAGE_SIZE },
  );

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

  const runUserMutation = async <T,>(
    action: () => Promise<T>,
    successTitle: string,
    successDescription?: (result: T) => string,
  ) => {
    try {
      setIsUserMutationPending(true);
      const result = await action();
      toast({ title: successTitle, description: successDescription?.(result) });
    } catch (e: unknown) {
      toast({
        title: e instanceof Error ? e.message : 'Request failed',
        variant: 'destructive',
      });
    } finally {
      setIsUserMutationPending(false);
    }
  };

  const selectedUserRoleMeta = USER_ROLE_GROUP_META[userRoleGroup];
  const isSuperAdmin = hasRole(user, 'SUPER_ADMIN');

  return {
    search,
    setSearch: (value: string) => {
      setSearch(value);
    },
    userRoleGroup,
    setUserRoleGroup: (value: AdminUserRoleGroup) => {
      setUserRoleGroup(value);
    },
    users,
    totalCount: totalCount ?? undefined,
    status,
    loadMore: () => loadMore(USERS_PAGE_SIZE),
    isUsersLoading: activeTab === 'users' && status === 'LoadingFirstPage',
    isUsersError: false,
    usersError: null,
    refetchUsers: () => undefined,
    selectedUserRoleMeta,
    currentUserId: user?.id,
    canDeactivate,
    canResetPassword,
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
    onResetPassword: (targetUser: AdminUserRecord) =>
      void runUserMutation(
        () => resetPassword({ userId: targetUser.id as Id<'users'> }),
        'Temporary password generated',
        (result) => `${targetUser.uniqueId}: ${result.temporaryPassword}`,
      ),
    isResetPasswordPending: isUserMutationPending,
    isSuperAdmin,
    isAssignRolesPending: isUserMutationPending,
    onAssignRoles: (payload: { id: string; roles: string[] }) =>
      void runUserMutation(
        () =>
          assignRoles({
            userId: payload.id as Id<'users'>,
            roles: payload.roles as AppRole[],
          }),
        'Permissions updated',
      ),
  };
}
