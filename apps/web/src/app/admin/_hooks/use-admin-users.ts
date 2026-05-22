'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation as useConvexMutation, useQuery as useConvexQuery } from 'convex/react';
import { hasRole, useCurrentUser } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { api } from '~/apps/convex/src/_generated/api';
import type { Id } from '~/apps/convex/src/_generated/dataModel';
import { getDynamicUsersPageSize, getUserRoles, USER_ROLE_GROUP_META } from '../_lib/admin-utils';
import type { AdminTabId } from './use-admin-tab';
import type { AdminUserRecord, AdminUserRoleGroup } from '../_lib/types';
import type { AppRole } from '@ia/contracts/auth';

export function useAdminUsers(activeTab: AdminTabId) {
  const user = useCurrentUser();
  const { toast } = useToast();
  const viewportRef = useRef<HTMLDivElement | null>(null);

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageCursors, setPageCursors] = useState<Array<string | null>>([null]);
  const [userRoleGroup, setUserRoleGroup] = useState<AdminUserRoleGroup>('students');
  const [usersPageSize, setUsersPageSize] = useState(10);
  const [isUserMutationPending, setIsUserMutationPending] = useState(false);

  const canDeactivate = (targetUser: AdminUserRecord) => {
    if (!user) return false;
    const targetRoles = getUserRoles(targetUser);
    const isTargetPrivileged = targetRoles.includes('ADMIN') || targetRoles.includes('SUPER_ADMIN');
    if (isTargetPrivileged) return hasRole(user, 'SUPER_ADMIN');
    return hasRole(user, 'ADMIN', 'SUPER_ADMIN');
  };

  useEffect(() => {
    if (activeTab !== 'users') return;

    const updateUsersPageSize = () => {
      const availableHeight = viewportRef.current?.clientHeight ?? 0;
      if (availableHeight <= 0) return;

      const nextPageSize = getDynamicUsersPageSize(availableHeight);
      setUsersPageSize((currentPageSize) =>
        currentPageSize === nextPageSize ? currentPageSize : nextPageSize,
      );
    };

    const frameId = window.requestAnimationFrame(updateUsersPageSize);
    const resizeObserver =
      typeof ResizeObserver !== 'undefined' && viewportRef.current
        ? new ResizeObserver(updateUsersPageSize)
        : null;

    if (resizeObserver && viewportRef.current) {
      resizeObserver.observe(viewportRef.current);
    }

    window.addEventListener('resize', updateUsersPageSize);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', updateUsersPageSize);
      resizeObserver?.disconnect();
    };
  }, [activeTab]);

  useEffect(() => {
    setPage(1);
    setPageCursors([null]);
  }, [search, userRoleGroup, usersPageSize]);

  const usersPage = useConvexQuery(
    api.users.list,
    activeTab === 'users'
      ? {
          paginationOpts: {
            numItems: usersPageSize,
            cursor: pageCursors[page - 1] ?? null,
          },
          search: search || undefined,
          roleGroup: userRoleGroup === 'all' ? undefined : userRoleGroup,
        }
      : 'skip',
  );

  const deactivateUser = useConvexMutation(api.users.deactivate);
  const activateUser = useConvexMutation(api.users.activate);
  const assignRoles = useConvexMutation(api.users.assignRoles);

  const runUserMutation = async (action: () => Promise<unknown>, successTitle: string) => {
    try {
      setIsUserMutationPending(true);
      await action();
      toast({ title: successTitle });
    } catch (e: unknown) {
      toast({
        title: e instanceof Error ? e.message : 'Request failed',
        variant: 'destructive',
      });
    } finally {
      setIsUserMutationPending(false);
    }
  };

  const usersData = usersPage
    ? {
        users: usersPage.page as AdminUserRecord[],
        isDone: usersPage.isDone,
        continueCursor: usersPage.continueCursor,
      }
    : undefined;

  const selectedUserRoleMeta = USER_ROLE_GROUP_META[userRoleGroup];
  const isSuperAdmin = hasRole(user, 'SUPER_ADMIN');

  return {
    search,
    setSearch: (value: string) => {
      setSearch(value);
    },
    page,
    setPage: (updater: (page: number) => number) => {
      setPage((current) => {
        const next = Math.max(1, updater(current));
        if (next > current && usersData?.continueCursor) {
          setPageCursors((currentCursors) => {
            const copy = [...currentCursors];
            copy[current] = usersData.continueCursor;
            return copy;
          });
        }
        return next;
      });
    },
    userRoleGroup,
    setUserRoleGroup: (value: AdminUserRoleGroup) => {
      setUserRoleGroup(value);
    },
    usersPageSize,
    viewportRef,
    usersData,
    isUsersLoading: activeTab === 'users' && usersPage === undefined,
    isUsersError: false,
    usersError: null,
    refetchUsers: () => undefined,
    selectedUserRoleMeta,
    currentUserId: user?.id,
    canDeactivate,
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
