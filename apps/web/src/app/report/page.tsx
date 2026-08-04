'use client';

import { useState } from 'react';
import { MessageSquareWarning } from 'lucide-react';
import { useMutation } from 'convex/react';
import { AppShell } from '@/components/layout/AppShell';
import { PageFrame, Panel } from '@/components/layout/page-frame';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { api } from '~/apps/convex/src/_generated/api';

const MAX_REPORT_REASON_CHARACTERS = 1_000;

export default function ReportPage() {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitReport = useMutation(api.moderation.reports.submit);
  const { toast } = useToast();
  const trimmedReason = reason.trim();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!trimmedReason || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await submitReport({
        contentType: 'GENERAL',
        contentId: 'report-page',
        reason: trimmedReason,
      });
      setReason('');
      toast({ title: 'Report sent', description: 'School staff will review it.' });
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : 'Unable to send report',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AppShell>
      <PageFrame className="max-w-2xl">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <MessageSquareWarning className="size-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Report a concern</h1>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Share a safety concern or an issue that needs staff attention. Reports go directly to the school review queue.
            </p>
          </div>
        </div>

        <Panel title="What happened?" description="Include enough detail for staff to understand and follow up.">
          <form className="space-y-4" onSubmit={handleSubmit}>
            <Textarea
              aria-label="Describe your concern"
              placeholder="Describe the concern..."
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={MAX_REPORT_REASON_CHARACTERS}
              rows={7}
            />
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                {reason.length}/{MAX_REPORT_REASON_CHARACTERS}
              </p>
              <Button type="submit" disabled={!trimmedReason || isSubmitting} loading={isSubmitting}>
                Send report
              </Button>
            </div>
          </form>
        </Panel>
      </PageFrame>
    </AppShell>
  );
}
