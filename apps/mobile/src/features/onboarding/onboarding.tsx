import { useEffect, useState } from "react";
import { DeviceEventEmitter, Keyboard, View } from "react-native";
import { router, usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery } from "@/lib/convex-react";
import { useLiveCurrentUser } from "@/lib/auth";
import { Button, Progress, Sheet, Txt } from "@/components/ui";
import { spacing } from "@/lib/tokens";
import { api } from "~/apps/convex/src/_generated/api";
import { onboardingSteps, onboardingSaveError } from "~/apps/shared/onboarding";

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
  const decide = useMutation(api.onboarding.setup.decide);
  const finish = useMutation(api.onboarding.setup.finish);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [keyboard, setKeyboard] = useState(false);
  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener(OPEN_SETUP, () => {
      setError("");
      setOpen(true);
    });
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
            onPress={() => {
              setError("");
              setOpen(true);
            }}
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
              ? "You’re all set. Your choices are saved."
              : "Make IA App useful for your school day. Skip anything you don’t need."}
          </Txt>
          {status.phase === "active" || status.phase === "completed" ? (
            <>
              <Txt accessibilityLiveRegion="polite">
                {status.resolved} / {status.total} steps resolved
              </Txt>
              <Progress value={(status.resolved / status.total) * 100} />
              {onboardingSteps(user.roles).map((step, index) => {
                const state =
                  status.steps.find((item) => item.id === step.id)?.state ??
                  "pending";
                return (
                  <View key={step.id} style={{ gap: spacing.sm }}>
                    <Txt variant="section">
                      {index + 1}. {step.title}
                    </Txt>
                    <Txt variant="caption" tone="muted">
                      {state === "done"
                        ? "Complete"
                        : state === "skipped"
                          ? "Skipped"
                          : "To do"}
                    </Txt>
                    <Txt tone="muted">{step.description}</Txt>
                    <Button
                      title={step.action}
                      variant="tertiary"
                      onPress={() => {
                        setOpen(false);
                        router.push(step.native as never);
                      }}
                    />
                    {status.phase === "active" && state === "pending" ? (
                      <>
                        <Button
                          title={step.confirmation}
                          variant="secondary"
                          disabled={busy}
                          onPress={() =>
                            save(() =>
                              decide({ step: step.id, decision: "done" }),
                            )
                          }
                        />
                        <Button
                          title="Skip for now"
                          accessibilityLabel={`Skip ${step.title.toLowerCase()}`}
                          variant="ghost"
                          disabled={busy}
                          onPress={() =>
                            save(() =>
                              decide({ step: step.id, decision: "skipped" }),
                            )
                          }
                        />
                      </>
                    ) : null}
                  </View>
                );
              })}
            </>
          ) : (
            <Txt>
              Your progress follows your account. Later hides the reminder until
              you return to Set up IA App in Profile.
            </Txt>
          )}
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
              title={
                status.phase === "deferred" ? "Resume setup" : "Get started"
              }
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
