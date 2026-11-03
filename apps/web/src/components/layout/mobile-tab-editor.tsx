"use client";

import { useState } from "react";
import { GripVertical, type LucideIcon } from "lucide-react";
import { api } from "~/apps/convex/src/_generated/api";
import { useMutation } from "@/lib/convex-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { CheckboxGroup, CheckboxItem } from "@/components/ui/checkbox-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sortable,
  SortableItem,
  SortableItemHandle,
} from "@/components/reui/sortable";
import {
  MOBILE_TAB_DESTINATION_MAX,
  MOBILE_TAB_DESTINATION_MIN,
  normalizeMobileTabLayout,
  type MobileTabId,
} from "./mobile-tab-layout";

type TabOption = { mobileTabId: MobileTabId; label: string; icon: LucideIcon };
type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  options: TabOption[];
  savedLayout?: string[];
  showSchedule: boolean;
};

export function MobileTabEditor(props: Props) {
  // A fresh form on each opening makes Cancel a real discard operation.
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      {props.open ? <MobileTabEditorForm {...props} /> : null}
    </Dialog>
  );
}

function MobileTabEditorForm({
  onOpenChange,
  options,
  savedLayout,
  showSchedule,
}: Props) {
  const [layout, setLayout] = useState<MobileTabId[]>(() => {
    return normalizeMobileTabLayout(
      savedLayout,
      options.map((item) => item.mobileTabId),
      showSchedule,
    );
  });
  const [saving, setSaving] = useState(false);
  const update = useMutation(api.users.me.updateMobileTabLayout);
  const { toast } = useToast();
  const unchecked = options.filter(
    (item) => !layout.includes(item.mobileTabId),
  );
  async function save() {
    setSaving(true);
    try {
      await update({ layout });
      onOpenChange(false);
      toast({ title: "Tab bar updated" });
    } catch (error) {
      toast({
        title:
          error instanceof Error
            ? error.message
            : "Could not update the tab bar",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }
  return (
    <DialogContent size="sm">
      <DialogHeader>
        <DialogTitle>Edit tab bar</DialogTitle>
        <DialogDescription>
          Home and More stay in place. Choose four or five destinations, then
          drag to order them.
        </DialogDescription>
      </DialogHeader>
      <CheckboxGroup
        className="w-full"
        checkedIndices={new Set(layout.map((_, index) => index))}
      >
        <Sortable
          value={layout}
          onValueChange={setLayout}
          getItemValue={(id) => id}
          strategy="vertical"
        >
          {layout.map((id, index) => {
            const item = options.find((option) => option.mobileTabId === id)!;
            return (
              <SortableItem
                key={id}
                value={id}
                className="flex items-center gap-1"
              >
                <CheckboxItem
                  className="min-w-0 flex-1"
                  index={index}
                  label={item.label}
                  checked
                  disabled={
                    saving || layout.length <= MOBILE_TAB_DESTINATION_MIN
                  }
                  onToggle={() =>
                    setLayout((current) =>
                      current.filter((value) => value !== id),
                    )
                  }
                />
                <SortableItemHandle
                  render={
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      disabled={saving}
                      aria-label={`Drag ${item.label} to reorder`}
                    />
                  }
                >
                  <GripVertical />
                </SortableItemHandle>
              </SortableItem>
            );
          })}
        </Sortable>
        {unchecked.map((item, index) => (
          <CheckboxItem
            key={item.mobileTabId}
            index={layout.length + index}
            label={item.label}
            checked={false}
            disabled={saving || layout.length >= MOBILE_TAB_DESTINATION_MAX}
            onToggle={() =>
              setLayout((current) => [...current, item.mobileTabId])
            }
          />
        ))}
      </CheckboxGroup>
      <DialogFooter>
        <Button
          variant="ghost"
          disabled={saving}
          onClick={() => onOpenChange(false)}
        >
          Cancel
        </Button>
        <Button loading={saving} onClick={() => void save()}>
          Save tab bar
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
