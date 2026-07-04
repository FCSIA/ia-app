'use client';

import type { Dispatch, SetStateAction } from 'react';
import {
  Bell,
  Contrast,
  Heart,
  Image as ImageIcon,
  Lock,
  Monitor,
  Moon,
  Palette,
  Sun,
  User,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import type { AppUser } from '@/lib/auth';
import { cn } from '@/lib/utils';
import type { NotificationCategory } from '~/apps/convex/src/validators';
import { CustomThemeEditor } from './CustomThemeEditor';
import { ProfileAvatarEditor } from './ProfileAvatarEditor';

export type PasswordForm = {
  currentPassword: string;
  newPassword: string;
  confirm: string;
};

type NotificationCategoryOption = {
  key: NotificationCategory;
  label: string;
};

type ModerationAlert = {
  id: string;
  title: string;
  body: string;
};

export function ProfileSummaryCard({ user }: { user: AppUser | null }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-5 p-6">
        {user ? <ProfileAvatarEditor user={user} /> : null}
        <div>
          <h1 className="text-xl font-bold text-foreground">
            {user?.firstName} {user?.lastName}
          </h1>
          <p className="text-muted-foreground text-sm font-mono mt-0.5">{user?.uniqueId}</p>
          <div className="flex flex-wrap gap-1 mt-2">
            {user?.roles?.map((role: string) => (
              <Badge key={role} variant="solid" className="text-[10px]">
                {role.replace(/_/g, ' ')}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function AccountInfoCard({ user }: { user: AppUser | null }) {
  const rows = [
    { label: 'Student / Staff ID', value: user?.uniqueId, mono: true },
    ...(user?.roles?.includes('STUDENT')
      ? [
          { label: 'Grade', value: user?.gradeLevel || '\u2014' },
          {
            label: 'Major Pathway',
            value: user?.major ? user.major.replace(/_/g, ' ') : '\u2014',
          },
          {
            label: 'Minor Pathway',
            value: user?.minor ? user.minor.replace(/_/g, ' ') : '\u2014',
          },
        ]
      : []),
  ];

  return (
    <Card>
      <CardHeader className="pb-3 border-b border-foreground/[0.07]">
        <div className="flex items-center gap-2">
          <User size={16} className="text-accent-500" />
          <CardTitle className="text-base font-semibold">Account Info</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {rows.map(({ label, value, mono }) => (
          <div
            key={label}
            className="flex justify-between items-center py-3 border-b border-foreground/[0.06] last:border-0"
          >
            <span className="text-sm text-muted-foreground">{label}</span>
            <span
              className={`text-sm ${
                mono
                  ? 'font-mono text-accent-500 dark:text-accent-400 font-medium'
                  : 'text-foreground'
              }`}
            >
              {value}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
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

export function ChangePasswordCard({
  changing,
  form,
  setForm,
  onStart,
  onCancel,
  onSubmit,
}: ChangePasswordCardProps) {
  const { toast } = useToast();
  const canSubmitPassword =
    form.currentPassword.length > 0 && form.newPassword.length > 0 && form.confirm.length > 0;

  function handlePasswordSubmit() {
    if (form.newPassword.length < 8) {
      toast({
        title: 'Your new password must be at least 8 characters long.',
        variant: 'destructive',
      });
      return;
    }
    if (form.newPassword !== form.confirm) {
      toast({ title: 'Passwords do not match', variant: 'destructive' });
      return;
    }
    onSubmit({
      currentPassword: form.currentPassword,
      newPassword: form.newPassword,
    });
  }

  return (
    <Card>
      <CardHeader className="pb-3 border-b border-foreground/[0.07]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock size={16} className="text-accent-500" />
            <CardTitle className="text-base font-semibold">Change Password</CardTitle>
          </div>
          {!changing ? (
            <Button variant="tertiary" size="sm" onClick={onStart}>
              Change
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        {changing ? (
          <div className="space-y-4">
            <Input
              type="password"
              placeholder="Current password"
              value={form.currentPassword}
              onChange={(event) => setForm({ ...form, currentPassword: event.target.value })}
              required
            />
            <Input
              type="password"
              placeholder="New password (at least 8 characters)"
              value={form.newPassword}
              onChange={(event) => setForm({ ...form, newPassword: event.target.value })}
              required
            />
            <Input
              type="password"
              placeholder="Confirm new password"
              value={form.confirm}
              onChange={(event) => setForm({ ...form, confirm: event.target.value })}
              required
            />
            <div className="flex gap-2 pt-4 mt-2 border-t border-foreground/[0.07]">
              <Button
                type="button"
                disabled={!canSubmitPassword}
                onClick={handlePasswordSubmit}
              >
                Update Password
              </Button>
              <Button type="button" variant="ghost" onClick={onCancel}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm font-mono tracking-[0.2em] mt-2">
            {'\u2022'.repeat(8)}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

type NotificationPreferencesCardProps = {
  categories: NotificationCategoryOption[];
  prefMap: Record<string, boolean | undefined>;
  onToggle: (args: { category: NotificationCategory; enabled: boolean }) => void;
};

export function NotificationPreferencesCard({
  categories,
  prefMap,
  onToggle,
}: NotificationPreferencesCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3 border-b border-foreground/[0.07]">
        <div className="flex items-center gap-2">
          <Bell size={16} className="text-accent-500" />
          <CardTitle className="text-base font-semibold">Notification Preferences</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        {categories.map(({ key, label }) => {
          const enabled = prefMap[`${key}:null`] !== false;
          return (
            <div key={key} className="flex items-center justify-between gap-4">
              <Label htmlFor={`pref-${key}`} className="text-sm font-medium cursor-pointer">
                {label}
              </Label>
              <Switch
                label=""
                id={`pref-${key}`}
                checked={enabled}
                onToggle={() => onToggle({ category: key, enabled: !enabled })}
              />
            </div>
          );
        })}
        <p className="text-xs text-muted-foreground pt-3 mt-1 border-t border-foreground/[0.06]">
          Admin-general announcements always notify you regardless of preferences.
        </p>
      </CardContent>
    </Card>
  );
}

type AppearanceCardProps = {
  theme: string | undefined;
  setTheme: (theme: string) => void;
};

export function AppearanceCard({ theme, setTheme }: AppearanceCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3 border-b border-foreground/[0.07]">
        <div className="flex items-center gap-2">
          <Palette size={16} className="text-accent-500" />
          <CardTitle className="text-base font-semibold">Appearance</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-3">
          {[
            { id: 'light', label: 'Light', icon: Sun },
            { id: 'dark', label: 'Dark', icon: Moon },
            { id: 'system', label: 'System', icon: Monitor },
            { id: 'high-contrast', label: 'Contrast', icon: Contrast },
            { id: 'bubblegum', label: 'Bubblegum', icon: Heart },
            { id: 'custom', label: 'Custom', icon: ImageIcon },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTheme(id)}
              className={cn(
                'flex flex-col items-center gap-2.5 p-4 rounded-2xl border transition-all duration-200 outline-none',
                theme === id
                  ? 'border-primary bg-primary/[0.03] text-primary ring-1 ring-primary'
                  : 'border-foreground/[0.06] hover:border-foreground/[0.12] hover:bg-foreground/[0.02] text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon
                size={20}
                className={cn('transition-transform duration-300', theme === id && 'scale-110')}
              />
              <span className="text-xs font-semibold uppercase tracking-wider">{label}</span>
            </button>
          ))}
        </div>

        {theme === 'custom' ? <CustomThemeEditor /> : null}
      </CardContent>
    </Card>
  );
}

export function ModerationAlertsCard({ alerts }: { alerts: ModerationAlert[] }) {
  return (
    <Card>
      <CardHeader className="pb-3 border-b border-foreground/[0.07]">
        <CardTitle className="text-base font-semibold">Recent Content Moderation Alerts</CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-3">
        {alerts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recent flagged content notices.</p>
        ) : (
          alerts.map((alert) => (
            <div key={alert.id} className="rounded-md border p-3">
              <p className="text-sm font-medium">{alert.title}</p>
              <p className="text-xs text-muted-foreground mt-1">{alert.body}</p>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
