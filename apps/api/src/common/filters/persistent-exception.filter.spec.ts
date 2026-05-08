import { mkdtemp, readFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { PersistentExceptionFilter } from './persistent-exception.filter';

describe('PersistentExceptionFilter', () => {
  const originalErrorLogDir = process.env.ERROR_LOG_DIR;

  afterEach(() => {
    process.env.ERROR_LOG_DIR = originalErrorLogDir;
  });

  it('persists 500-level backend failures to a local jsonl file', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ia-errors-'));
    process.env.ERROR_LOG_DIR = dir;
    const filter = new PersistentExceptionFilter();
    const status = jest.fn().mockReturnThis();
    const json = jest.fn();
    const host: any = {
      switchToHttp: () => ({
        getResponse: () => ({ status, json }),
        getRequest: () => ({
          method: 'GET',
          originalUrl: '/boom',
          url: '/boom',
          headers: {},
          user: { id: 'user-1' },
        }),
      }),
    };

    await filter.catch(new Error('boom'), host);

    const today = new Date().toISOString().slice(0, 10);
    const contents = await readFile(join(dir, `server-errors-${today}.jsonl`), 'utf8');
    expect(contents).toContain('"path":"/boom"');
    expect(contents).toContain('"userId":"user-1"');
    expect(status).toHaveBeenCalledWith(500);
  });
});
