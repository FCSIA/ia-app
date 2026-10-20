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
import { ColorPicker, ColorSwatch } from '@/components/ui/color-picker';
import { FileInput } from '@/components/ui/file-input';
import { Tabs, TabsList, TabItem, TabPanel } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useCurrentUser } from '@/lib/auth';
import { uploadUserImage } from '@/lib/upload-user-image';
import { paletteFromImage } from '@/lib/wallpaper-palette';
import { api } from '~/apps/convex/src/_generated/api';

export function CustomThemeEditor() {
  return (
    <Tabs defaultValue="image" className="space-y-3 rounded-2xl border border-foreground/[0.08] bg-foreground/[0.02] p-4">
      <TabsList aria-label="Custom theme">
        <TabItem value="image" icon={ImageIcon} label="Image" />
        <TabItem value="colors" icon={Droplet} label="Colors" />
      </TabsList>
      <TabPanel value="image"><CustomBackgroundPanel /></TabPanel>
      <TabPanel value="colors"><CustomColorsPanel /></TabPanel>
    </Tabs>
  );
}

function CustomBackgroundPanel() {
  const { toast } = useToast();
  const user = useCurrentUser();
  const [uploading, setUploading] = useState(false);
  const [sampling, setSampling] = useState(false);
  const [pendingTint, setPendingTint] = useState<string | null>(null);
  const generateUploadUrl = useMutation(api.uploads.files.generateUploadUrl);
  const saveUserImage = useAction(api.users.me.saveUserImage);
  const clearUserImage = useMutation(api.users.me.clearUserImage);
  const setPalette = useMutation(api.users.me.setCustomBackgroundPalette);
  const setTint = useMutation(api.users.me.setCustomBackgroundTint);

  const preview = user?.customBackgroundUrl ?? null;
  const palette = user?.customBackgroundPalette ?? [];
  const selectedTint = pendingTint ?? user?.customBackgroundTint;

  async function uploadAndSave(file: File) {
    const wallpaperPalette = await paletteFromImage(file).catch(() => []);
    await uploadUserImage(
      { generateUploadUrl: () => generateUploadUrl({ purpose: "USER_IMAGE" }) },
      (args) => saveUserImage(args),
      'background',
      file,
      wallpaperPalette,
    );
  }

  async function handleSampleSavedImage() {
    if (!preview) return;
    setSampling(true);
    try {
      const response = await fetch(preview);
      if (!response.ok) throw new Error('Could not read the saved image');
      const colors = await paletteFromImage(await response.blob());
      if (colors.length === 0) throw new Error('No usable colors found in the image');
      await setPalette({ palette: colors, expectedUrl: preview });
    } catch {
      toast({
        title: 'Couldn’t sample this image',
        description: 'Replace the image to generate color choices.',
        variant: 'destructive',
      });
    } finally {
      setSampling(false);
    }
  }

  async function handleTint(tint: string) {
    if (pendingTint || tint === selectedTint) return;
    setPendingTint(tint);
    try {
      await setTint({ tint });
    } catch {
      toast({ title: 'Couldn’t save the tint', variant: 'destructive' });
    } finally {
      setPendingTint(null);
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
            Saved to your account.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            If page text blends into the picture, choose a Text color under Colors.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <FileInput
          accept="image/*"
          disabled={uploading || sampling}
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
            disabled={uploading || sampling}
            onClick={() => void handleRemove()}
            className="rounded-full text-muted-foreground hover:text-destructive"
          >
            Remove
          </Button>
        ) : null}
      </div>

      {preview ? (
        <div className="space-y-2 border-t border-foreground/[0.08] pt-3">
          <div>
            <p className="text-sm font-medium text-foreground">Surface tint</p>
            <p className="text-xs text-muted-foreground">
              Choose an image color for cards and menus.
            </p>
          </div>
          {palette.length > 0 ? (
            <div role="group" aria-label="Choose a wallpaper surface tint" className="flex flex-wrap gap-3 px-1 py-1">
              {palette.map((color, index) => (
                <ColorSwatch
                  key={color}
                  color={color}
                  size={40}
                  selected={selectedTint === color}
                  aria-label={`Wallpaper color ${index + 1}: ${color}`}
                  aria-pressed={selectedTint === color}
                  aria-disabled={pendingTint !== null}
                  onClick={() => void handleTint(color)}
                />
              ))}
            </div>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={sampling || uploading}
              onClick={() => void handleSampleSavedImage()}
            >
              {sampling ? 'Finding colors…' : 'Find image colors'}
            </Button>
          )}
        </div>
      ) : null}
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
        <p className="text-xs text-muted-foreground">
          Surface contrast adjusts automatically. Unreadable page, link, and icon combinations are not saved.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
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
                  <p className="text-xs text-muted-foreground">{help}</p>
                </div>
                <span className={cn('text-xs text-muted-foreground', hex && 'font-mono')}>
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
