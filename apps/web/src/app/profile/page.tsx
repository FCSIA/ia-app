'use client';

import { useState, useEffect } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useCurrentUser } from '@/lib/auth';
import { useMutation, useQuery } from 'convex/react';
import { api } from '~/apps/convex/src/_generated/api';
import { useToast } from '@/hooks/use-toast';
import { User, Lock, Bell, Sun, Moon, Monitor, Palette } from 'lucide-react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

export default function ProfilePage() {
  const user = useCurrentUser();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [changing, setChanging] = useState(false);
  const changePassword = useMutation(api.users.auth.changePassword);
  const upsertPreference = useMutation(api.notifications.preferences.upsert);

  const prefs = useQuery(api.notifications.preferences.list) ?? [];
  const moderationAlerts = (useQuery(api.notifications.inbox.list, { unreadOnly: true }) ?? [])
    .filter((row) => row.category === 'CONTENT_MODERATED')
    .slice(0, 5);

  async function handleChangePassword(d: { currentPassword: string; newPassword: string }) {
    try {
      await changePassword(d);
      toast({ title: 'Password changed' });
      setChanging(false);
      setPwForm({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (e: unknown) {
      toast({
        title: e instanceof Error ? e.message : 'Failed to change password',
        variant: 'destructive',
      });
    }
  }

  function handlePreferenceToggle({ category, enabled }: { category: any; enabled: boolean }) {
    void upsertPreference({ category, enabled });
  }

  const prefMap = Object.fromEntries(
    prefs.map((p) => [`${p.category}:${p.clubId || 'null'}`, p.enabled])
  );

  const categories = [
    { key: 'SCHOOL_ANNOUNCEMENT', label: 'School Announcements' },
    { key: 'CLUB_JOIN_REQUEST', label: 'Club Join Requests' },
    { key: 'EVENT', label: 'Events' },
    { key: 'FLEX_FRIDAY', label: 'Flex Friday' },
    { key: 'CONTENT_MODERATED', label: 'Content Moderation Alerts' },
  ];

  const initials = user
    ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase()
    : '??';

  return (
    <AppShell>
      <div className="max-w-xl mx-auto space-y-5">

        {/* Profile hero */}
        <Card>
          <CardContent className="flex items-center gap-5 p-6">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold text-white flex-shrink-0"
              style={{
                background: 'linear-gradient(135deg, #f97316, #ea580c)',
                boxShadow: '0 8px 24px rgba(249,115,22,0.3)',
              }}
            >
              {initials}
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">
                {user?.firstName} {user?.lastName}
              </h1>
              <p className="text-muted-foreground text-sm font-mono mt-0.5">{user?.uniqueId}</p>
              <div className="flex flex-wrap gap-1 mt-2">
                {user?.roles?.map((r: string) => (
                  <Badge key={r} variant="solid" className="text-[10px]">
                    {r.replace(/_/g, ' ')}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Account Info */}
        <Card>
          <CardHeader className="pb-3 border-b border-foreground/[0.07]">
            <div className="flex items-center gap-2">
              <User size={16} className="text-accent-500" />
              <CardTitle className="text-base font-semibold">Account Info</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {[
              { label: 'Student / Staff ID', value: user?.uniqueId, mono: true },
              ...(user?.roles?.includes('STUDENT')
                ? [
                    { label: 'Grade', value: user?.gradeLevel || '—' },
                    {
                      label: 'Major Pathway',
                      value: user?.major ? user.major.replace(/_/g, ' ') : '—',
                    },
                    {
                      label: 'Minor Pathway',
                      value: user?.minor ? user.minor.replace(/_/g, ' ') : '—',
                    },
                  ]
                : []),
            ].map(({ label, value, mono }) => (
              <div
                key={label}
                className="flex justify-between items-center py-3 border-b border-foreground/[0.06] last:border-0"
              >
                <span className="text-sm text-muted-foreground">{label}</span>
                <span
                  className={`text-sm ${mono ? 'font-mono text-accent-500 dark:text-accent-400 font-medium' : 'text-foreground'}`}
                >
                  {value}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Change Password */}
        <Card>
          <CardHeader className="pb-3 border-b border-foreground/[0.07]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock size={16} className="text-accent-500" />
                <CardTitle className="text-base font-semibold">Change Password</CardTitle>
              </div>
              {!changing && (
                <Button variant="tertiary" size="sm" onClick={() => setChanging(true)}>
                  Change
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {changing ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (pwForm.newPassword !== pwForm.confirm) {
                    toast({ title: 'Passwords do not match', variant: 'destructive' });
                    return;
                  }
                  void handleChangePassword({
                    currentPassword: pwForm.currentPassword,
                    newPassword: pwForm.newPassword,
                  });
                }}
                className="space-y-4"
              >
                <Input
                  type="password"
                  placeholder="Current password"
                  value={pwForm.currentPassword}
                  onChange={(e) => setPwForm({ ...pwForm, currentPassword: e.target.value })}
                  required
                />
                <Input
                  type="password"
                  placeholder="New password (min 12 chars)"
                  value={pwForm.newPassword}
                  onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })}
                  required
                  minLength={12}
                />
                <Input
                  type="password"
                  placeholder="Confirm new password"
                  value={pwForm.confirm}
                  onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })}
                  required
                />
                <div className="flex gap-2 pt-4 mt-2 border-t border-foreground/[0.07]">
                  <Button type="submit">
                    Update Password
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setChanging(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <p className="text-muted-foreground text-sm font-mono tracking-[0.2em] mt-2">
                ••••••••
              </p>
            )}
          </CardContent>
        </Card>

        {/* Notification Preferences */}
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
                  <Switch label=""
                    id={`pref-${key}`}
                    checked={enabled}
                    onToggle={() => handlePreferenceToggle({ category: key, enabled: !enabled })}
                  />
                </div>
              );
            })}
            <p className="text-xs text-muted-foreground pt-3 mt-1 border-t border-foreground/[0.06]">
              Admin-general announcements always notify you regardless of preferences.
            </p>
          </CardContent>
        </Card>

        {/* Appearance */}
        {mounted && (
          <Card>
            <CardHeader className="pb-3 border-b border-foreground/[0.07]">
              <div className="flex items-center gap-2">
                <Palette size={16} className="text-accent-500" />
                <CardTitle className="text-base font-semibold">Appearance</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: 'light', label: 'Light', icon: Sun },
                  { id: 'dark', label: 'Dark', icon: Moon },
                  { id: 'system', label: 'System', icon: Monitor },
                ].map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTheme(id)}
                    className={cn(
                      'flex flex-col items-center gap-2.5 p-4 rounded-2xl border transition-all duration-200 outline-none',
                      theme === id
                        ? 'border-primary bg-primary/[0.03] text-primary ring-1 ring-primary'
                        : 'border-foreground/[0.06] hover:border-foreground/[0.12] hover:bg-foreground/[0.02] text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <Icon size={20} className={cn(
                      "transition-transform duration-300",
                      theme === id && "scale-110"
                    )} />
                    <span className="text-xs font-semibold uppercase tracking-wider">{label}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Content moderation alerts */}
        <Card>
          <CardHeader className="pb-3 border-b border-foreground/[0.07]">
            <CardTitle className="text-base font-semibold">Recent Content Moderation Alerts</CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            {moderationAlerts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent flagged content notices.</p>
            ) : (
              moderationAlerts.map((alert) => (
                <div key={alert.id} className="rounded-md border p-3">
                  <p className="text-sm font-medium">{alert.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">{alert.body}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

      </div>
    </AppShell>
  );
}
