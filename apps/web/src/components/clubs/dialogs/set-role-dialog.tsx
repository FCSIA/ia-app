'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@/lib/convex-react';
import Link from 'next/link';
import { Plus, Settings, SlidersHorizontal } from 'lucide-react';
import { api } from '~/apps/convex/src/_generated/api';
import type { Id } from '~/apps/convex/src/_generated/dataModel';
import { useClubId } from '@/app/clubs/club-route';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RadioGroup, RadioItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { fullName, type ClubDirectoryEntry } from '@/components/clubs/types';
import { useToast } from '@/hooks/use-toast';

type RoleEditor =
  | { mode: 'create' }
  | { mode: 'rename'; roleId: Id<'clubRoles'>; name: string }
  | null;

export function SetRoleDialog({ person }: { person: ClubDirectoryEntry }) {
  return <SetRoleDialogContent key={person._id} person={person} />;
}

function SetRoleDialogContent({ person }: { person: ClubDirectoryEntry }) {
  const clubId = useClubId();
  const { toast } = useToast();
  const roles = useQuery(api.clubs.management.listRoles, { clubId }) ?? [];
  const setMemberRole = useMutation(api.clubs.management.setMemberRole);
  const createRole = useMutation(api.clubs.management.createRole);
  const renameRole = useMutation(api.clubs.management.renameRole);
  const initializeRoles = useMutation(api.clubs.management.initializeRoles);
  const [open, setOpen] = useState(false);
  const [pendingValue, setPendingValue] = useState<string | null>(null);
  const [editor, setEditor] = useState<RoleEditor>(null);
  const [roleName, setRoleName] = useState('');
  const [savingRole, setSavingRole] = useState(false);

  const currentValue = person.roleId ?? roles.find((role) => role.isDefault)?._id ?? '';
  const value = pendingValue ?? currentValue;

  useEffect(() => {
    if (!open || roles.length > 0) return;
    void initializeRoles({ clubId }).catch((error) => {
      toast({
        title: error instanceof Error ? error.message : 'Could not load roles',
        variant: 'destructive',
      });
    });
  }, [clubId, initializeRoles, open, roles.length, toast]);

  const assign = async (nextValue: string) => {
    setPendingValue(nextValue);
    try {
      await setMemberRole({
        clubId,
        memberId: person._id,
        roleId: nextValue as Id<'clubRoles'>,
      });
    } catch (error) {
      setPendingValue(null);
      toast({
        title: error instanceof Error ? error.message : 'Could not update role',
        variant: 'destructive',
      });
    }
  };

  const openEditor = (nextEditor: Exclude<RoleEditor, null>) => {
    setOpen(false);
    setEditor(nextEditor);
    setRoleName(nextEditor.mode === 'rename' ? nextEditor.name : '');
  };

  const saveRole = async () => {
    const name = roleName.trim();
    if (!name || !editor) return;
    setSavingRole(true);
    try {
      if (editor.mode === 'create') {
        const role = await createRole({ clubId, name });
        await assign(role._id);
      } else {
        await renameRole({ clubId, roleId: editor.roleId, name });
      }
      setEditor(null);
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : 'Could not save role',
        variant: 'destructive',
      });
    } finally {
      setSavingRole(false);
    }
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label={`Change ${fullName(person)}'s club role`}
          >
            <Settings className="size-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="w-[min(20rem,calc(100vw-2rem))] p-2"
          aria-label={`Club role for ${fullName(person)}`}
        >
          <div className="px-2 pb-2 pt-1">
            <p className="text-sm font-semibold text-foreground">Choose role</p>
            <p className="truncate text-xs text-muted-foreground">{fullName(person)}</p>
          </div>
          <div className="relative">
            <RadioGroup value={value} onValueChange={(nextValue) => void assign(nextValue)} className="w-full gap-0.5">
              {roles.map((role, index) => (
                <RadioItem
                  key={role._id}
                  value={role._id}
                  label={role.name}
                  index={index}
                  className="w-full pr-10"
                />
              ))}
            </RadioGroup>
            <div className="pointer-events-none absolute inset-y-0 right-1 top-0 z-30 flex flex-col gap-0.5">
              {roles.map((role) => (
                <div key={role._id} className="flex h-8 any-pointer-coarse:h-11 items-center">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="pointer-events-auto size-7 any-pointer-coarse:size-11"
                    aria-label={`Rename ${role.name}`}
                    onClick={() => openEditor({ mode: 'rename', roleId: role._id, name: role.name })}
                  >
                    <Settings className="size-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
          <Separator className="my-2" />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            leadingIcon={Plus}
            onClick={() => openEditor({ mode: 'create' })}
          >
            Add role
          </Button>
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            leadingIcon={SlidersHorizontal}
            onClick={() => setOpen(false)}
          >
            <Link href={`/clubs/${clubId}/settings`}>Manage permissions</Link>
          </Button>
        </PopoverContent>
      </Popover>

      <Dialog open={editor !== null} onOpenChange={(nextOpen) => !nextOpen && setEditor(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editor?.mode === 'rename' ? 'Rename role' : 'New role'}</DialogTitle>
            <DialogDescription>
              {editor?.mode === 'rename'
                ? 'This name appears everywhere the role is shown.'
                : 'New roles start without permissions. Configure them in Club settings.'}
            </DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            value={roleName}
            maxLength={64}
            placeholder="Role name"
            onChange={(event) => setRoleName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void saveRole();
              }
            }}
          />
          <DialogFooter>
            <Button variant="tertiary" onClick={() => setEditor(null)} disabled={savingRole}>
              Cancel
            </Button>
            <Button onClick={() => void saveRole()} loading={savingRole} disabled={!roleName.trim()}>
              {editor?.mode === 'rename' ? 'Save' : 'Add role'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
