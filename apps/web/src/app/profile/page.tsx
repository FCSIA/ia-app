'use client';

import { useMounted } from '@/hooks/use-mounted';
import { hasAnyRole, isStaff, MODERATION_ALERT_ROLES, SCHEDULE_ROLES } from '~/apps/shared/roles';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery } from '@/lib/convex-react';
import { useTheme } from 'next-themes';
import { AppShell } from '@/components/layout/AppShell';
import { OnboardingEntry } from '@/components/onboarding/onboarding';
import { useToast } from '@/hooks/use-toast';
import { startLogout, useCurrentUser } from '@/lib/auth';
import { api } from '~/apps/convex/src/_generated/api';
import { NotificationSettingsPanel } from '@/components/notifications/notification-settings-panel';
import { useSeenRelease } from '@/components/devlog/use-seen-release';
import { MobileTabEditor } from '@/components/layout/mobile-tab-editor';
import { getMobileTabEditorItems, getSidebarEditorItems } from '@/components/layout/app-shell-navigation';
import { SidebarEditor } from '@/components/layout/sidebar-editor';
import { wrappedAvailability } from '~/apps/shared/wrapped-window';
import { Panel } from '@/components/layout/page-frame';
import { Button } from '@/components/ui/button';
import {
  AccountSettingsSection,
  AppearanceSection,
  ModerationAlertsSection,
  ProfileSidebar,
  WhatsNewSection,
} from './_components/ProfileSections';
import type { PasswordForm } from './_components/ProfileSections';
import { PROFILE_SECTIONS, type ProfileSection } from './_components/profile-sections';

const EMPTY_PASSWORD_FORM: PasswordForm = {
  currentPassword: '',
  newPassword: '',
  confirm: '',
};

export default function ProfilePage() {
  return <Suspense fallback={null}><ProfilePageContent /></Suspense>;
}

function ProfilePageContent() {
  const searchParams = useSearchParams();
  const requestedSection = searchParams?.get('section');
  const activeSection = PROFILE_SECTIONS.find(
    section => section.id === requestedSection,
  )?.id ?? 'account';
  function navigateToSection(section: ProfileSection) {
    const params = new URLSearchParams(searchParams?.toString());
    if (section === 'account') params.delete('section');
    else params.set('section', section);
    const query = params.toString();
    // Next's native history integration updates useSearchParams immediately
    // without a server navigation for a local settings-panel change.
    window.history.replaceState(null, '', query ? `/profile?${query}` : '/profile');
  }
  const user = useCurrentUser();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const showSchedule = hasAnyRole(user, SCHEDULE_ROLES);
  const navigationOptions = getMobileTabEditorItems({ pathname: '/profile', showAdmin: false, showSchedule, showWrapped: wrappedAvailability().open });
  const sidebarOptions = getSidebarEditorItems({
    pathname: '/profile',
    showAdmin: isStaff(user) || Boolean(user?.canReviewFeedback),
    showSchedule,
    showFriends: hasAnyRole(user, ["STUDENT"]),
    showWrapped: wrappedAvailability().open,
  });
  const [passwordForm, setPasswordForm] = useState<PasswordForm>(EMPTY_PASSWORD_FORM);
  const [changingPassword, setChangingPassword] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [savingTimeFormat, setSavingTimeFormat] = useState(false);
  const { unseenCount, markSeen } = useSeenRelease();

  const changePassword = useMutation(api.users.auth.changePassword);
  const updateTimeFormat = useMutation(api.users.me.updateTimeFormat);
  const moderationAlerts = (useQuery(api.notifications.inbox.list, { unreadOnly: true }) ?? [])
    .filter((row) => row.category === 'CONTENT_MODERATED')
    .slice(0, 5);

  // Reading the section is what marks the release as read.
  useEffect(() => {
    if (activeSection === 'whats-new') markSeen();
  }, [activeSection, markSeen]);

  const canSeeModeration =
    hasAnyRole(user, MODERATION_ALERT_ROLES) || moderationAlerts.length > 0;
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
          onSectionChange={navigateToSection}
          unseenReleases={unseenCount}
        />
        <div className="flex min-w-0 flex-col gap-5">
          <div><OnboardingEntry /></div>
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
              <div className="flex flex-col items-start gap-4">
                <p className="text-sm text-muted-foreground">Choose the order and which destinations appear in More. Desktop and mobile layouts are saved separately to your account.</p>
                <Button variant="tertiary" disabled={!user} onClick={() => setSidebarOpen(true)}>Desktop sidebar</Button>
                <Button variant="tertiary" disabled={!user} onClick={() => setNavigationOpen(true)}>Mobile bottom bar</Button>
              </div>
              <SidebarEditor open={sidebarOpen} onOpenChange={setSidebarOpen} options={sidebarOptions} savedLayout={user?.sidebarLayout} />
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
