import { File } from "expo-file-system";
import {
  ImageManipulator,
  SaveFormat,
  type ImageManipulatorContext,
  type ImageRef,
} from "expo-image-manipulator";

const AVATAR_MAX_DIMENSION = 512;
const AVATAR_TARGET_BYTES = 90 * 1024;
const JPEG_QUALITIES = [0.88, 0.8, 0.72, 0.64, 0.56, 0.48] as const;

export type PreparedAvatarImage = {
  file: File;
  mimeType: "image/jpeg";
  size: number;
  width: number;
  height: number;
};

class AvatarPreparationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AvatarPreparationError";
  }
}

/** Resizes and compresses an image into the upload budget used by web avatars. */
export async function prepareAvatarImage(sourceUri: string): Promise<PreparedAvatarImage> {
  let context: ImageManipulatorContext | undefined;
  let image: ImageRef | undefined;

  try {
    context = ImageManipulator.manipulate(sourceUri);
    image = await context.renderAsync();

    if (!isValidDimension(image.width) || !isValidDimension(image.height)) {
      throw new AvatarPreparationError("This photo couldn't be read. Try a different image.");
    }

    if (Math.max(image.width, image.height) > AVATAR_MAX_DIMENSION) {
      const resize = image.width >= image.height
        ? { width: AVATAR_MAX_DIMENSION }
        : { height: AVATAR_MAX_DIMENSION };

      releaseSharedRef(image);
      image = undefined;
      context.resize(resize);
      image = await context.renderAsync();
    }

    for (const quality of JPEG_QUALITIES) {
      const result = await image.saveAsync({
        compress: quality,
        format: SaveFormat.JPEG,
      });
      const file = new File(result.uri);
      const info = file.info();
      const size = info.exists ? info.size : undefined;

      if (typeof size !== "number" || !Number.isFinite(size) || size <= 0) {
        deleteFile(file);
        throw new AvatarPreparationError("The compressed photo couldn't be read. Try a different image.");
      }

      if (size <= AVATAR_TARGET_BYTES) {
        return {
          file,
          mimeType: "image/jpeg",
          size,
          width: result.width,
          height: result.height,
        };
      }

      deleteFile(file);
    }

    throw new AvatarPreparationError(
      "This photo is still too large after compression. Try a smaller or simpler image.",
    );
  } catch (error) {
    if (error instanceof AvatarPreparationError) throw error;
    throw new AvatarPreparationError(
      "This photo couldn't be prepared. Try a different JPG, PNG, or HEIC image.",
    );
  } finally {
    releaseSharedRef(image);
    releaseSharedRef(context);
  }
}

/** Removes the cache file after its upload finishes or fails. */
export function discardPreparedAvatarImage(image: PreparedAvatarImage | null | undefined) {
  if (image) deleteFile(image.file);
}

function isValidDimension(value: number) {
  return Number.isFinite(value) && value > 0;
}

function deleteFile(file: File) {
  try {
    if (file.exists) file.delete();
  } catch {
    // Cache cleanup is best effort and should not mask the upload result.
  }
}

function releaseSharedRef(ref: { release(): void } | null | undefined) {
  try {
    ref?.release();
  } catch {
    // A preparation error is more useful than a secondary release error.
  }
}
