'use client';

import type { RefObject, ReactNode } from 'react';
import { KeyRound } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DataTablePanel, dataTableClasses } from '@/components/data/data-table-panel';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Empty, EmptyTitle } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SearchInput } from '@/components/ui/search';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatRoleLabel, getUserRoles, USER_ROLE_GROUP_META } from '../../_lib/admin-utils';
import type { AdminUserRecord, AdminUserRoleGroup } from '../../_lib/types';
import { UserPermissionsPopover } from './user-permissions-popover';

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
  isSuperAdmin,
  canDeactivate,
  canResetPassword,
  onDeactivate,
  onActivate,
  onResetPassword,
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
  canResetPassword: (user: AdminUserRecord) => boolean;
  onDeactivate: (userId: string) => void;
  onActivate: (userId: string) => void;
  onResetPassword: (user: AdminUserRecord) => void;
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
                    {canResetPassword(user) && user.id !== currentUserId ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onResetPassword(user)}
                        className="h-7"
                      >
                        <KeyRound className="mr-1 size-3" />
                        Reset
                      </Button>
                    ) : null}
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
  canResetPassword,
  onDeactivate,
  onActivate,
  onResetPassword,
  passwordResetTarget,
  passwordResetValue,
  onPasswordResetValueChange,
  onClosePasswordReset,
  onSubmitPasswordReset,
  isResetPasswordPending,
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
  usersData?: { users?: AdminUserRecord[]; total?: number };
  isUsersLoading: boolean;
  isUsersError: boolean;
  usersError: unknown;
  refetchUsers: () => void;
  selectedUserRoleMeta: typeof USER_ROLE_GROUP_META[AdminUserRoleGroup];
  currentUserId?: string;
  canDeactivate: (user: AdminUserRecord) => boolean;
  canResetPassword: (user: AdminUserRecord) => boolean;
  onDeactivate: (userId: string) => void;
  onActivate: (userId: string) => void;
  onResetPassword: (user: AdminUserRecord) => void;
  passwordResetTarget: AdminUserRecord | null;
  passwordResetValue: string;
  onPasswordResetValueChange: (value: string) => void;
  onClosePasswordReset: () => void;
  onSubmitPasswordReset: () => void;
  isResetPasswordPending: boolean;
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
                  {(usersError as any)?.response?.data?.message || (usersError as Error)?.message || 'Request failed.'}
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
          <>
            <UserTableSection
              title={selectedUserRoleMeta.label}
              emptyMessage={selectedUserRoleMeta.emptyMessage}
              users={users}
              totalCount={usersData?.total}
              showGrade={selectedUserRoleMeta.showGrade}
              currentUserId={currentUserId}
              isSuperAdmin={isSuperAdmin}
              canDeactivate={canDeactivate}
              canResetPassword={canResetPassword}
              onDeactivate={onDeactivate}
              onActivate={onActivate}
              onResetPassword={onResetPassword}
              isAssignRolesPending={isAssignRolesPending}
              onAssignRoles={onAssignRoles}
              pagination={pagination}
            />
            <Dialog
              open={!!passwordResetTarget}
              onOpenChange={(open) => {
                if (!open) onClosePasswordReset();
              }}
            >
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Reset password</DialogTitle>
                  <DialogDescription>
                    Set a temporary password for {passwordResetTarget?.firstName} {passwordResetTarget?.lastName}.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-2">
                  <Label htmlFor="admin-reset-password">Temporary password</Label>
                  <Input
                    id="admin-reset-password"
                    type="password"
                    value={passwordResetValue}
                    onChange={(event) => onPasswordResetValueChange(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') onSubmitPasswordReset();
                    }}
                    placeholder="At least 8 characters"
                  />
                  <p className="text-xs text-muted-foreground">
                    The user should change this after signing in.
                  </p>
                </div>
                <DialogFooter>
                  <Button type="button" variant="tertiary" onClick={onClosePasswordReset}>
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    disabled={passwordResetValue.length < 8}
                    loading={isResetPasswordPending}
                    onClick={onSubmitPasswordReset}
                  >
                    Reset password
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        )}
      </div>
    </div>
  );
}

