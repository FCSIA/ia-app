/** Client-side compression to keep per-user storage within the 3k-user budget. */
export type ImageCompressPreset = 'avatar' | 'background';

const PRESETS = {
  avatar: { maxDimension: 512, maxBytes: 90 * 1024 },
  background: { maxWidth: 1440, maxBytes: 220 * 1024 },
} as const;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read image'));
    };
    img.src = url;
  });
}

function scaledSize(
  width: number,
  height: number,
  preset: ImageCompressPreset,
): { width: number; height: number } {
  if (preset === 'avatar') {
    const max = PRESETS.avatar.maxDimension;
    const scale = Math.min(1, max / Math.max(width, height));
    return { width: Math.round(width * scale), height: Math.round(height * scale) };
  }

  const maxWidth = PRESETS.background.maxWidth;
  if (width <= maxWidth) return { width, height };
  const scale = maxWidth / width;
  return { width: maxWidth, height: Math.round(height * scale) };
}

async function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', quality);
  });
}

export async function compressImageForUpload(
  file: File,
  preset: ImageCompressPreset,
): Promise<File> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Not an image');
  }

  const img = await loadImage(file);
  const { width, height } = scaledSize(img.naturalWidth, img.naturalHeight, preset);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not process image');
  ctx.drawImage(img, 0, 0, width, height);

  const maxBytes = PRESETS[preset].maxBytes;
  let quality = 0.88;
  let blob: Blob | null = null;

  while (quality >= 0.45) {
    blob = await canvasToJpegBlob(canvas, quality);
    if (!blob) break;
    if (blob.size <= maxBytes) break;
    quality -= 0.08;
  }

  if (!blob) throw new Error('Could not compress image');
  if (blob.size > maxBytes) {
    throw new Error('Image is still too large after compression. Try a smaller photo.');
  }

  const baseName = file.name.replace(/\.[^.]+$/, '') || preset;
  return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' });
}
