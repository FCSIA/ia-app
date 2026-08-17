"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { CircleHelp, Plus, Trash2 } from "lucide-react";
import { api } from "~/apps/convex/src/_generated/api";
import type { Id } from "~/apps/convex/src/_generated/dataModel";
import type { ClubDetail } from "@/components/clubs/types";
import { PeoplePicker } from "@/components/clubs/people-picker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardGroup, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckboxGroup, CheckboxItem } from "@/components/ui/checkbox-group";
import { Field, FieldLabel, FieldSet, FieldTitle } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { Elevated } from "@/lib/elevated";

type GroupRule =
  | { kind: "ROLE"; roleId: Id<"clubRoles"> }
  | { kind: "PERSON"; userId: Id<"users"> }
  | { kind: "UNIT"; unitId: Id<"clubUnits"> };

export function PeopleGroupsSettings({ club }: { club: ClubDetail }) {
  const { toast } = useToast();
  const groups = useQuery(api.clubs.peopleGroups.list, { clubId: club._id });
  const hierarchy = useQuery(api.clubs.hierarchy.list, { clubId: club._id });
  const createGroup = useMutation(api.clubs.peopleGroups.create);
  const updateGroup = useMutation(api.clubs.peopleGroups.update);
  const removeGroup = useMutation(api.clubs.peopleGroups.remove);
  const [editingId, setEditingId] = useState<Id<"clubPeopleGroups"> | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [roleIds, setRoleIds] = useState<Set<string>>(new Set());
  const [unitIds, setUnitIds] = useState<Set<string>>(new Set());
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const members = useMemo(
    () => club.directory.filter((person) => person.kind === "MEMBER"),
    [club.directory],
  );
  const orderedUnits = useMemo(() => {
    const units = hierarchy?.units ?? [];
    const children = new Map<string | null, typeof units>();
    for (const unit of units) {
      const siblings = children.get(unit.parentUnitId ?? null) ?? [];
      siblings.push(unit);
      children.set(unit.parentUnitId ?? null, siblings);
    }
    const result: Array<{ id: string; label: string }> = [];
    const visit = (parentId: string | null, depth: number) => {
      for (const unit of children.get(parentId) ?? []) {
        result.push({ id: unit._id, label: `${"— ".repeat(depth)}${unit.name}` });
        visit(unit._id, depth + 1);
      }
    };
    visit(null, 0);
    return result;
  }, [hierarchy?.units]);
  const selectedGroup = groups?.groups.find((group) => group._id === editingId);

  const reset = () => {
    setEditingId(null);
    setName("");
    setDescription("");
    setRoleIds(new Set());
    setUnitIds(new Set());
    setMemberIds([]);
  };

  const edit = (groupId: Id<"clubPeopleGroups"> | null) => {
    if (!groupId) {
      reset();
      return;
    }
    const group = groups?.groups.find((candidate) => candidate._id === groupId);
    if (!group) return;
    setEditingId(group._id);
    setName(group.name);
    setDescription(group.description ?? "");
    setRoleIds(new Set(group.rules.filter((rule) => rule.kind === "ROLE").map((rule) => rule.roleId)));
    setUnitIds(new Set(group.rules.filter((rule) => rule.kind === "UNIT").map((rule) => rule.unitId)));
    setMemberIds(group.rules.filter((rule) => rule.kind === "PERSON").map((rule) => rule.userId));
  };

  useEffect(() => {
    if (editingId && !selectedGroup) reset();
  }, [editingId, selectedGroup]);

  const toggle = (setter: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) => {
    setter((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const save = async () => {
    const rules: GroupRule[] = [
      ...[...roleIds].map((roleId) => ({ kind: "ROLE" as const, roleId: roleId as Id<"clubRoles"> })),
      ...[...unitIds].map((unitId) => ({ kind: "UNIT" as const, unitId: unitId as Id<"clubUnits"> })),
      ...memberIds.map((userId) => ({ kind: "PERSON" as const, userId: userId as Id<"users"> })),
    ];
    if (!name.trim() || !rules.length) return;
    setSaving(true);
    try {
      if (editingId) {
        await updateGroup({ clubId: club._id, groupId: editingId, name, description: description || undefined, rules });
      } else {
        await createGroup({ clubId: club._id, name, description: description || undefined, rules });
      }
      toast({ title: editingId ? "Group updated" : "Group created" });
      reset();
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : "Could not save group", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!editingId || !window.confirm(`Delete ${name}?`)) return;
    try {
      await removeGroup({ clubId: club._id, groupId: editingId });
      toast({ title: "Group deleted" });
      reset();
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : "Could not delete group", variant: "destructive" });
    }
  };

  return (
    <Elevated offset={1} className="overflow-hidden rounded-xl">
      <Card className="pb-0">
        <CardHeader className="border-b border-border/70 px-5 py-4">
          <CardTitle className="text-xl tracking-tight">People groups</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid md:grid-cols-[13rem_minmax(0,1fr)]">
            <aside className="border-b border-border/70 md:border-b-0 md:border-r">
              <div className="flex items-center justify-between px-5 py-4">
                <div>
                  <p className="text-sm font-semibold text-foreground">Custom groups</p>
                </div>
                <Button type="button" size="icon-sm" variant="ghost" aria-label="New people group" onClick={() => edit(null)}>
                  <Plus />
                </Button>
              </div>
              <div className="px-2 pb-3">
                <CardGroup orientation="inline" separated className="gap-0.5" aria-label="Custom people groups">
                  {groups?.groups.map((group) => (
                    <Card
                      key={group._id}
                      label={`Edit ${group.name}`}
                      selected={group._id === editingId}
                      onClick={() => edit(group._id)}
                      className="min-h-8 gap-2 rounded-md px-3 text-sm font-medium"
                    >
                      <span className="min-w-0 truncate">{group.name}</span>
                    </Card>
                  ))}
                </CardGroup>
              </div>
            </aside>
            <div className="min-w-0 p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="people-group-name">Group name</FieldLabel>
                  <Input id="people-group-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="House leadership" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="people-group-description">Description</FieldLabel>
                  <Textarea id="people-group-description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Optional note" rows={2} />
                </Field>
              </div>
              <Separator className="my-5" />
              <div className="grid gap-5 lg:grid-cols-3">
                <FieldSet className="gap-2">
                  <FieldTitle>
                    Roles
                    <Tooltip content="Anyone with one of these roles will appear in this group.">
                      <Button type="button" variant="ghost" size="icon-compact" aria-label="About role group rules"><CircleHelp /></Button>
                    </Tooltip>
                  </FieldTitle>
                  <ScrollArea className="h-48 rounded-md border border-border/70">
                    <CheckboxGroup checkedIndices={new Set(club.roles.flatMap((role, index) => roleIds.has(role._id) ? [index] : []))} className="w-full" aria-label="Roles in group">
                      {club.roles.map((role, index) => (
                        <CheckboxItem key={role._id} index={index} label={role.name} checked={roleIds.has(role._id)} onToggle={() => toggle(setRoleIds, role._id)} className="w-full" />
                      ))}
                    </CheckboxGroup>
                  </ScrollArea>
                </FieldSet>
                <FieldSet className="gap-2">
                  <FieldLabel>Structure branches</FieldLabel>
                  <ScrollArea className="h-48 rounded-md border border-border/70">
                    <CheckboxGroup checkedIndices={new Set(orderedUnits.flatMap((unit, index) => unitIds.has(unit.id) ? [index] : []))} className="w-full" aria-label="Structure branches in group">
                      {orderedUnits.map((unit, index) => (
                        <CheckboxItem key={unit.id} index={index} label={unit.label} checked={unitIds.has(unit.id)} onToggle={() => toggle(setUnitIds, unit.id)} className="w-full" />
                      ))}
                    </CheckboxGroup>
                  </ScrollArea>
                </FieldSet>
                <Field>
                  <FieldLabel>Selected people</FieldLabel>
                  <PeoplePicker people={members} selectedIds={memberIds} onChange={setMemberIds} placeholder="Add people" />
                </Field>
              </div>
              <div className="mt-5 flex flex-wrap justify-between gap-2">
                <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" disabled={!editingId || saving} leadingIcon={Trash2} onClick={() => void remove()}>
                  Delete group
                </Button>
                <Button type="button" disabled={!name.trim() || !(roleIds.size || unitIds.size || memberIds.length) || saving} loading={saving} onClick={() => void save()}>
                  {editingId ? "Save group" : "Create group"}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Elevated>
  );
}
