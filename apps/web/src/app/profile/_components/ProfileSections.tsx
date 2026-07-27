'use client';

import type { Dispatch, ReactNode, SetStateAction } from 'react';
import {
  Bell,
  Lock,
  LockKeyhole,
  Palette,
  ShieldAlert,
  User,
  type LucideIcon,
} from 'lucide-react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { NotificationCategoryOption } from '@/components/notifications/notification-category-options';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import type { AppUser } from '@/lib/auth';
import { cn } from '@/lib/utils';
import type { NotificationCategory } from '~/apps/convex/src/validators';
import { CustomThemeEditor } from './CustomThemeEditor';
import { ProfileAvatarEditor } from './ProfileAvatarEditor';

const cardClass = 'overflow-hidden rounded-2xl border-border/70 bg-card/95 shadow-sm';
const headerClass = 'flex flex-row items-start justify-between gap-4 border-b border-border/70 px-5 py-4';
const contentClass = 'p-5';

const passwordFormSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required.'),
    newPassword: z.string().min(8, 'Your new password must be at least 8 characters long.'),
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
  icon: LucideIcon;
  title: string;
};

function SettingsCard({
  children,
  contentClassName,
  description,
  icon: Icon,
  title,
}: SettingsCardProps) {
  return (
    <Card className={cardClass}>
      <CardHeader className={headerClass}>
        <div className="flex min-w-0 items-center gap-3">
          <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <div className="min-w-0">
            <CardTitle className="text-base font-semibold leading-tight">{title}</CardTitle>
            {description ? (
              <CardDescription className="mt-1 text-xs leading-5">{description}</CardDescription>
            ) : null}
          </div>
        </div>
      </CardHeader>
      {children ? (
        <CardContent className={cn(contentClass, contentClassName)}>{children}</CardContent>
      ) : null}
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
    <div className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] items-baseline gap-4 py-3 last:pb-5">
      <span className="min-w-0 text-sm text-muted-foreground">{label}</span>
      <span
        className={cn(
          'truncate text-right text-sm font-medium text-foreground',
          mono && 'font-mono text-xs tracking-wide text-muted-foreground',
        )}
      >
        {value || '—'}
      </span>
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

export type ProfileSection = 'account' | 'notifications' | 'appearance' | 'moderation';

const PROFILE_SECTIONS: Array<{
  id: ProfileSection;
  label: string;
  icon: LucideIcon;
}> = [
  { id: 'account', label: 'Account', icon: User },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'moderation', label: 'Moderation', icon: ShieldAlert },
];

type ProfileSidebarProps = {
  activeSection: ProfileSection;
  canSeeModeration: boolean;
  onSectionChange: (section: ProfileSection) => void;
  user: AppUser | null;
};

export function ProfileSidebar({
  activeSection,
  canSeeModeration,
  onSectionChange,
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
            <CardTitle className="truncate text-xl font-semibold leading-tight">
              {displayName}
            </CardTitle>
            {user?.roles?.length ? (
              <CardDescription className="mt-2 text-sm leading-5">
                {user.roles.map(friendlyRole).join(' · ')}
              </CardDescription>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <Separator />
      <CardContent className="p-2">
        <nav aria-label="Profile settings" className="flex flex-col gap-1">
          {visibleSections.map(({ id, label, icon }) => (
            <Button
              key={id}
              type="button"
              variant={activeSection === id ? 'secondary' : 'ghost'}
              size="md"
              leadingIcon={icon}
              className="w-full justify-start"
              aria-current={activeSection === id ? 'page' : undefined}
              onClick={() => onSectionChange(id)}
            >
              {label}
            </Button>
          ))}
        </nav>
      </CardContent>
    </Card>
  );
}

type AccountSettingsCardProps = ChangePasswordCardProps & {
  user: AppUser | null;
};

export function AccountSettingsCard({
  changing,
  form,
  onCancel,
  onStart,
  onSubmit,
  setForm,
  user,
}: AccountSettingsCardProps) {
  const rows = [
    { label: 'Student / Staff ID', value: user?.uniqueId, mono: true },
    ...(user?.roles?.includes('STUDENT')
      ? [
          { label: 'Grade', value: user?.gradeLevel || '—' },
          { label: 'Major Pathway', value: user?.major ? user.major.replace(/_/g, ' ') : '—' },
          { label: 'Minor Pathway', value: user?.minor ? user.minor.replace(/_/g, ' ') : '—' },
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
    <SettingsCard
      icon={User}
      title="Account"
      description="Your school profile and sign-in credentials."
      contentClassName="p-0"
    >
      <section className="px-5 pt-4" aria-labelledby="account-details-heading">
        <div className="flex items-center gap-2">
          <User className="size-3.5 text-muted-foreground" aria-hidden />
          <h2
            id="account-details-heading"
            className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            Account details
          </h2>
        </div>
        <div className="mt-1">
          {rows.map((row) => (
            <InfoRow key={row.label} {...row} />
          ))}
        </div>
      </section>
      <Separator />
      <section className="p-5" aria-labelledby="password-heading">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Lock className="size-3.5 text-muted-foreground" aria-hidden />
              <h2 id="password-heading" className="text-sm font-semibold">
                Password
              </h2>
            </div>
            {!changing ? (
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Update your sign-in credentials.
              </p>
            ) : null}
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
                <Input
                  id="current-password"
                  type="password"
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
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={form.newPassword}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, newPassword: event.target.value }))
                  }
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="confirm-password">Confirm new password</FieldLabel>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={form.confirm}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, confirm: event.target.value }))
                  }
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
    </SettingsCard>
  );
}

