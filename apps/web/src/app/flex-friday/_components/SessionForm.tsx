import React, { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { SessionForm as SessionFormType } from '../_types';
import type { Id } from '~/apps/convex/src/_generated/dataModel';
import { useToast } from '@/hooks/use-toast';

interface Props {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  editingSessionId: string | null;
  initialData: SessionFormType;
  flexFridayId: Id<'flexFridays'>;
  runAction: (key: string, fn: () => Promise<unknown>) => Promise<unknown>;
  mutations: {
    createSession: any;
    updateSession: any;
  };
}

export function SessionForm({
  isOpen,
  onOpenChange,
  editingSessionId,
  initialData,
  flexFridayId,
  runAction,
  mutations,
}: Props) {
  const { toast } = useToast();
  const [form, setForm] = useState<SessionFormType>(initialData);
  const [previousTarget, setPreviousTarget] = useState({ isOpen, editingSessionId });

  if (previousTarget.isOpen !== isOpen || previousTarget.editingSessionId !== editingSessionId) {
    setPreviousTarget({ isOpen, editingSessionId });
    if (isOpen) {
      setForm(initialData);
    }
  }

  const handleSubmit = async () => {

    const payload: any = {
      title: form.title.trim(),
      sessionType: form.sessionType,
      startTime: form.startTime,
      endTime: form.endTime,
    };
    if (form.description.trim()) payload.description = form.description.trim();

    try {
      if (editingSessionId) {
        await runAction('session-update', async () => {
          await mutations.updateSession({
            sessionId: editingSessionId as Id<'flexSessions'>,
            ...payload,
          });
        });
        toast({ title: 'Session updated' });
      } else {
        await runAction('session-create', async () => {
          await mutations.createSession({
            flexFridayId,
            ...payload,
          });
        });
        toast({ title: 'Session created' });
      }
      onOpenChange(false);
    } catch {
      // Error handled by runAction
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader className="pb-4 border-b mb-6">
          <SheetTitle>{editingSessionId ? 'Edit Session' : 'New Session'}</SheetTitle>
        </SheetHeader>
        
        <form onSubmit={() => handleSubmit()} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Session Title *</Label>
              <Input placeholder="e.g. Morning Session, Workshop Block A" value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            </div>
            
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea placeholder="Optional details about this session" value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
            </div>

            <div className="space-y-2">
              <Label>Session Type</Label>
              <Select value={form.sessionType} onValueChange={(v: string) => setForm({ ...form, sessionType: v as any })}>
                <SelectTrigger placeholder="Select type" />
                <SelectContent>
                  <SelectItem value="STUDENT_CHOICE" index={0}>Student Choice</SelectItem>
                  <SelectItem value="TEACHER_ASSIGNED" index={1}>Teacher Assigned</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Time</Label>
                <Input type="time" value={form.startTime}
                  onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>End Time</Label>
                <Input type="time" value={form.endTime}
                  onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
              </div>
            </div>
          </div>

          <SheetFooter className="pt-6 border-t mt-8">
            <Button type="button" variant="tertiary" onClick={() => onOpenChange(false)} className="flex-1">Cancel</Button>
            <Button type="submit" className="flex-1">
              {editingSessionId ? 'Save Changes' : 'Create Session'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
