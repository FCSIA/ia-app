import React, { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { GRADE_OPTIONS, PATHWAY_OPTIONS, WorkshopForm as WorkshopFormType } from '../_types';
import { formatTimeRange, toggleInArray } from '../_utils';
import type { Id } from '~/apps/convex/src/_generated/dataModel';
import { useToast } from '@/hooks/use-toast';

interface Props {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  editingWorkshopId: string | null;
  initialData: WorkshopFormType;
  sessions: any[];
  flexFridayId: Id<'flexFridays'>;
  runAction: (key: string, fn: () => Promise<unknown>) => Promise<unknown>;
  mutations: {
    createWorkshop: any;
    updateWorkshop: any;
  };
}

export function WorkshopForm({
  isOpen,
  onOpenChange,
  editingWorkshopId,
  initialData,
  sessions,
  flexFridayId,
  runAction,
  mutations,
}: Props) {
  const { toast } = useToast();
  const [form, setForm] = useState<WorkshopFormType>(initialData);
  const [previousTarget, setPreviousTarget] = useState({ isOpen, editingWorkshopId });

  if (previousTarget.isOpen !== isOpen || previousTarget.editingWorkshopId !== editingWorkshopId) {
    setPreviousTarget({ isOpen, editingWorkshopId });
    if (isOpen) {
      setForm(initialData);
    }
  }

  const handleSubmit = async () => {
    if (form.sessionIds.length === 0) {
      toast({ title: 'Pick at least one session', variant: 'destructive' });
      return;
    }

    const payload: any = {
      title: form.title.trim(),
      sessionIds: form.sessionIds as Id<'flexSessions'>[],
      targetGrades: form.targetGrades,
      targetMajorPathways: form.targetMajorPathways,
      targetMinorPathways: form.targetMinorPathways,
    };
    
    if (form.description.trim()) payload.description = form.description.trim();
    if (form.location.trim()) payload.location = form.location.trim();
    if (form.capacity) {
      const cap = parseInt(form.capacity, 10);
      if (!isNaN(cap)) payload.capacity = cap;
    }

    try {
      if (editingWorkshopId) {
        await runAction('workshop-update', async () => {
          await mutations.updateWorkshop({
            workshopId: editingWorkshopId as Id<'flexWorkshops'>,
            ...payload,
          });
        });
        toast({ title: 'Workshop updated' });
      } else {
        await runAction('workshop-create', async () => {
          await mutations.createWorkshop({
            flexFridayId,
            ...payload,
          });
        });
        toast({ title: 'Workshop created' });
      }
      onOpenChange(false);
    } catch {
      // Error handled by runAction
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md overflow-y-auto">
        <SheetHeader className="pb-4 border-b mb-6">
          <SheetTitle>{editingWorkshopId ? 'Edit Workshop' : 'New Workshop'}</SheetTitle>
        </SheetHeader>
        
        <form onSubmit={() => handleSubmit()} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Workshop Title *</Label>
              <Input placeholder="Enter workshop title" value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            </div>
            
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea placeholder="What will students do in this workshop?" value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Location</Label>
                <Input placeholder="Room / location" value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Capacity</Label>
                <Input type="number" placeholder="Optional limit" value={form.capacity}
                  onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Sessions *</Label>
              <div className="grid gap-2">
                {sessions.map((s) => {
                  const checked = form.sessionIds.includes(s._id);
                  return (
                    <label key={s._id}
                      className={cn(
                        'flex items-start gap-3 rounded-lg border p-3 text-sm cursor-pointer transition-all',
                        checked ? 'border-primary bg-primary/5' : 'hover:bg-muted/50',
                      )}>
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={checked}
                        onChange={() =>
                          setForm((c) => ({
                            ...c,
                            sessionIds: toggleInArray(c.sessionIds, s._id),
                          }))
                        }
                      />
                      <div className="min-w-0">
                        <p className="font-medium text-sm leading-tight">{s.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatTimeRange(s.startTime, s.endTime)}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Target Grades</Label>
              <div className="flex flex-wrap gap-2">
                {GRADE_OPTIONS.map((g) => {
                  const checked = form.targetGrades.includes(g);
                  return (
                    <Button
                      type="button"
                      variant={checked ? 'secondary' : 'tertiary'}
                      size="sm"
                      key={g}
                      onClick={() =>
                        setForm((c) => ({ ...c, targetGrades: toggleInArray(c.targetGrades, g) }))
                      }
                    >
                      Grade {g}
                    </Button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Target Pathways</Label>
              <div className="flex flex-wrap gap-2">
                {PATHWAY_OPTIONS.map((p) => {
                  const checked = form.targetMajorPathways.includes(p.value);
                  return (
                    <Button
                      type="button"
                      variant={checked ? 'secondary' : 'tertiary'}
                      size="sm"
                      key={p.value}
                      onClick={() =>
                        setForm((c) => ({
                          ...c,
                          targetMajorPathways: toggleInArray(c.targetMajorPathways, p.value),
                        }))
                      }
                    >
                      {p.label}
                    </Button>
                  );
                })}
              </div>
            </div>
          </div>

          <SheetFooter className="pt-6 border-t mt-8">
            <Button type="button" variant="tertiary" onClick={() => onOpenChange(false)} className="flex-1">Cancel</Button>
            <Button type="submit" className="flex-1">
              {editingWorkshopId ? 'Save Changes' : 'Create Workshop'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
