'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { useTheme } from 'next-themes';
import { AppShell } from '@/components/layout/AppShell';
import { useToast } from '@/hooks/use-toast';
import { hasRole, startLogout, useCurrentUser } from '@/lib/auth';
import { api } from '~/apps/convex/src/_generated/api';
import type { NotificationCategory } from '~/apps/convex/src/validators';
import { PROFILE_NOTIFICATION_CATEGORIES } from './_constants';
import {
  AccountSettingsCard,
  AppearanceCard,
  ModerationAlertsCard,
  NotificationPreferencesCard,
  ProfileSidebar,
} from './_components/ProfileSections';
import type { PasswordForm, ProfileSection } from './_components/ProfileSections';

const EMPTY_PASSWORD_FORM: PasswordForm = {
  currentPassword: '',
  newPassword: '',
  confirm: '',
};

type PreferenceState = {
  enabled?: boolean;
  locked?: boolean;
};

export default function ProfilePage() {
  const user = useCurrentUser();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [passwordForm, setPasswordForm] = useState<PasswordForm>(EMPTY_PASSWORD_FORM);
  const [changingPassword, setChangingPassword] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [savingTimeFormat, setSavingTimeFormat] = useState(false);
  const [activeSection, setActiveSection] = useState<ProfileSection>('account');
  const [optimisticPrefs, setOptimisticPrefs] = useState<Record<string, PreferenceState>>({});

  const changePassword = useMutation(api.users.auth.changePassword);
  const updateTimeFormat = useMutation(api.users.me.updateTimeFormat);
  const upsertPreference = useMutation(api.notifications.preferences.upsert);
  const prefs = useQuery(api.notifications.preferences.list);
  const moderationAlerts = (useQuery(api.notifications.inbox.list, { unreadOnly: true }) ?? [])
    .filter((row) => row.category === 'CONTENT_MODERATED')
    .slice(0, 5);

  useEffect(() => setMounted(true), []);

  const canSeeModeration =
    hasRole(user, 'ADMIN', 'SUPER_ADMIN', 'TEACHER', 'STUDENT_ADMIN') || moderationAlerts.length > 0;
  const visibleSection =
    activeSection === 'moderation' && !canSeeModeration ? 'account' : activeSection;

  const visiblePreferenceCategories = useMemo(
    () =>
      PROFILE_NOTIFICATION_CATEGORIES.filter(
        (category) => !category.staffOnly || canSeeModeration,
      ),
    [canSeeModeration],
  );

  const storedPrefMap = useMemo(
    () => {
      const preferences = prefs ?? [];
      return Object.fromEntries(
        preferences.map((preference) => [
          `${preference.category}:${preference.scopeKey}`,
          { enabled: preference.enabled, locked: preference.locked },
        ]),
      ) as Record<string, PreferenceState | undefined>;
    },
    [prefs],
  );

  const prefMap = useMemo(
    () => ({ ...storedPrefMap, ...optimisticPrefs }),
    [optimisticPrefs, storedPrefMap],
  );

  useEffect(() => {
    setOptimisticPrefs((current) => {
      let changed = false;
      const next = { ...current };
      for (const [key, value] of Object.entries(current)) {
        if (storedPrefMap[key]?.enabled === value.enabled) {
          delete next[key];
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [storedPrefMap]);

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

  function handleSignOut() {
    setSigningOut(true);
    startLogout();
  }

  async function handleTimeFormatChange(use24HourTime: boolean) {
    if (savingTimeFormat) return;
    setSavingTimeFormat(true);
    try {
      await updateTimeFormat({ use24HourTime });
    } catch (error: unknown) {
      toast({
        title: error instanceof Error ? error.message : 'Failed to update time format',
        variant: 'destructive',
      });
    } finally {
      setSavingTimeFormat(false);
    }
  }

  function handlePreferenceToggle({
    category,
    enabled,
  }: {
    category: NotificationCategory;
    enabled: boolean;
  }) {
    const key = `${category}:global`;
    if (storedPrefMap[key]?.locked) return;
    setOptimisticPrefs((current) => ({ ...current, [key]: { enabled } }));
    void upsertPreference({ category, enabled, scopeKey: 'global' }).catch((error: unknown) => {
      setOptimisticPrefs((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      toast({
        title: error instanceof Error ? error.message : 'Failed to update notification preference',
        variant: 'destructive',
      });
    });
  }

  return (
    <AppShell>
      <div className="mx-auto grid w-full max-w-5xl gap-5 lg:grid-cols-[minmax(260px,340px)_minmax(0,1fr)] lg:items-start">
        <ProfileSidebar
          user={user}
          activeSection={visibleSection}
          canSeeModeration={canSeeModeration}
          onSectionChange={setActiveSection}
        />
        <div>
          {visibleSection === 'account' ? (
            <AccountSettingsCard
              user={user}
              changing={changingPassword}
              form={passwordForm}
              setForm={setPasswordForm}
              onStart={() => setChangingPassword(true)}
              onCancel={() => setChangingPassword(false)}
              onSubmit={(data) => void handleChangePassword(data)}
              onSignOut={() => void handleSignOut()}
              signingOut={signingOut}
            />
          ) : null}
          {visibleSection === 'notifications' ? (
            <NotificationPreferencesCard
              categories={visiblePreferenceCategories}
              loading={prefs === undefined}
              prefMap={prefMap}
              onToggle={handlePreferenceToggle}
            />
          ) : null}
          {visibleSection === 'appearance' && mounted ? (
            <AppearanceCard
              theme={theme}
              setTheme={setTheme}
              use24HourTime={user?.use24HourTime ?? false}
              savingTimeFormat={savingTimeFormat}
              onUse24HourTimeChange={(value) => void handleTimeFormatChange(value)}
            />
          ) : null}
          {visibleSection === 'moderation' && canSeeModeration ? (
            <ModerationAlertsCard alerts={moderationAlerts} />
          ) : null}
        </div>
      </div>
    </AppShell>
  );
}
