import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
import { expect, test } from 'vitest';
import { shapeMap } from '@/lib/shape-context';

test('the actual app CSS gives hover and pressed layers the numeric radius used by Fluid selection', async () => {
  const file = fileURLToPath(new URL('../../app/globals.css', import.meta.url));
  const result = await postcss([tailwind()]).process(await readFile(file, 'utf8'), { from: file });
  const values: string[] = [];
  postcss.parse(result.css).walkRules((rule) => {
    if (rule.selector === `.${shapeMap.rounded.bg}` || rule.selector === '.after\\:rounded-lg::after') {
      rule.walkDecls('border-radius', (declaration) => { values.push(declaration.value); });
    }
  });
  expect(values.length).toBeGreaterThanOrEqual(2);
  expect(new Set(values)).toEqual(new Set([`${shapeMap.rounded.bgRadius}px`]));
  expect(shapeMap.rounded.bgRadius).toBe(shapeMap.rounded.mergedRadius);
});
