import React, { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { FridayForm as FridayFormType, PATHWAY_OPTIONS } from '../_types';
import { useToast } from '@/hooks/use-toast';

interface Props {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  runAction: (key: string, fn: () => Promise<unknown>) => Promise<unknown>;
  mutations: {
    createFriday: any;
  };
}

export function FridayForm({
  isOpen,
  onOpenChange,
  runAction,
  mutations,
}: Props) {
  const { toast } = useToast();
  const [form, setForm] = useState<FridayFormType>({
    date: '',
    type: 'ALL_STUDENT',
    gradeLevel: '9',
    pathway: 'INFORMATION_TECHNOLOGY',
    notes: '',
    isSchoolDay: true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.date) {
      toast({ title: 'Pick a date', variant: 'destructive' });
      return;
    }

    const payload: any = {
      date: new Date(form.date).getTime(),
      type: form.type,
      isSchoolDay: form.isSchoolDay,
    };
    if (form.type === 'GRADE_LEVEL') payload.gradeLevel = parseInt(form.gradeLevel, 10);
    if (form.type === 'PATHWAY') payload.pathway = form.pathway;
    if (form.notes.trim()) payload.notes = form.notes.trim();

    try {
      await runAction('friday-create', async () => {
        await mutations.createFriday(payload);
      });
      onOpenChange(false);
      toast({ title: 'Friday Scheduled' });
    } catch (e) {
      // Error handled by runAction
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader className="pb-4 border-b mb-6">
          <SheetTitle>Schedule Flex Friday</SheetTitle>
        </SheetHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Date *</Label>
              <Input type="date" value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })} required />
            </div>

            <div className="space-y-2">
              <Label>Event Type</Label>
              <Select value={form.type} onValueChange={(v: string) => setForm({ ...form, type: v as any })}>
                <SelectTrigger placeholder="Select type" />
                <SelectContent>
                  <SelectItem value="ALL_STUDENT" index={0}>All Students</SelectItem>
                  <SelectItem value="GRADE_LEVEL" index={1}>Specific Grade</SelectItem>
                  <SelectItem value="PATHWAY" index={2}>Specific Pathway</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.type === 'GRADE_LEVEL' && (
              <div className="space-y-2">
                <Label>Grade Level</Label>
                <Select value={form.gradeLevel} onValueChange={(v: string) => setForm({ ...form, gradeLevel: v })}>
                  <SelectTrigger placeholder="Select grade" />
                  <SelectContent>
                    <SelectItem value="9" index={0}>Grade 9</SelectItem>
                    <SelectItem value="10" index={1}>Grade 10</SelectItem>
                    <SelectItem value="11" index={2}>Grade 11</SelectItem>
                    <SelectItem value="12" index={3}>Grade 12</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {form.type === 'PATHWAY' && (
              <div className="space-y-2">
                <Label>Pathway</Label>
                <Select value={form.pathway} onValueChange={(v: string) => setForm({ ...form, pathway: v })}>
                  <SelectTrigger placeholder="Select pathway" />
                  <SelectContent>
                    {PATHWAY_OPTIONS.map((p, i) => (
                      <SelectItem key={p.value} value={p.value} index={i}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="py-2">
              <Label className="flex items-center gap-2 cursor-pointer">
                <Switch 
                  checked={form.isSchoolDay} 
                  onToggle={() => setForm(f => ({ ...f, isSchoolDay: !f.isSchoolDay }))} 
                />
                <span className="text-sm font-medium">Is School Day?</span>
              </Label>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea placeholder="Optional internal notes" value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} />
            </div>
          </div>

          <SheetFooter className="pt-6 border-t mt-8">
            <Button type="button" variant="tertiary" onClick={() => onOpenChange(false)} className="flex-1">Cancel</Button>
            <Button type="submit" className="flex-1">Schedule Friday</Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
