'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@/lib/convex-react';
import { useTheme } from 'next-themes';
import { AppShell } from '@/components/layout/AppShell';
import { useToast } from '@/hooks/use-toast';
import { hasRole, startLogout, useCurrentUser } from '@/lib/auth';
import { api } from '~/apps/convex/src/_generated/api';
import { NotificationSettingsPanel } from '@/components/notifications/notification-settings-panel';
import { useSeenRelease } from '@/components/devlog/use-seen-release';
import { MobileTabEditor } from '@/components/layout/mobile-tab-editor';
import { getMobileTabEditorItems } from '@/components/layout/app-shell-navigation';
import { computeWrappedAvailability } from '@/lib/wrapped';
import { Panel } from '@/components/layout/page-frame';
import { Button } from '@/components/ui/button';
import {
  AccountSettingsSection,
  AppearanceSection,
  ModerationAlertsSection,
  ProfileSidebar,
  WhatsNewSection,
} from './_components/ProfileSections';
import type { PasswordForm, ProfileSection } from './_components/ProfileSections';

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
  const [navigationOpen, setNavigationOpen] = useState(false);
  const showSchedule = Boolean(user && hasRole(user, 'STUDENT', 'ADMIN', 'SUPER_ADMIN'));
  const navigationOptions = getMobileTabEditorItems({ pathname: '/profile', showAdmin: false, showSchedule, showWrapped: computeWrappedAvailability().open });
  const [passwordForm, setPasswordForm] = useState<PasswordForm>(EMPTY_PASSWORD_FORM);
  const [changingPassword, setChangingPassword] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [savingTimeFormat, setSavingTimeFormat] = useState(false);
  const [activeSection, setActiveSection] = useState<ProfileSection>('account');
  const { unseenCount, markSeen } = useSeenRelease();

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('section') === 'whats-new') {
      setActiveSection('whats-new');
    }
  }, []);

  const changePassword = useMutation(api.users.auth.changePassword);
  const updateTimeFormat = useMutation(api.users.me.updateTimeFormat);
  const moderationAlerts = (useQuery(api.notifications.inbox.list, { unreadOnly: true }) ?? [])
    .filter((row) => row.category === 'CONTENT_MODERATED')
    .slice(0, 5);

  useEffect(() => setMounted(true), []);

  // Reading the section is what marks the release as read.
  useEffect(() => {
    if (activeSection === 'whats-new') markSeen();
  }, [activeSection, markSeen]);

  const canSeeModeration =
    hasRole(user, 'ADMIN', 'SUPER_ADMIN', 'TEACHER', 'STUDENT_ADMIN') || moderationAlerts.length > 0;
  const visibleSection =
    activeSection === 'moderation' && !canSeeModeration ? 'account' : activeSection;

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

  return (
    <AppShell>
      <div className="mx-auto grid w-full max-w-5xl gap-5 lg:grid-cols-[minmax(260px,340px)_minmax(0,1fr)] lg:items-start">
        <ProfileSidebar
          user={user}
          activeSection={visibleSection}
          canSeeModeration={canSeeModeration}
          onSectionChange={setActiveSection}
          unseenReleases={unseenCount}
        />
        <div className="min-w-0">
          {visibleSection === 'account' ? (
            <AccountSettingsSection
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
            <NotificationSettingsPanel />
          ) : null}
          {visibleSection === 'appearance' && mounted ? (
            <AppearanceSection
              theme={theme}
              setTheme={setTheme}
              use24HourTime={user?.use24HourTime ?? false}
              savingTimeFormat={savingTimeFormat}
              onUse24HourTimeChange={(value) => void handleTimeFormatChange(value)}
            />
          ) : null}
          {visibleSection === 'navigation' ? (
            <Panel title="Navigation">
              <p className="mb-4 text-sm text-muted-foreground">Choose the destinations in your mobile tab bar.</p>
              <Button variant="tertiary" onClick={() => setNavigationOpen(true)}>Edit tab bar</Button>
              <MobileTabEditor open={navigationOpen} onOpenChange={setNavigationOpen} options={navigationOptions} savedLayout={user?.mobileTabLayout} showSchedule={showSchedule} />
            </Panel>
          ) : null}
          {visibleSection === 'moderation' && canSeeModeration ? (
            <ModerationAlertsSection alerts={moderationAlerts} />
          ) : null}
          {visibleSection === 'whats-new' ? <WhatsNewSection /> : null}
        </div>
      </div>
    </AppShell>
  );
}
