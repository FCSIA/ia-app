import type { Id } from '~/apps/convex/src/_generated/dataModel';
import { compressImageForUpload, type ImageCompressPreset } from '@/lib/compress-image';
import { uploadFileToConvex } from '@/lib/convex-upload';

type UploadClient = {
  generateUploadUrl: () => Promise<string>;
};

type SaveUserImage = (args: {
  kind: 'avatar' | 'background';
  storageId: Id<'_storage'>;
  mimeType: string;
  size: number;
}) => Promise<unknown>;

export async function uploadUserImage(
  convex: UploadClient,
  saveUserImage: SaveUserImage,
  kind: ImageCompressPreset,
  file: File,
) {
  const compressed = await compressImageForUpload(file, kind);
  const storageId = await uploadFileToConvex(convex, compressed);
  await saveUserImage({
    kind,
    storageId,
    mimeType: compressed.type,
    size: compressed.size,
  });
}
