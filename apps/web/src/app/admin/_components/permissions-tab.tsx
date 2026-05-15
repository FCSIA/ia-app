'use client';

import { Check, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SearchInput } from '@/components/ui/search';
import { cn } from '@/lib/utils';
import { getUserRoles } from '../_lib/admin-utils';
import type { AdminUserRecord } from '../_lib/types';

const CONTENT_ROLES: Array<{ role: string; label: string; color: 'emerald' | 'blue' | 'purple' | 'amber' | 'red' }> = [
  { role: 'STUDENT_ADMIN', label: 'Student Admin', color: 'emerald' },
  { role: 'TEACHER', label: 'Teacher', color: 'blue' },
  { role: 'SPONSOR', label: 'Sponsor', color: 'purple' },
  { role: 'SUPPORT_STAFF', label: 'Support Staff', color: 'amber' },
  { role: 'ADMIN', label: 'Admin', color: 'red' },
];

export function PermissionsTab({
  search,
  onSearchChange,
  deferredSearch,
  isLoading,
  users,
  isSuperAdmin,
  isPending,
  onAssignRoles,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  deferredSearch: string;
  isLoading: boolean;
  users: AdminUserRecord[];
  isSuperAdmin: boolean;
  isPending: boolean;
  onAssignRoles: (payload: { id: string; roles: string[] }) => void;
}) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="border-b pb-4">
          <CardTitle className="text-base">Content Creator Permissions</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Grant or revoke roles that allow users to add sessions, workshops, announcements, and events.
          </p>
        </CardHeader>
        <CardContent className="space-y-4 pt-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <SearchInput
              className="max-w-xs"
              placeholder="Search by name or ID..."
              value={search}
              onValueChange={onSearchChange}
            />
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <Badge variant="dot" color="blue">Teacher</Badge>
              <Badge variant="dot" color="purple">Sponsor</Badge>
              <Badge variant="dot" color="amber">Support Staff</Badge>
            </div>
          </div>

          {isLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading...</p>
          ) : users.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {deferredSearch ? 'No users match your search' : 'No users found'}
            </p>
          ) : (
            <div className="overflow-hidden rounded-xl border">
              {users.map((u) => {
                const roles = getUserRoles(u);
                const isPrivileged = roles.includes('ADMIN') || roles.includes('SUPER_ADMIN');
                const canEditThis = isPrivileged ? isSuperAdmin : true;
                const roleOptions = CONTENT_ROLES.filter((item) => item.role !== 'ADMIN' || isSuperAdmin);

                return (
                  <div key={u.id} className="flex flex-col gap-3 border-b bg-background px-4 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
                    <UserSummary user={u} />
                    <div className="flex shrink-0 flex-wrap gap-2">
                      {roleOptions.map(({ role, label, color }) => {
                        const active = roles.includes(role);
                        return (
                          <button
                            key={role}
                            disabled={!canEditThis || isPending}
                            onClick={() => {
                              if (!canEditThis) return;
                              const next = active ? roles.filter((r) => r !== role) : [...roles, role];
                              onAssignRoles({ id: u.id, roles: next });
                            }}
                            className={cn(
                              'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                              active
                                ? activeRoleClass(color)
                                : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted/70',
                              !canEditThis && 'cursor-not-allowed opacity-50',
                            )}
                          >
                            {active ? <Check size={10} /> : null}
                            {label}
                          </button>
                        );
                      })}
                      {!canEditThis ? (
                        <span className="self-center text-xs text-muted-foreground">Super Admin only</span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function StudentAdminsTab({
  search,
  onSearchChange,
  deferredSearch,
  isLoading,
  users,
  isPending,
  onAssignRoles,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  deferredSearch: string;
  isLoading: boolean;
  users: AdminUserRecord[];
  isPending: boolean;
  onAssignRoles: (payload: { id: string; roles: string[] }) => void;
}) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="border-b pb-4">
          <CardTitle className="text-base">Student Admins</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Students with admin privileges to add and remove events. Admins and Super Admins can revoke this role.
          </p>
        </CardHeader>
        <CardContent className="space-y-4 pt-5">
          <SearchInput
            className="max-w-xs"
            placeholder="Search by name or ID..."
            value={search}
            onValueChange={onSearchChange}
          />
          {isLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading...</p>
          ) : users.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {deferredSearch ? 'No student admins match your search' : 'No student admins assigned yet'}
            </p>
          ) : (
            <div className="overflow-hidden rounded-xl border">
              {users.map((u) => {
                const roles = getUserRoles(u);
                return (
                  <div key={u.id} className="flex flex-col gap-3 border-b bg-background px-4 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
                    <UserSummary user={u} />
                    <Button
                      size="sm"
                      variant="ghost"
                      className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      disabled={isPending}
                      onClick={() => {
                        if (!confirm(`Remove Student Admin role from ${u.firstName} ${u.lastName}?`)) return;
                        onAssignRoles({ id: u.id, roles: roles.filter((r) => r !== 'STUDENT_ADMIN') });
                      }}
                    >
                      <X className="mr-1 size-3" />
                      Remove
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function UserSummary({ user }: { user: AdminUserRecord }) {
  return (
    <div className="min-w-0">
      <p className="text-sm font-medium leading-tight text-foreground">
        {user.firstName} {user.lastName}
      </p>
      <p className="mt-0.5 font-mono text-xs text-muted-foreground">{user.uniqueId}</p>
      {user.gradeLevel ? (
        <p className="mt-0.5 text-xs text-muted-foreground">Grade {user.gradeLevel}</p>
      ) : null}
    </div>
  );
}

function activeRoleClass(color: 'emerald' | 'blue' | 'purple' | 'amber' | 'red') {
  switch (color) {
    case 'blue':
      return 'border-blue-500/30 bg-blue-500/15 text-blue-600 hover:bg-blue-500/25';
    case 'purple':
      return 'border-purple-500/30 bg-purple-500/15 text-purple-600 hover:bg-purple-500/25';
    case 'amber':
      return 'border-amber-500/30 bg-amber-500/15 text-amber-600 hover:bg-amber-500/25';
    case 'emerald':
      return 'border-emerald-500/30 bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25';
    case 'red':
      return 'border-red-500/30 bg-red-500/15 text-red-600 hover:bg-red-500/25';
  }
}

