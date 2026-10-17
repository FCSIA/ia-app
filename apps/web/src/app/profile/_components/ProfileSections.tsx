'use client';

import { type Dispatch, type ReactNode, type SetStateAction, useEffect, useRef, useState } from 'react';
import {
  Bell,
  Lock,
  KeyRound,
  LogOut,
  Palette,
  ShieldAlert,
  User,
  type LucideIcon,
} from 'lucide-react';
import { z } from 'zod';
import { Badge } from '@/components/ui/badge';
import { DeveloperBadge } from '@/components/ui/developer-badge';
import { BugHunterTag } from '@/components/recognition/bug-hunter-tag';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DevlogList } from '@/components/devlog/devlog-list';
import { appVersionLabel } from '@/components/devlog/devlog-version-label';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { PasswordInput } from '@/components/ui/password-input';
import { RadioGroup, RadioItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useFoundersQuest, useRecordQuestKey } from '@/hooks/use-founders-quest';
import { useGifAutoplay } from '@/hooks/use-gif-autoplay';
import { useCurrentUser, type AppUser } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { CARD_SURFACE_FOREGROUND } from '@/lib/surface-classes';
import { createEasterEggTapMatcher } from '@/lib/phoenix-easter-egg';
import { CustomThemeEditor } from './CustomThemeEditor';
import { ProfileAvatarEditor } from './ProfileAvatarEditor';

const cardClass = cn(
  'border border-border bg-card pb-0',
  CARD_SURFACE_FOREGROUND,
);

const passwordFormSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required.'),
    newPassword: z.string().min(6, 'Your new password must be at least 6 characters long.'),
    confirm: z.string().min(1, 'Confirm your new password.'),
  })
  .refine((form) => form.newPassword === form.confirm, {
    message: 'Passwords do not match',
    path: ['confirm'],
  });

export type PasswordForm = z.infer<typeof passwordFormSchema>;

type ModerationAlert = {
  id: string;
  title: string;
  body: string;
};

type SettingsCardProps = {
  children?: ReactNode;
  contentClassName?: string;
  description?: string;
  icon?: LucideIcon;
  title: string;
};

export function SettingsCard({ children, contentClassName, description, icon: Icon, title }: SettingsCardProps) {
  return (
    <Card className={cardClass}>
      <CardHeader className="flex flex-row items-start justify-between gap-4 border-b border-border/70 px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          {Icon ? <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden /> : null}
          <div className="min-w-0">
            <CardTitle className="text-base font-semibold leading-tight">{title}</CardTitle>
            {description ? <CardDescription className="mt-1 text-xs leading-5 text-foreground/80">{description}</CardDescription> : null}
          </div>
        </div>
      </CardHeader>
      {children ? <CardContent className={cn('p-5', contentClassName)}>{children}</CardContent> : null}
    </Card>
  );
}

function friendlyRole(role: string) {
  return role
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function InfoRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value?: string | number | null;
  mono?: boolean;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] items-baseline gap-4 py-2.5">
      <dt className="min-w-0 text-sm font-medium text-foreground/80">{label}</dt>
      <dd
        className={cn(
          'min-w-0 break-words text-right text-sm font-medium text-foreground',
          mono && 'font-mono text-xs tracking-wide text-muted-foreground',
        )}
      >
        {value || '—'}
      </dd>
    </div>
  );
}

type ChangePasswordCardProps = {
  changing: boolean;
  form: PasswordForm;
  setForm: Dispatch<SetStateAction<PasswordForm>>;
  onStart: () => void;
  onCancel: () => void;
  onSubmit: (data: { currentPassword: string; newPassword: string }) => void;
};

export type ProfileSection =
  | 'account'
  | 'notifications'
  | 'appearance'
  | 'moderation'
  | 'whats-new';

