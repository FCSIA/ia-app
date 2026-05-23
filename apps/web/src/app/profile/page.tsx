'use client';

import { useState, useEffect, useRef } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useCurrentUser } from '@/lib/auth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authApi, notificationsApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { User, Lock, Bell, Sun, Moon, Monitor, Palette, Contrast, Heart, Image as ImageIcon, Trash2, Droplet, RotateCcw } from 'lucide-react';
import { useTheme } from 'next-themes';
import { HexColorPicker } from 'react-colorful';
import {
  CUSTOM_BG_STORAGE_KEY,
  CUSTOM_COLORS_STORAGE_KEY,
  hexToHslParts,
  readableForegroundParts,
  type CustomColorKey,
  type CustomColors,
} from '@/app/providers';
import { cn } from '@/lib/utils';
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
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
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
                  <Switch label=""
                    id={`pref-${key}`}
                    checked={enabled}
                    onToggle={() => prefMutation.mutate({ category: key, enabled: !enabled })}
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
                        : 'border-foreground/[0.06] hover:border-foreground/[0.12] hover:bg-foreground/[0.02] text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <Icon size={20} className={cn(
                      'transition-transform duration-300',
                      theme === id && 'scale-110'
                    )} />
                    <span className="text-xs font-semibold uppercase tracking-wider">{label}</span>
                  </button>
                ))}
              </div>

              {theme === 'custom' && <CustomThemeEditor />}
            </CardContent>
          </Card>
        )}

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

const MAX_CUSTOM_BG_BYTES = 4 * 1024 * 1024; // 4MB — keeps the data URL under the
// typical localStorage 5MB quota with headroom.

const PALETTE_SLOTS: Array<{ key: CustomColorKey; label: string; help: string }> = [
  { key: 'background', label: 'Background', help: 'Outer page backdrop.' },
  { key: 'primary', label: 'Primary', help: 'Buttons, links, focus rings.' },
  { key: 'secondary', label: 'Secondary', help: 'Cards and inner panels.' },
  { key: 'accent', label: 'Accent', help: 'Borders, hover highlights.' },
];

function CustomThemeEditor() {
  const [mode, setMode] = useState<'image' | 'colors'>('image');

  return (
    <div className="space-y-3 rounded-2xl border border-foreground/[0.08] bg-foreground/[0.02] p-4">
      <div
        role="tablist"
        className="inline-flex rounded-full border border-foreground/10 bg-background/40 p-0.5"
      >
        {(
          [
            { id: 'image', label: 'Image', icon: ImageIcon },
            { id: 'colors', label: 'Colors', icon: Droplet },
          ] as const
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={mode === id}
            onClick={() => setMode(id)}
            className={cn(
              'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
              mode === id
                ? 'bg-foreground text-background'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="size-3.5" />
            {label}
          </button>
        ))}
      </div>

      {mode === 'image' ? <CustomBackgroundPanel /> : <CustomColorsPanel />}
    </div>
  );
}

function CustomBackgroundPanel() {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setPreview(localStorage.getItem(CUSTOM_BG_STORAGE_KEY));
  }, []);

  function applyDataUrl(dataUrl: string | null) {
    if (typeof window === 'undefined') return;
    try {
      if (dataUrl) {
        localStorage.setItem(CUSTOM_BG_STORAGE_KEY, dataUrl);
        document.documentElement.style.setProperty(
          '--custom-bg-image',
          `url("${dataUrl}")`,
        );
      } else {
        localStorage.removeItem(CUSTOM_BG_STORAGE_KEY);
        document.documentElement.style.removeProperty('--custom-bg-image');
      }
      setPreview(dataUrl);
    } catch {
      toast({
        title: 'Couldn’t save background',
        description: 'The image is too large for your browser to store locally. Try a smaller file.',
        variant: 'destructive',
      });
    }
  }

  function handleFile(file: File) {
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Not an image', description: 'Pick a JPG, PNG, or WebP file.', variant: 'destructive' });
      return;
    }
    if (file.size > MAX_CUSTOM_BG_BYTES) {
      toast({
        title: 'Image too large',
        description: 'Max size is 4 MB. Try a smaller or more compressed image.',
        variant: 'destructive',
      });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : null;
      if (result) applyDataUrl(result);
    };
    reader.onerror = () => {
      toast({ title: 'Couldn’t read file', variant: 'destructive' });
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <div
          className="size-20 shrink-0 overflow-hidden rounded-xl border border-foreground/10 bg-muted"
          style={
            preview
              ? {
                  backgroundImage: `url("${preview}")`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }
              : undefined
          }
          aria-hidden
        >
          {!preview && (
            <div className="flex h-full items-center justify-center text-muted-foreground/60">
              <ImageIcon size={20} />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">Background image</p>
          <p className="text-xs text-muted-foreground">
            Upload a picture and it’ll sit behind every page. Saved on this device.
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground/70">
            JPG, PNG, or WebP. Max 4 MB.
          </p>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = '';
        }}
      />

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => fileRef.current?.click()}
          className="rounded-full"
        >
          <ImageIcon className="size-4" />
          {preview ? 'Replace image' : 'Upload image'}
        </Button>
        {preview && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => applyDataUrl(null)}
            className="rounded-full text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="size-4" />
            Remove
          </Button>
        )}
      </div>
    </div>
  );
}

