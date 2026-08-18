'use client';

import { useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, KeyRound, Trash2, UserCheck, UserX } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DataTablePanel, dataTableClasses } from '@/components/data/data-table-panel';
import { SearchInput } from '@/components/ui/search';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip } from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { formatRoleLabel, getUserRoles, USER_ROLE_GROUP_META } from '../../_lib/admin-utils';
import type { AdminUserRecord, AdminUserRoleGroup } from '../../_lib/types';
import { AdminNotice } from '../admin-ui';
import { UserPermissionsPopover } from './user-permissions-popover';
import { ImpersonateUserAction } from '@/components/auth/impersonate-user-action';

const ROLE_BADGE_LIMIT = 2;
const USER_TABLE_HEADERS = ['Select', 'Name', 'Grade', 'Roles', 'Status', 'Actions'] as const;

function roleLabel(role: string) {
  return formatRoleLabel(role);
}

function RoleSummary({ roles }: { roles: string[] }) {
  const visibleRoles = roles.slice(0, ROLE_BADGE_LIMIT);
  const overflowCount = roles.length - visibleRoles.length;
  const fullLabel = roles.map(roleLabel).join(', ') || 'No roles';

  return (
    <div
      className="flex max-w-full flex-nowrap items-center gap-1 overflow-hidden"
      aria-label={fullLabel}
      title={fullLabel}
    >
      {visibleRoles.map((role) => (
        <Badge key={role} variant="solid" size="sm" className="min-w-0 max-w-[118px] shrink-0">
          <span className="truncate">{roleLabel(role)}</span>
        </Badge>
      ))}
      {overflowCount > 0 ? (
        <Badge variant="solid" color="gray" size="sm" className="shrink-0">
          +{overflowCount}
        </Badge>
      ) : null}
    </div>
  );
}

function IconActionButton({
  label,
  children,
  onClick,
  disabled,
  className,
}: {
  label: string;
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <Tooltip content={label} side="top" delayDuration={250}>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={label}
        title={label}
        onClick={onClick}
        disabled={disabled}
        className={className}
      >
        {children}
      </Button>
    </Tooltip>
  );
}

