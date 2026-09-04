'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@/lib/convex-react';
import { api } from '~/apps/convex/src/_generated/api';
import type { Id } from '~/apps/convex/src/_generated/dataModel';
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
import {
  GitBranch,
  Plus,
  QrCode,
  Save,
  Trash2,
  UserRoundPlus,
  Users,
} from 'lucide-react';
import type {
  ClubDetail,
  ClubHierarchy,
  ClubUnit,
  ClubUnitMember,
} from '@/components/clubs/types';
import { PeoplePicker } from '@/components/clubs/people-picker';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Field,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { InputCopy } from '@/components/ui/input-copy';
import { IaQrCode } from '@/components/ui/ia-qr-code';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { CARD_SURFACE_FOREGROUND } from '@/lib/surface-classes';

type UnitJoinPolicy = ClubUnit['joinPolicy'];

const joinPolicyOptions: Array<{ value: UnitJoinPolicy; label: string }> = [
  { value: 'ASSIGN_ONLY', label: 'Managers assign members' },
  { value: 'OPEN', label: 'Any club member can join' },
  { value: 'CODE', label: 'Join code or QR required' },
];

type FlatUnit = { unit: ClubUnit; depth: number };

function flattenUnits(units: ClubUnit[]) {
  const children = new Map<string | null, ClubUnit[]>();
  for (const unit of units) {
    const key = unit.parentUnitId ?? null;
    children.set(key, [...(children.get(key) ?? []), unit]);
  }
  for (const siblings of children.values()) {
    siblings.sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
  }

  const rows: FlatUnit[] = [];
  const visit = (parentId: string | null, depth: number) => {
    for (const unit of children.get(parentId) ?? []) {
      rows.push({ unit, depth });
      visit(unit._id, depth + 1);
    }
  };
  visit(null, 0);
  return rows;
}

function mutationError(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong';
}