function CustomColorsPanel() {
  const { toast } = useToast();
  const [colors, setColors] = useState<CustomColors>({});
  const [openSlot, setOpenSlot] = useState<CustomColorKey | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(CUSTOM_COLORS_STORAGE_KEY);
      if (raw) setColors(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, []);

  function persist(next: CustomColors) {
    setColors(next);
    try {
      if (Object.keys(next).length === 0) {
        localStorage.removeItem(CUSTOM_COLORS_STORAGE_KEY);
      } else {
        localStorage.setItem(CUSTOM_COLORS_STORAGE_KEY, JSON.stringify(next));
      }
      applyToDom(next);
    } catch {
      toast({
        title: 'Couldn’t save colors',
        description: 'Your browser blocked localStorage. Changes won’t persist.',
        variant: 'destructive',
      });
    }
  }

  function applyToDom(next: CustomColors) {
    const root = document.documentElement;
    const slots: Array<{ key: CustomColorKey; vars: string[]; fg?: string }> = [
      { key: 'background', vars: ['--background'], fg: '--foreground' },
      {
        key: 'primary',
        vars: ['--primary', '--ring', '--sidebar-primary', '--sidebar-ring'],
        fg: '--primary-foreground',
      },
      {
        key: 'secondary',
        vars: ['--secondary', '--muted', '--card', '--popover'],
        fg: '--secondary-foreground',
      },
      { key: 'accent', vars: ['--accent', '--border', '--input'], fg: '--accent-foreground' },
    ];
    for (const slot of slots) {
      for (const v of slot.vars) root.style.removeProperty(v);
      if (slot.fg) root.style.removeProperty(slot.fg);
    }
    for (const slot of slots) {
      const hex = next[slot.key];
      if (!hex) continue;
      const hsl = hexToHslParts(hex);
      if (!hsl) continue;
      for (const v of slot.vars) root.style.setProperty(v, hsl);
      if (slot.fg) root.style.setProperty(slot.fg, readableForegroundParts(hex));
    }
  }

  function handleChange(key: CustomColorKey, hex: string) {
    persist({ ...colors, [key]: hex });
  }

  function handleClear(key: CustomColorKey) {
    const next = { ...colors };
    delete next[key];
    persist(next);
  }

  function handleResetAll() {
    persist({});
    setOpenSlot(null);
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium text-foreground">Color palette</p>
        <p className="text-xs text-muted-foreground">
          Pick any color for each slot — text contrast adjusts automatically. Saved on this device.
        </p>
      </div>

      <div className="space-y-2">
        {PALETTE_SLOTS.map(({ key, label, help }) => {
          const hex = colors[key];
          const isOpen = openSlot === key;
          return (
            <div
              key={key}
              className="rounded-xl border border-foreground/[0.08] bg-background/40"
            >
              <button
                type="button"
                onClick={() => setOpenSlot(isOpen ? null : key)}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left"
              >
                <span
                  className={cn(
                    'size-7 shrink-0 rounded-lg border border-foreground/15',
                    !hex && 'bg-[repeating-conic-gradient(#ddd_0_25%,_#fff_0_50%)] bg-[length:10px_10px]',
                  )}
                  style={hex ? { backgroundColor: hex } : undefined}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{label}</p>
                  <p className="text-[11px] text-muted-foreground">{help}</p>
                </div>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {hex ?? 'auto'}
                </span>
              </button>
              {isOpen && (
                <div className="space-y-2 border-t border-foreground/[0.08] p-3">
                  <HexColorPicker
                    color={hex ?? '#888888'}
                    onChange={(value) => handleChange(key, value)}
                    style={{ width: '100%', height: 180 }}
                  />
                  <div className="flex items-center justify-between gap-2">
                    <input
                      type="text"
                      value={hex ?? ''}
                      placeholder="#rrggbb"
                      onChange={(e) => {
                        const v = e.target.value;
                        if (/^#[0-9a-fA-F]{6}$/.test(v)) handleChange(key, v);
                      }}
                      className="w-28 rounded-md border border-foreground/15 bg-background px-2 py-1 font-mono text-xs"
                    />
                    {hex && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => handleClear(key)}
                        className="h-7 rounded-full text-xs text-muted-foreground hover:text-destructive"
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {Object.keys(colors).length > 0 && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={handleResetAll}
          className="rounded-full text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="size-4" />
          Reset all colors
        </Button>
      )}
    </div>
  );
}