function ResetPasswordAction({
  user,
  disabled,
  onResetPassword,
}: {
  user: AdminUserRecord;
  disabled: boolean;
  onResetPassword: (user: AdminUserRecord) => void;
}) {
  const [open, setOpen] = useState(false);
  const label = `Reset password for ${user.firstName} ${user.lastName}`;

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <IconActionButton
        label={label}
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <KeyRound className="size-4" />
      </IconActionButton>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reset password?</AlertDialogTitle>
          <AlertDialogDescription>
            This will generate a temporary password for {user.firstName} {user.lastName} and mark
            their account to change it after signing in.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              onResetPassword(user);
              setOpen(false);
            }}
          >
            Reset password
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function BulkDeleteUsersAction({
  selectedCount,
  disabled,
  onDelete,
}: {
  selectedCount: number;
  disabled: boolean;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        variant="tertiary"
        size="sm"
        leadingIcon={Trash2}
        disabled={disabled || selectedCount === 0}
        onClick={() => setOpen(true)}
        className="text-destructive hover:text-destructive"
      >
        Delete {selectedCount} selected
      </Button>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {selectedCount} user {selectedCount === 1 ? 'account' : 'accounts'}?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes the selected sign-ins, sessions, profile records, and profile images. Historical school and collaboration records remain for audit continuity.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={disabled}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={disabled}
            variant="destructive"
            onClick={() => {
              onDelete();
              setOpen(false);
            }}
          >
            Delete permanently
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function UserTableSection({
  title,
  emptyMessage,
  users,
  totalCount,
  search,
  onSearchChange,
  userRoleGroup,
  onUserRoleGroupChange,
  currentUserId,
  isSuperAdmin,
  canDeactivate,
  canResetPassword,
  canDeleteUsers,
  onDeactivate,
  onActivate,
  onResetPassword,
  onDeleteUsers,
  isDeleteUsersPending,
  isResetPasswordPending,
  isAssignRolesPending,
  onAssignRoles,
  status,
  canLoadPrevious,
  pageIndex,
  loadNextPage,
  loadPreviousPage,
}: {
  title: string;
  emptyMessage: string;
  users: AdminUserRecord[];
  totalCount?: number;
  search: string;
  onSearchChange: (value: string) => void;
  userRoleGroup: AdminUserRoleGroup;
  onUserRoleGroupChange: (value: AdminUserRoleGroup) => void;
  currentUserId?: string;
  isSuperAdmin: boolean;
  canDeactivate: (user: AdminUserRecord) => boolean;
  canResetPassword: (user: AdminUserRecord) => boolean;
  canDeleteUsers: boolean;
  onDeactivate: (userId: string) => void;
  onActivate: (userId: string) => void;
  onResetPassword: (user: AdminUserRecord) => void;
  onDeleteUsers: (userIds: string[]) => Promise<boolean>;
  isDeleteUsersPending: boolean;
  isResetPasswordPending: boolean;
  isAssignRolesPending: boolean;
  onAssignRoles: (payload: { _id: string; roles: string[] }) => void;
  status: 'LoadingFirstPage' | 'CanLoadMore' | 'LoadingMore' | 'Exhausted';
  canLoadPrevious: boolean;
  pageIndex: number;
  loadNextPage: () => void;
  loadPreviousPage: () => void;
}) {
  const d = dataTableClasses('compact');
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(() => new Set());
  const selectableUsers = canDeleteUsers ? users.filter((user) => user._id !== currentUserId) : [];
  const selectedCount = selectedUserIds.size;
  const selectedVisibleCount = selectableUsers.filter((user) => selectedUserIds.has(user._id)).length;
  const areAllVisibleUsersSelected = selectableUsers.length > 0 && selectedVisibleCount === selectableUsers.length;

  const toggleUser = (userId: string, selected: boolean) => {
    setSelectedUserIds((current) => {
      const next = new Set(current);
      if (selected) {
        next.add(userId);
      } else {
        next.delete(userId);
      }
      return next;
    });
  };

  const toggleVisibleUsers = (selected: boolean) => {
    setSelectedUserIds((current) => {
      const next = new Set(current);
      for (const user of selectableUsers) {
        if (selected) {
          next.add(user._id);
        } else {
          next.delete(user._id);
        }
      }
      return next;
    });
  };

  const clearSelection = () => setSelectedUserIds(new Set());

  const deleteSelectedUsers = () => {
    void onDeleteUsers(Array.from(selectedUserIds)).then((didDelete) => {
      if (didDelete) clearSelection();
    });
  };

  const toolbar = (
    <div className="flex w-full min-w-0 flex-col gap-2 xl:flex-row xl:items-center xl:justify-end">
      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row xl:justify-end">
        <SearchInput
          className="w-full min-w-0 sm:w-64"
          placeholder="Search users..."
          value={search}
          onValueChange={onSearchChange}
          size="sm"
        />
        <Select value={userRoleGroup} onValueChange={(value) => onUserRoleGroupChange(value as AdminUserRoleGroup)}>
          <SelectTrigger className="w-full sm:w-[190px]" placeholder="Filter by role" />
          <SelectContent>
            <SelectItem index={0} value="students">Students</SelectItem>
            <SelectItem index={1} value="teachers">Teachers</SelectItem>
            <SelectItem index={2} value="student-admin">Student Admins</SelectItem>
            <SelectItem index={3} value="other">Other Roles</SelectItem>
            <SelectItem index={4} value="all">All Users</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {canDeleteUsers && selectedCount > 0 ? (
        <div className="flex shrink-0 items-center gap-2">
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {selectedCount} selected
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isDeleteUsersPending}
            onClick={clearSelection}
          >
            Clear
          </Button>
          <BulkDeleteUsersAction
            selectedCount={selectedCount}
            disabled={isDeleteUsersPending}
            onDelete={deleteSelectedUsers}
          />
        </div>
      ) : null}
      <div className="flex shrink-0 items-center justify-between gap-2 text-xs text-muted-foreground xl:justify-end">
        <span className="whitespace-nowrap">
          Page {pageIndex + 1} · Showing {users.length}
          {typeof totalCount === 'number' ? ` of ${totalCount}` : ''} user{users.length === 1 ? '' : 's'}
        </span>
        <div className="flex items-center gap-1.5">
          <Button
            variant="tertiary"
            size="sm"
            onClick={loadPreviousPage}
            disabled={!canLoadPrevious || status === 'LoadingMore'}
            leadingIcon={ChevronLeft}
          >
            Previous
          </Button>
          <Button
            variant="tertiary"
            size="sm"
            onClick={loadNextPage}
            disabled={status !== 'CanLoadMore'}
            trailingIcon={ChevronRight}
          >
            {status === 'LoadingMore' ? 'Loading...' : 'Next page'}
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <DataTablePanel
      title={title}
      count={totalCount}
      density="compact"
      fillHeight
      toolbar={toolbar}
    >
      <Table className={`${d.table} table-fixed`}>
        <colgroup>
          <col className="w-10" />
          <col className="w-[200px]" />
          <col className="w-[72px]" />
          <col />
          <col className="w-[92px]" />
          <col className="w-[176px]" />
        </colgroup>
        <TableHeader className="sticky top-0 z-20 bg-muted/95 backdrop-blur">
          <TableRow>
            <TableHead className={d.head}>
              <Checkbox
                checked={areAllVisibleUsersSelected ? true : selectedVisibleCount > 0 ? 'indeterminate' : false}
                onCheckedChange={(checked) => toggleVisibleUsers(checked === true)}
                disabled={selectableUsers.length === 0 || isDeleteUsersPending}
                aria-label="Select all users shown on this page"
              />
            </TableHead>
            {USER_TABLE_HEADERS.slice(1).map((header) => (
              <TableHead key={header} className={d.head}>
                {header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.length === 0 ? (
            <TableRow>
              <TableCell colSpan={USER_TABLE_HEADERS.length} className="px-3 py-8 text-center text-xs text-muted-foreground">
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            users.map((user, index) => (
              <TableRow key={user._id} index={index} className="h-10">
                <TableCell className={d.cell}>
                  <Checkbox
                    checked={selectedUserIds.has(user._id)}
                    onCheckedChange={(checked) => toggleUser(user._id, checked === true)}
                    disabled={!canDeleteUsers || user._id === currentUserId || isDeleteUsersPending}
                    aria-label={`Select ${user.firstName} ${user.lastName}`}
                  />
                </TableCell>
                <TableCell className={`${d.cell} min-w-0 overflow-hidden`}>
                  <span className="block truncate font-medium leading-tight">{user.firstName} {user.lastName}</span>
                </TableCell>
                <TableCell className={d.cell}>
                  <span className="text-muted-foreground">{user.gradeLevel || '-'}</span>
                </TableCell>
                <TableCell className={`${d.cell} min-w-0 overflow-hidden`}>
                  <RoleSummary roles={getUserRoles(user)} />
                </TableCell>
                <TableCell className={d.cell}>
                  <Badge variant="solid" color={user.isActive ? 'emerald' : 'red'} size="sm">
                    {user.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </TableCell>
                <TableCell className={`${d.cell} overflow-hidden`}>
                  <div className="grid grid-cols-[2rem_2rem_2rem_2rem] items-center justify-end gap-1">
                    <UserPermissionsPopover
                      user={user}
                      isSuperAdmin={isSuperAdmin}
                      isPending={isAssignRolesPending}
                      onAssignRoles={onAssignRoles}
                    />
                    {canResetPassword(user) && user._id !== currentUserId ? (
                      <ResetPasswordAction
                        user={user}
                        disabled={isResetPasswordPending}
                        onResetPassword={onResetPassword}
                      />
                    ) : (
                      <span aria-hidden className="size-8" />
                    )}
                    {isSuperAdmin && user._id !== currentUserId && !getUserRoles(user).some((role) => role === 'ADMIN' || role === 'SUPER_ADMIN') ? (
                      <ImpersonateUserAction
                        userId={user._id}
                        name={`${user.firstName} ${user.lastName}`}
                      />
                    ) : (
                      <span aria-hidden className="size-8" />
                    )}
                    {user.isActive ? (
                      canDeactivate(user) && user._id !== currentUserId ? (
                        <IconActionButton
                          label={`Deactivate ${user.firstName} ${user.lastName}`}
                          onClick={() => onDeactivate(user._id)}
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        >
                          <UserX className="size-4" />
                        </IconActionButton>
                      ) : (
                        <span aria-hidden className="size-8" />
                      )
                    ) : (
                      <IconActionButton
                        label={`Activate ${user.firstName} ${user.lastName}`}
                        onClick={() => onActivate(user._id)}
                        className="text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-600"
                      >
                        <UserCheck className="size-4" />
                      </IconActionButton>
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
  users,
  totalCount,
  status,
  canLoadPrevious,
  pageIndex,
  loadNextPage,
  loadPreviousPage,
  isUsersLoading,
  isUsersError,
  usersError,
  refetchUsers,
  selectedUserRoleMeta,
  currentUserId,
  canDeactivate,
  canResetPassword,
  canDeleteUsers,
  onDeactivate,
  onActivate,
  onResetPassword,
  onDeleteUsers,
  isDeleteUsersPending,
  isResetPasswordPending,
  isAssignRolesPending,
  onAssignRoles,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  userRoleGroup: AdminUserRoleGroup;
  onUserRoleGroupChange: (value: AdminUserRoleGroup) => void;
  isSuperAdmin: boolean;
  users: AdminUserRecord[];
  totalCount?: number;
  status: 'LoadingFirstPage' | 'CanLoadMore' | 'LoadingMore' | 'Exhausted';
  canLoadPrevious: boolean;
  pageIndex: number;
  loadNextPage: () => void;
  loadPreviousPage: () => void;
  isUsersLoading: boolean;
  isUsersError: boolean;
  usersError: unknown;
  refetchUsers: () => void;
  selectedUserRoleMeta: typeof USER_ROLE_GROUP_META[AdminUserRoleGroup];
  currentUserId?: string;
  canDeactivate: (user: AdminUserRecord) => boolean;
  canResetPassword: (user: AdminUserRecord) => boolean;
  canDeleteUsers: boolean;
  onDeactivate: (userId: string) => void;
  onActivate: (userId: string) => void;
  onResetPassword: (user: AdminUserRecord) => void;
  onDeleteUsers: (userIds: string[]) => Promise<boolean>;
  isDeleteUsersPending: boolean;
  isResetPasswordPending: boolean;
  isAssignRolesPending: boolean;
  onAssignRoles: (payload: { _id: string; roles: string[] }) => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col">
        {isUsersLoading ? (
          <AdminNotice className="min-h-0 flex-1" message="Loading users..." />
        ) : isUsersError ? (
          <AdminNotice
            className="min-h-0 flex-1"
            tone="danger"
            title="Could not load users."
            message={(usersError as { response?: { data?: { message?: string } } })?.response?.data?.message || (usersError as Error)?.message || 'Request failed.'}
            actionLabel="Try again"
            onAction={refetchUsers}
          />
        ) : (
          <UserTableSection
            key={`${userRoleGroup}:${pageIndex}`}
            title={selectedUserRoleMeta.label}
            emptyMessage={selectedUserRoleMeta.emptyMessage}
            users={users}
            totalCount={totalCount}
            search={search}
            onSearchChange={onSearchChange}
            userRoleGroup={userRoleGroup}
            onUserRoleGroupChange={onUserRoleGroupChange}
            currentUserId={currentUserId}
            isSuperAdmin={isSuperAdmin}
            canDeactivate={canDeactivate}
            canResetPassword={canResetPassword}
            canDeleteUsers={canDeleteUsers}
            onDeactivate={onDeactivate}
            onActivate={onActivate}
            onResetPassword={onResetPassword}
            onDeleteUsers={onDeleteUsers}
            isDeleteUsersPending={isDeleteUsersPending}
            isResetPasswordPending={isResetPasswordPending}
            isAssignRolesPending={isAssignRolesPending}
            onAssignRoles={onAssignRoles}
            status={status}
            canLoadPrevious={canLoadPrevious}
            pageIndex={pageIndex}
            loadNextPage={loadNextPage}
            loadPreviousPage={loadPreviousPage}
          />
        )}
      </div>
    </div>
  );
}
