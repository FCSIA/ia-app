import React, { useState } from 'react';
import { useMutation } from '@/lib/convex-react';
import { api } from '~/apps/convex/src/_generated/api';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import type { SessionForm as SessionFormType, SessionType } from '../_types';
import type { RunFlexAction } from '../_hooks/useFlexActions';
import type { Id } from '~/apps/convex/src/_generated/dataModel';
import { useToast } from '@/hooks/use-toast';

interface Props {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  editingSessionId: string | null;
  initialData: SessionFormType;
  flexFridayId: Id<'flexFridays'>;
  runAction: RunFlexAction;
}

export function SessionForm({
  isOpen,
  onOpenChange,
  editingSessionId,
  initialData,
  flexFridayId,
  runAction,
}: Props) {
  const { toast } = useToast();
  const createSession = useMutation(api.flexFriday.sessions.create);
  const updateSession = useMutation(api.flexFriday.sessions.update);
  const [form, setForm] = useState<SessionFormType>(initialData);
  const [previousTarget, setPreviousTarget] = useState({ isOpen, editingSessionId });

  if (previousTarget.isOpen !== isOpen || previousTarget.editingSessionId !== editingSessionId) {
    setPreviousTarget({ isOpen, editingSessionId });
    if (isOpen) {
      setForm(initialData);
    }
  }

  const handleSubmit = async () => {
    const fields = {
      title: form.title.trim(),
      sessionType: form.sessionType,
      startTime: form.startTime,
      endTime: form.endTime,
      ...(form.description.trim() ? { description: form.description.trim() } : {}),
    };

    const saved = editingSessionId
      ? await runAction('session-update', () =>
          updateSession({ sessionId: editingSessionId as Id<'flexSessions'>, ...fields }),
        )
      : await runAction('session-create', () => createSession({ flexFridayId, ...fields }));
    if (!saved) return;
    toast({ title: editingSessionId ? 'Session updated' : 'Session created' });
    onOpenChange(false);
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader className="pb-4 border-b mb-6">
          <SheetTitle>{editingSessionId ? 'Edit Session' : 'New Session'}</SheetTitle>
        </SheetHeader>
        
        <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="space-y-6">
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
              <Select value={form.sessionType} onValueChange={(sessionType) => setForm({ ...form, sessionType: sessionType as SessionType })}>
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
