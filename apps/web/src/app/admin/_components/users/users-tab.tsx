'use client';

import type { RefObject, ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DataTablePanel, dataTableClasses } from '@/components/data/data-table-panel';
import { Empty, EmptyTitle } from '@/components/ui/empty';
import { SearchInput } from '@/components/ui/search';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatRoleLabel, getUserRoles, USER_ROLE_GROUP_META } from '../../_lib/admin-utils';
import type { AdminUserRecord, AdminUserRoleGroup } from '../../_lib/types';
import { UserPermissionsPopover } from './user-permissions-popover';

export function UsersPaginationControls({
  page,
  hasNext,
  onPrev,
  onNext,
}: {
  page: number;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  if (page <= 1 && !hasNext) return null;

  return (
    <div className="flex items-center justify-center gap-3 border-t px-4 py-2.5">
      <Button variant="tertiary" size="sm" disabled={page === 1} onClick={onPrev}>
        Prev
      </Button>
      <span className="text-xs text-muted-foreground">
        Page {page}
      </span>
      <Button variant="tertiary" size="sm" disabled={!hasNext} onClick={onNext}>
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
  isSuperAdmin,
  canDeactivate,
  onDeactivate,
  onActivate,
  isAssignRolesPending,
  onAssignRoles,
  pagination,
}: {
  title: string;
  emptyMessage: string;
  users: AdminUserRecord[];
  totalCount?: number;
  showGrade?: boolean;
  currentUserId?: string;
  isSuperAdmin: boolean;
  canDeactivate: (user: AdminUserRecord) => boolean;
  onDeactivate: (userId: string) => void;
  onActivate: (userId: string) => void;
  isAssignRolesPending: boolean;
  onAssignRoles: (payload: { id: string; roles: string[] }) => void;
  pagination?: ReactNode;
}) {
  const d = dataTableClasses('compact');
  const headers = showGrade
    ? ['ID', 'Name', 'Grade', 'Roles', 'Status', 'Actions']
    : ['ID', 'Name', 'Roles', 'Status', 'Actions'];

  return (
    <DataTablePanel
      title={title}
      count={totalCount ?? users.length}
      density="compact"
      fillHeight
      footer={pagination}
    >
      <Table className={d.table}>
        <TableHeader className="bg-muted/50">
          <TableRow>
            {headers.map((header) => (
              <TableHead key={header} className={d.head}>
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
                <TableCell className={d.cell}>
                  <span className="font-mono text-[11px] text-muted-foreground">{user.uniqueId}</span>
                </TableCell>
                <TableCell className={d.cell}>
                  <span className="font-medium leading-tight">{user.firstName} {user.lastName}</span>
                </TableCell>
                {showGrade ? (
                  <TableCell className={d.cell}>
                    <span className="text-muted-foreground">{user.gradeLevel || '-'}</span>
                  </TableCell>
                ) : null}
                <TableCell className={d.cell}>
                  <div className="flex flex-wrap gap-1">
                    {getUserRoles(user).map((role) => (
                      <Badge key={role} variant="dot" size="sm">
                        {formatRoleLabel(role)}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell className={d.cell}>
                  <Badge variant="solid" color={user.isActive ? 'emerald' : 'red'} size="sm">
                    {user.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </TableCell>
                <TableCell className={d.cell}>
                  <div className="flex flex-wrap items-center gap-1">
                    <UserPermissionsPopover
                      user={user}
                      isSuperAdmin={isSuperAdmin}
                      isPending={isAssignRolesPending}
                      onAssignRoles={onAssignRoles}
                    />
                    {user.isActive ? (
                      canDeactivate(user) && user.id !== currentUserId ? (
                        <Button variant="ghost" size="sm" onClick={() => onDeactivate(user.id)} className="h-7 text-destructive hover:bg-destructive/10 hover:text-destructive">
                          Deactivate
                        </Button>
                      ) : null
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => onActivate(user.id)} className="h-7 text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-600">
                        Activate
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </DataTablePanel>
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
  isAssignRolesPending,
  onAssignRoles,
  pagination,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  userRoleGroup: AdminUserRoleGroup;
  onUserRoleGroupChange: (value: AdminUserRoleGroup) => void;
  isSuperAdmin: boolean;
  viewportRef: RefObject<HTMLDivElement | null>;
  usersData?: { users?: AdminUserRecord[]; isDone?: boolean };
  isUsersLoading: boolean;
  isUsersError: boolean;
  usersError: unknown;
  refetchUsers: () => void;
  selectedUserRoleMeta: typeof USER_ROLE_GROUP_META[AdminUserRoleGroup];
  currentUserId?: string;
  canDeactivate: (user: AdminUserRecord) => boolean;
  onDeactivate: (userId: string) => void;
  onActivate: (userId: string) => void;
  isAssignRolesPending: boolean;
  onAssignRoles: (payload: { id: string; roles: string[] }) => void;
  pagination?: ReactNode;
}) {
  const users = usersData?.users ?? [];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <div className="flex shrink-0 flex-wrap items-center gap-3">
        <SearchInput
          className="max-w-xs"
          placeholder="Search users..."
          value={search}
          onValueChange={onSearchChange}
          size="sm"
        />
        <Select value={userRoleGroup} onValueChange={(value) => onUserRoleGroupChange(value as AdminUserRoleGroup)}>
          <SelectTrigger className="w-[220px]" placeholder="Filter by role" />
          <SelectContent>
            <SelectItem index={0} value="students">Students</SelectItem>
            <SelectItem index={1} value="teachers">Teachers</SelectItem>
            <SelectItem index={2} value="student-admin">Student Admins</SelectItem>
            <SelectItem index={3} value="other">Other Roles</SelectItem>
            <SelectItem index={4} value="all">All Users</SelectItem>
          </SelectContent>
        </Select>
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
                  {(usersError as { response?: { data?: { message?: string } } })?.response?.data?.message || (usersError as Error)?.message || 'Request failed.'}
                </p>
              </div>
              <Button type="button" variant="tertiary" size="sm" onClick={refetchUsers}>
                Try again
              </Button>
            </CardContent>
          </Card>
        ) : users.length === 0 ? (
          <Empty className="flex-1">
            <EmptyTitle className="text-sm font-medium text-muted-foreground">
              {selectedUserRoleMeta.emptyMessage}
            </EmptyTitle>
          </Empty>
        ) : (
          <UserTableSection
            title={selectedUserRoleMeta.label}
            emptyMessage={selectedUserRoleMeta.emptyMessage}
            users={users}
            showGrade={selectedUserRoleMeta.showGrade}
            currentUserId={currentUserId}
            isSuperAdmin={isSuperAdmin}
            canDeactivate={canDeactivate}
            onDeactivate={onDeactivate}
            onActivate={onActivate}
            isAssignRolesPending={isAssignRolesPending}
            onAssignRoles={onAssignRoles}
            pagination={pagination}
          />
        )}
      </div>
    </div>
  );
}
