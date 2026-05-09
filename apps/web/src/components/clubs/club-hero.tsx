'use client';

import { useRef, useState } from 'react';
import { Camera, ImagePlus, Loader2, Palette, Settings2, Trash2, X } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ClubDetail } from '@ia/contracts/clubs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { clubsApi, uploadsApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/$/, '');

function resolveMediaUrl(url?: string | null) {
  if (!url) return undefined;
  if (url.startsWith('http')) return url;
  return `${API_BASE}${url.startsWith('/') ? '' : '/'}${url}`;
}

export function ClubHero({ club, canEdit }: { club: ClubDetail; canEdit: boolean }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);

  const [form, setForm] = useState({
    overview: club.overview ?? '',
    accentColor: club.accentColor ?? '',
    logoUrl: club.logoUrl ?? '',
    bannerUrl: club.bannerUrl ?? '',
  });
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const bannerInputRef = useRef<HTMLInputElement | null>(null);
  const quickLogoInputRef = useRef<HTMLInputElement | null>(null);

  const handleQuickLogoUpload = async (file: File) => {
    setUploadingLogo(true);
    try {
      const { data } = await uploadsApi.uploadClubImage(file);
      await clubsApi.update(club.id, { logoUrl: data.url });

      qc.invalidateQueries({ queryKey: ['club', club.id] });
      qc.invalidateQueries({ queryKey: ['clubs'] });
      qc.invalidateQueries({ queryKey: ['my-clubs'] });
      toast({ title: 'Club logo updated' });

      setForm((c) => ({ ...c, logoUrl: data.url }));
    } catch (e: any) {
      toast({
        title: e.response?.data?.message || 'Upload failed',
        variant: 'destructive',
      });
    } finally {
      setUploadingLogo(false);
    }
  };

  const updateMutation = useMutation({
    mutationFn: (payload: any) => clubsApi.update(club.id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['club', club.id] });
      qc.invalidateQueries({ queryKey: ['clubs'] });
      qc.invalidateQueries({ queryKey: ['my-clubs'] });
      toast({ title: 'Club branding saved' });
      setEditing(false);
    },
    onError: (e: any) =>
      toast({
        title: e.response?.data?.message || 'Failed to save',
        variant: 'destructive',
      }),
  });

  const openEditor = () => {
    setForm({
      overview: club.overview ?? '',
      accentColor: club.accentColor ?? '',
      logoUrl: club.logoUrl ?? '',
      bannerUrl: club.bannerUrl ?? '',
    });
    setEditing(true);
  };

  const handleUpload = async (kind: 'logo' | 'banner', file: File) => {
    const setBusy = kind === 'logo' ? setUploadingLogo : setUploadingBanner;
    setBusy(true);
    try {
      const { data } = await uploadsApi.uploadClubImage(file);
      setForm((c) => ({ ...c, [kind === 'logo' ? 'logoUrl' : 'bannerUrl']: data.url }));
    } catch (e: any) {
      toast({
        title: e.response?.data?.message || 'Upload failed',
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleSave = () => {
    updateMutation.mutate({
      overview: form.overview || null,
      accentColor: form.accentColor || null,
      logoUrl: form.logoUrl || null,
      bannerUrl: form.bannerUrl || null,
    });
  };

  const bannerUrl = resolveMediaUrl(club.bannerUrl);
  const logoUrl = resolveMediaUrl(club.logoUrl);
  const accent = club.accentColor || undefined;

  return (
    <Card className="overflow-hidden border-border/70">
      {/* Banner */}
      <div
        className={cn(
          'relative h-40 w-full bg-gradient-to-br from-primary/30 via-primary/10 to-muted',
          !bannerUrl && 'ring-1 ring-inset ring-border/40',
        )}
        style={
          bannerUrl
            ? {
                backgroundImage: `url(${bannerUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }
            : accent
              ? { background: `linear-gradient(135deg, ${accent}, ${accent}33)` }
              : undefined
        }
      >
        {canEdit && !editing && (
          <Button
            variant="secondary"
            size="sm"
            onClick={openEditor}
            className="absolute right-3 top-3 gap-1.5 bg-background/80 backdrop-blur hover:bg-background"
          >
            <Settings2 className="size-3.5" /> Customize
          </Button>
        )}
      </div>

      <CardContent className="relative -mt-12 space-y-4 px-6 pb-6 pt-0">
        <div className="flex items-end gap-4">
          <div className="group relative size-24 shrink-0 overflow-hidden rounded-2xl border-4 border-background bg-muted shadow-sm">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt={club.name} className="size-full object-cover" />
            ) : (
              <div
                className="flex size-full items-center justify-center bg-gradient-to-br from-orange-500/20 via-amber-500/20 to-background text-2xl font-semibold text-orange-100"
                style={accent ? { background: `linear-gradient(135deg, ${accent}55, ${accent}22)` } : undefined}
              >
                {club.name.trim().charAt(0).toUpperCase() || 'C'}
              </div>
            )}
            {canEdit && (
              <>
                <div
                  className={cn(
                    "absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity cursor-pointer",
                    uploadingLogo ? "opacity-100" : "group-hover:opacity-100"
                  )}
                  onClick={() => quickLogoInputRef.current?.click()}
                >
                  {uploadingLogo ? (
                    <Loader2 className="size-6 text-white animate-spin" />
                  ) : (
                    <Camera className="size-6 text-white" />
                  )}
                </div>
                <input
                  ref={quickLogoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleQuickLogoUpload(file);
                    if (quickLogoInputRef.current) quickLogoInputRef.current.value = '';
                  }}
                />
              </>
            )}
          </div>
          <div className="min-w-0 pb-1">
            <h1 className="truncate text-2xl font-semibold tracking-tight text-foreground">
              {club.name}
            </h1>
            {club.description ? (
              <p className="line-clamp-1 text-sm text-muted-foreground">{club.description}</p>
            ) : null}
          </div>
        </div>

        {club.overview ? (
          <p className="whitespace-pre-line text-sm leading-6 text-muted-foreground">
            {club.overview}
          </p>
        ) : null}

        {editing && canEdit && (
          <div className="space-y-4 rounded-xl border border-border bg-muted/30 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Customize club home</h3>
              <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                <X className="size-4" />
              </Button>
            </div>

            {/* Banner upload */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Banner image</label>
              <div className="flex items-center gap-3">
                <div
                  className="h-16 w-40 shrink-0 overflow-hidden rounded-md border bg-background bg-cover bg-center"
                  style={
                    form.bannerUrl
                      ? { backgroundImage: `url(${resolveMediaUrl(form.bannerUrl)})` }
                      : undefined
                  }
                />
                <div className="flex flex-wrap gap-2">
                  <input
                    ref={bannerInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUpload('banner', file);
                      if (bannerInputRef.current) bannerInputRef.current.value = '';
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="tertiary"
                    onClick={() => bannerInputRef.current?.click()}
                    disabled={uploadingBanner}
                  >
                    {uploadingBanner ? (
                      <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                    ) : (
                      <ImagePlus className="mr-1.5 size-3.5" />
                    )}
                    Upload banner
                  </Button>
                  {form.bannerUrl && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setForm((c) => ({ ...c, bannerUrl: '' }))}
                    >
                      <Trash2 className="mr-1.5 size-3.5" /> Remove
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Logo upload */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Logo / profile picture</label>
              <div className="flex items-center gap-3">
                <div
                  className="size-16 shrink-0 overflow-hidden rounded-md border bg-background bg-cover bg-center"
                  style={
                    form.logoUrl
                      ? { backgroundImage: `url(${resolveMediaUrl(form.logoUrl)})` }
                      : undefined
                  }
                />
                <div className="flex flex-wrap gap-2">
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUpload('logo', file);
                      if (logoInputRef.current) logoInputRef.current.value = '';
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="tertiary"
                    onClick={() => logoInputRef.current?.click()}
                    disabled={uploadingLogo}
                  >
                    {uploadingLogo ? (
                      <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                    ) : (
                      <ImagePlus className="mr-1.5 size-3.5" />
                    )}
                    Upload logo
                  </Button>
                  {form.logoUrl && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setForm((c) => ({ ...c, logoUrl: '' }))}
                    >
                      <Trash2 className="mr-1.5 size-3.5" /> Remove
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Accent color */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Palette className="size-3.5" /> Accent color
              </label>
              <div className="flex items-center gap-2">
                <Input
                  type="color"
                  value={form.accentColor || '#6366f1'}
                  onChange={(e) => setForm((c) => ({ ...c, accentColor: e.target.value }))}
                  className="h-9 w-16 cursor-pointer p-1"
                />
                <Input
                  placeholder="#6366f1"
                  value={form.accentColor}
                  onChange={(e) => setForm((c) => ({ ...c, accentColor: e.target.value }))}
                  className="h-9 max-w-[160px]"
                />
                {form.accentColor && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setForm((c) => ({ ...c, accentColor: '' }))}
                  >
                    Clear
                  </Button>
                )}
              </div>
            </div>

            {/* Overview */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">About this club</label>
              <Textarea
                placeholder="Tell members what this club is about, meeting times, goals…"
                rows={5}
                value={form.overview}
                onChange={(e) => setForm((c) => ({ ...c, overview: e.target.value }))}
              />
            </div>

            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Saving…' : 'Save changes'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
