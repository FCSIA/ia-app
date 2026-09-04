'use client';

import { useState } from 'react';
import { useAction, useMutation } from '@/lib/convex-react';
import { Droplet, Image as ImageIcon, Loader2, RotateCcw, Trash2 } from 'lucide-react';
import {
  CUSTOM_COLORS_STORAGE_KEY,
  applyCustomColors,
  customColorSlots,
  loadCustomColors,
  validateCustomColors,
  type CustomColorKey,
  type CustomColorErrors,
  type CustomColors,
} from '@/lib/custom-theme';
import { Button } from '@/components/ui/button';
import { ColorPicker } from '@/components/ui/color-picker';
import { FileInput } from '@/components/ui/file-input';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useCurrentUser } from '@/lib/auth';
import { uploadUserImage } from '@/lib/upload-user-image';
import { api } from '~/apps/convex/src/_generated/api';

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
  const [uploading, setUploading] = useState(false);
  const generateUploadUrl = useMutation(api.uploads.files.generateUploadUrl);
  const saveUserImage = useAction(api.users.me.saveUserImage);
  const clearUserImage = useMutation(api.users.me.clearUserImage);

  const preview = user?.customBackgroundUrl ?? null;

  async function uploadAndSave(file: File) {
    await uploadUserImage(
      { generateUploadUrl: () => generateUploadUrl({ purpose: "USER_IMAGE" }) },
      (args) => saveUserImage(args),
      'background',
      file,
    );
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
              {uploading ? (
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
            If page text blends into the picture, choose a Text color under Colors.
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground/70">
            JPG, PNG, or WebP. Compressed automatically before upload.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <FileInput
          accept="image/*"
          disabled={uploading}
          loading={uploading}
          label={preview ? 'Replace image' : 'Upload image'}
          onFileSelect={(file) => void handleFile(file)}
        />
        {preview ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            leadingIcon={Trash2}
            disabled={uploading}
            onClick={() => void handleRemove()}
            className="rounded-full text-muted-foreground hover:text-destructive"
          >
            Remove
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function CustomColorsPanel() {
  const { toast } = useToast();
  const [colors, setColors] = useState<CustomColors>(loadCustomColors);
  const [validationErrors, setValidationErrors] = useState<CustomColorErrors>({});
  const [openSlot, setOpenSlot] = useState<CustomColorKey | null>(null);

  function persist(next: CustomColors) {
    setColors(next);
    const errors = validateCustomColors(next);
    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) return;

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
          Surface contrast adjusts automatically. Unreadable page, link, and icon combinations are not saved.
        </p>
        <p className="text-[11px] text-muted-foreground/70">
          Wallpaper pixels cannot be checked automatically; review page text over your image before leaving.
        </p>
      </div>

      <div className="space-y-2">
        {customColorSlots.map(({ key, label, help }) => {
          const hex = colors[key];
          const isOpen = openSlot === key;
          const error = validationErrors[key];
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
                  <ColorPicker
                    value={hex ?? '#888888'}
                    format="hex"
                    hideAlpha
                    onValueChange={(value) => handleChange(key, value.slice(0, 7))}
                    swatches={['#f95b01', '#2563eb', '#16a34a', '#7c3aed', '#0f172a', '#f8fafc']}
                    className="w-full"
                  />
                  <div className="flex justify-end">
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
                  {error ? (
                    <p className="text-xs leading-5 text-destructive" role="alert">
                      {error} This draft has not been applied or saved.
                    </p>
                  ) : null}
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
          leadingIcon={RotateCcw}
          onClick={handleResetAll}
          className="rounded-full text-muted-foreground hover:text-foreground"
        >
          Reset all colors
        </Button>
      ) : null}
    </div>
  );
}
