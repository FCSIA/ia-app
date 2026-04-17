'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { clubsApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

type Props = {
  clubId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function InviteDialog({ clubId, open, onOpenChange }: Props) {
  const { toast } = useToast();
  const [uniqueId, setUniqueId] = useState('');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvKey, setCsvKey] = useState(0);
  const [result, setResult] = useState<{ invited: number; skipped: number; errors: string[] } | null>(null);

  const inviteMutation = useMutation({
    mutationFn: (id: string) => clubsApi.sendInvite(clubId, id),
    onSuccess: () => {
      setUniqueId('');
      toast({ title: 'Invite sent' });
    },
    onError: (error: any) => {
      toast({
        title: error.response?.data?.message || 'Failed to send invite',
        variant: 'destructive',
      });
    },
  });

  const csvMutation = useMutation({
    mutationFn: () => {
      if (!csvFile) throw new Error('CSV required');
      return clubsApi.bulkInviteCsv(clubId, csvFile);
    },
    onSuccess: (response) => {
      setResult(response.data);
      setCsvFile(null);
      setCsvKey((k) => k + 1);
      toast({
        title: 'CSV processed',
        description: `${response.data.invited} invited, ${response.data.skipped} skipped`,
      });
    },
    onError: (error: any) => {
      toast({
        title: error.response?.data?.message || 'Failed to import CSV',
        variant: 'destructive',
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite members</DialogTitle>
          <DialogDescription>
            Send a single invite by unique ID or bulk-upload a CSV with a `unique_id`, `student_id`, or `user_id` column.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="invite-id">Single invite</Label>
            <div className="flex gap-2">
              <Input
                id="invite-id"
                value={uniqueId}
                onChange={(event) => setUniqueId(event.target.value)}
                placeholder="STU001"
              />
              <Button
                disabled={inviteMutation.isPending || !uniqueId.trim()}
                onClick={() => inviteMutation.mutate(uniqueId.trim().toUpperCase())}
              >
                Send
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="invite-csv">Bulk CSV</Label>
            <Input
              key={csvKey}
              id="invite-csv"
              type="file"
              accept=".csv"
              onChange={(event) => setCsvFile(event.target.files?.[0] || null)}
            />
            <Button
              variant="outline"
              className="w-full"
              disabled={!csvFile || csvMutation.isPending}
              onClick={() => csvMutation.mutate()}
            >
              <Upload className="mr-2 size-4" />
              {csvMutation.isPending ? 'Uploading…' : 'Upload CSV'}
            </Button>
          </div>

          {result ? (
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <p className="font-medium">
                {result.invited} invited · {result.skipped} skipped
              </p>
              {result.errors.slice(0, 5).map((error) => (
                <p key={error} className="mt-1 text-xs text-muted-foreground">
                  {error}
                </p>
              ))}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
