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
      <Accordion type="single" collapsible>
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
              <p className="text-sm text-muted-foreground">
                Combine filters with spaces. Every filter must match. Put
                phrases in double quotes; add a minus sign to exclude a match.
                Names and readable action labels work alongside IDs and original
                codes.
              </p>
              <label htmlFor="audit-query" className="text-sm font-medium">
                Search query
              </label>
              <Input
                id="audit-query"
                value={draft}
                onChange={(event) => onDraftChange(event.target.value)}
                placeholder={
                  'person:"Eniola Famakinwa" action:"message posted"'
                }
                aria-invalid={!!error}
                aria-describedby="audit-query-help audit-query-error"
              />
              <p
                id="audit-query-error"
                role="status"
                className="text-sm text-destructive"
              >
                {error}
              </p>
              <div
                id="audit-query-help"
                className="space-y-2 text-xs text-muted-foreground [overflow-wrap:anywhere]"
              >
                <p>
                  <code>person:</code> who acted · <code>action:</code> what
                  happened · <code>type:</code> record type ·{' '}
                  <code>record:</code> name or ID · <code>text:</code> any
                  recorded text · <code>source:person</code> or{' '}
                  <code>source:system</code>
                </p>
                <p>
                  <code>after:2026-10-01 before:2026-10-02</code> includes both
                  dates (UTC). The From/To controls above use your local time.
                </p>
                <p>
                  Example:{' '}
                  <code>
                    type:message -action:reaction &quot;room assignments&quot;
                  </code>
                </p>
                <p>
                  Search is case-insensitive and matches part of a value. Plain
                  words search all fields. These filters combine with the
                  controls above and the selected view. Older or unlisted action
                  codes are searchable here too.
                </p>
              </div>
              <Button type="submit" variant="secondary" disabled={!!error}>
                Apply query
              </Button>
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
        <p className="text-xs text-muted-foreground">
          Query changes are not applied yet.
        </p>
      ) : null}
    </div>
  );
}
