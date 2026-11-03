'use client';

import { useState } from 'react';
import { useMutation } from '@/lib/convex-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import type { AppUser } from '@/lib/auth';
import { api } from '~/apps/convex/src/_generated/api';
import { MAX_PREFERRED_NAME_LENGTH } from '~/apps/shared/user-name';

export function PreferredNameSettings({ user }: { user: AppUser }) {
  const [value, setValue] = useState(user.preferredName ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const update = useMutation(api.users.me.updatePreferredName);
  const { toast } = useToast();

  async function save() {
    if (saving) return;
    setSaving(true);
    setError(undefined);
    try {
      const updated = await update({ preferredName: value });
      setValue(updated.preferredName ?? '');
      toast({ title: updated.preferredName ? 'Preferred name saved' : 'Using your regular name' });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save preferred name.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={(event) => { event.preventDefault(); void save(); }} className="flex flex-col gap-3">
      <div className="space-y-1.5">
        <Label htmlFor="preferred-name">Preferred name (optional)</Label>
        <Input
          id="preferred-name"
          value={value}
          onChange={(event) => { setValue(event.target.value); setError(undefined); }}
          maxLength={MAX_PREFERRED_NAME_LENGTH}
          autoComplete="nickname"
          aria-describedby={error ? 'preferred-name-description preferred-name-error' : 'preferred-name-description'}
          aria-invalid={!!error}
          disabled={saving}
        />
        {error && <p id="preferred-name-error" className="text-xs text-destructive">{error}</p>}
      </div>
      <p id="preferred-name-description" className="text-xs leading-5 text-muted-foreground">
        Shown throughout the app, including chats. Leave blank to use your regular name. People can find you by either name.
      </p>
      <Button type="submit" size="sm" loading={saving} disabled={value === (user.preferredName ?? '')} className="self-start">
        Save name
      </Button>
    </form>
  );
}
