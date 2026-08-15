"use client";

import {
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Id } from "~/apps/convex/src/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";

const ANY_UNIT_VALUE = "__any-unit__";

export type UnitTreePickerUnit = {
  _id: Id<"clubUnits">;
  parentUnitId: Id<"clubUnits"> | null;
  name: string;
  disabled?: boolean;
};

type UnitTreePickerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactElement;
  units: UnitTreePickerUnit[];
  value: Id<"clubUnits"> | null;
  onValueChange: (value: Id<"clubUnits"> | null) => void;
  title: string;
  subtitle: string;
  ariaLabel: string;
  loading?: boolean;
  anyUnitLabel?: string;
  closeOnSelect?: boolean;
  footer?: ReactNode;
};

/**
 * A single-surface, drill-in selector for the club structure tree. The row
 * selects its unit; the trailing chevron only changes the current tree level.
 */
export function UnitTreePicker({
  open,
  onOpenChange,
  trigger,
  units,
  value,
  onValueChange,
  title,
  subtitle,
  ariaLabel,
  loading = false,
  anyUnitLabel,
  closeOnSelect = true,
  footer,
}: UnitTreePickerProps) {
  const [unitPath, setUnitPath] = useState<Id<"clubUnits">[]>([]);
  const [direction, setDirection] = useState<1 | -1>(1);
  const reduceMotion = useReducedMotion() ?? false;
  const unitById = useMemo(
    () => new Map<Id<"clubUnits">, UnitTreePickerUnit>(units.map((unit) => [unit._id, unit])),
    [units],
  );
  const childrenByParentId = useMemo(() => {
    const children = new Map<Id<"clubUnits"> | null, UnitTreePickerUnit[]>();
    for (const unit of units) {
      const parentId = unit.parentUnitId ?? null;
      const siblings = children.get(parentId) ?? [];
      siblings.push(unit);
      children.set(parentId, siblings);
    }
    return children;
  }, [units]);
  const parentUnitId = unitPath.at(-1) ?? null;
  const parentUnit = parentUnitId ? unitById.get(parentUnitId) : null;
  const currentUnits = childrenByParentId.get(parentUnitId) ?? [];
  const selectedValue = value ?? ANY_UNIT_VALUE;
  const canChooseAny = parentUnitId === null && !!anyUnitLabel;

  const reset = () => {
    setUnitPath([]);
    setDirection(1);
  };

  const selectUnit = (nextValue: string) => {
    if (nextValue === ANY_UNIT_VALUE) {
      onValueChange(null);
    } else {
      const unit = unitById.get(nextValue as Id<"clubUnits">);
      if (!unit || unit.disabled) return;
      onValueChange(unit._id);
    }
    if (closeOnSelect) onOpenChange(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) reset();
      }}
    >
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[min(20rem,calc(100vw-2rem))] overflow-hidden p-2"
        aria-label={ariaLabel}
      >
        <AnimatePresence initial={false} mode="wait" custom={direction}>
          <motion.div
            key={parentUnitId ?? "root"}
            custom={direction}
            initial={reduceMotion ? false : { opacity: 0, x: direction * 14 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, x: direction * -10 }}
            transition={{
              duration: reduceMotion ? 0.01 : 0.16,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <div className="flex items-center gap-1 px-2 pb-2 pt-1">
              {parentUnit ? (
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Back to parent unit"
                  onClick={() => {
                    setDirection(-1);
                    setUnitPath((path) => path.slice(0, -1));
                  }}
                >
                  <ChevronLeft />
                </Button>
              ) : null}
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {parentUnit?.name ?? subtitle}
                </p>
              </div>
            </div>

            {loading ? (
              <p className="px-3 py-2 text-xs text-muted-foreground">
                Loading units…
              </p>
            ) : currentUnits.length || canChooseAny ? (
              <ScrollArea className="max-h-64">
                <div className="relative">
                  <RadioGroup
                    value={selectedValue}
                    onValueChange={selectUnit}
                    className="w-full gap-0.5"
                  >
                    {canChooseAny ? (
                      <RadioItem
                        value={ANY_UNIT_VALUE}
                        label={anyUnitLabel}
                        index={0}
                        className="w-full"
                      />
                    ) : null}
                    {currentUnits.map((unit, index) => (
                      <RadioItem
                        key={unit._id}
                        value={unit._id}
                        label={unit.name}
                        index={index + (canChooseAny ? 1 : 0)}
                        className="w-full pr-10"
                        aria-disabled={unit.disabled}
                      />
                    ))}
                  </RadioGroup>
                  <div className="pointer-events-none absolute inset-y-0 right-1 top-0 z-30 flex flex-col gap-0.5">
                    {canChooseAny ? <div className="h-8" /> : null}
                    {currentUnits.map((unit) => {
                      const hasChildren = (childrenByParentId.get(unit._id) ?? [])
                        .length > 0;
                      return (
                        <div key={unit._id} className="flex h-8 items-center">
                          {hasChildren ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              className="pointer-events-auto size-7"
                              aria-label={`View units inside ${unit.name}`}
                              onClick={() => {
                                setDirection(1);
                                setUnitPath((path) => [...path, unit._id]);
                              }}
                            >
                              <ChevronRight />
                            </Button>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </ScrollArea>
            ) : (
              <p className="px-3 py-2 text-xs text-muted-foreground">
                No units here yet
              </p>
            )}

            {parentUnitId === null ? footer : null}
          </motion.div>
        </AnimatePresence>
      </PopoverContent>
    </Popover>
  );
}
