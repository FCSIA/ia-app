'use client';

import { FormEvent, useState } from 'react';
import { useMutation } from '@/lib/convex-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { PasswordInput } from '@/components/ui/password-input';
import { api } from '~/apps/convex/src/_generated/api';
import { CARD_SURFACE_FOREGROUND } from '@/lib/surface-classes';

export default function ForcedPasswordChangePage() {
  const router = useRouter();
  const changePassword = useMutation(api.users.auth.changePassword);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      await changePassword({ currentPassword, newPassword });
      router.replace('/home');
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Password change failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-4">
      <form
        className={`flex w-full max-w-md flex-col gap-6 rounded-xl border bg-card p-6 shadow-sm ${CARD_SURFACE_FOREGROUND}`}
        onSubmit={submit}
      >
        <header className="flex flex-col gap-2">
          <h1 className="text-xl font-semibold text-foreground">Change your password</h1>
          <p className="text-sm text-muted-foreground">
            Your temporary password must be replaced before you can use the app.
          </p>
        </header>

        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="current-password">Temporary password</FieldLabel>
            <PasswordInput
              id="current-password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              required
            />
          </Field>
          <Field data-invalid={!!error}>
            <FieldLabel htmlFor="new-password">New password</FieldLabel>
            <PasswordInput
              id="new-password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              aria-invalid={!!error}
              minLength={6}
              required
            />
            <FieldDescription>Use at least 6 characters.</FieldDescription>
          </Field>
          <Field data-invalid={!!error}>
            <FieldLabel htmlFor="confirm-password">Confirm new password</FieldLabel>
            <PasswordInput
              id="confirm-password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              aria-invalid={!!error}
              minLength={6}
              required
            />
            <FieldError>{error}</FieldError>
          </Field>
        </FieldGroup>

        <Button type="submit" loading={submitting} disabled={submitting}>
          Save password
        </Button>
      </form>
    </main>
  );
}
