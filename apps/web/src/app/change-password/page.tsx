'use client';

import { FormEvent, useState } from 'react';
import { useMutation } from 'convex/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { api } from '~/apps/convex/src/_generated/api';

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

    if (newPassword.length < 12) {
      setError('New password must be at least 12 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      await changePassword({ currentPassword, newPassword });
      router.replace('/dashboard');
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
        className="flex w-full max-w-md flex-col gap-6 rounded-xl border bg-card p-6 shadow-sm"
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
            <Input
              id="current-password"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              required
            />
          </Field>
          <Field data-invalid={!!error}>
            <FieldLabel htmlFor="new-password">New password</FieldLabel>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              aria-invalid={!!error}
              minLength={12}
              required
            />
            <FieldDescription>Use at least 12 characters.</FieldDescription>
          </Field>
          <Field data-invalid={!!error}>
            <FieldLabel htmlFor="confirm-password">Confirm new password</FieldLabel>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              aria-invalid={!!error}
              minLength={12}
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
