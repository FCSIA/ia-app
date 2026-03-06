'use client';

import { useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { getUser } from '@/lib/auth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authApi, notificationsApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { User, Lock, Bell } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

export default function ProfilePage() {
  const user = getUser();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [changing, setChanging] = useState(false);

  const { data: prefs = [] } = useQuery({
    queryKey: ['notification-prefs'],
    queryFn: () => notificationsApi.getPreferences().then((r) => r.data),
  });

  const changePwMutation = useMutation({
    mutationFn: (d: any) => authApi.changePassword(d.currentPassword, d.newPassword),
    onSuccess: () => {
      toast({ title: 'Password changed' });
      setChanging(false);
      setPwForm({ currentPassword: '', newPassword: '', confirm: '' });
    },
    onError: (e: any) => toast({ title: e.response?.data?.message || 'Failed to change password', variant: 'destructive' }),
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
    { key: 'EVENT', label: 'Events' },
    { key: 'FLEX_FRIDAY', label: 'Flex Friday' },
  ];

  // Avatar initials
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
              style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)', boxShadow: '0 8px 24px rgba(249,115,22,0.3)' }}
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
          <CardHeader className="pb-3 border-b">
            <div className="flex items-center gap-2">
              <User size={16} className="text-accent-500" />
              <CardTitle className="text-base font-semibold">Account Info</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-3">
            <div className="space-y-0">
              {[
                { label: 'Student / Staff ID', value: user?.uniqueId, mono: true },
                ...(user?.roles?.includes('STUDENT') ? [
                  { label: 'Grade', value: user?.gradeLevel || '—' },
                  { label: 'Major Pathway', value: user?.major ? user.major.replace(/_/g, ' ') : '—' },
                  { label: 'Minor Pathway', value: user?.minor ? user.minor.replace(/_/g, ' ') : '—' },
                ] : []),
              ].map(({ label, value, mono }, i, arr) => (
                <div
                  key={label}
                  className="flex justify-between items-center py-3 border-b last:border-0"
                >
                  <span className="text-sm text-muted-foreground">{label}</span>
                  <span className={`text-sm ${mono ? 'font-mono text-accent-600 dark:text-accent-400 font-medium' : 'text-foreground'}`}>
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Change Password */}
        <Card>
          <CardHeader className="pb-3 border-b">
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
            {changing && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (pwForm.newPassword !== pwForm.confirm) {
                    toast({ title: 'Passwords do not match', variant: 'destructive' });
                    return;
                  }
                  changePwMutation.mutate({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword });
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
                <div className="flex gap-2 pt-1 border-t border-border pt-4 mt-4">
                  <Button type="submit" disabled={changePwMutation.isPending}>
                    Update Password
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setChanging(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            )}
            {!changing && (
              <p className="text-muted-foreground text-sm font-mono tracking-[0.2em] mt-2">••••••••</p>
            )}
          </CardContent>
        </Card>

        {/* Notification Preferences */}
        <Card>
          <CardHeader className="pb-3 border-b">
            <div className="flex items-center gap-2">
              <Bell size={16} className="text-accent-500" />
              <CardTitle className="text-base font-semibold">Notification Preferences</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-5">
            {categories.map(({ key, label }) => {
              const enabled = prefMap[`${key}:null`] !== false;
              return (
                <div key={key} className="flex items-center justify-between">
                  <p className="text-sm font-medium">{label}</p>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={enabled}
                      onChange={(e) => prefMutation.mutate({ category: key, enabled: e.target.checked })}
                    />
                    <div
                      className="w-11 h-6 rounded-full transition-all duration-200 relative"
                      style={{
                        background: enabled
                          ? 'linear-gradient(135deg, #f97316, #ea580c)'
                          : 'rgba(100,100,100,0.2)',
                        border: enabled
                          ? '1px solid rgba(249,115,22,0.5)'
                          : '1px solid rgba(100,100,100,0.1)',
                        boxShadow: enabled ? '0 4px 12px rgba(249,115,22,0.25)' : 'none',
                      }}
                    >
                      <span
                        className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all duration-200 shadow-sm"
                        style={{ left: enabled ? 'calc(100% - 1.375rem)' : '0.125rem' }}
                      />
                    </div>
                  </label>
                </div>
              );
            })}
            <div className="pt-4 border-t border-border mt-4">
              <p className="text-xs text-muted-foreground">
                Admin-general announcements always notify you regardless of preferences.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
