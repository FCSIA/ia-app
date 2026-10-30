import { vi } from 'vitest';
import aggregateTest from '@convex-dev/aggregate/test';

// Audit logging is application plumbing: every mutation fixture needs the same
// registered components as the app, including tests outside the audit feature.
vi.mock('convex-test', async (importOriginal) => {
  const original = await importOriginal<typeof import('convex-test')>();
  return {
    ...original,
    convexTest: (...args: Parameters<typeof original.convexTest>) => {
      const t = original.convexTest(...args);
      aggregateTest.register(t, 'auditByCategory');
      aggregateTest.register(t, 'auditByActor');
      return t;
    },
  };
});
