'use client';

import { useDeferredValue, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { Send, Upload, UserPlus, X } from 'lucide-react';
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { api } from '~/apps/convex/src/_generated/api';
import type { Id } from '~/apps/convex/src/_generated/dataModel';
import { parseInviteCsv } from '@/lib/parse-invite-csv';
import { useToast } from '@/hooks/use-toast';
import { fullName } from '@/components/clubs/types';

type StudentResult = FunctionReturnType<typeof api.clubs.invitations.searchInviteCandidates>[number];

type Props = {
  clubId: Id<'clubs'>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function InviteDialog({ clubId, open, onOpenChange }: Props) {
  const { toast } = useToast();

  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [selected, setSelected] = useState<StudentResult | null>(null);

  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvKey, setCsvKey] = useState(0);
  const [result, setResult] = useState<{ invited: number; skipped: number; errors: string[] } | null>(null);
  const [csvPending, setCsvPending] = useState(false);

  const searchResults =
    useQuery(
      api.clubs.invitations.searchInviteCandidates,
      deferredQuery.length >= 2 && !selected
        ? { clubId, query: deferredQuery, limit: 20 }
        : 'skip',
    ) ?? [];
  const isSearching = deferredQuery.length >= 2 && !selected && searchResults.length === 0;

  const sendInvite = useMutation(api.clubs.invitations.sendInvite);
  const bulkInvite = useMutation(api.clubs.invitations.bulkInvite);

  const handleCsvUpload = async () => {
    if (!csvFile) return;
    setCsvPending(true);
    try {
      const text = await csvFile.text();
      const uniqueIds = parseInviteCsv(text);
      const response = await bulkInvite({ clubId, uniqueIds });
      setResult(response);
      setCsvFile(null);
      setCsvKey((k) => k + 1);
      toast({
        title: 'CSV processed',
        description: `${response.invited} invited, ${response.skipped} skipped`,
      });
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : 'Failed to import CSV',
        variant: 'destructive',
      });
    } finally {
      setCsvPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite members</DialogTitle>
          <DialogDescription>
            Search for a student by name, or bulk-upload an authorized roster CSV.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Single invite</Label>

            {selected ? (
              <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
                  {selected.firstName[0]}{selected.lastName[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{fullName(selected)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => { setSelected(null); setQuery(''); }}
                  className="shrink-0 rounded-full p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  aria-label="Clear selection"
                >
                  <X className="size-4" />
                </button>
                <Button
                  size="sm"
                  onClick={() =>
                    void sendInvite({
                      clubId,
                      recipientId: selected._id,
                    }).then(() => {
                      setSelected(null);
                      setQuery('');
                      toast({ title: 'Invite sent!' });
                    })
                  }
                  className="shrink-0"
                >
                  <Send className="mr-1.5 size-3.5" />
                  Send
                </Button>
              </div>
            ) : (
              <Command className="rounded-xl border shadow-sm" shouldFilter={false}>
                <CommandInput
                  placeholder="Search by name..."
                  value={query}
                  onValueChange={setQuery}
                />
                <CommandList className="max-h-[160px]">
                  {deferredQuery.length < 2 ? (
                    <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
                      <UserPlus className="size-4" />
                      Type at least 2 characters to search
                    </div>
                  ) : isSearching ? (
                    <div className="py-4 text-center text-sm text-muted-foreground">
                      Searching…
                    </div>
                  ) : searchResults?.length === 0 ? (
                    <CommandEmpty>No students found for &ldquo;{deferredQuery}&rdquo;.</CommandEmpty>
                  ) : (
                    <CommandGroup heading="Results">
                      {searchResults?.map((student) => (
                        <CommandItem
                          key={student._id}
                          onSelect={() => setSelected(student)}
                          className="flex cursor-pointer items-center gap-3 px-3 py-2.5"
                        >
                          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                            {student.firstName[0]}{student.lastName[0]}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">{fullName(student)}</p>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}
                </CommandList>
              </Command>
            )}
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or bulk upload</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground" htmlFor="invite-csv">Bulk upload</Label>
            <Input
              key={csvKey}
              id="invite-csv"
              type="file"
              accept=".csv"
              onChange={(event) => setCsvFile(event.target.files?.[0] || null)}
            />
            <Button
              variant="tertiary"
              className="w-full"
              disabled={!csvFile || csvPending}
              onClick={() => void handleCsvUpload()}
            >
              <Upload className="mr-2 size-4" />
              {csvPending ? 'Uploading…' : 'Upload CSV'}
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
          <Button variant="tertiary" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
