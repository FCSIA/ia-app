'use client';

import type { RefObject, ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SearchInput } from '@/components/ui/search';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatRoleLabel, getUserRoles, USER_ROLE_GROUP_META } from '../../_lib/admin-utils';
import type { AdminUserRecord, AdminUserRoleGroup } from '../../_lib/types';

export function UsersPaginationControls({
  page,
  total,
  pageSize,
  onPrev,
  onNext,
}: {
  page: number;
  total: number;
  pageSize: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  const totalPages = Math.ceil(total / pageSize);

  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-3 border-t px-4 py-2.5">
      <Button variant="tertiary" size="sm" disabled={page === 1} onClick={onPrev}>
        Prev
      </Button>
      <span className="text-xs text-muted-foreground">
        Page {page} of {totalPages}
      </span>
      <Button variant="tertiary" size="sm" disabled={page >= totalPages} onClick={onNext}>
        Next
      </Button>
    </div>
  );
}

function UserTableSection({
  title,
  emptyMessage,
  users,
  totalCount,
  showGrade = false,
  currentUserId,
  canDeactivate,
  onDeactivate,
  onActivate,
  pagination,
}: {
  title: string;
  emptyMessage: string;
  users: AdminUserRecord[];
  totalCount?: number;
  showGrade?: boolean;
  currentUserId?: string;
  canDeactivate: (user: AdminUserRecord) => boolean;
  onDeactivate: (userId: string) => void;
  onActivate: (userId: string) => void;
  pagination?: ReactNode;
}) {
  const headers = showGrade
    ? ['ID', 'Name', 'Grade', 'Roles', 'Status', 'Actions']
    : ['ID', 'Name', 'Roles', 'Status', 'Actions'];

  return (
    <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <CardHeader className="border-b px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-sm">{title}</CardTitle>
          <Badge variant="solid" size="sm">
            {totalCount ?? users.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-auto p-0">
        <Table className="text-xs">
          <TableHeader className="bg-muted/50">
            <TableRow>
              {headers.map((header) => (
                <TableHead key={header} className="h-8 px-3 py-1 text-[11px] uppercase tracking-wide">
                  {header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={headers.length} className="px-3 py-8 text-center text-xs text-muted-foreground">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id} className="hover:bg-muted/30">
                  <TableCell className="px-3 py-1.5 font-mono text-[11px] text-muted-foreground">
                    {user.uniqueId}
                  </TableCell>
                  <TableCell className="px-3 py-1.5 text-xs font-medium leading-tight">
                    {user.firstName} {user.lastName}
                  </TableCell>
                  {showGrade ? (
                    <TableCell className="px-3 py-1.5 text-xs text-muted-foreground">
                      {user.gradeLevel || '-'}
                    </TableCell>
                  ) : null}
                  <TableCell className="px-3 py-1.5">
                    <div className="flex flex-wrap gap-1">
                      {getUserRoles(user).map((role) => (
                        <Badge key={role} variant="dot" size="sm">
                          {formatRoleLabel(role)}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="px-3 py-1.5">
                    <Badge variant="solid" color={user.isActive ? 'emerald' : 'red'} size="sm">
                      {user.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-3 py-1.5">
                    {user.isActive ? (
                      canDeactivate(user) && user.id !== currentUserId ? (
                        <Button variant="ghost" size="sm" onClick={() => onDeactivate(user.id)} className="text-destructive hover:bg-destructive/10 hover:text-destructive">
                          Deactivate
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => onActivate(user.id)} className="text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-600">
                        Activate
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
      {pagination}
    </Card>
  );
}

export function AdminUsersTab({
  search,
  onSearchChange,
  userRoleGroup,
  onUserRoleGroupChange,
  isSuperAdmin,
  viewportRef,
  usersData,
  isUsersLoading,
  isUsersError,
  usersError,
  refetchUsers,
  selectedUserRoleMeta,
  currentUserId,
  canDeactivate,
  onDeactivate,
  onActivate,
  pagination,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  userRoleGroup: AdminUserRoleGroup;
  onUserRoleGroupChange: (value: AdminUserRoleGroup) => void;
  isSuperAdmin: boolean;
  viewportRef: RefObject<HTMLDivElement | null>;
  usersData?: { users?: AdminUserRecord[]; total?: number };
  isUsersLoading: boolean;
  isUsersError: boolean;
  usersError: unknown;
  refetchUsers: () => void;
  selectedUserRoleMeta: typeof USER_ROLE_GROUP_META[AdminUserRoleGroup];
  currentUserId?: string;
  canDeactivate: (user: AdminUserRecord) => boolean;
  onDeactivate: (userId: string) => void;
  onActivate: (userId: string) => void;
  pagination?: ReactNode;
}) {
  const users = usersData?.users ?? [];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex shrink-0 flex-wrap items-center gap-3">
        <SearchInput
          className="max-w-xs"
          placeholder="Search users..."
          value={search}
          onValueChange={onSearchChange}
          size="sm"
        />
        <Select value={userRoleGroup} onValueChange={(value) => onUserRoleGroupChange(value as AdminUserRoleGroup)}>
          <SelectTrigger className="w-[200px]" placeholder="Select role view" />
          <SelectContent>
            <SelectItem index={0} value="students">Students</SelectItem>
            <SelectItem index={1} value="teachers">Teachers</SelectItem>
            <SelectItem index={2} value="other">Other Roles</SelectItem>
          </SelectContent>
        </Select>
        {isSuperAdmin ? (
          <p className="text-xs text-muted-foreground">
            Student roster import/export lives in the Schedule tab.
          </p>
        ) : null}
      </div>

      <div ref={viewportRef} className="flex min-h-0 flex-1 flex-col">
        {isUsersLoading && !usersData ? (
          <Card className="flex min-h-0 flex-1">
            <CardContent className="flex flex-1 items-center justify-center py-8 text-center text-sm text-muted-foreground">
              Loading users...
            </CardContent>
          </Card>
        ) : isUsersError ? (
          <Card className="flex min-h-0 flex-1">
            <CardContent className="flex flex-1 flex-col items-center justify-center gap-3 py-8 text-center">
              <div>
                <p className="font-medium text-foreground">Could not load users.</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {(usersError as any)?.response?.data?.message || (usersError as Error)?.message || 'Request failed.'}
                </p>
              </div>
              <Button type="button" variant="tertiary" size="sm" onClick={refetchUsers}>
                Try again
              </Button>
            </CardContent>
          </Card>
        ) : users.length === 0 ? (
          <Card className="flex min-h-0 flex-1">
            <CardContent className="flex flex-1 items-center justify-center py-8 text-center text-sm text-muted-foreground">
              {selectedUserRoleMeta.emptyMessage}
            </CardContent>
          </Card>
        ) : (
          <UserTableSection
            title={selectedUserRoleMeta.label}
            emptyMessage={selectedUserRoleMeta.emptyMessage}
            users={users}
            totalCount={usersData?.total}
            showGrade={selectedUserRoleMeta.showGrade}
            currentUserId={currentUserId}
            canDeactivate={canDeactivate}
            onDeactivate={onDeactivate}
            onActivate={onActivate}
            pagination={pagination}
          />
        )}
      </div>
    </div>
  );
}