const PROFILE_SECTIONS: Array<{
  id: ProfileSection;
  label: string;
  icon?: LucideIcon;
}> = [
  { id: 'account', label: 'Account', icon: User },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'moderation', label: 'Moderation', icon: ShieldAlert },
  { id: 'whats-new', label: "What's new" },
];

type ProfileSidebarProps = {
  activeSection: ProfileSection;
  canSeeModeration: boolean;
  onSectionChange: (section: ProfileSection) => void;
  unseenReleases: number;
  user: AppUser | null;
};

export function ProfileSidebar({
  activeSection,
  canSeeModeration,
  onSectionChange,
  unseenReleases,
  user,
}: ProfileSidebarProps) {
  const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Profile';
  const visibleSections = canSeeModeration
    ? PROFILE_SECTIONS
    : PROFILE_SECTIONS.filter((section) => section.id !== 'moderation');

  return (
    <Card className={cn(cardClass, 'lg:sticky lg:top-5')}>
      <CardHeader className="p-5">
        <div className="flex items-start gap-4">
          {user ? <ProfileAvatarEditor user={user} /> : null}
          <div className="min-w-0 flex-1 pt-0.5">
            <div className="flex min-w-0 items-center gap-1.5">
              <CardTitle className="min-w-0 truncate text-xl font-semibold leading-tight">
                {displayName}
              </CardTitle>
              <DeveloperBadge user={user} size={16} />
              <BugHunterTag user={user} />
            </div>
            {user?.roles?.length ? (
              <CardDescription className="mt-2 text-sm leading-5 text-foreground/80">
                {user.roles.map(friendlyRole).join(' · ')}
              </CardDescription>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-2">
        <nav aria-label="Profile settings" className="flex flex-col gap-1">
          {visibleSections.map(({ id, label, icon }) => {
            const unread = id === 'whats-new' ? unseenReleases : 0;

            return (
              <Button
                key={id}
                type="button"
                variant={activeSection === id ? 'secondary' : 'ghost'}
                size="md"
                leadingIcon={icon}
                className={cn(
                  'w-full justify-start',
                  activeSection === id ? 'text-foreground' : 'text-foreground/85 hover:text-foreground',
                )}
                aria-current={activeSection === id ? 'page' : undefined}
                // The count is decoration; keep it out of the accessible name
                // and say what it means instead.
                aria-label={unread > 0 ? `${label}, ${unread} unread` : undefined}
                onClick={() => onSectionChange(id)}
              >
                <span className="flex-1 text-left">{label}</span>
                {unread > 0 ? (
                  <Badge size="sm" color="blue" aria-hidden>
                    {unread}
                  </Badge>
                ) : null}
              </Button>
            );
          })}
        </nav>
      </CardContent>
    </Card>
  );
}

type AccountSettingsSectionProps = ChangePasswordCardProps & {
  onSignOut: () => void;
  signingOut: boolean;
  user: AppUser | null;
};

export function AccountSettingsSection({
  changing,
  form,
  onCancel,
  onSignOut,
  onStart,
  onSubmit,
  setForm,
  signingOut,
  user,
}: AccountSettingsSectionProps) {
  const rows = [
    ...(user?.roles?.includes('STUDENT')
      ? [
          { label: 'Grade', value: user?.gradeLevel || '—' },
          { label: 'Major Pathway', value: user?.major ? friendlyRole(user.major) : '—' },
          { label: 'Minor Pathway', value: user?.minor ? friendlyRole(user.minor) : '—' },
        ]
      : []),
  ];
  const { toast } = useToast();
  const canSubmitPassword =
    form.currentPassword.length > 0 && form.newPassword.length > 0 && form.confirm.length > 0;

  function handlePasswordSubmit() {
    const result = passwordFormSchema.safeParse(form);
    if (!result.success) {
      toast({
        title: result.error.issues[0]?.message ?? 'Check your password details.',
        variant: 'destructive',
      });
      return;
    }

    onSubmit({
      currentPassword: result.data.currentPassword,
      newPassword: result.data.newPassword,
    });
  }

  return (
    <section aria-label="Account" className="flex min-w-0 flex-col gap-6">
      {rows.length > 0 ? (
        <dl className="divide-y divide-border/30">
          {rows.map((row) => <InfoRow key={row.label} {...row} />)}
        </dl>
      ) : null}
      <section aria-labelledby="password-heading">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Lock className="size-3.5 text-foreground/70" aria-hidden />
              <h2 id="password-heading" className="text-sm font-semibold">
                Password
              </h2>
            </div>
          </div>
          {!changing ? (
            <Button variant="tertiary" size="sm" onClick={onStart}>
              Change
            </Button>
          ) : null}
        </div>
        {changing ? (
          <form
            action={() => {
              handlePasswordSubmit();
            }}
            className="mt-4"
          >
            <FieldGroup className="gap-4">
              <Field>
                <FieldLabel htmlFor="current-password">Current password</FieldLabel>
                <PasswordInput
                  id="current-password"
                  autoComplete="current-password"
                  value={form.currentPassword}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, currentPassword: event.target.value }))
                  }
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="new-password">New password</FieldLabel>
                <PasswordInput
                  id="new-password"
                  autoComplete="new-password"
                  value={form.newPassword}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, newPassword: event.target.value }))
                  }
                  minLength={6}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="confirm-password">Confirm new password</FieldLabel>
                <PasswordInput
                  id="confirm-password"
                  autoComplete="new-password"
                  value={form.confirm}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, confirm: event.target.value }))
                  }
                  minLength={6}
                  required
                />
              </Field>
            </FieldGroup>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button type="submit" disabled={!canSubmitPassword}>
                Update password
              </Button>
              <Button type="button" variant="ghost" onClick={onCancel}>
                Cancel
              </Button>
            </div>
          </form>
        ) : null}
      </section>
      <div className="border-t border-border/30 pt-4">
        <Button
          type="button"
          variant="tertiary"
          leadingIcon={LogOut}
          loading={signingOut}
          disabled={signingOut}
          className="shrink-0 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={onSignOut}
        >
          Sign out
        </Button>
      </div>
    </section>
  );
}

