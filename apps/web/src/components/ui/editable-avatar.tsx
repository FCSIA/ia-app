'use client';

import { Camera, Loader2, Trash2 } from 'lucide-react';
import type { CSSProperties } from 'react';
import { FileInput } from '@/components/ui/file-input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type EditableAvatarProps = {
  alt: string;
  canEdit?: boolean;
  className?: string;
  disabled?: boolean;
  fallback: string;
  fallbackClassName?: string;
  fallbackStyle?: CSSProperties;
  imageUrl?: string | null;
  loading?: boolean;
  onRemove?: () => void;
  onUpload?: (file: File) => void;
  removeLabel?: string;
  uploadLabel?: string;
  variant?: 'overlay' | 'inline';
};

export function EditableAvatar({
  alt,
  canEdit = false,
  className,
  disabled = false,
  fallback,
  fallbackClassName,
  fallbackStyle,
  imageUrl,
  loading = false,
  onRemove,
  onUpload,
  removeLabel = 'Remove image',
  uploadLabel = 'Change image',
  variant = 'overlay',
}: EditableAvatarProps) {
  const editable = canEdit && Boolean(onUpload);
  const canRemove = editable && Boolean(imageUrl) && Boolean(onRemove);
  const revealClass = loading
    ? 'opacity-100'
    : 'opacity-0 group-hover/avatar:opacity-100 group-focus-within/avatar:opacity-100';
  const interactionClass = loading
    ? 'pointer-events-auto'
    : 'pointer-events-none group-hover/avatar:pointer-events-auto group-focus-within/avatar:pointer-events-auto';

  return (
    <div
      className={cn(
        'relative w-fit shrink-0',
        variant === 'overlay' && editable && 'group/avatar',
        variant === 'inline' && 'flex items-center gap-3',
      )}
    >
      <Avatar
        className={cn(
          'border border-border/60 bg-background shadow-sm',
          variant === 'overlay' &&
            editable &&
            'cursor-pointer transition-shadow duration-150 motion-reduce:transition-none group-hover/avatar:ring-2 group-hover/avatar:ring-ring/25 group-focus-within/avatar:ring-2 group-focus-within/avatar:ring-ring/40',
          className,
        )}
      >
        {imageUrl ? <AvatarImage src={imageUrl} alt={alt} /> : null}
        <AvatarFallback className={cn('font-semibold', fallbackClassName)} style={fallbackStyle}>
          {fallback}
        </AvatarFallback>
      </Avatar>

      {editable ? (
        variant === 'overlay' ? (
          <FileInput
            accept="image/*"
            disabled={disabled}
            loading={loading}
            onFileSelect={(file) => onUpload?.(file)}
          >
            {({ disabled: inputDisabled, open }) => (
              <button
                type="button"
                disabled={inputDisabled}
                onClick={open}
                className={cn(
                  'absolute inset-0 flex cursor-pointer items-center justify-center rounded-2xl bg-gradient-to-t from-black/55 via-black/25 to-black/5 text-white transition-opacity duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
                  revealClass,
                  interactionClass,
                )}
                aria-label={uploadLabel}
              >
                <span className="flex size-9 scale-95 items-center justify-center rounded-full border border-white/20 bg-background/95 text-foreground shadow-sm backdrop-blur transition-transform duration-150 group-hover/avatar:scale-100 group-focus-within/avatar:scale-100 motion-reduce:transition-none">
                  {loading ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
                </span>
              </button>
            )}
          </FileInput>
        ) : (
          <div className="flex flex-wrap gap-2">
            <FileInput
              accept="image/*"
              disabled={disabled}
              loading={loading}
              label={uploadLabel}
              onFileSelect={(file) => onUpload?.(file)}
            />
            {canRemove ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                disabled={disabled || loading}
                onClick={onRemove}
              >
                <Trash2 className="size-3.5" />
                {removeLabel}
              </Button>
            ) : null}
          </div>
        )
      ) : null}

      {canRemove && variant === 'overlay' ? (
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled || loading}
          className={cn(
            'absolute right-1 top-1 z-10 flex size-7 cursor-pointer items-center justify-center rounded-full border border-border/70 bg-background/95 text-muted-foreground shadow-sm backdrop-blur transition-[color,opacity,transform] duration-150 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none',
            revealClass,
            interactionClass,
          )}
          aria-label={removeLabel}
        >
          <Trash2 className="size-3" />
        </button>
      ) : null}
    </div>
  );
}
