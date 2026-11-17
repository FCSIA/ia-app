'use client';

import { displayName } from '~/apps/shared/user-name';

import { ShieldCheck, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownContent, DropdownTrigger, DropdownLabel, DropdownSeparator } from '@/components/ui/dropdown';
import { MenuItem } from '@/components/ui/menu-item';
import {
  canEditUserRoles,
  getAssignableRoleOptions,
} from '../../_lib/user-roles';
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
  const roles = user.roles ?? [];
  const roleSet = new Set(roles);
  const canEdit = canEditUserRoles(user, isSuperAdmin);
  const roleOptions = getAssignableRoleOptions(isSuperAdmin);
  const checkedIndices = new Set(
    roleOptions.flatMap(({ role }, index) =>
      roleSet.has(role) ? [index] : [],
    ),
  );
  const roleSelectionDisabled = !canEdit || isPending;
  const fullName = displayName(user);

  return (
    <DropdownMenu>
      <DropdownTrigger render={
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Permissions for ${fullName}`}
          title="Permissions"
        >
          <ShieldCheck />
        </Button>
      } />
      <DropdownContent align="end" checkedIndices={[...checkedIndices, ...(user.isDeveloper ? [roleOptions.length] : [])]}>
        <DropdownLabel>{fullName}</DropdownLabel>
        {!canEdit ? <DropdownLabel>Super Admin only</DropdownLabel> : null}
          {roleOptions.map(({ role, label }, index) => {
            const active = roleSet.has(role);
            return (
              <MenuItem
                key={role}
                index={index}
                label={label}
                checked={active}
                disabled={roleSelectionDisabled}
                onSelect={() => {
                  if (roleSelectionDisabled) return;
                  const next = active ? roles.filter((r) => r !== role) : [...roles, role];
                  onAssignRoles({ _id: user._id, roles: next });
                }}
              />
            );
          })}

        {isSuperAdmin && onSetDeveloper ? (
          <>
            <DropdownSeparator />
            <DropdownLabel>Designation</DropdownLabel>
              <MenuItem
                index={roleOptions.length}
                label="Developer"
                icon={Wrench}
                checked={!!user.isDeveloper}
                disabled={isPending}
                onSelect={() => {
                  if (isPending) return;
                  onSetDeveloper({ _id: user._id, enabled: !user.isDeveloper });
                }}
              />
          </>
        ) : null}
      </DropdownContent>
    </DropdownMenu>
  );
}
