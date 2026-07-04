'use client';

import { useRef, useState } from 'react';
import { useMutation } from 'convex/react';
import { Camera, Loader2, Trash2 } from 'lucide-react';
import { api } from '~/apps/convex/src/_generated/api';
import { UserAvatar } from '@/components/ui/user-avatar';
import { useToast } from '@/hooks/use-toast';
import type { AppUser } from '@/lib/auth';
import { uploadUserImage } from '@/lib/upload-user-image';

export function ProfileAvatarEditor({ user }: { user: AppUser }) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const generateUploadUrl = useMutation(api.uploads.files.generateUploadUrl);
  const saveUserImage = useMutation(api.users.me.saveUserImage);
  const clearUserImage = useMutation(api.users.me.clearUserImage);

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
      await uploadUserImage(
        { generateUploadUrl: () => generateUploadUrl({}) },
        (args) => saveUserImage(args),
        'avatar',
        file,
      );
      toast({ title: 'Profile picture updated' });
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
      await clearUserImage({ kind: 'avatar' });
      toast({ title: 'Profile picture removed' });
    } catch (e: unknown) {
      toast({
        title: e instanceof Error ? e.message : 'Failed to remove picture',
        variant: 'destructive',
      });
    }
  }

  return (
    <div className="relative shrink-0">
      <UserAvatar
        firstName={user.firstName}
        lastName={user.lastName}
        avatarUrl={user.avatarUrl}
        className="size-16 rounded-2xl"
        fallbackClassName="text-xl rounded-2xl"
      />
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
      <button
        type="button"
        disabled={uploading}
        onClick={() => fileRef.current?.click()}
        className="absolute -bottom-1 -right-1 flex size-7 items-center justify-center rounded-full border bg-background shadow-sm transition-colors hover:bg-muted disabled:opacity-50"
        aria-label="Change profile picture"
      >
        {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Camera className="size-3.5" />}
      </button>
      {user.avatarUrl ? (
        <button
          type="button"
          onClick={() => void handleRemove()}
          className="absolute -top-1 -right-1 flex size-6 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm transition-colors hover:text-destructive"
          aria-label="Remove profile picture"
        >
          <Trash2 className="size-3" />
        </button>
      ) : null}
    </div>
  );
}
