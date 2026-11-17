'use client';

import { isPathway, PATHWAY_ABBREVIATIONS } from '~/apps/shared/labels';
import { isPrivilegedAccount } from '~/apps/shared/roles';
import { displayName } from '~/apps/shared/user-name';

import { forwardRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight, KeyRound, Trash2, UserCheck, UserX } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button, type ButtonProps } from '@/components/ui/button';
import { DeveloperBadge } from '@/components/ui/developer-badge';
import {
  useDataTable,
  DataTableColumnHeader,
  DataTableControls,
  selectColumn,
  type ColumnDef,
} from '@/components/ui/data-table';
import { AdminDataTable } from '../admin-data-table';
import { Card, CardDescription, CardFooter, CardGroup, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
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
import { formatPathwayLabel, formatRoleLabel } from '../../_lib/admin-utils';
import type { AdminUserRecord, AdminUserRoleGroup } from '../../_lib/types';
import { useAdminUsers } from '../../_hooks/use-admin-users';
import { AdminNotice } from '../admin-ui';
import { UserPermissionsPopover } from './user-permissions-popover';
import { ImpersonateUserAction } from '@/components/auth/impersonate-user-action';
import { InputCopy } from '@/components/ui/input-copy';
import { Skeleton } from '@/components/ui/skeleton';

const ROLE_BADGE_LIMIT = 2;

function PathwayCell({ value }: { value?: string | null }) {
  const label = formatPathwayLabel(value);
  return (
    <abbr title={label} aria-label={label} className="block truncate no-underline">
      {(value && isPathway(value) && PATHWAY_ABBREVIATIONS[value]) || label}
    </abbr>
  );
}

function RoleSummary({ roles }: { roles: string[] }) {
  const visibleRoles = roles.slice(0, ROLE_BADGE_LIMIT);
  const overflowCount = roles.length - visibleRoles.length;
  const fullLabel = roles.map(formatRoleLabel).join(', ') || 'No roles';

  return (
    <div
      className="flex max-w-full items-center gap-1 overflow-hidden"
      aria-label={fullLabel}
      title={fullLabel}
    >
      {visibleRoles.map((role) => (
        <Badge key={role} variant="solid" size="sm">
          {formatRoleLabel(role)}
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
  search,
  onSearchChange,
  userRoleGroup,
  onUserRoleGroupChange,
  currentUserId,
  isSuperAdmin,
  canManage,
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
  search: string;
  onSearchChange: (value: string) => void;
  userRoleGroup: AdminUserRoleGroup;
  onUserRoleGroupChange: (value: AdminUserRoleGroup) => void;
  currentUserId?: string;
  isSuperAdmin: boolean;
  canManage: (user: AdminUserRecord) => boolean;
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
  const selectedCount = selectedUserIds.size;

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
      {canManage(user) && user._id !== currentUserId ? (
        <ResetPasswordAction
          user={user}
          disabled={isResetPasswordPending}
          onResetPassword={onResetPassword}
        />
      ) : null}
      {isSuperAdmin && user._id !== currentUserId && !isPrivilegedAccount(user) ? (
        <ImpersonateUserAction
          userId={user._id}
          name={displayName(user)}
        />
      ) : null}
      {user.isActive ? (
        canManage(user) && user._id !== currentUserId ? (
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
  const roleFilter = (
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
  );
  const selectionBar = canDeleteUsers && selectedCount > 0 ? (
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
  ) : null;

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

  const columns: ColumnDef<AdminUserRecord>[] = [
    selectColumn<AdminUserRecord>(),
    {
      id: 'name',
      accessorFn: (user) => displayName(user),
      header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
      cell: ({ row }) => (
        <span className="flex min-w-0 items-center gap-1 font-medium leading-tight">
          <span className="min-w-0 truncate" title={displayName(row.original)}>{displayName(row.original)}</span>
          <DeveloperBadge user={row.original} size={13} />
        </span>
      ),
      meta: { label: 'Name' },
    },
    {
      id: 'grade',
      accessorFn: (user) => user.gradeLevel,
      header: ({ column }) => <DataTableColumnHeader column={column} title="Grade" />,
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.gradeLevel || '-'}</span>,
      meta: { label: 'Grade' },
    },
    {
      id: 'major',
      accessorFn: (user) => user.major,
      header: ({ column }) => <DataTableColumnHeader column={column} title="Major" />,
      cell: ({ row }) => <PathwayCell value={row.original.major} />,
      meta: { label: 'Major' },
    },
    {
      id: 'minor',
      accessorFn: (user) => user.minor,
      header: ({ column }) => <DataTableColumnHeader column={column} title="Minor" />,
      cell: ({ row }) => <PathwayCell value={row.original.minor} />,
      meta: { label: 'Minor' },
    },
    {
      id: 'roles',
      accessorFn: (user) => (user.roles ?? []).join(', '),
      header: ({ column }) => <DataTableColumnHeader column={column} title="Roles" />,
      cell: ({ row }) => <RoleSummary roles={row.original.roles ?? []} />,
      meta: { label: 'Roles' },
    },
    {
      id: 'status',
      accessorFn: (user) => (user.isActive ? 'Active' : 'Inactive'),
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }) => (
        <Badge variant="solid" color={row.original.isActive ? 'emerald' : 'red'} size="sm">
          {row.original.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
      meta: { label: 'Status' },
    },
    {
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => (
        <DataTableControls className="justify-end">{userActions(row.original)}</DataTableControls>
      ),
      meta: { label: 'Actions' },
    },
  ];
  const table = useDataTable({
    data: users,
    columns,
    pageSize: 20,
    getRowId: (user) => user._id,
    manualFiltering: true,
    manualPagination: true,
    enableSorting: false,
    state: {
      globalFilter: search,
      rowSelection: Object.fromEntries([...selectedUserIds].map((id) => [id, true])),
    },
    onGlobalFilterChange: (update) => onSearchChange(typeof update === 'function' ? update(search) : update),
    enableRowSelection: (row) => canDeleteUsers && row.original._id !== currentUserId && !isDeleteUsersPending,
    onRowSelectionChange: (update) =>
      setSelectedUserIds((current) => {
        const previous = Object.fromEntries([...current].map((id) => [id, true]));
        const next = typeof update === 'function' ? update(previous) : update;
        return new Set(Object.keys(next).filter((id) => next[id]));
      }),
  });

  return (
    <AdminDataTable
      label={title}
      table={table}
      loading={isLoading}
      empty={emptyMessage}
      searchPlaceholder="Search users…"
      controls={roleFilter}
      count={countLabel}
      toolbarBelow={selectionBar}
      footer={pagination}
      mobile={
        isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((index) => <Skeleton key={index} className="h-16 w-full" />)}
          </div>
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
                    {[user.gradeLevel ? `Grade ${user.gradeLevel}` : null, (user.roles ?? []).map(formatRoleLabel).join(', ')]
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
        )
      }
    />
  );
}

export function AdminUsersTab() {
  const searchParams = useSearchParams();
  const initialSearch = searchParams?.get('search') ?? '';
  const initialUserId = searchParams?.get('user') ?? '';
  return <AdminUsersTabContent key={`${initialSearch}:${initialUserId}`} initialSearch={initialSearch} initialUserId={initialUserId} />;
}

function AdminUsersTabContent({ initialSearch, initialUserId }: { initialSearch: string; initialUserId: string }) {
  const users = useAdminUsers(initialSearch, initialUserId);

  return (
    <UserTableSection
      key={`${users.userRoleGroup}:${users.pageIndex}`}
      title={users.selectedUserRoleMeta.label}
      emptyMessage={users.selectedUserRoleMeta.emptyMessage}
      users={users.users}
      totalCount={users.totalCount}
      isLoading={users.isUsersLoading}
      search={users.search}
      onSearchChange={users.setSearch}
      userRoleGroup={users.userRoleGroup}
      onUserRoleGroupChange={users.setUserRoleGroup}
      currentUserId={users.currentUserId}
      isSuperAdmin={users.isSuperAdmin}
      canManage={users.canManage}
      canDeleteUsers={users.canDeleteUsers}
      onDeactivate={users.onDeactivate}
      onActivate={users.onActivate}
      onResetPassword={users.onResetPassword}
      onDeleteUsers={users.onDeleteUsers}
      isDeleteUsersPending={users.isDeleteUsersPending}
      isResetPasswordPending={users.isResetPasswordPending}
      isAssignRolesPending={users.isAssignRolesPending}
      onSetDeveloper={users.onSetDeveloper}
      onAssignRoles={users.onAssignRoles}
      status={users.status}
      canLoadPrevious={users.canLoadPrevious}
      pageIndex={users.pageIndex}
      loadNextPage={users.loadNextPage}
      loadPreviousPage={users.loadPreviousPage}
    />
  );
}
