'use client';

import { useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { getUser } from '@/lib/auth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authApi, notificationsApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { User, Lock, Bell } from 'lucide-react';

export default function ProfilePage() {
  const user = getUser();
  const qc = useQueryClient();
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [changing, setChanging] = useState(false);

  const { data: prefs = [] } = useQuery({
    queryKey: ['notification-prefs'],
    queryFn: () => notificationsApi.getPreferences().then((r) => r.data),
  });

  const changePwMutation = useMutation({
    mutationFn: (d: any) => authApi.changePassword(d.currentPassword, d.newPassword),
    onSuccess: () => {
      toast.success('Password changed');
      setChanging(false);
      setPwForm({ currentPassword: '', newPassword: '', confirm: '' });
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to change password'),
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
        <div className="card flex items-center gap-5">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold text-white flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)', boxShadow: '0 8px 24px rgba(249,115,22,0.3)' }}
          >
            {initials}
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">
              {user?.firstName} {user?.lastName}
            </h1>
            <p className="text-white/45 text-sm font-mono mt-0.5">{user?.uniqueId}</p>
            <div className="flex flex-wrap gap-1 mt-2">
              {user?.roles?.map((r: string) => (
                <span key={r} className="badge-blue text-[10px]">{r.replace(/_/g, ' ')}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Account Info */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <User size={16} className="text-accent-400" />
            <h2 className="font-semibold text-white/90">Account Info</h2>
          </div>
          <div className="space-y-0">
            {[
              { label: 'Student / Staff ID', value: user?.uniqueId, mono: true },
              ...(user?.roles?.includes('STUDENT') ? [
                { label: 'Grade', value: user?.gradeLevel || '—' },
                { label: 'Major Pathway', value: user?.major ? user.major.replace(/_/g, ' ') : '—' },
                { label: 'Minor Pathway', value: user?.minor ? user.minor.replace(/_/g, ' ') : '—' },
              ] : [])
            ].map(({ label, value, mono }, i, arr) => (
              <div
                key={label}
                className="flex justify-between items-center py-3"
                style={i < arr.length - 1 ? { borderBottom: '1px solid rgba(255,255,255,0.06)' } : undefined}
              >
                <span className="text-sm text-white/45">{label}</span>
                <span className={`text-sm ${mono ? 'font-mono text-accent-400/80' : 'text-white/75'}`}>
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Change Password */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Lock size={16} className="text-accent-400" />
              <h2 className="font-semibold text-white/90">Change Password</h2>
            </div>
            {!changing && (
              <button onClick={() => setChanging(true)} className="btn-secondary text-sm py-1 px-3">
                Change
              </button>
            )}
          </div>
          {changing && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (pwForm.newPassword !== pwForm.confirm) {
                  toast.error('Passwords do not match');
                  return;
                }
                changePwMutation.mutate({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword });
              }}
              className="space-y-3"
            >
              <input
                type="password"
                className="input"
                placeholder="Current password"
                value={pwForm.currentPassword}
                onChange={(e) => setPwForm({ ...pwForm, currentPassword: e.target.value })}
                required
              />
              <input
                type="password"
                className="input"
                placeholder="New password (min 8 chars)"
                value={pwForm.newPassword}
                onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })}
                required
                minLength={8}
              />
              <input
                type="password"
                className="input"
                placeholder="Confirm new password"
                value={pwForm.confirm}
                onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })}
                required
              />
              <div className="flex gap-2 pt-1">
                <button type="submit" className="btn-primary text-sm" disabled={changePwMutation.isPending}>
                  Update Password
                </button>
                <button type="button" onClick={() => setChanging(false)} className="btn-secondary text-sm">
                  Cancel
                </button>
              </div>
            </form>
          )}
          {!changing && (
            <p className="text-white/30 text-sm">••••••••</p>
          )}
        </div>

        {/* Notification Preferences */}
        <div className="card">
          <div className="flex items-center gap-2 mb-5">
            <Bell size={16} className="text-accent-400" />
            <h2 className="font-semibold text-white/90">Notification Preferences</h2>
          </div>
          <div className="space-y-4">
            {categories.map(({ key, label }) => {
              const enabled = prefMap[`${key}:null`] !== false;
              return (
                <div key={key} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-white/80">{label}</p>
                  </div>
                  {/* Custom orange toggle */}
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
                          : 'rgba(255,255,255,0.1)',
                        border: enabled
                          ? '1px solid rgba(249,115,22,0.5)'
                          : '1px solid rgba(255,255,255,0.1)',
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
          </div>
          <p className="text-xs text-white/25 pt-4 mt-2 border-t border-white/[0.06]">
            Admin-general announcements always notify you regardless of preferences.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
