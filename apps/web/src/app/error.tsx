'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    // Keep the underlying error visible in the console so a report can name
    // the failing query instead of only "Something went wrong!".
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-foreground">Something went wrong</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          This page hit an unexpected error. Try again, or go back to where you were.
        </p>
        {error.digest ? (
          <p className="font-mono text-xs text-muted-foreground">Ref: {error.digest}</p>
        ) : null}
      </div>
      <div className="flex gap-2">
        <Button variant="secondary" onClick={() => router.back()}>
          Go back
        </Button>
        <Button onClick={() => reset()}>Try again</Button>
      </div>
    </div>
  );
}
