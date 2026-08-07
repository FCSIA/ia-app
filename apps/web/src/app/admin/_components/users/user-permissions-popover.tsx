'use client';

import { ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CheckboxGroup, CheckboxItem } from '@/components/ui/checkbox-group';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  canEditUserRoles,
  getAssignableRoleOptions,
} from '../../_lib/user-roles';
import { getUserRoles } from '../../_lib/admin-utils';
import type { AdminUserRecord } from '../../_lib/types';

type UserPermissionsPopoverProps = {
  user: AdminUserRecord;
  isSuperAdmin: boolean;
  isPending: boolean;
  onAssignRoles: (payload: { _id: string; roles: string[] }) => void;
};

export function UserPermissionsPopover({
  user,
  isSuperAdmin,
  isPending,
  onAssignRoles,
}: UserPermissionsPopoverProps) {
  const roles = getUserRoles(user);
  const roleSet = new Set(roles);
  const canEdit = canEditUserRoles(user, isSuperAdmin);
  const roleOptions = getAssignableRoleOptions(isSuperAdmin);
  const checkedIndices = new Set(
    roleOptions.flatMap(({ role }, index) =>
      roleSet.has(role) ? [index] : [],
    ),
  );
  const roleSelectionDisabled = !canEdit || isPending;
  const fullName = `${user.firstName} ${user.lastName}`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Permissions for ${fullName}`}
          title="Permissions"
        >
          <ShieldCheck />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-3">
        <div className="mb-2">
          <p className="truncate text-xs font-medium text-foreground">
            {user.firstName} {user.lastName}
          </p>
          {!canEdit ? (
            <p className="mt-1 text-[11px] text-muted-foreground">Super Admin only</p>
          ) : null}
        </div>
        <CheckboxGroup
          checkedIndices={checkedIndices}
          aria-label={`Roles for ${fullName}`}
          aria-disabled={roleSelectionDisabled || undefined}
          className="w-full gap-0"
        >
          {roleOptions.map(({ role, label }, index) => {
            const active = roleSet.has(role);
            return (
              <CheckboxItem
                key={role}
                index={index}
                label={label}
                checked={active}
                disabled={roleSelectionDisabled}
                onToggle={() => {
                  if (roleSelectionDisabled) return;
                  const next = active ? roles.filter((r) => r !== role) : [...roles, role];
                  onAssignRoles({ _id: user._id, roles: next });
                }}
                className="h-8 py-0"
              />
            );
          })}
        </CheckboxGroup>
      </PopoverContent>
    </Popover>
  );
}
