import type { Id } from '~/apps/convex/src/_generated/dataModel';
import { compressImageForUpload, type ImageCompressPreset } from '@/lib/compress-image';
import { uploadFileToConvex } from '@/lib/convex-upload';

type UploadClient = {
  generateUploadUrl: () => Promise<{
    uploadUrl: string;
    uploadIntentId: Id<'uploadIntents'>;
  }>;
};

type SaveUserImage<TResult> = (args: {
  kind: 'avatar' | 'background';
  uploadIntentId: Id<'uploadIntents'>;
  storageId: Id<'_storage'>;
  mimeType: string;
  size: number;
}) => Promise<TResult>;

export async function uploadUserImage<TResult>(
  convex: UploadClient,
  saveUserImage: SaveUserImage<TResult>,
  kind: ImageCompressPreset,
  file: File,
): Promise<TResult> {
  const compressed = await compressImageForUpload(file, kind);
  const { storageId, uploadIntentId } = await uploadFileToConvex(convex, compressed);
  return saveUserImage({
    kind,
    uploadIntentId,
    storageId,
    mimeType: compressed.type,
    size: compressed.size,
  });
}
