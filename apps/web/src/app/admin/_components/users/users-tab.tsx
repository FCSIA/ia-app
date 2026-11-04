'use client';

import { displayName } from '~/apps/shared/user-name';

import { forwardRef, useState } from 'react';
import { ChevronLeft, ChevronRight, KeyRound, Trash2, UserCheck, UserX } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button, type ButtonProps } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DeveloperBadge } from '@/components/ui/developer-badge';
import { DataTableCount, DataTableSection, PINNED_TABLE_HEADER } from '@/components/data/data-table-section';
import { Card, CardDescription, CardFooter, CardGroup, CardHeader, CardTitle } from '@/components/ui/card';
import { SearchInput, SearchToolbarRow } from '@/components/ui/search';
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { formatPathwayLabel, formatRoleLabel, getUserRoles, USER_ROLE_GROUP_META } from '../../_lib/admin-utils';
import type { AdminUserRecord, AdminUserRoleGroup } from '../../_lib/types';
import { AdminNotice } from '../admin-ui';
import { UserPermissionsPopover } from './user-permissions-popover';
import { ImpersonateUserAction } from '@/components/auth/impersonate-user-action';
import { InputCopy } from '@/components/ui/input-copy';
import { Skeleton } from '@/components/ui/skeleton';

const ROLE_BADGE_LIMIT = 2;
const USER_TABLE_HEADERS = ['Select', 'Name', 'Grade', 'Major', 'Minor', 'Roles', 'Status', 'Actions'] as const;

function roleLabel(role: string) {
  return formatRoleLabel(role);
}

function PathwayCell({ value }: { value?: string | null }) {
  const label = formatPathwayLabel(value);
  const codes: Record<string, string> = {
    INFORMATION_TECHNOLOGY: 'IT',
    HEALTH_SCIENCE: 'HS',
    ENGINEERING: 'ENG',
  };
  return (
    <abbr title={label} aria-label={label} className="block truncate no-underline">
      {(value && codes[value]) || label}
    </abbr>
  );
}

