"use client";

import Link from "next/link";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { ListChecks } from "lucide-react";
import { useMutation, useQuery } from "@/lib/convex-react";
import { api } from "~/apps/convex/src/_generated/api";
import {
  onboardingSteps,
  onboardingSaveError,
  type OnboardingDecision,
  type OnboardingStepId,
} from "~/apps/shared/onboarding";
import { useCurrentUser } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  AccordionContent,
  AccordionGroup,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Banner,
  BannerAction,
  BannerActions,
  BannerTitle,
} from "@/components/ui/banner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { FunctionReturnType } from "convex/server";

type Status = NonNullable<FunctionReturnType<typeof api.onboarding.setup.get>>;
const OPEN_SETUP = "ia:open-setup";

function openSetup(opener: HTMLElement | null) {
  window.dispatchEvent(new CustomEvent(OPEN_SETUP, { detail: opener }));
}

function useSetupStatus() {
  const user = useCurrentUser();
  return useQuery(
    api.onboarding.setup.get,
    user && !user.mustResetPassword ? {} : "skip",
  );
}

/** Invited and in-progress setup is reminded on Home; nowhere else. */
export function useSetupReminder() {
  const status = useSetupStatus();
  return status?.phase === "invited" || status?.phase === "active";
}

export function OnboardingEntry() {
  return (
    <Button
      variant="tertiary"
      onClick={(event) => openSetup(event.currentTarget)}
    >
      Set up IA App
    </Button>
  );
}

/** Home's reminder. Dismissing it is Later: it stays hidden until Profile. */
export function OnboardingBanner() {
  const status = useSetupStatus();
  const later = useMutation(api.onboarding.setup.later);
  const { toast } = useToast();
  const [hidden, setHidden] = useState(false);
  const reminded = status?.phase === "invited" || status?.phase === "active";
  const started = status?.phase === "active";
  const progress = status ? `${status.resolved} of ${status.total} done` : "";

  return (
    <Banner
      variant="fixed"
      icon={ListChecks}
      open={reminded && !hidden}
      dismissible
      dismissLabel="Set up later"
      onDismiss={() => {
        setHidden(true);
        later()
          .then(() => setHidden(false))
          .catch(() => {
            setHidden(false);
            toast({
              title: "Could not save. Try again.",
              variant: "destructive",
            });
          });
      }}
    >
      <BannerTitle>
        {started ? `Finish setting up IA App · ${progress}` : "Set up IA App"}
      </BannerTitle>
      <BannerActions>
        <BannerAction
          variant="primary"
          onClick={(event) => openSetup(event.currentTarget)}
        >
          {started ? "Continue" : "Get started"}
        </BannerAction>
      </BannerActions>
    </Banner>
  );
}

export function Onboarding() {
  const user = useCurrentUser();
  const status = useSetupStatus();
  const start = useMutation(api.onboarding.setup.start);
  const decide = useMutation(api.onboarding.setup.decide);
  const finish = useMutation(api.onboarding.setup.finish);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState("");
  const opener = useRef<HTMLElement | null>(null);

  async function save(action: () => Promise<unknown>) {
    if (busy) return false;
    setBusy(true);
    setError("");
    try {
      await action();
      return true;
    } catch (cause) {
      setError(onboardingSaveError(cause));
      return false;
    } finally {
      setBusy(false);
    }
  }

  const begin = () => save(() => start());

  const show = useEffectEvent((event: Event) => {
    if (!status) return;
    opener.current = (event as CustomEvent<HTMLElement | null>).detail;
    setError("");
    setExpanded(status.steps.find((s) => s.state === "pending")?.id ?? "");
    setOpen(true);
    // Opening setup is the explicit choice to start or resume it.
    if (status.phase !== "active" && status.phase !== "completed")
      void begin();
  });

  useEffect(() => {
    const handler = (event: Event) => show(event);
    window.addEventListener(OPEN_SETUP, handler);
    return () => window.removeEventListener(OPEN_SETUP, handler);
  }, []);

  if (!user || !status) return null;
  const editable = status.phase === "active" || status.phase === "completed";
  const allResolved = status.resolved === status.total;

  async function resolve(step: OnboardingStepId, decision: OnboardingDecision) {
    if (!(await save(() => decide({ step, decision })))) return;
    const order = status!.steps.map((s) => s.id);
    const from = order.indexOf(step);
    const next = [...order.slice(from + 1), ...order.slice(0, from)].find(
      (id) => status!.steps.find((s) => s.id === id)?.state === "pending",
    );
    setExpanded(next ?? "");
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        setError("");
      }}
    >
      <DialogContent
        size="lg"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (opener.current?.isConnected) opener.current.focus();
          else document.querySelector("main")?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>Set up IA App</DialogTitle>
          <DialogDescription>
            {status.phase === "completed"
              ? allResolved
                ? "You’re all set. Your choices are saved."
                : "Setup is done. Review the new steps for your role when you’re ready."
              : "Skip anything you don’t need."}
          </DialogDescription>
        </DialogHeader>
        <OnboardingChecklist
          status={status}
          roles={user.roles}
          busy={busy || !editable}
          expanded={expanded}
          onExpandedChange={setExpanded}
          onNavigate={() => setOpen(false)}
          onDecide={resolve}
        />
        {error ? (
          <p role="alert" className="mt-4 break-words text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          {status.phase === "completed" ? (
            <Button onClick={() => setOpen(false)}>Done</Button>
          ) : editable ? (
            <>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Close
              </Button>
              <Button
                loading={busy}
                disabled={busy || !allResolved}
                onClick={async () => {
                  if (await save(() => finish())) setOpen(false);
                }}
              >
                Finish setup
              </Button>
            </>
          ) : (
            <Button loading={busy} disabled={busy} onClick={() => void begin()}>
              {error ? "Try again" : "Start setup"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function OnboardingChecklist({
  status,
  roles,
  busy,
  expanded,
  onExpandedChange,
  onNavigate,
  onDecide,
}: {
  status: Status;
  roles: readonly string[];
  busy: boolean;
  expanded: string;
  onExpandedChange: (step: string) => void;
  onNavigate: () => void;
  onDecide: (step: OnboardingStepId, decision: OnboardingDecision) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <p role="status" className="text-sm text-muted-foreground">
        {status.resolved} of {status.total} done
      </p>
      <Progress
        value={status.total ? (status.resolved / status.total) * 100 : 100}
        aria-label="Setup progress"
      />
      <AccordionGroup
        type="single"
        collapsible
        value={expanded}
        onValueChange={onExpandedChange}
        className="-mx-3"
      >
        {onboardingSteps(roles).map((step, index) => {
          const state =
            status.steps.find((item) => item.id === step.id)?.state ??
            "pending";
          return (
            <AccordionItem key={step.id} value={step.id} index={index}>
              <AccordionTrigger>
                {step.title}
                {state !== "pending" ? (
                  <span className="text-muted-foreground">
                    {state === "done" ? " · Done" : " · Skipped"}
                  </span>
                ) : null}
              </AccordionTrigger>
              <AccordionContent>
                <div className="flex flex-col gap-3">
                  <p>{step.description}</p>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="tertiary" asChild>
                      <Link href={step.web} onClick={onNavigate}>
                        {step.action}
                      </Link>
                    </Button>
                    {state === "pending" ? (
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
                          Skip
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </AccordionGroup>
    </div>
  );
}
