import { useEffect, useRef, useState } from "react";
import { DeviceEventEmitter, Keyboard, View } from "react-native";
import { router, usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery } from "@/lib/convex-react";
import { useLiveCurrentUser } from "@/lib/auth";
import { ChevronDown, ChevronUp } from "lucide-react-native";
import {
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Progress,
  Sheet,
  Txt,
} from "@/components/ui";
import { useTheme } from "@/lib/theme";
import { spacing } from "@/lib/tokens";
import { api } from "~/apps/convex/src/_generated/api";
import {
  onboardingSteps,
  onboardingSaveError,
  type OnboardingDecision,
  type OnboardingStepId,
} from "~/apps/shared/onboarding";

const OPEN_SETUP = "ia:open-setup";
export function OnboardingEntry() {
  return (
    <Button
      title="Set up IA App"
      variant="tertiary"
      onPress={() => DeviceEventEmitter.emit(OPEN_SETUP)}
    />
  );
}

export function Onboarding() {
  const user = useLiveCurrentUser();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const status = useQuery(
    api.onboarding.setup.get,
    user && !user.mustResetPassword ? {} : "skip",
  );
  const start = useMutation(api.onboarding.setup.start);
  const later = useMutation(api.onboarding.setup.later);
  const { color } = useTheme();
  const [expanded, setExpanded] = useState("");
  const decide = useMutation(api.onboarding.setup.decide);
  const finish = useMutation(api.onboarding.setup.finish);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [keyboard, setKeyboard] = useState(false);
  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener(OPEN_SETUP, () =>
      openRef.current(),
    );
    const show = Keyboard.addListener("keyboardDidShow", () =>
      setKeyboard(true),
    );
    const hide = Keyboard.addListener("keyboardDidHide", () =>
      setKeyboard(false),
    );
    return () => {
      subscription.remove();
      show.remove();
      hide.remove();
    };
  }, []);

  async function save(action: () => Promise<unknown>, close = false) {
    if (busy) return false;
    setBusy(true);
    setError("");
    try {
      await action();
      if (close) setOpen(false);
      return true;
    } catch (cause) {
      setError(onboardingSaveError(cause));
      return false;
    } finally {
      setBusy(false);
    }
  }

  function openSetup() {
    if (!status) return;
    setError("");
    setExpanded(status.steps.find((s) => s.state === "pending")?.id ?? "");
    setOpen(true);
    // Opening setup is the explicit choice to start or resume it.
    if (status.phase !== "active" && status.phase !== "completed")
      void save(() => start());
  }
  const openRef = useRef(openSetup);
  useEffect(() => {
    openRef.current = openSetup;
  });

  async function resolve(step: OnboardingStepId, decision: OnboardingDecision) {
    if (!status || !(await save(() => decide({ step, decision })))) return;
    const order = status.steps.map((s) => s.id);
    const from = order.indexOf(step);
    const next = [...order.slice(from + 1), ...order.slice(0, from)].find(
      (id) => status.steps.find((s) => s.id === id)?.state === "pending",
    );
    setExpanded(next ?? "");
  }
  if (
    !user ||
    user.mustResetPassword ||
    !status ||
    pathname === "/login" ||
    pathname === "/change-password"
  )
    return null;
  const visible = status.phase === "invited" || status.phase === "active";
  return (
    <>
      {visible && !keyboard && !pathname.includes("/channels/") ? (
        <View
          style={{
            position: "absolute",
            bottom: insets.bottom + 84,
            right: spacing.lg,
            width: 192,
            gap: spacing.sm,
          }}
        >
          <Button
            title={`Setup · ${status.resolved} / ${status.total} steps`}
            accessibilityLabel={`Set up IA App, ${status.resolved} of ${status.total} steps`}
            onPress={openSetup}
          />
          <View
            accessibilityRole="progressbar"
            accessibilityLabel="Setup progress"
            accessibilityValue={{
              min: 0,
              max: status.total,
              now: status.resolved,
            }}
          >
            <Progress value={(status.resolved / status.total) * 100} />
          </View>
        </View>
      ) : null}
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Set up IA App"
        scrollable
        snapPoints={["90%"]}
      >
        <View style={{ gap: spacing.lg }}>
          <Txt tone="muted">
            {status.phase === "completed"
              ? status.resolved === status.total
                ? "You’re all set. Your choices are saved."
                : "Setup is done. Review the new steps for your role when you’re ready."
              : "Skip anything you don’t need."}
          </Txt>
          <Txt accessibilityLiveRegion="polite">
            {status.resolved} of {status.total} done
          </Txt>
          <Progress
            value={status.total ? (status.resolved / status.total) * 100 : 100}
          />
          <View>
            {onboardingSteps(user.roles).map((step) => {
              const state =
                status.steps.find((item) => item.id === step.id)?.state ??
                "pending";
              const isOpen = expanded === step.id;
              const editable =
                status.phase === "active" || status.phase === "completed";
              return (
                <Collapsible
                  key={step.id}
                  open={isOpen}
                  onOpenChange={(next) => setExpanded(next ? step.id : "")}
                >
                  <CollapsibleTrigger style={{ gap: spacing.sm }}>
                    <Txt variant="label" style={{ flex: 1 }}>
                      {step.title}
                      {state !== "pending" ? (
                        <Txt variant="label" tone="muted">
                          {state === "done" ? " · Done" : " · Skipped"}
                        </Txt>
                      ) : null}
                    </Txt>
                    {isOpen ? (
                      <ChevronUp size={16} color={color("mutedForeground")} />
                    ) : (
                      <ChevronDown size={16} color={color("mutedForeground")} />
                    )}
                  </CollapsibleTrigger>
                  <CollapsibleContent
                    style={{ gap: spacing.sm, paddingBottom: spacing.md }}
                  >
                    <Txt tone="muted">{step.description}</Txt>
                    <Button
                      title={step.action}
                      variant="tertiary"
                      onPress={() => {
                        setOpen(false);
                        router.push(step.native);
                      }}
                    />
                    {state === "pending" ? (
                      <>
                        <Button
                          title={step.confirmation}
                          variant="secondary"
                          disabled={busy || !editable}
                          onPress={() => resolve(step.id, "done")}
                        />
                        <Button
                          title="Skip"
                          accessibilityLabel={`Skip ${step.title.toLowerCase()}`}
                          variant="ghost"
                          disabled={busy || !editable}
                          onPress={() => resolve(step.id, "skipped")}
                        />
                      </>
                    ) : null}
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </View>
          {error ? (
            <Txt tone="destructive" accessibilityRole="alert">
              {error}
            </Txt>
          ) : null}
          {status.phase === "active" ? (
            <Button
              title="Finish setup"
              loading={busy}
              disabled={busy || status.resolved !== status.total}
              onPress={() => save(() => finish(), true)}
            />
          ) : status.phase === "completed" ? (
            <Button title="Done" onPress={() => setOpen(false)} />
          ) : (
            <Button
              title={error ? "Try again" : "Start setup"}
              loading={busy}
              onPress={() => save(() => start())}
            />
          )}
          {status.phase !== "completed" ? (
            <Button
              title="Later"
              variant="ghost"
              disabled={busy}
              onPress={() => save(() => later(), true)}
            />
          ) : null}
        </View>
      </Sheet>
    </>
  );
}
