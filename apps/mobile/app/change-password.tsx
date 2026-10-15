import { useState } from "react";
import { router } from "expo-router";
import { useMutation } from "@/lib/convex-react";
import { FormScreen } from "@/components/screen";
import { Button, Field, TextField, Txt } from "@/components/ui";
import { api } from "~/apps/convex/src/_generated/api";

export default function ForcedPasswordChangeScreen() {
  const changePassword = useMutation(api.users.auth.changePassword);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }

    setPending(true);
    try {
      await changePassword({ currentPassword, newPassword });
      router.replace("/dashboard" as never);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Password change failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <FormScreen title="Change your password">
      <Txt variant="body" tone="muted">
        Replace your temporary password before using the app.
      </Txt>
      <Field.Root>
        <Field.Label required>Temporary password</Field.Label>
        <TextField
          value={currentPassword}
          onChangeText={setCurrentPassword}
          secureTextEntry
          autoComplete="current-password"
          accessibilityLabel="Temporary password"
        />
      </Field.Root>
      <Field.Root>
        <Field.Label required>New password</Field.Label>
        <TextField
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
          autoComplete="new-password"
          accessibilityLabel="New password"
        />
        <Field.Description>Use at least 6 characters.</Field.Description>
      </Field.Root>
      <Field.Root>
        <Field.Label required>Confirm new password</Field.Label>
        <TextField
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          autoComplete="new-password"
          accessibilityLabel="Confirm new password"
        />
        {error ? <Field.Error>{error}</Field.Error> : null}
      </Field.Root>
      <Button
        title="Save password"
        loading={pending}
        disabled={pending}
        onPress={() => void submit()}
      />
    </FormScreen>
  );
}
