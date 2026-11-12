'use client';

import { useEffect, useState } from 'react';
import { TerminalSquare } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQuery } from '@/lib/convex-react';
import { SCHOOL_TIME_ZONE } from '~/apps/shared/school-time';
import { api } from '~/apps/convex/src/_generated/api';
import type { FunctionReturnType } from 'convex/server';

type CliSession = FunctionReturnType<typeof api.users.cliSessions.list>[number];

const SECTION_ID = 'cli-sign-ins';

// A fixed locale and the school clock keep server and client HTML identical.
const sessionTime = new Intl.DateTimeFormat('en-US', {
  timeZone: SCHOOL_TIME_ZONE,
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

function when(timestamp: number) {
  return sessionTime.format(timestamp);
}

// Lists the command-line clients signed in as this person. Hidden when there
// are none, so most people never see it. The sign-in notice links here.
export function CliSignIns() {
  const sessions = useQuery(api.users.cliSessions.list, {});
  const revoke = useMutation(api.users.cliSessions.revoke);
  const { toast } = useToast();
  const [pending, setPending] = useState<CliSession | null>(null);
  const [busy, setBusy] = useState(false);

  // The section renders after the data loads, too late for the browser's own
  // scroll to /profile#cli-sign-ins.
  const ready = sessions !== undefined && sessions.length > 0;
  useEffect(() => {
    if (ready && window.location.hash === `#${SECTION_ID}`) {
      document.getElementById(SECTION_ID)?.scrollIntoView({ block: 'start' });
    }
  }, [ready]);

  if (!ready) return null;

  async function confirm() {
    if (!pending) return;
    setBusy(true);
    try {
      await revoke({ sessionId: pending.id });
      toast({ title: 'Signed out the command-line client' });
      setPending(null);
    } catch (cause) {
      toast({
        title: cause instanceof Error ? cause.message : "Couldn't sign it out.",
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id={SECTION_ID} aria-labelledby="cli-sign-ins-heading" className="scroll-mt-20">
      <div className="flex items-center gap-2">
        <TerminalSquare className="size-3.5 text-muted-foreground" aria-hidden />
        <h2 id="cli-sign-ins-heading" className="text-sm font-semibold">
          Command-line sign-ins
        </h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Terminals signed in as you. Sign out any you don&apos;t recognize.
      </p>
      <Table className="mt-3">
        <TableHeader>
          <TableRow>
            <TableHead>Client</TableHead>
            <TableHead className="hidden sm:table-cell">Signed in</TableHead>
            <TableHead>Last used</TableHead>
            <TableHead>
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sessions.map((session, index) => (
            <TableRow key={session.id} index={index}>
              <TableCell className="text-foreground">{session.client}</TableCell>
              <TableCell className="hidden whitespace-nowrap sm:table-cell">{when(session.createdAt)}</TableCell>
              <TableCell className="whitespace-nowrap">{when(session.lastUsedAt)}</TableCell>
              <TableCell className="text-right">
                <Button variant="tertiary" size="sm" onClick={() => setPending(session)}>
                  Sign out
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <AlertDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setPending(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign out this command-line client?</AlertDialogTitle>
            <AlertDialogDescription>
              {pending?.client} will need to run fcsia login again to use your account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={busy}
              onClick={(event) => {
                event.preventDefault();
                void confirm();
              }}
            >
              Sign out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
