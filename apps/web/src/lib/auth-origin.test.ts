import { describe, expect, test } from 'vitest';
import {
  getPublicAuthOrigin,
  isSameOriginAuthRequest,
  withPublicAuthUrl,
} from './auth-origin';

describe('web auth origin validation', () => {
  test.each([
    'http://localhost:3000',
    'http://10.0.0.231:3000',
    'https://ia-app-dev.loca.lt',
    'https://generated-name.trycloudflare.com',
  ])('accepts same-origin requests from %s', (origin) => {
    const request = new Request(`${origin}/api/auth/sign-in/username`, {
      method: 'POST',
      headers: { origin },
    });

    expect(isSameOriginAuthRequest(request)).toBe(true);
  });

  test('rejects a cross-origin browser request', () => {
    const request = new Request('https://ia-app-dev.loca.lt/api/auth/sign-in/username', {
      method: 'POST',
      headers: { origin: 'https://attacker.example' },
    });

    expect(isSameOriginAuthRequest(request)).toBe(false);
  });

  test('rejects a malformed origin', () => {
    const request = new Request('http://localhost:3000/api/auth/sign-in/username', {
      method: 'POST',
      headers: { origin: 'not a URL' },
    });

    expect(isSameOriginAuthRequest(request)).toBe(false);
  });

  test('defers requests without an Origin header to Better Auth', () => {
    const request = new Request('http://localhost:3000/api/auth/sign-in/username', {
      method: 'POST',
    });

    expect(isSameOriginAuthRequest(request)).toBe(true);
  });

  test('uses the Host header when Next exposes an internal request URL', () => {
    const request = new Request('http://localhost:3000/api/auth/sign-in/username', {
      method: 'POST',
      headers: {
        host: '10.0.0.231:3000',
        origin: 'http://10.0.0.231:3000',
      },
    });

    expect(getPublicAuthOrigin(request)).toBe('http://10.0.0.231:3000');
    expect(isSameOriginAuthRequest(request)).toBe(true);
  });

  test('uses trusted proxy host and protocol headers for HTTPS tunnels', async () => {
    const request = new Request('http://localhost:3000/api/auth/sign-in/username?test=1', {
      method: 'POST',
      headers: {
        host: 'localhost:3000',
        origin: 'https://generated-name.trycloudflare.com',
        'x-forwarded-host': 'generated-name.trycloudflare.com',
        'x-forwarded-proto': 'https',
        'content-type': 'application/json',
      },
      body: '{}',
    });

    expect(isSameOriginAuthRequest(request)).toBe(true);
    const normalized = await withPublicAuthUrl(request);
    expect(normalized?.url).toBe(
      'https://generated-name.trycloudflare.com/api/auth/sign-in/username?test=1',
    );
    expect(await normalized?.text()).toBe('{}');
  });

  test('rejects malformed forwarded hosts and protocols', () => {
    const invalidHost = new Request('http://localhost:3000/api/auth/sign-out', {
      method: 'POST',
      headers: {
        origin: 'https://attacker.example',
        'x-forwarded-host': 'attacker.example/path',
      },
    });
    const invalidProtocol = new Request('http://localhost:3000/api/auth/sign-out', {
      method: 'POST',
      headers: {
        origin: 'https://attacker.example',
        'x-forwarded-host': 'attacker.example',
        'x-forwarded-proto': 'javascript',
      },
    });

    expect(getPublicAuthOrigin(invalidHost)).toBeNull();
    expect(getPublicAuthOrigin(invalidProtocol)).toBeNull();
  });
});
