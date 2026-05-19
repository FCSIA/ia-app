'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '@/lib/api';
import { hasRole, useCurrentUser } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { getDynamicUsersPageSize, getUserRoles, USER_ROLE_GROUP_META } from '../_lib/admin-utils';
import type { AdminTabId } from './use-admin-tab';
import type { AdminUserRecord, AdminUserRoleGroup } from '../_lib/types';

export function useAdminUsers(activeTab: AdminTabId) {
  const user = useCurrentUser();
  const { toast } = useToast();
  const qc = useQueryClient();
  const viewportRef = useRef<HTMLDivElement | null>(null);

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [userRoleGroup, setUserRoleGroup] = useState<AdminUserRoleGroup>('students');
  const [usersPageSize, setUsersPageSize] = useState(10);
  const [passwordResetTarget, setPasswordResetTarget] = useState<AdminUserRecord | null>(null);
  const [passwordResetValue, setPasswordResetValue] = useState('');

  const canDeactivate = (targetUser: AdminUserRecord) => {
    if (!user) return false;
    const targetRoles = getUserRoles(targetUser);
    const isTargetPrivileged = targetRoles.includes('ADMIN') || targetRoles.includes('SUPER_ADMIN');
    if (isTargetPrivileged) return hasRole(user, 'SUPER_ADMIN');
    return hasRole(user, 'ADMIN', 'SUPER_ADMIN');
  };

  const canResetPassword = (targetUser: AdminUserRecord) => {
    if (!user) return false;
    if (hasRole(user, 'SUPER_ADMIN')) return true;
    if (!hasRole(user, 'ADMIN')) return false;
    const targetRoles = getUserRoles(targetUser);
    return !targetRoles.includes('ADMIN') && !targetRoles.includes('SUPER_ADMIN');
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

  const {
    data: usersData,
    isLoading: isUsersLoading,
    isError: isUsersError,
    error: usersError,
    refetch: refetchUsers,
  } = useQuery({
    queryKey: ['admin-users', page, search, userRoleGroup, usersPageSize],
    queryFn: () =>
      usersApi
        .getAll(
          page,
          usersPageSize,
          search || undefined,
          userRoleGroup === 'all' ? undefined : userRoleGroup,
        )
        .then((r) => r.data),
    enabled: activeTab === 'users',
  });

  useEffect(() => {
    const totalPages = usersData?.total ? Math.max(1, Math.ceil(usersData.total / usersPageSize)) : 1;
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, usersData?.total, usersPageSize]);

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => usersApi.deactivate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      toast({ title: 'Deactivated' });
    },
  });

  const activateMutation = useMutation({
    mutationFn: (id: string) => usersApi.activate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      toast({ title: 'Activated' });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: ({ id, newPassword }: { id: string; newPassword: string }) =>
      usersApi.resetPassword(id, newPassword),
    onSuccess: () => {
      setPasswordResetTarget(null);
      setPasswordResetValue('');
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      toast({ title: 'Password reset' });
    },
    onError: (e: unknown) =>
      toast({
        title: (e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Could not reset password',
        variant: 'destructive',
      }),
  });

  const assignRolesMutation = useMutation({
    mutationFn: ({ id, roles }: { id: string; roles: string[] }) => usersApi.assignRoles(id, roles),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      toast({ title: 'Permissions updated' });
    },
    onError: (e: unknown) =>
      toast({
        title: (e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to update permissions',
        variant: 'destructive',
      }),
  });

  const selectedUserRoleMeta = USER_ROLE_GROUP_META[userRoleGroup];
  const isSuperAdmin = hasRole(user, 'SUPER_ADMIN');

  return {
    search,
    setSearch: (value: string) => {
      setSearch(value);
      setPage(1);
    },
    page,
    setPage,
    userRoleGroup,
    setUserRoleGroup: (value: AdminUserRoleGroup) => {
      setUserRoleGroup(value);
      setPage(1);
    },
    usersPageSize,
    viewportRef,
    usersData,
    isUsersLoading,
    isUsersError,
    usersError,
    refetchUsers,
    selectedUserRoleMeta,
    currentUserId: user?.id,
    canDeactivate,
    canResetPassword,
    onDeactivate: (userId: string) => deactivateMutation.mutate(userId),
    onActivate: (userId: string) => activateMutation.mutate(userId),
    passwordResetTarget,
    passwordResetValue,
    setPasswordResetValue,
    openPasswordReset: (targetUser: AdminUserRecord) => {
      setPasswordResetTarget(targetUser);
      setPasswordResetValue('');
    },
    closePasswordReset: () => {
      setPasswordResetTarget(null);
      setPasswordResetValue('');
    },
    resetPassword: () => {
      if (!passwordResetTarget || passwordResetValue.length < 8) return;
      resetPasswordMutation.mutate({
        id: passwordResetTarget.id,
        newPassword: passwordResetValue,
      });
    },
    isResetPasswordPending: resetPasswordMutation.isPending,
    isSuperAdmin,
    isAssignRolesPending: assignRolesMutation.isPending,
    onAssignRoles: (payload: { id: string; roles: string[] }) => assignRolesMutation.mutate(payload),
  };
}