type AppearanceSectionProps = {
  theme: string | undefined;
  setTheme: (theme: string) => void;
  use24HourTime: boolean;
  savingTimeFormat: boolean;
  onUse24HourTimeChange: (use24HourTime: boolean) => void;
};

const APPEARANCE_OPTIONS = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'system', label: 'System' },
  { id: 'high-contrast', label: 'Contrast' },
  { id: 'bubblegum', label: 'Bubblegum' },
  { id: 'bubblegum-dark', label: 'Bubblegum Dark' },
  { id: 'custom', label: 'Custom' },
] as const;

export function AppearanceSection({
  theme,
  setTheme,
  use24HourTime,
  savingTimeFormat,
  onUse24HourTimeChange,
}: AppearanceSectionProps) {
  const { autoplay, setAutoplay } = useGifAutoplay();
  const { toast } = useToast();
  return (
    <section aria-label="Appearance" className="flex min-w-0 flex-col gap-5">
      <RadioGroup
        aria-label="Theme"
        value={theme ?? 'system'}
        onValueChange={setTheme}
        className="w-full"
      >
        {APPEARANCE_OPTIONS.map(({ id, label }, index) => (
          <RadioItem
            key={id}
            index={index}
            label={label}
            value={id}
          />
        ))}
      </RadioGroup>

      {theme === 'custom' ? <CustomThemeEditor /> : null}

      <div className="flex items-center justify-between gap-4 border-t border-border/30 pt-4">
        <div>
          <p className="text-sm font-medium text-foreground">Autoplay GIFs</p>
          <p className="text-xs text-muted-foreground">Start GIFs automatically in this browser. Reduced motion starts them paused.</p>
        </div>
        <Switch checked={autoplay} aria-label="Autoplay GIFs" onCheckedChange={(next) => {
          try { setAutoplay(next); } catch { toast({ title: 'Could not save playback preference', variant: 'destructive' }); }
        }} />
      </div>

      <div className="flex items-center justify-between gap-4 border-t border-border/30 pt-4">
        <div>
          <p className="text-sm font-medium text-foreground">Use 24-hour time</p>
          <p className="text-xs text-muted-foreground">Show times like 13:45 instead of 1:45 PM.</p>
        </div>
        <Switch
          checked={use24HourTime}
          disabled={savingTimeFormat}
          onCheckedChange={onUse24HourTimeChange}
          aria-label="Use 24-hour time"
        />
      </div>
    </section>
  );
}

