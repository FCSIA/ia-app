"use client";

import { useState } from "react";
import { GripVertical } from "lucide-react";
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
type TabOption = { id: string; label: string };
type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  options: TabOption[];
  initialLayout: string[];
  defaultLayout: string[];
  title: string;
  description: string;
  minimum: number;
  maximum: number;
  onSave: (layout: string[] | undefined) => Promise<unknown>;
};

export function NavigationLayoutEditor(props: Props) {
  // A fresh form on each opening makes Cancel a real discard operation.
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      {props.open ? <NavigationLayoutEditorForm {...props} /> : null}
    </Dialog>
  );
}

function NavigationLayoutEditorForm({
  onOpenChange,
  options,
  initialLayout,
  defaultLayout,
  title,
  description,
  minimum,
  maximum,
  onSave,
}: Props) {
  const [layout, setLayout] = useState(initialLayout);
  const [reset, setReset] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const unchecked = options.filter(
    (item) => !layout.includes(item.id),
  );
  async function save() {
    setSaving(true);
    try {
      await onSave(reset ? undefined : layout);
      onOpenChange(false);
      toast({ title: `${title} updated` });
    } catch (error) {
      toast({
        title:
          error instanceof Error
            ? error.message
            : "Could not save navigation",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }
  return (
    <DialogContent size="sm">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <CheckboxGroup
        className="w-full max-h-[50dvh] overflow-y-auto"
        checkedIndices={new Set(layout.map((_, index) => index))}
      >
        <Sortable
          value={layout}
          onValueChange={(value) => { setReset(false); setLayout(value); }}
          getItemValue={(id) => id}
          strategy="vertical"
        >
          {layout.map((id, index) => {
            const item = options.find((option) => option.id === id)!;
            return (
              <SortableItem
                key={id}
                value={id}
                disabled={saving}
                className="flex items-center gap-1"
              >
                <CheckboxItem
                  className="min-w-0 flex-1"
                  index={index}
                  label={item.label}
                  checked
                  disabled={
                    saving || layout.length <= minimum
                  }
                  onToggle={() => { setReset(false);
                    setLayout((current) =>
                      current.filter((value) => value !== id),
                    );
                  }}
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
            key={item.id}
            index={layout.length + index}
            label={item.label}
            checked={false}
            disabled={saving || layout.length >= maximum}
            onToggle={() => { setReset(false);
              setLayout((current) => [...current, item.id]);
            }}
          />
        ))}
      </CheckboxGroup>
      <DialogFooter>
        <Button variant="ghost" disabled={saving} onClick={() => { setReset(true); setLayout(defaultLayout); }}>
          Reset
        </Button>
        <Button
          variant="ghost"
          disabled={saving}
          onClick={() => onOpenChange(false)}
        >
          Cancel
        </Button>
        <Button loading={saving} onClick={() => void save()}>
          Save changes
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
