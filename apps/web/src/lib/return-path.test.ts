import { describe, expect, test } from 'vitest';
import { safeReturnPath } from './return-path';

describe('safeReturnPath', () => {
  test('keeps same-site paths with their query', () => {
    expect(safeReturnPath('/device?user_code=ABCDEFGH')).toBe('/device?user_code=ABCDEFGH');
    expect(safeReturnPath('/profile#cli-sign-ins')).toBe('/profile#cli-sign-ins');
  });

  test('rejects anything that could leave the site or loop', () => {
    for (const value of [null, '', 'device', 'https://evil.test', '//evil.test', '/\\evil.test', '/\tevil', '/login?next=/x']) {
      expect(safeReturnPath(value)).toBeNull();
    }
  });
});