export function ClubStructureActions({
  club,
  canManageStructure = true,
  canDelete = false,
}: {
  club: ClubDetail;
  canManageStructure?: boolean;
  canDelete?: boolean;
}) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmationName, setConfirmationName] = useState('');
  const [deleting, setDeleting] = useState(false);
  const deleteClub = useMutation(api.clubs.management.deletePermanently);
  const router = useRouter();
  const { toast } = useToast();

  const permanentlyDelete = async () => {
    setDeleting(true);
    try {
      await deleteClub({ clubId: club._id, confirmationName });
      toast({ title: `${club.name} is being deleted` });
      router.replace('/clubs');
    } catch (error) {
      toast({ title: mutationError(error), variant: 'destructive' });
      setDeleting(false);
    }
  };

  return (
    <>
      <div>
        {canManageStructure ? (
          <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">Club structure</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Organize teams, houses, rooms, and join policies.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="tertiary"
              leadingIcon={GitBranch}
              onClick={() => router.push(`/clubs/${club._id}/settings/structure`)}
            >
              Manage structure
            </Button>
          </div>
        ) : null}
        {canDelete ? (
          <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">Delete club</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Permanently remove the club and all of its content.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="tertiary"
              leadingIcon={Trash2}
              className="text-destructive"
              onClick={() => setDeleteOpen(true)}
            >
              Delete club
            </Button>
          </div>
        ) : null}
      </div>
      <AlertDialog
        open={deleteOpen}
        onOpenChange={(nextOpen) => {
          setDeleteOpen(nextOpen);
          if (!nextOpen && !deleting) setConfirmationName('');
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {club.name}?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4 text-sm text-muted-foreground">
                <p>
                  This permanently removes the club, its memberships, structure,
                  channels, messages, files, announcements, and events. This action
                  cannot be undone.
                </p>
                <Field className="gap-2">
                  <FieldLabel htmlFor="delete-club-name">
                    Enter <span className="font-semibold">{club.name}</span> to confirm
                  </FieldLabel>
                  <Input
                    id="delete-club-name"
                    autoComplete="off"
                    value={confirmationName}
                    onChange={(event) => setConfirmationName(event.target.value)}
                  />
                </Field>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleting || confirmationName !== club.name}
              onClick={(event) => {
                event.preventDefault();
                void permanentlyDelete();
              }}
            >
              {deleting ? 'Deleting…' : 'Delete club'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function ClubStructureEditor({ club }: { club: ClubDetail }) {
  const hierarchy = useQuery(api.clubs.hierarchy.list, { clubId: club._id }) as ClubHierarchy | undefined;
  const [selectedId, setSelectedId] = useState<Id<'clubUnits'> | null>(null);
  const [createParentId, setCreateParentId] = useState<Id<'clubUnits'> | null | undefined>();
  const flatUnits = useMemo(() => flattenUnits(hierarchy?.units ?? []), [hierarchy?.units]);

  useEffect(() => {
    if (!hierarchy) return;
    if (selectedId && hierarchy.units.some((unit) => unit._id === selectedId)) return;
    setSelectedId(hierarchy.units[0]?._id ?? null);
  }, [hierarchy, selectedId]);

  const selectedUnit = hierarchy?.units.find((unit) => unit._id === selectedId) ?? null;

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col p-3 sm:p-5">
      <div className={cn("grid min-h-0 flex-1 overflow-hidden rounded-xl border border-border/70 bg-card lg:grid-cols-[21rem_minmax(0,1fr)]", CARD_SURFACE_FOREGROUND)}>
          <aside className="flex min-h-0 flex-col border-b bg-muted/25 lg:border-b-0 lg:border-r">
            <div className="flex items-center justify-between gap-2 border-b px-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{club.name}</p>
                <p className="text-xs text-muted-foreground">
                  {hierarchy?.units.length ?? 0} units
                </p>
              </div>
              <Button
                type="button"
                size="icon-sm"
                variant="tertiary"
                aria-label="Add top-level unit"
                onClick={() => setCreateParentId(null)}
              >
                <Plus className="size-4" />
              </Button>
            </div>
            <ScrollArea className="max-h-56 flex-1 lg:max-h-none">
              <div className="space-y-0.5 p-2">
                {flatUnits.map(({ unit, depth }) => (
                  <Button
                    key={unit._id}
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-current={selectedId === unit._id ? 'page' : undefined}
                    className={cn(
                      'h-9 w-full justify-start gap-2 px-2 font-normal',
                      selectedId === unit._id && 'bg-active font-medium text-foreground',
                    )}
                    style={{ paddingLeft: `${8 + Math.min(depth, 8) * 16}px` }}
                    onClick={() => {
                      setSelectedId(unit._id);
                      setCreateParentId(undefined);
                    }}
                  >
                    <GitBranch className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate text-left">{unit.name}</span>
                  </Button>
                ))}
                {hierarchy && hierarchy.units.length === 0 ? (
                  <div className="px-3 py-8 text-center">
                    <GitBranch className="mx-auto size-7 text-muted-foreground" />
                    <p className="mt-2 text-sm font-medium">No structure yet</p>
                    <p className="mt-1 text-xs leading-4 text-muted-foreground">
                      Start with FRC, IT, TSA, or any top-level division.
                    </p>
                  </div>
                ) : null}
              </div>
            </ScrollArea>
          </aside>

          <ScrollArea className="min-h-0">
            <div className="mx-auto w-full max-w-3xl p-4 sm:p-7">
              {createParentId !== undefined ? (
                <CreateUnitForm
                  clubId={club._id}
                  parent={hierarchy?.units.find((unit) => unit._id === createParentId) ?? null}
                  onCancel={() => setCreateParentId(undefined)}
                  onCreated={(unitId) => {
                    setSelectedId(unitId);
                    setCreateParentId(undefined);
                  }}
                />
              ) : selectedUnit ? (
                <UnitDetail
                  key={selectedUnit._id}
                  club={club}
                  unit={selectedUnit}
                  onAddChild={() => setCreateParentId(selectedUnit._id)}
                  onArchived={() => setSelectedId(null)}
                />
              ) : (
                <div className="flex min-h-64 flex-col items-center justify-center text-center">
                  <GitBranch className="size-9 text-muted-foreground" />
                  <h3 className="mt-3 text-base font-semibold">Create the first unit</h3>
                  <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                    Levels and labels are entirely up to this club.
                  </p>
                  <Button className="mt-4" leadingIcon={Plus} onClick={() => setCreateParentId(null)}>
                    Add top-level unit
                  </Button>
                </div>
              )}
            </div>
          </ScrollArea>
      </div>
    </div>
  );
}

function CreateUnitForm({
  clubId,
  parent,
  onCancel,
  onCreated,
}: {
  clubId: Id<'clubs'>;
  parent: ClubUnit | null;
  onCancel: () => void;
  onCreated: (unitId: Id<'clubUnits'>) => void;
}) {
  const { toast } = useToast();
  const createUnit = useMutation(api.clubs.hierarchy.create);
  const [name, setName] = useState('');
  const [kind, setKind] = useState('');
  const [description, setDescription] = useState('');
  const [joinPolicy, setJoinPolicy] = useState<UnitJoinPolicy>('ASSIGN_ONLY');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const unitId = await createUnit({
        clubId,
        parentUnitId: parent?._id,
        name,
        kind: kind || undefined,
        description: description || undefined,
        joinPolicy,
      });
      toast({ title: `${name.trim()} created` });
      onCreated(unitId);
    } catch (error) {
      toast({ title: mutationError(error), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold">
          {parent ? `Add a unit inside ${parent.name}` : 'Add a top-level unit'}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          The type is a label, not a fixed level. You can nest another kind beneath it later.
        </p>
      </div>
      <UnitFields
        name={name}
        kind={kind}
        description={description}
        joinPolicy={joinPolicy}
        onNameChange={setName}
        onKindChange={setKind}
        onDescriptionChange={setDescription}
        onJoinPolicyChange={setJoinPolicy}
      />
      <div className="flex justify-end gap-2">
        <Button variant="tertiary" onClick={onCancel}>Cancel</Button>
        <Button loading={saving} disabled={!name.trim()} onClick={() => void save()}>
          Create unit
        </Button>
      </div>
    </div>
  );
}

function UnitFields({
  name,
  kind,
  description,
  joinPolicy,
  onNameChange,
  onKindChange,
  onDescriptionChange,
  onJoinPolicyChange,
}: {
  name: string;
  kind: string;
  description: string;
  joinPolicy: UnitJoinPolicy;
  onNameChange: (value: string) => void;
  onKindChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onJoinPolicyChange: (value: UnitJoinPolicy) => void;
}) {
  const selectedJoinPolicy = joinPolicyOptions.find(
    (option) => option.value === joinPolicy,
  )!;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field>
        <FieldLabel htmlFor="unit-name">Name</FieldLabel>
        <Input id="unit-name" value={name} onChange={(event) => onNameChange(event.target.value)} placeholder="FRC 8866, IT, House A" />
      </Field>
      <Field>
        <FieldLabel htmlFor="unit-kind">Type label</FieldLabel>
        <Input id="unit-kind" value={kind} onChange={(event) => onKindChange(event.target.value)} placeholder="Program, House, Room, Subsystem" />
      </Field>
      <Field className="sm:col-span-2">
        <FieldLabel htmlFor="unit-description">Description</FieldLabel>
        <Textarea id="unit-description" value={description} onChange={(event) => onDescriptionChange(event.target.value)} placeholder="What this unit owns or who it is for" rows={3} />
      </Field>
      <Field className="sm:col-span-2">
        <FieldLabel>Joining</FieldLabel>
        <Select
          value={selectedJoinPolicy.label}
          onValueChange={(label) => {
            const option = joinPolicyOptions.find((candidate) => candidate.label === label);
            if (option) onJoinPolicyChange(option.value);
          }}
        >
          <SelectTrigger className="w-full" placeholder="Choose join policy" />
          <SelectContent>
            {joinPolicyOptions.map((option, index) => (
              <SelectItem key={option.value} index={index} value={option.label}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    </div>
  );
}

function UnitDetail({
  club,
  unit,
  onAddChild,
  onArchived,
}: {
  club: ClubDetail;
  unit: ClubUnit;
  onAddChild: () => void;
  onArchived: () => void;
}) {
  const { toast } = useToast();
  const updateUnit = useMutation(api.clubs.hierarchy.update);
  const archiveUnit = useMutation(api.clubs.hierarchy.archive);
  const [name, setName] = useState(unit.name);
  const [kind, setKind] = useState(unit.kind ?? '');
  const [description, setDescription] = useState(unit.description ?? '');
  const [joinPolicy, setJoinPolicy] = useState<UnitJoinPolicy>(unit.joinPolicy);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await updateUnit({
        clubId: club._id,
        unitId: unit._id,
        name,
        kind,
        description,
        joinPolicy,
      });
      toast({ title: 'Unit saved' });
    } catch (error) {
      toast({ title: mutationError(error), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const archive = async () => {
    if (!confirm(`Archive ${unit.name}? It must have no children or assigned members.`)) return;
    try {
      await archiveUnit({ clubId: club._id, unitId: unit._id });
      toast({ title: `${unit.name} archived` });
      onArchived();
    } catch (error) {
      toast({ title: mutationError(error), variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-7">
      <section className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold">{unit.name}</h3>
              {unit.kind ? <Badge variant="solid">{unit.kind}</Badge> : null}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">Edit this unit or add another level beneath it.</p>
          </div>
          <Button variant="tertiary" size="sm" leadingIcon={Plus} onClick={onAddChild}>
            Add child
          </Button>
        </div>
        <UnitFields
          name={name}
          kind={kind}
          description={description}
          joinPolicy={joinPolicy}
          onNameChange={setName}
          onKindChange={setKind}
          onDescriptionChange={setDescription}
          onJoinPolicyChange={setJoinPolicy}
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button variant="ghost" size="sm" leadingIcon={Trash2} className="text-destructive hover:text-destructive" onClick={() => void archive()}>
            Archive unit
          </Button>
          <Button leadingIcon={Save} loading={saving} disabled={!name.trim()} onClick={() => void save()}>
            Save changes
          </Button>
        </div>
      </section>

      <MemberManager club={club} unit={unit} />
      <JoinCodePanel clubId={club._id} unit={unit} />
    </div>
  );
}

function MemberManager({ club, unit }: { club: ClubDetail; unit: ClubUnit }) {
  const { toast } = useToast();
  const members = useQuery(api.clubs.hierarchy.listMembers, {
    clubId: club._id,
    unitId: unit._id,
  }) as ClubUnitMember[] | undefined;
  const setMember = useMutation(api.clubs.hierarchy.setMember);
  const removeMember = useMutation(api.clubs.hierarchy.removeMember);
  const people = useMemo(
    () => club.directory.filter((person) => person.kind === 'MEMBER'),
    [club.directory],
  );
  const selectedIds: string[] = members?.map((member) => member.userId) ?? [];

  const changeSelection = async (nextIds: string[]) => {
    if (!members) return;
    const addedId = nextIds.find((id) => !selectedIds.includes(id));
    const removedId = selectedIds.find((id) => !nextIds.includes(id));
    try {
      if (addedId) {
        await setMember({
          clubId: club._id,
          unitId: unit._id,
          memberId: addedId as Id<'users'>,
        });
      } else if (removedId) {
        await removeMember({
          clubId: club._id,
          unitId: unit._id,
          memberId: removedId as Id<'users'>,
        });
      }
    } catch (error) {
      toast({ title: mutationError(error), variant: 'destructive' });
    }
  };

  return (
    <section className="flex flex-col gap-3 border-t pt-5">
      <div>
        <h3 className="flex items-center gap-2 text-sm font-semibold"><Users className="size-4" /> Members</h3>
      </div>
      <PeoplePicker people={people} selectedIds={selectedIds} onChange={(ids) => void changeSelection(ids)} placeholder="Assign club members" />
    </section>
  );
}

function JoinCodePanel({ clubId, unit }: { clubId: Id<'clubs'>; unit: ClubUnit }) {
  const { toast } = useToast();
  const generateJoinCode = useMutation(api.clubs.hierarchy.generateJoinCode);
  const [origin, setOrigin] = useState('');
  useEffect(() => setOrigin(window.location.origin), []);
  const joinUrl = origin && unit.joinCode
    ? `${origin}/clubs/${clubId}?unitId=${unit._id}&unitCode=${unit.joinCode}`
    : '';
  return (
    <section className="space-y-3 border-t pt-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold"><QrCode className="size-4" /> Join code and QR</h3>
          <p className="mt-1 text-xs leading-4 text-muted-foreground">Only existing members of this club can redeem a unit link.</p>
        </div>
        <Button variant="tertiary" size="sm" onClick={() => void generateJoinCode({ clubId, unitId: unit._id }).then(() => toast({ title: 'Unit join code rotated' })).catch((error) => toast({ title: mutationError(error), variant: 'destructive' }))}>
          {unit.joinCode ? 'Rotate code' : 'Generate code'}
        </Button>
      </div>
      {joinUrl ? (
        <div className="grid gap-4 rounded-lg border bg-muted/20 p-4 sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-center">
          <IaQrCode
            value={joinUrl}
            label={`Join ${unit.name} QR code`}
            className="size-36"
          />
          <div className="min-w-0 space-y-2">
            <InputCopy value={joinUrl} variant="button" />
            <p className="text-xs text-muted-foreground">Printing or sharing this QR lets club members join {unit.name} directly.</p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          <UserRoundPlus className="size-5 shrink-0" /> Generate a code when this unit is ready for self-join.
        </div>
      )}
    </section>
  );
}
