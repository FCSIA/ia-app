'use client';

import { ShieldCheck, Wrench } from 'lucide-react';
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
  /** Super-admin-only: grant/revoke the developer (wrench) badge. */
  onSetDeveloper?: (payload: { _id: string; enabled: boolean }) => void;
};

export function UserPermissionsPopover({
  user,
  isSuperAdmin,
  isPending,
  onAssignRoles,
  onSetDeveloper,
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
        {isSuperAdmin && onSetDeveloper ? (
          <div className="mt-2 border-t border-border/60 pt-2">
            <p className="mb-1 inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
              <Wrench className="size-3 text-primary" aria-hidden />
              Designation
            </p>
            <CheckboxGroup
              checkedIndices={new Set(user.isDeveloper ? [0] : [])}
              aria-label={`Developer designation for ${fullName}`}
              aria-disabled={isPending || undefined}
              className="w-full gap-0"
            >
              <CheckboxItem
                index={0}
                label="Developer"
                checked={!!user.isDeveloper}
                disabled={isPending}
                onToggle={() => {
                  if (isPending) return;
                  onSetDeveloper({ _id: user._id, enabled: !user.isDeveloper });
                }}
                className="h-8 py-0"
              />
            </CheckboxGroup>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
