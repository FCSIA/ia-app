"use client";

import { useState } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import type { Id } from "~/apps/convex/src/_generated/dataModel";
import type { ClubDetail } from "@/components/clubs/types";
import { UnitTreePicker } from "@/components/clubs/unit-tree-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckboxGroup, CheckboxItem } from "@/components/ui/checkbox-group";
import { FieldDescription, FieldLegend, FieldSet } from "@/components/ui/field";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

export type PeopleKindFilter = "all" | "MEMBER" | "SPONSOR";

type Hierarchy = {
  units: Array<{
    _id: Id<"clubUnits">;
    parentUnitId: Id<"clubUnits"> | null;
    name: string;
    kind: string | null;
  }>;
};

type Props = {
  club: ClubDetail | undefined;
  hierarchy: Hierarchy | undefined;
  selectedUnitId: Id<"clubUnits"> | null;
  onSelectedUnitIdChange: (id: Id<"clubUnits"> | null) => void;
  selectedRoleIds: Set<Id<"clubRoles">>;
  onSelectedRoleIdsChange: (ids: Set<Id<"clubRoles">>) => void;
  kindFilter: PeopleKindFilter;
  onKindFilterChange: (kind: PeopleKindFilter) => void;
  onClear: () => void;
};

export function PeopleFilterPopover({
  club,
  hierarchy,
  selectedUnitId,
  onSelectedUnitIdChange,
  selectedRoleIds,
  onSelectedRoleIdsChange,
  kindFilter,
  onKindFilterChange,
  onClear,
}: Props) {
  const [open, setOpen] = useState(false);
  const [unitPickerOpen, setUnitPickerOpen] = useState(false);

  const activeCount =
    (selectedUnitId ? 1 : 0) +
    (selectedRoleIds.size > 0 ? 1 : 0) +
    (kindFilter !== "all" ? 1 : 0);

  const selectedUnitName = selectedUnitId
    ? hierarchy?.units.find((u) => u._id === selectedUnitId)?.name ?? null
    : null;

  const roles = club?.roles ?? [];
  const checkedRoleIndices = new Set(
    roles.flatMap((role, index) => (selectedRoleIds.has(role._id) ? [index] : [])),
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="tertiary"
          size="sm"
          leadingIcon={SlidersHorizontal}
          active={open}
          aria-label="Filter people"
        >
          <span>Filters</span>
          {activeCount > 0 ? (
            <Badge size="sm" color="blue" className="ml-1">
              {activeCount}
            </Badge>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[min(30rem,calc(100vw-2rem))] overflow-hidden p-0"
        aria-label="Filter people"
      >
        <div className="max-h-[min(38rem,var(--radix-popover-content-available-height))] overflow-y-auto p-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-foreground">Filters</h3>
            {activeCount > 0 ? (
              <Button variant="ghost" size="sm" onClick={onClear}>
                Clear
              </Button>
            ) : null}
          </div>

          <div className="flex flex-col gap-5">
            <FieldSet className="gap-2">
              <FieldLegend variant="label">Substructure</FieldLegend>
              <UnitTreePicker
                open={unitPickerOpen}
                onOpenChange={setUnitPickerOpen}
                trigger={
                  <Button
                    type="button"
                    variant="tertiary"
                    size="sm"
                    className="w-full justify-between"
                    trailingIcon={ChevronDown}
                  >
                    <span className="truncate">{selectedUnitName ?? "All substructures"}</span>
                  </Button>
                }
                units={hierarchy?.units ?? []}
                value={selectedUnitId}
                onValueChange={onSelectedUnitIdChange}
                title="Substructure"
                subtitle="Filter people"
                ariaLabel="Filter people by substructure"
                anyUnitLabel="All substructures"
                loading={hierarchy === undefined}
              />
              <FieldDescription>Includes members assigned to descendant units.</FieldDescription>
            </FieldSet>

            {roles.length > 0 ? (
              <FieldSet className="gap-2">
                <FieldLegend variant="label">Roles</FieldLegend>
                <FieldDescription>Matches any selected role.</FieldDescription>
                <ScrollArea className="max-h-48">
                  <CheckboxGroup checkedIndices={checkedRoleIndices} className="w-full">
                    {roles.map((role, index) => (
                      <CheckboxItem
                        key={role._id}
                        index={index}
                        label={role.name}
                        checked={selectedRoleIds.has(role._id)}
                        onToggle={() =>
                          onSelectedRoleIdsChange(
                            (() => {
                              const next = new Set(selectedRoleIds);
                              if (next.has(role._id)) next.delete(role._id);
                              else next.add(role._id);
                              return next;
                            })(),
                          )
                        }
                      />
                    ))}
                  </CheckboxGroup>
                </ScrollArea>
              </FieldSet>
            ) : null}

            <FieldSet className="gap-0">
              <FieldLegend variant="label">Person type</FieldLegend>
              <RadioGroup
                value={kindFilter}
                onValueChange={(value) => onKindFilterChange(value as PeopleKindFilter)}
                className="w-full gap-0.5"
              >
                <RadioItem index={0} value="all" label="Everyone" className="w-full" />
                <RadioItem index={1} value="MEMBER" label="Members only" className="w-full" />
                <RadioItem index={2} value="SPONSOR" label="Sponsors only" className="w-full" />
              </RadioGroup>
            </FieldSet>
          </div>

          {activeCount > 0 ? (
            <>
              <Separator className="my-3" />
              <div className="flex justify-end">
                <Button variant="tertiary" size="sm" onClick={() => setOpen(false)}>
                  Done
                </Button>
              </div>
            </>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