export function WhatsNewSection() {
  const user = useCurrentUser();
  const { progress } = useFoundersQuest();
  const { toast } = useToast();
  const recordQuestKey = useRecordQuestKey();
  const versionTapMatcher = useRef(createEasterEggTapMatcher());
  const tapCount = useRef(0);
  const lastTapAt = useRef(0);
  const [seal, setSeal] = useState<'hidden' | 'revealed' | 'claimed'>('hidden');
  const [savingSeal, setSavingSeal] = useState(false);
  const copperFound = progress?.keys.includes('copper') ?? false;

  useEffect(() => {
    if (seal === 'hidden') return;
    const timer = window.setTimeout(() => setSeal('hidden'), seal === 'claimed' ? 5_000 : 15_000);
    return () => window.clearTimeout(timer);
  }, [seal]);

  async function claimCopper() {
    if (savingSeal || copperFound) return;
    setSavingSeal(true);
    const saved = await recordQuestKey('copper');
    setSavingSeal(false);
    if (saved) {
      setSeal('claimed');
      toast({ title: 'Copper Key found: 1 of 3', description: 'Your next clue is on your profile.', duration: 5_000 });
    }
  }

  return (
    <section aria-label="What's new" className="flex min-w-0 flex-col gap-5">
      <DevlogList />
      <div className="border-t border-border/30 pt-4">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="font-mono tracking-wide"
          aria-label={`App version ${appVersionLabel()}`}
          onClick={() => {
            if (!user?.roles.includes('STUDENT') || copperFound || seal !== 'hidden') return;
            const now = Date.now();
            tapCount.current = now - lastTapAt.current > 1500 ? 1 : tapCount.current + 1;
            lastTapAt.current = now;
            if (tapCount.current === 2) toast({ title: '3 more…', duration: 1_600 });
            if (versionTapMatcher.current(now)) {
              tapCount.current = 0;
              setSeal('revealed');
              toast({ title: 'A copper seal appeared', description: 'It will fade soon. Open it while it is here.', duration: 3_000 });
            }
          }}
        >
          {appVersionLabel()}
        </Button>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          {user?.roles.includes('STUDENT') && !copperFound
            ? 'Every story leaves a mark in its version history.'
            : 'Include this version when you report a problem so we know which build you were on.'}
        </p>
        {seal === 'revealed' && !copperFound ? (
          <Button type="button" size="sm" variant="secondary" leadingIcon={KeyRound} className="mt-3" loading={savingSeal} onClick={() => void claimCopper()}>
            Open the copper seal
          </Button>
        ) : null}
        {seal === 'claimed' ? <p className="mt-3 text-sm text-primary" role="status">Copper Key saved. The seal is fading, but your key is yours.</p> : null}
      </div>
    </section>
  );
}

export function ModerationAlertsSection({ alerts }: { alerts: ModerationAlert[] }) {
  return (
    <section aria-label="Moderation">
      {alerts.length === 0 ? (
        <p className="text-sm text-muted-foreground">No recent flagged content notices.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {alerts.map((alert) => (
            <div key={alert.id} className="border-b border-border/30 py-2.5 last:border-0">
              <p className="text-sm font-medium">{alert.title}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{alert.body}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
