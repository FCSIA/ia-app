'use client';

import { useState } from 'react';
import { MessageSquareText } from 'lucide-react';
import { useMutation } from 'convex/react';
import { AppShell } from '@/components/layout/AppShell';
import { PageFrame, Panel } from '@/components/layout/page-frame';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { api } from '~/apps/convex/src/_generated/api';

const MAX_FEEDBACK_CHARACTERS = 1_000;

export default function ReportPage() {
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitReport = useMutation(api.moderation.reports.submit);
  const { toast } = useToast();
  const trimmedMessage = message.trim();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!trimmedMessage || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await submitReport({
        contentType: 'GENERAL',
        contentId: 'report-page',
        reason: trimmedMessage,
      });
      setMessage('');
      toast({ title: 'Feedback sent', description: 'School staff will review it.' });
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : 'Unable to send feedback',
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
            <MessageSquareText className="size-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Share feedback</h1>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Send a thought, feature request, improvement idea, or concern. ANYTHING! Don't like a particular look for some icon? Want a feature for your particular club? Let us know!! Website maintainers will be quick to respond to your concerns. 
            </p>
          </div>
        </div>

        <Panel title="What would you like to share?" tone="accent">
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <Textarea
              aria-label="Share your feedback"
              placeholder="Share an idea, request, concern, or other feedback..."
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              maxLength={MAX_FEEDBACK_CHARACTERS}
              rows={7}
            />
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                {message.length}/{MAX_FEEDBACK_CHARACTERS}
              </p>
              <Button type="submit" disabled={!trimmedMessage || isSubmitting} loading={isSubmitting}>
                Send feedback
              </Button>
            </div>
          </form>
        </Panel>
      </PageFrame>
    </AppShell>
  );
}