type NotificationPreferencesCardProps = {
  categories: NotificationCategoryOption[];
  loading?: boolean;
  prefMap: Record<string, { enabled?: boolean; locked?: boolean } | undefined>;
  onToggle: (args: { category: NotificationCategory; enabled: boolean }) => void;
};

export function NotificationPreferencesCard({
  categories,
  loading = false,
  prefMap,
  onToggle,
}: NotificationPreferencesCardProps) {
  return (
    <SettingsCard
      icon={Bell}
      title="Notification Preferences"
      description="Choose which personal notification types stay active."
      contentClassName="p-0"
    >
      {categories.map(({ key, label, description, defaultEnabled }) => {
        const preference = prefMap[`${key}:global`];
        const enabled = preference ? preference.enabled !== false : defaultEnabled;
        const locked = preference?.locked === true;
        const disabled = loading || locked;
        return (
          <div
            key={key}
            className={cn(
              'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-border/60 px-5 py-4',
              disabled && 'opacity-65',
            )}
          >
            <div className="min-w-0">
              <Label
                htmlFor={`pref-${key}`}
                className={cn('text-sm font-medium', disabled ? 'cursor-not-allowed' : 'cursor-pointer')}
              >
                {label}
                {locked ? (
                  <span className="ml-2 inline-flex items-center gap-1 text-[11px] font-normal text-muted-foreground">
                    <LockKeyhole className="size-3" aria-hidden />
                    Required
                  </span>
                ) : null}
              </Label>
              <p
                id={`pref-${key}-description`}
                className="mt-1 max-w-prose text-xs leading-5 text-muted-foreground"
              >
                {description}
              </p>
            </div>
            <Switch
              label=""
              id={`pref-${key}`}
              aria-describedby={`pref-${key}-description`}
              checked={enabled}
              disabled={disabled}
              onCheckedChange={(nextEnabled) =>
                onToggle({ category: key, enabled: nextEnabled })
              }
            />
          </div>
        );
      })}
      <p className="px-5 py-3 text-xs leading-5 text-muted-foreground">
        Admin broadcasts always notify you regardless of these preferences.
      </p>
    </SettingsCard>
  );
}

type AppearanceCardProps = {
  theme: string | undefined;
  setTheme: (theme: string) => void;
};

const APPEARANCE_OPTIONS = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'system', label: 'System' },
  { id: 'high-contrast', label: 'Contrast' },
  { id: 'bubblegum', label: 'Bubblegum' },
  { id: 'custom', label: 'Custom' },
] as const;

export function AppearanceCard({ theme, setTheme }: AppearanceCardProps) {
  return (
    <SettingsCard
      icon={Palette}
      title="Appearance"
      description="Set the interface theme for this browser."
      contentClassName="flex flex-col gap-3"
    >
      <RadioGroup
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
    </SettingsCard>
  );
}

export function ModerationAlertsCard({ alerts }: { alerts: ModerationAlert[] }) {
  return (
    <SettingsCard
      icon={ShieldAlert}
      title="Moderation Alerts"
      description="Recent notices that may need staff review."
    >
      {alerts.length === 0 ? (
        <p className="text-sm text-muted-foreground">No recent flagged content notices.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {alerts.map((alert) => (
            <div key={alert.id} className="border-b border-border/60 py-2.5 last:border-0">
              <p className="text-sm font-medium">{alert.title}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{alert.body}</p>
            </div>
          ))}
        </div>
      )}
    </SettingsCard>
  );
}