function RoleSummary({ roles }: { roles: string[] }) {
  const visibleRoles = roles.slice(0, ROLE_BADGE_LIMIT);
  const overflowCount = roles.length - visibleRoles.length;
  const fullLabel = roles.map(roleLabel).join(', ') || 'No roles';

  return (
    <div
      className="flex max-w-full items-center gap-1 overflow-hidden"
      aria-label={fullLabel}
      title={fullLabel}
    >
      {visibleRoles.map((role) => (
        <Badge key={role} variant="solid" size="sm">
          {roleLabel(role)}
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

const IconActionButton = forwardRef<HTMLButtonElement, ButtonProps & { label: string }>(
  function IconActionButton({ label, children, ...props }, ref) {
    return (
      <Tooltip content={label} side="top" delayDuration={250}>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          {...props}
          ref={ref}
          aria-label={label}
          title={label}
        >
          {children}
        </Button>
      </Tooltip>
    );
  },
);

function ResetPasswordAction({
  user,
  disabled,
  onResetPassword,
}: {
  user: AdminUserRecord;
  disabled: boolean;
  onResetPassword: (user: AdminUserRecord) => Promise<string | undefined>;
}) {
  const [open, setOpen] = useState(false);
  const [temporaryPassword, setTemporaryPassword] = useState<string>();
  const [isResetting, setIsResetting] = useState(false);
  const label = `Reset password for ${displayName(user)}`;

  const resetPassword = async () => {
    setIsResetting(true);
    const password = await onResetPassword(user);
    setIsResetting(false);
    if (password) setTemporaryPassword(password);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) setTemporaryPassword(undefined);
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger asChild>
        <IconActionButton label={label} disabled={disabled}>
          <KeyRound className="size-4" />
        </IconActionButton>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{temporaryPassword ? 'Temporary password created' : 'Reset password?'}</AlertDialogTitle>
          <AlertDialogDescription>
            {temporaryPassword
              ? `Copy this password and share it securely with ${displayName(user)}. It is only shown once.`
              : `This will generate a temporary password for ${displayName(user)} and mark their account to change it after signing in.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {temporaryPassword ? <InputCopy label="Temporary password" value={temporaryPassword} variant="button" /> : null}
        <AlertDialogFooter>
          {temporaryPassword ? (
            <AlertDialogCancel>Done</AlertDialogCancel>
          ) : (
            <>
              <AlertDialogCancel disabled={isResetting}>Cancel</AlertDialogCancel>
              <Button type="button" onClick={() => void resetPassword()} disabled={isResetting}>
                {isResetting ? 'Resetting...' : 'Reset password'}
              </Button>
            </>
          )}
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
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="tertiary"
          size="sm"
          leadingIcon={Trash2}
          disabled={disabled || selectedCount === 0}
          className="text-destructive hover:text-destructive"
        >
          Delete {selectedCount} selected
        </Button>
      </AlertDialogTrigger>
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
  isLoading,
  errorMessage,
  onRetry,
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
  onSetDeveloper,
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
  isLoading: boolean;
  errorMessage?: string;
  onRetry: () => void;
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
  onResetPassword: (user: AdminUserRecord) => Promise<string | undefined>;
  onDeleteUsers: (userIds: string[]) => Promise<boolean | undefined>;
  isDeleteUsersPending: boolean;
  isResetPasswordPending: boolean;
  isAssignRolesPending: boolean;
  onAssignRoles: (payload: { _id: string; roles: string[] }) => void;
  onSetDeveloper?: (payload: { _id: string; enabled: boolean }) => void;
  status: 'LoadingFirstPage' | 'CanLoadMore' | 'LoadingMore' | 'Exhausted';
  canLoadPrevious: boolean;
  pageIndex: number;
  loadNextPage: () => void;
  loadPreviousPage: () => void;
}) {
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

  const userActions = (user: AdminUserRecord) => (
    <>
      <UserPermissionsPopover
        user={user}
        isSuperAdmin={isSuperAdmin}
        isPending={isAssignRolesPending}
        onAssignRoles={onAssignRoles}
        onSetDeveloper={onSetDeveloper}
      />
      {canResetPassword(user) && user._id !== currentUserId ? (
        <ResetPasswordAction
          user={user}
          disabled={isResetPasswordPending}
          onResetPassword={onResetPassword}
        />
      ) : null}
      {isSuperAdmin && user._id !== currentUserId && !getUserRoles(user).some((role) => role === 'ADMIN' || role === 'SUPER_ADMIN') ? (
        <ImpersonateUserAction
          userId={user._id}
          name={displayName(user)}
        />
      ) : null}
      {user.isActive ? (
        canDeactivate(user) && user._id !== currentUserId ? (
          <IconActionButton
            label={`Deactivate ${displayName(user)}`}
            onClick={() => onDeactivate(user._id)}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <UserX className="size-4" />
          </IconActionButton>
        ) : null
      ) : (
        <IconActionButton
          label={`Activate ${displayName(user)}`}
          onClick={() => onActivate(user._id)}
          className="text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-600"
        >
          <UserCheck className="size-4" />
        </IconActionButton>
      )}
    </>
  );

  const countLabel = isLoading
    ? '—'
    : search.trim()
      ? `${users.length} ${users.length === 1 ? 'match' : 'matches'}`
      : typeof totalCount === 'number'
        ? `${users.length.toLocaleString()}/${totalCount.toLocaleString()} ${totalCount === 1 ? 'user' : 'users'}`
        : `${users.length} ${users.length === 1 ? 'user' : 'users'}`;
  const toolbar = (
    <>
      <SearchToolbarRow className="flex-row flex-wrap items-center gap-2">
        <SearchInput
          className="min-w-0 basis-full sm:basis-0 sm:flex-1"
          placeholder="Search users…"
          aria-label="Search users"
          value={search}
          onValueChange={onSearchChange}
        />
        <Select value={userRoleGroup} onValueChange={(value) => onUserRoleGroupChange(value as AdminUserRoleGroup)}>
          <SelectTrigger className="w-44 shrink-0" placeholder="Filter by role" aria-label="Filter users by role" />
          <SelectContent>
            <SelectItem index={0} value="students">Students</SelectItem>
            <SelectItem index={1} value="teachers">Teachers</SelectItem>
            <SelectItem index={2} value="student-admin">Student Admins</SelectItem>
            <SelectItem index={3} value="other">Other Roles</SelectItem>
            <SelectItem index={4} value="all">All Users</SelectItem>
          </SelectContent>
        </Select>
        <DataTableCount>{countLabel}</DataTableCount>
      </SearchToolbarRow>
      {canDeleteUsers && selectedCount > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
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
    </>
  );

  // The toolbar owns the count; the list end only pages.
  const pagination = isLoading || (!canLoadPrevious && status === 'Exhausted') ? null : (
    <div className="flex min-h-9 min-w-0 items-center justify-between gap-3 pt-2 text-xs text-muted-foreground">
      <span>Page {pageIndex + 1}</span>
      <div className="flex items-center gap-1.5">
        <Button
          variant="tertiary"
          size="sm"
          onClick={loadPreviousPage}
          disabled={isLoading || !canLoadPrevious || status === 'LoadingMore'}
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
  );

  return (
    <DataTableSection label={title} toolbar={toolbar}>
      <div className="hidden md:block">
        <Table aria-label={title} aria-busy={isLoading || status === 'LoadingMore'} className="table-fixed">
          <colgroup>
            <col className="w-10" />
            <col />
            <col className="w-14" />
            <col className="hidden w-16 xl:table-column" />
            <col className="hidden w-16 xl:table-column" />
            <col className="w-[22%]" />
            <col className="w-[5.5rem]" />
            <col className="w-[9.5rem]" />
          </colgroup>
          <TableHeader className={PINNED_TABLE_HEADER}>
            <TableRow>
              <TableHead scope="col">
                <Checkbox
                  checked={areAllVisibleUsersSelected ? true : selectedVisibleCount > 0 ? 'indeterminate' : false}
                  onCheckedChange={(checked) => toggleVisibleUsers(checked === true)}
                  disabled={selectableUsers.length === 0 || isDeleteUsersPending}
                  aria-label="Select all users shown on this page"
                />
              </TableHead>
              {USER_TABLE_HEADERS.slice(1).map((header) => (
                <TableHead
                  key={header}
                  scope="col"
                  className={header === 'Major' || header === 'Minor' ? 'hidden xl:table-cell' : undefined}
                >
                  {header === 'Actions' ? <span className="sr-only">Actions</span> : header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? Array.from({ length: 8 }, (_, index) => (
              <TableRow key={index}><TableCell colSpan={8}><Skeleton className="h-5 w-full" /></TableCell></TableRow>
            )) : errorMessage ? (
              <TableRow><TableCell colSpan={8}><AdminNotice tone="danger" title="Could not load users." message={errorMessage} actionLabel="Try again" onAction={onRetry} /></TableCell></TableRow>
            ) : users.length === 0 ? (
              <TableRow><TableCell colSpan={8}><AdminNotice message={emptyMessage} /></TableCell></TableRow>
            ) : users.map((user, index) => (
              <TableRow key={user._id} index={index} className="group">
                <TableCell>
                  <Checkbox
                    checked={selectedUserIds.has(user._id)}
                    onCheckedChange={(checked) => toggleUser(user._id, checked === true)}
                    disabled={!canDeleteUsers || user._id === currentUserId || isDeleteUsersPending}
                    aria-label={`Select ${displayName(user)}`}
                  />
                </TableCell>
                <TableCell className="min-w-0 overflow-hidden">
                  <span className="flex min-w-0 items-center gap-1 font-medium leading-tight">
                    <span className="min-w-0 truncate" title={displayName(user)}>{displayName(user)}</span>
                    <DeveloperBadge user={user} size={13} />
                  </span>
                </TableCell>
                <TableCell>
                  <span className="text-muted-foreground">{user.gradeLevel || '-'}</span>
                </TableCell>
                <TableCell className="hidden min-w-0 overflow-hidden xl:table-cell">
                  <PathwayCell value={user.major} />
                </TableCell>
                <TableCell className="hidden min-w-0 overflow-hidden xl:table-cell">
                  <PathwayCell value={user.minor} />
                </TableCell>
                <TableCell className="min-w-0 overflow-hidden">
                  <RoleSummary roles={getUserRoles(user)} />
                </TableCell>
                <TableCell>
                  <Badge variant="solid" color={user.isActive ? 'emerald' : 'red'} size="sm">
                    {user.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </TableCell>
                <TableCell className="overflow-hidden">
                  <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 pointer-coarse:opacity-100">
                    {userActions(user)}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="md:hidden">
        {isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((index) => <Skeleton key={index} className="h-16 w-full" />)}
          </div>
        ) : errorMessage ? (
          <AdminNotice tone="danger" title="Could not load users." message={errorMessage} actionLabel="Try again" onAction={onRetry} />
        ) : users.length === 0 ? (
          <AdminNotice message={emptyMessage} />
        ) : (
          <CardGroup border="none" corners="compact">
            {users.map((user) => (
              <Card key={user._id}>
                <CardHeader>
                  <CardTitle>
                    <span className="flex min-w-0 items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-1">
                        <span className="truncate">{displayName(user)}</span>
                        <DeveloperBadge user={user} size={13} />
                      </span>
                      <Badge variant="solid" color={user.isActive ? 'emerald' : 'red'} size="sm">
                        {user.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </span>
                  </CardTitle>
                  <CardDescription className="truncate">
                    {[user.gradeLevel ? `Grade ${user.gradeLevel}` : null, getUserRoles(user).map(roleLabel).join(', ')]
                      .filter(Boolean)
                      .join(' · ')}
                  </CardDescription>
                </CardHeader>
                <CardFooter>
                  <div className="flex items-center gap-1">{userActions(user)}</div>
                </CardFooter>
              </Card>
            ))}
          </CardGroup>
        )}
      </div>
      {pagination}
    </DataTableSection>
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
  onSetDeveloper,
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
  onResetPassword: (user: AdminUserRecord) => Promise<string | undefined>;
  onDeleteUsers: (userIds: string[]) => Promise<boolean | undefined>;
  isDeleteUsersPending: boolean;
  isResetPasswordPending: boolean;
  isAssignRolesPending: boolean;
  onAssignRoles: (payload: { _id: string; roles: string[] }) => void;
  onSetDeveloper?: (payload: { _id: string; enabled: boolean }) => void;
}) {
  return (
          <UserTableSection
            key={`${userRoleGroup}:${pageIndex}`}
            title={selectedUserRoleMeta.label}
            emptyMessage={selectedUserRoleMeta.emptyMessage}
            users={users}
            totalCount={totalCount}
            isLoading={isUsersLoading}
            errorMessage={isUsersError ? (usersError as { response?: { data?: { message?: string } } })?.response?.data?.message || (usersError as Error)?.message || 'Request failed.' : undefined}
            onRetry={refetchUsers}
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
            onSetDeveloper={onSetDeveloper}
            onAssignRoles={onAssignRoles}
            status={status}
            canLoadPrevious={canLoadPrevious}
            pageIndex={pageIndex}
            loadNextPage={loadNextPage}
            loadPreviousPage={loadPreviousPage}
          />
  );
}
