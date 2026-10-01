import { describe, expect, test } from 'vitest';
import { paletteFromPixels } from './wallpaper-palette';

function pixels(...colors: Array<[number, number, number, number?]>): Uint8ClampedArray {
  return new Uint8ClampedArray(colors.flatMap(([r, g, b, a = 255]) => [r, g, b, a]));
}

describe('wallpaper palette extraction', () => {
  test('offers distinct colors for a multicolor image', () => {
    const palette = paletteFromPixels(pixels(
      [220, 60, 40], [220, 60, 40], [40, 130, 210], [40, 130, 210], [60, 180, 90],
    ));
    expect(palette).toHaveLength(3);
    expect(palette).toContain('#dc3c28');
    expect(palette).toContain('#2882d2');
    expect(palette).toContain('#3cb45a');
  });

  test('uses one neutral choice for a monochrome image', () => {
    expect(paletteFromPixels(pixels([90, 90, 90], [110, 110, 110]))).toEqual(['#646464']);
  });

  test('does not suggest a color from a tiny outlier', () => {
    const dominant = Array.from({ length: 100 }, () => [210, 55, 40] as [number, number, number]);
    expect(paletteFromPixels(pixels(...dominant, [40, 100, 200]))).toEqual(['#d23728']);
  });

  test('ignores transparent and near-white pixels', () => {
    expect(paletteFromPixels(pixels([255, 0, 0, 0], [255, 255, 255], [20, 100, 180])))
      .toEqual(['#1464b4']);
  });
});
