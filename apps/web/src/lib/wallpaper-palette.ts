/** Pick a few distinct, representative colors from a small image sample. */
export function paletteFromPixels(data: Uint8ClampedArray): string[] {
  const buckets = Array.from({ length: 18 }, () => ({ weight: 0, r: 0, g: 0, b: 0 }));
  let neutralWeight = 0;
  let neutralR = 0;
  let neutralG = 0;
  let neutralB = 0;

  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3] / 255;
    if (alpha < 0.5) continue;
    const r = data[i] / 255;
    const g = data[i + 1] / 255;
    const b = data[i + 2] / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const lightness = (max + min) / 2;
    if (lightness < 0.1 || lightness > 0.92) continue;

    neutralWeight += alpha;
    neutralR += r * alpha;
    neutralG += g * alpha;
    neutralB += b * alpha;

    const delta = max - min;
    const saturation = delta / (1 - Math.abs(2 * lightness - 1));
    if (saturation < 0.18) continue;

    let hue: number;
    if (max === r) hue = ((g - b) / delta) % 6;
    else if (max === g) hue = (b - r) / delta + 2;
    else hue = (r - g) / delta + 4;
    hue = (hue * 60 + 360) % 360;

    const bucket = buckets[Math.floor(hue / 20)];
    const weight = alpha * (0.5 + saturation);
    bucket.weight += weight;
    bucket.r += r * weight;
    bucket.g += g * weight;
    bucket.b += b * weight;
  }

  const ranked = buckets
    .map((bucket, index) => ({ ...bucket, index }))
    .filter((bucket) => bucket.weight > 0)
    .sort((a, b) => b.weight - a.weight || a.index - b.index);

  const selected: typeof ranked = [];
  for (const bucket of ranked) {
    if (selected.length === 3) break;
    if (bucket.weight < ranked[0].weight * 0.12) break;
    if (selected.some((choice) => {
      const distance = Math.abs(choice.index - bucket.index);
      return Math.min(distance, 18 - distance) < 2;
    })) continue;
    selected.push(bucket);
  }

  if (selected.length > 0) {
    return selected.map(({ r, g, b, weight }) => toHex(r / weight, g / weight, b / weight));
  }
  return neutralWeight > 0
    ? [toHex(neutralR / neutralWeight, neutralG / neutralWeight, neutralB / neutralWeight)]
    : [];
}

export async function paletteFromImage(file: Blob): Promise<string[]> {
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('Could not read image colors'));
      element.src = url;
    });
    const scale = Math.min(1, 64 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return [];
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return paletteFromPixels(context.getImageData(0, 0, canvas.width, canvas.height).data);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function toHex(r: number, g: number, b: number): string {
  return `#${[r, g, b]
    .map((channel) => Math.round(channel * 255).toString(16).padStart(2, '0'))
    .join('')}`;
}
