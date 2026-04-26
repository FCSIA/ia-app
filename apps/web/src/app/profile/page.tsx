'use client';

import { useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useCurrentUser } from '@/lib/auth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authApi, notificationsApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { User, Lock, Bell } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

export default function ProfilePage() {
  const user = useCurrentUser();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [changing, setChanging] = useState(false);

  const { data: prefs = [] } = useQuery({
    queryKey: ['notification-prefs'],
    queryFn: () => notificationsApi.getPreferences().then((r) => r.data),
  });
  const { data: moderationAlerts = [] } = useQuery({
    queryKey: ['profile-moderation-alerts'],
    queryFn: () =>
      notificationsApi
        .getAll(true)
        .then((r) => r.data)
        .then((rows: any[]) => rows.filter((row) => row.category === 'CONTENT_MODERATED').slice(0, 5)),
  });

  const changePwMutation = useMutation({
    mutationFn: (d: any) => authApi.changePassword(d.currentPassword, d.newPassword),
    onSuccess: () => {
      toast({ title: 'Password changed' });
      setChanging(false);
      setPwForm({ currentPassword: '', newPassword: '', confirm: '' });
    },
    onError: (e: any) =>
      toast({ title: e.response?.data?.message || 'Failed to change password', variant: 'destructive' }),
  });

  const prefMutation = useMutation({
    mutationFn: ({ category, enabled }: any) => notificationsApi.upsertPreference(category, enabled),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notification-prefs'] }),
  });

  const prefMap = Object.fromEntries(
    (prefs as any[]).map((p: any) => [`${p.category}:${p.clubId || 'null'}`, p.enabled])
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
                  <Badge key={r} variant="secondary" className="text-[10px]">
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
                <Button variant="outline" size="sm" onClick={() => setChanging(true)}>
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
                  changePwMutation.mutate({
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
                  placeholder="New password (min 8 chars)"
                  value={pwForm.newPassword}
                  onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })}
                  required
                  minLength={8}
                />
                <Input
                  type="password"
                  placeholder="Confirm new password"
                  value={pwForm.confirm}
                  onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })}
                  required
                />
                <div className="flex gap-2 pt-4 mt-2 border-t border-foreground/[0.07]">
                  <Button type="submit" disabled={changePwMutation.isPending}>
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
                  <Switch
                    id={`pref-${key}`}
                    checked={enabled}
                    onCheckedChange={(checked: boolean) =>
                      prefMutation.mutate({ category: key, enabled: checked })
                    }
                  />
                </div>
              );
            })}
            <p className="text-xs text-muted-foreground pt-3 mt-1 border-t border-foreground/[0.06]">
              Admin-general announcements always notify you regardless of preferences.
            </p>
          </CardContent>
        </Card>

        {/* Content moderation alerts */}
        <Card>
          <CardHeader className="pb-3 border-b border-foreground/[0.07]">
            <CardTitle className="text-base font-semibold">Recent Content Moderation Alerts</CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            {(moderationAlerts as any[]).length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent flagged content notices.</p>
            ) : (
              (moderationAlerts as any[]).map((alert) => (
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
