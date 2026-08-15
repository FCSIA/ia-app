"use client";

import { useState } from "react";
import { Eye } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip } from "@/components/ui/tooltip";
import type { Id } from "~/apps/convex/src/_generated/dataModel";

export function ImpersonateUserAction({
  userId,
  name,
}: {
  userId: Id<"users"> | string;
  name: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      setError("A reason is required.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/impersonate-user", {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          "x-ia-impersonation-reason": trimmedReason,
        },
        body: JSON.stringify({ userId }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as
          | { message?: string }
          | null;
        throw new Error(body?.message ?? "Could not start impersonation.");
      }
      window.location.assign("/");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not start impersonation.");
      setPending(false);
    }
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) {
          setOpen(next);
          if (!next) setError(null);
        }
      }}
    >
      <Tooltip content={`Impersonate ${name}`} side="top" delayDuration={250}>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Impersonate ${name}`}
          onClick={() => setOpen(true)}
        >
          <Eye className="size-4" />
        </Button>
      </Tooltip>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>View as {name}?</AlertDialogTitle>
          <AlertDialogDescription>
            You will use this person’s access for up to 15 minutes. This start is recorded with your reason.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <label className="grid gap-2 text-sm font-medium">
          Reason
          <Input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="e.g. Reproducing a reported access issue"
            disabled={pending}
            autoFocus
          />
        </label>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending || reason.trim().length === 0}
            onClick={(event) => {
              event.preventDefault();
              void start();
            }}
          >
            {pending ? "Starting…" : "Start session"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
