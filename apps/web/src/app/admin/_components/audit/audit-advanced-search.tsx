'use client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Props = {
  draft: string;
  onDraftChange: (value: string) => void;
  applied: string;
  error: string | null;
  onApply: () => void;
};

export function AuditAdvancedSearch({
  draft,
  onDraftChange,
  applied,
  error,
  onApply,
}: Props) {
  return (
    <div className="min-w-0 space-y-2">
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="advanced">
          <AccordionTrigger>Advanced search</AccordionTrigger>
          <AccordionContent>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                onApply();
              }}
              className="min-w-0 space-y-3"
            >
              <label htmlFor="audit-query" className="block text-sm font-medium text-foreground">
                Search query
              </label>
              <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start">
                <Input
                  id="audit-query"
                  value={draft}
                  onChange={(event) => onDraftChange(event.target.value)}
                  placeholder={'person:"Alex Johnson" action:"message posted"'}
                  aria-invalid={!!error}
                  aria-describedby={error ? 'audit-query-error audit-query-help' : 'audit-query-help'}
                />
                <Button type="submit" variant="secondary" disabled={!!error}>
                  Apply query
                </Button>
              </div>
              {error ? (
                <p id="audit-query-error" role="status" className="text-sm text-destructive">
                  {error}
                </p>
              ) : null}
              <div
                id="audit-query-help"
                className="space-y-2 text-xs text-muted-foreground [overflow-wrap:anywhere]"
              >
                <p>
                  Combine <code>person:</code>, <code>action:</code>, <code>type:</code>,{' '}
                  <code>record:</code>, <code>text:</code>, and <code>source:person</code>{' '}
                  or <code>source:system</code>. Quote phrases; use <code>-</code> to
                  exclude a term. All terms must match alongside the filters above.
                </p>
                <p>
                  <code>after:2026-10-01 before:2026-10-02</code> includes both
                  dates in UTC. From and To use your local time.
                </p>
              </div>
            </form>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
      {applied ? (
        <p className="text-xs text-muted-foreground [overflow-wrap:anywhere]">
          Applied query: <code>{applied}</code>
        </p>
      ) : null}
      {draft.trim() !== applied ? (
        <p role="status" className="text-xs text-muted-foreground">
          Query changes are not applied yet.
        </p>
      ) : null}
    </div>
  );
}
