'use client';

import { useRef, useState } from 'react';
import { useMutation } from 'convex/react';
import { Droplet, Image as ImageIcon, Loader2, RotateCcw, Trash2 } from 'lucide-react';
import { HexColorPicker } from 'react-colorful';
import {
  CUSTOM_BG_STORAGE_KEY,
  CUSTOM_COLORS_STORAGE_KEY,
  applyCustomColors,
  type CustomColorKey,
  type CustomColors,
} from '@/app/providers';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useCurrentUser } from '@/lib/auth';
import { compressImageForUpload } from '@/lib/compress-image';
import { uploadUserImage } from '@/lib/upload-user-image';
import { api } from '~/apps/convex/src/_generated/api';

const PALETTE_SLOTS: Array<{ key: CustomColorKey; label: string; help: string }> = [
  { key: 'background', label: 'Background', help: 'Outer page backdrop.' },
  { key: 'primary', label: 'Primary', help: 'Buttons, links, focus rings.' },
  { key: 'secondary', label: 'Secondary', help: 'Cards and inner panels.' },
  { key: 'accent', label: 'Accent', help: 'Borders, hover highlights.' },
];

function getLegacyBackgroundDataUrl() {
  if (typeof window === 'undefined') return null;
  try {
    const legacy = localStorage.getItem(CUSTOM_BG_STORAGE_KEY);
    return legacy?.startsWith('data:image/') ? legacy : null;
  } catch {
    return null;
  }
}

function clearLegacyBackground() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(CUSTOM_BG_STORAGE_KEY);
  } catch {
    // ignore
  }
}

function loadCustomColors(): CustomColors {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(CUSTOM_COLORS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CustomColors) : {};
  } catch {
    return {};
  }
}

export function CustomThemeEditor() {
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
  const user = useCurrentUser();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [hasLegacyBackground, setHasLegacyBackground] = useState(
    () => getLegacyBackgroundDataUrl() !== null,
  );
  const generateUploadUrl = useMutation(api.uploads.files.generateUploadUrl);
  const saveUserImage = useMutation(api.users.me.saveUserImage);
  const clearUserImage = useMutation(api.users.me.clearUserImage);

  const preview = user?.customBackgroundUrl ?? null;

  async function uploadAndSave(file: File) {
    await uploadUserImage(
      { generateUploadUrl: () => generateUploadUrl({}) },
      (args) => saveUserImage(args),
      'background',
      file,
    );
    clearLegacyBackground();
    setHasLegacyBackground(false);
  }

  async function handleLegacyBackground() {
    const legacy = getLegacyBackgroundDataUrl();
    if (!legacy) {
      setHasLegacyBackground(false);
      return;
    }

    setMigrating(true);
    try {
      const response = await fetch(legacy);
      const blob = await response.blob();
      const file = new File([blob], 'background.jpg', { type: blob.type || 'image/jpeg' });
      const compressed = await compressImageForUpload(file, 'background');
      await uploadAndSave(compressed);
      toast({ title: 'Background image updated' });
    } catch (e: unknown) {
      toast({
        title: e instanceof Error ? e.message : 'Failed to update background',
        variant: 'destructive',
      });
    } finally {
      setMigrating(false);
    }
  }


  async function handleFile(file: File) {
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Not an image',
        description: 'Pick a JPG, PNG, or WebP file.',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);
    try {
      await uploadAndSave(file);
      toast({ title: 'Background image updated' });
    } catch (e: unknown) {
      toast({
        title: e instanceof Error ? e.message : 'Upload failed',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  }

  async function handleRemove() {
    try {
      await clearUserImage({ kind: 'background' });
      clearLegacyBackground();
      setHasLegacyBackground(false);
      toast({ title: 'Background image removed' });
    } catch (e: unknown) {
      toast({
        title: e instanceof Error ? e.message : 'Failed to remove background',
        variant: 'destructive',
      });
    }
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
          {!preview ? (
            <div className="flex h-full items-center justify-center text-muted-foreground/60">
              {uploading || migrating ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <ImageIcon size={20} />
              )}
            </div>
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">Background image</p>
          <p className="text-xs text-muted-foreground">
            Upload a picture and it will sit behind every page. Saved to your account.
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground/70">
            JPG, PNG, or WebP. Compressed automatically before upload.
          </p>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
          event.target.value = '';
        }}
      />

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="tertiary"
          disabled={uploading || migrating}
          onClick={() => fileRef.current?.click()}
          className="rounded-full"
        >
          {uploading ? <Loader2 className="size-4 animate-spin" /> : <ImageIcon className="size-4" />}
          {preview ? 'Replace image' : 'Upload image'}
        </Button>
        {preview ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={uploading}
            onClick={() => void handleRemove()}
            className="rounded-full text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="size-4" />
            Remove
          </Button>
        ) : null}
        {!preview && hasLegacyBackground ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={uploading || migrating || !user}
            onClick={() => void handleLegacyBackground()}
            className="rounded-full text-muted-foreground hover:text-foreground"
          >
            {migrating ? <Loader2 className="size-4 animate-spin" /> : <ImageIcon className="size-4" />}
            Use saved image
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function CustomColorsPanel() {
  const { toast } = useToast();
  const [colors, setColors] = useState<CustomColors>(loadCustomColors);
  const [openSlot, setOpenSlot] = useState<CustomColorKey | null>(null);

  function persist(next: CustomColors) {
    setColors(next);
    try {
      if (Object.keys(next).length === 0) {
        localStorage.removeItem(CUSTOM_COLORS_STORAGE_KEY);
      } else {
        localStorage.setItem(CUSTOM_COLORS_STORAGE_KEY, JSON.stringify(next));
      }
      applyCustomColors(next);
    } catch {
      toast({
        title: 'Couldn\u2019t save colors',
        description: 'Your browser blocked localStorage. Changes won\u2019t persist.',
        variant: 'destructive',
      });
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
          Pick any color for each slot &mdash; text contrast adjusts automatically. Saved on this device.
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
              {isOpen ? (
                <div className="space-y-2 border-t border-foreground/[0.08] p-3">
                  <HexColorPicker
                    color={hex ?? '#888888'}
                    onChange={(value) => handleChange(key, value)}
                    style={{ width: '100%', height: 180 }}
                  />
                  <div className="flex items-center justify-between gap-2">
                    <input
                      type="text"
                      aria-label={`${label} color hex`}
                      value={hex ?? ''}
                      placeholder="#rrggbb"
                      onChange={(event) => {
                        const value = event.target.value;
                        if (/^#[0-9a-fA-F]{6}$/.test(value)) handleChange(key, value);
                      }}
                      className="w-28 rounded-md border border-foreground/15 bg-background px-2 py-1 font-mono text-xs"
                    />
                    {hex ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => handleClear(key)}
                        className="h-7 rounded-full text-xs text-muted-foreground hover:text-destructive"
                      >
                        Clear
                      </Button>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {Object.keys(colors).length > 0 ? (
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
      ) : null}
    </div>
  );
}
