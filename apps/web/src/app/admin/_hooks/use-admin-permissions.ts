'use client';

import { useDeferredValue, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import type { AdminTabId } from './use-admin-tab';
import type { AdminUserRecord } from '../_lib/types';

export function useAdminPermissions(activeTab: AdminTabId) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [permSearch, setPermSearch] = useState('');
  const deferredPermSearch = useDeferredValue(permSearch);
  const [studentAdminSearch, setStudentAdminSearch] = useState('');
  const deferredStudentAdminSearch = useDeferredValue(studentAdminSearch);

  const { data: permUsersData, isLoading: isPermUsersLoading } = useQuery({
    queryKey: ['perm-users', deferredPermSearch],
    queryFn: () =>
      usersApi.getAll(1, 30, deferredPermSearch || undefined, undefined).then((r) => r.data),
    enabled: activeTab === 'permissions',
  });

  const { data: studentAdminsData, isLoading: isStudentAdminsLoading } = useQuery({
    queryKey: ['student-admins', deferredStudentAdminSearch],
    queryFn: () =>
      usersApi
        .getAll(1, 50, deferredStudentAdminSearch || undefined, 'student-admin' as any)
        .then((r) => r.data),
    enabled: activeTab === 'student-admins',
  });

  const assignRolesMutation = useMutation({
    mutationFn: ({ id, roles }: { id: string; roles: string[] }) => usersApi.assignRoles(id, roles),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['perm-users'] });
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      qc.invalidateQueries({ queryKey: ['student-admins'] });
      toast({ title: 'Permissions updated' });
    },
    onError: (e: any) =>
      toast({
        title: e.response?.data?.message || 'Failed to update permissions',
        variant: 'destructive',
      }),
  });

  return {
    permSearch,
    setPermSearch,
    deferredPermSearch,
    permUsers: (permUsersData?.users ?? []) as AdminUserRecord[],
    isPermUsersLoading,
    studentAdminSearch,
    setStudentAdminSearch,
    deferredStudentAdminSearch,
    studentAdmins: (studentAdminsData?.users ?? []) as AdminUserRecord[],
    isStudentAdminsLoading,
    assignRolesMutation,
  };
}
