"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@/lib/convex-react";
import { api } from "~/apps/convex/src/_generated/api";
import {
  onboardingSteps,
  onboardingSaveError,
  type OnboardingDecision,
  type OnboardingStepId,
} from "~/apps/shared/onboarding";
import { useCurrentUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { FunctionReturnType } from "convex/server";

type Status = NonNullable<FunctionReturnType<typeof api.onboarding.setup.get>>;
const OPEN_SETUP = "ia:open-setup";

export function OnboardingEntry() {
  return (
    <Button
      variant="tertiary"
      onClick={(event) =>
        window.dispatchEvent(
          new CustomEvent(OPEN_SETUP, { detail: event.currentTarget }),
        )
      }
    >
      Set up IA App
    </Button>
  );
}

export function Onboarding() {
  const user = useCurrentUser();
  const status = useQuery(
    api.onboarding.setup.get,
    user && !user.mustResetPassword ? {} : "skip",
  );
  const start = useMutation(api.onboarding.setup.start);
  const later = useMutation(api.onboarding.setup.later);
  const decide = useMutation(api.onboarding.setup.decide);
  const finish = useMutation(api.onboarding.setup.finish);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const show = (event: Event) => {
      opener.current = (event as CustomEvent<HTMLElement>).detail;
      setError("");
      setOpen(true);
    };
    window.addEventListener(OPEN_SETUP, show);
    return () => window.removeEventListener(OPEN_SETUP, show);
  }, []);

  async function save(action: () => Promise<unknown>, close = false) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await action();
      if (close) setOpen(false);
    } catch (cause) {
      setError(onboardingSaveError(cause));
    } finally {
      setBusy(false);
    }
  }

  if (!user || !status) return null;
  const visible = status.phase === "invited" || status.phase === "active";
  const progress = `${status.resolved} / ${status.total} steps`;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        setError("");
      }}
    >
      {visible ? (
        <>
          <div aria-hidden className="h-20 shrink-0" />
          <div
            data-onboarding-launcher
            className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 z-30 flex w-48 max-w-[calc(100vw-2rem)] flex-col gap-2 lg:bottom-6 lg:right-6"
          >
            <DialogTrigger asChild>
              <Button
                variant="primary"
                size="lg"
                aria-label={`Set up IA App, ${progress}`}
                onClick={() => {
                  opener.current = null;
                }}
              >
                Setup · {progress}
              </Button>
            </DialogTrigger>
            <Progress
              value={(status.resolved / status.total) * 100}
              aria-label="Setup progress"
            />
          </div>
        </>
      ) : null}
      <DialogContent
        size="lg"
        onCloseAutoFocus={(event) => {
          if (opener.current?.isConnected) {
            event.preventDefault();
            opener.current.focus();
          } else if (!visible) {
            event.preventDefault();
            document.querySelector("main")?.focus();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>Set up IA App</DialogTitle>
          <DialogDescription>
            {status.phase === "completed"
              ? "You’re all set. Your choices are saved."
              : "Make IA App useful for your school day. Skip anything you don’t need."}
          </DialogDescription>
        </DialogHeader>
        {status.phase === "active" || status.phase === "completed" ? (
          <OnboardingChecklist
            status={status}
            roles={user.roles}
            busy={busy}
            onNavigate={() => setOpen(false)}
            onDecide={(step, decision) =>
              save(() => decide({ step, decision }))
            }
          />
        ) : (
          <div className="flex flex-col gap-3 text-sm">
            <p>
              Check your profile, choose your settings, and find the school
              tools you’ll use most.
            </p>
            <p className="text-muted-foreground">
              Your progress follows your account. Later hides the reminder until
              you return to Set up IA App in Profile.
            </p>
          </div>
        )}
        {error ? (
          <p role="alert" className="mt-4 break-words text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          {status.phase !== "completed" ? (
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => save(() => later(), true)}
            >
              Later
            </Button>
          ) : null}
          {status.phase === "active" ? (
            <Button
              loading={busy}
              disabled={busy || status.resolved !== status.total}
              onClick={() => save(() => finish(), true)}
            >
              Finish setup
            </Button>
          ) : status.phase === "completed" ? (
            <Button onClick={() => setOpen(false)}>Done</Button>
          ) : (
            <Button
              loading={busy}
              disabled={busy}
              onClick={() => save(() => start())}
            >
              {status.phase === "deferred" ? "Resume setup" : "Get started"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function OnboardingChecklist({
  status,
  roles,
  busy,
  onNavigate,
  onDecide,
}: {
  status: Status;
  roles: readonly string[];
  busy: boolean;
  onNavigate: () => void;
  onDecide: (step: OnboardingStepId, decision: OnboardingDecision) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <p role="status" className="text-sm text-muted-foreground">
        {status.resolved} / {status.total} steps resolved
      </p>
      <Progress
        value={(status.resolved / status.total) * 100}
        aria-label="Setup progress"
      />
      <ol className="flex flex-col gap-5">
        {onboardingSteps(roles).map((step, index) => {
          const state =
            status.steps.find((item) => item.id === step.id)?.state ??
            "pending";
          return (
            <li key={step.id} className="flex min-w-0 flex-col gap-2">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <h2 className="text-sm font-semibold">
                  {index + 1}. {step.title}
                </h2>
                <span className="text-xs text-muted-foreground">
                  {state === "done"
                    ? "Complete"
                    : state === "skipped"
                      ? "Skipped"
                      : "To do"}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {step.description}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="tertiary" asChild>
                  <Link href={step.web} onClick={onNavigate}>
                    {step.action}
                  </Link>
                </Button>
                {status.phase === "active" && state === "pending" ? (
                  <>
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() => onDecide(step.id, "done")}
                    >
                      {step.confirmation}
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={busy}
                      aria-label={`Skip ${step.title.toLowerCase()}`}
                      onClick={() => onDecide(step.id, "skipped")}
                    >
                      Skip for now
                    </Button>
                  </>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
