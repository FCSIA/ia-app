'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Props = {
  draft: string;
  onDraftChange: (value: string) => void;
  error: string | null;
  onApply: () => void;
};

export function AuditAdvancedSearch({ draft, onDraftChange, error, onApply }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="flex min-w-0 flex-col gap-3">
      <CollapsibleTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          trailingIcon={open ? ChevronUp : ChevronDown}
          className="self-start"
          active={open}
        >
          Advanced search
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onApply();
          }}
          className="min-w-0"
        >
          <FieldGroup>
            <Field className="min-w-0 gap-2" data-invalid={!!error}>
              <FieldLabel htmlFor="audit-query">Search query</FieldLabel>
              <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start">
                <Input
                  id="audit-query"
                  value={draft}
                  onChange={(event) => onDraftChange(event.target.value)}
                  placeholder={'person:"Alex Johnson" action:"message posted"'}
                  aria-invalid={!!error}
                  aria-describedby={
                    error ? 'audit-query-error audit-query-help' : 'audit-query-help'
                  }
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
                className="flex max-w-3xl flex-col gap-2 text-xs text-muted-foreground [overflow-wrap:anywhere]"
              >
                <p>
                  Combine <code>person:</code>, <code>action:</code>, <code>type:</code>,{' '}
                  <code>record:</code>, <code>text:</code>, and <code>source:person</code> or{' '}
                  <code>source:system</code>. Quote phrases; use <code>-</code> to exclude a term.
                  All terms must match alongside the filters above.
                </p>
                <p>
                  <code>after:2026-10-01 before:2026-10-02</code> includes both dates in UTC. From
                  and To use your local time.
                </p>
              </div>
            </Field>
          </FieldGroup>
        </form>
      </CollapsibleContent>
    </Collapsible>
  );
}
