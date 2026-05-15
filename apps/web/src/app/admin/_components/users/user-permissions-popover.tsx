'use client';

import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import {
  activeRoleClass,
  canEditUserRoles,
  getAssignableRoleOptions,
} from '../../_lib/user-roles';
import { getUserRoles } from '../../_lib/admin-utils';
import type { AdminUserRecord } from '../../_lib/types';

type UserPermissionsPopoverProps = {
  user: AdminUserRecord;
  isSuperAdmin: boolean;
  isPending: boolean;
  onAssignRoles: (payload: { id: string; roles: string[] }) => void;
};

export function UserPermissionsPopover({
  user,
  isSuperAdmin,
  isPending,
  onAssignRoles,
}: UserPermissionsPopoverProps) {
  const roles = getUserRoles(user);
  const canEdit = canEditUserRoles(user, isSuperAdmin);
  const roleOptions = getAssignableRoleOptions(isSuperAdmin);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7" disabled={!canEdit}>
          Permissions
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-3">
        <p className="mb-2 text-xs font-medium text-foreground">
          {user.firstName} {user.lastName}
        </p>
        <div className="flex flex-col gap-1.5">
          {roleOptions.map(({ role, label, color }) => {
            const active = roles.includes(role);
            return (
              <button
                key={role}
                type="button"
                disabled={!canEdit || isPending}
                onClick={() => {
                  if (!canEdit) return;
                  const next = active ? roles.filter((r) => r !== role) : [...roles, role];
                  onAssignRoles({ id: user.id, roles: next });
                }}
                className={cn(
                  'inline-flex w-full items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors',
                  active
                    ? activeRoleClass(color)
                    : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted/70',
                  !canEdit && 'cursor-not-allowed opacity-50',
                )}
              >
                {active ? <Check size={10} /> : null}
                {label}
              </button>
            );
          })}
        </div>
        {!canEdit ? (
          <p className="mt-2 text-[11px] text-muted-foreground">Super Admin only</p>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
