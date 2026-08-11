'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { Plus, Settings } from 'lucide-react';
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

function RoleOption({
  value,
  label,
  index,
  onEdit,
}: {
  value: string;
  label: string;
  index: number;
  onEdit?: () => void;
}) {
  return (
    <div className="relative">
      <RadioItem
        index={index}
        value={value}
        label={label}
        className={onEdit ? 'w-full pr-10' : 'w-full'}
      />
      {onEdit ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="absolute right-1 top-0 z-30"
          aria-label={`Rename ${label}`}
          onClick={onEdit}
        >
          <Settings className="size-3.5" />
        </Button>
      ) : null}
    </div>
  );
}

export function SetRoleDialog({ person }: { person: ClubDirectoryEntry }) {
  const clubId = useClubId();
  const { toast } = useToast();
  const roles = useQuery(api.clubs.management.listRoles, { clubId }) ?? [];
  const setMemberRole = useMutation(api.clubs.management.setMemberRole);
  const createRole = useMutation(api.clubs.management.createRole);
  const renameRole = useMutation(api.clubs.management.renameRole);
  const [open, setOpen] = useState(false);
  const [pendingValue, setPendingValue] = useState<string | null>(null);
  const [editor, setEditor] = useState<RoleEditor>(null);
  const [roleName, setRoleName] = useState('');
  const [savingRole, setSavingRole] = useState(false);

  const currentValue = person.customRoleId ?? (person.clubRole === 'LEADER' ? 'LEADER' : 'MEMBER');
  const value = pendingValue ?? currentValue;

  useEffect(() => {
    setPendingValue(null);
  }, [person.clubRole, person.customRoleId]);

  const assign = async (nextValue: string) => {
    setPendingValue(nextValue);
    try {
      await setMemberRole({
        clubId,
        memberId: person._id,
        role: nextValue === 'MEMBER' ? 'MEMBER' : 'LEADER',
        customRoleId: nextValue === 'MEMBER' || nextValue === 'LEADER'
          ? undefined
          : nextValue as Id<'clubRoles'>,
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
          <RadioGroup value={value} onValueChange={(nextValue) => void assign(nextValue)} className="w-full gap-0.5">
            <RoleOption value="MEMBER" label="Regular Member" index={0} />
            <RoleOption value="LEADER" label="Leader" index={1} />
            {roles.map((role, index) => (
              <RoleOption
                key={role._id}
                value={role._id}
                label={role.name}
                index={index + 2}
                onEdit={() => openEditor({ mode: 'rename', roleId: role._id, name: role.name })}
              />
            ))}
          </RadioGroup>
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
        </PopoverContent>
      </Popover>

      <Dialog open={editor !== null} onOpenChange={(nextOpen) => !nextOpen && setEditor(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editor?.mode === 'rename' ? 'Rename role' : 'New role'}</DialogTitle>
            <DialogDescription>
              Custom roles have the same club-management permissions as Leader.
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
