'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { useTheme } from 'next-themes';
import { AppShell } from '@/components/layout/AppShell';
import { useToast } from '@/hooks/use-toast';
import { useCurrentUser } from '@/lib/auth';
import { api } from '~/apps/convex/src/_generated/api';
import type { NotificationCategory } from '~/apps/convex/src/validators';
import { PROFILE_NOTIFICATION_CATEGORIES } from './_constants';
import {
  AccountInfoCard,
  AppearanceCard,
  ChangePasswordCard,
  ModerationAlertsCard,
  NotificationPreferencesCard,
  ProfileSummaryCard,
} from './_components/ProfileSections';
import type { PasswordForm } from './_components/ProfileSections';

const EMPTY_PASSWORD_FORM: PasswordForm = {
  currentPassword: '',
  newPassword: '',
  confirm: '',
};

export default function ProfilePage() {
  const user = useCurrentUser();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [passwordForm, setPasswordForm] = useState<PasswordForm>(EMPTY_PASSWORD_FORM);
  const [changingPassword, setChangingPassword] = useState(false);

  const changePassword = useMutation(api.users.auth.changePassword);
  const upsertPreference = useMutation(api.notifications.preferences.upsert);
  const prefs = useQuery(api.notifications.preferences.list) ?? [];
  const moderationAlerts = (useQuery(api.notifications.inbox.list, { unreadOnly: true }) ?? [])
    .filter((row) => row.category === 'CONTENT_MODERATED')
    .slice(0, 5);

  useEffect(() => setMounted(true), []);

  const prefMap = useMemo(
    () =>
      Object.fromEntries(
        prefs.map((preference) => [
          `${preference.category}:${preference.clubId || 'null'}`,
          preference.enabled,
        ]),
      ) as Record<string, boolean | undefined>,
    [prefs],
  );

  async function handleChangePassword(data: {
    currentPassword: string;
    newPassword: string;
  }) {
    try {
      await changePassword(data);
      toast({ title: 'Password changed' });
      setChangingPassword(false);
      setPasswordForm(EMPTY_PASSWORD_FORM);
    } catch (error: unknown) {
      toast({
        title: error instanceof Error ? error.message : 'Failed to change password',
        variant: 'destructive',
      });
    }
  }

  function handlePreferenceToggle({
    category,
    enabled,
  }: {
    category: NotificationCategory;
    enabled: boolean;
  }) {
    void upsertPreference({ category, enabled });
  }

  return (
    <AppShell>
      <div className="max-w-xl mx-auto space-y-5">
        <ProfileSummaryCard user={user} />
        <AccountInfoCard user={user} />
        <ChangePasswordCard
          changing={changingPassword}
          form={passwordForm}
          setForm={setPasswordForm}
          onStart={() => setChangingPassword(true)}
          onCancel={() => setChangingPassword(false)}
          onSubmit={(data) => void handleChangePassword(data)}
        />
        <NotificationPreferencesCard
          categories={PROFILE_NOTIFICATION_CATEGORIES}
          prefMap={prefMap}
          onToggle={handlePreferenceToggle}
        />
        {mounted ? <AppearanceCard theme={theme} setTheme={setTheme} /> : null}
        <ModerationAlertsCard alerts={moderationAlerts} />
      </div>
    </AppShell>
  );
}
