const { spawn } = require('node:child_process');
const {
  banner,
  clearApiPort,
  findAvailablePort,
  getCliPort,
  parsePort,
  writeApiPort,
} = require('./dev-port-utils.cjs');

async function main() {
  const requestedPort = getCliPort() ?? parsePort(process.env.API_PORT) ?? 3001;
  const port = await findAvailablePort(requestedPort);

  clearApiPort();
  writeApiPort(port);

  banner('API DEV SERVER', [
    port === requestedPort
      ? `using requested port ${port}`
      : `port ${requestedPort} was busy, using fallback port ${port}`,
    `API_URL=http://localhost:${port}`,
    `Swagger=http://localhost:${port}/docs`,
  ]);

  const child = spawn(
    process.execPath,
    [
      '--watch-path=src',
      '--require',
      'ts-node/register',
      '--require',
      'tsconfig-paths/register',
      'src/main.ts',
      '--port',
      String(port),
    ],
    {
      cwd: 'apps/api',
      env: { ...process.env, API_PORT: String(port) },
      stdio: 'inherit',
    },
  );

  const cleanup = () => clearApiPort();
  process.on('exit', cleanup);
  process.on('SIGINT', () => {
    cleanup();
    child.kill('SIGINT');
  });
  process.on('SIGTERM', () => {
    cleanup();
    child.kill('SIGTERM');
  });
  child.on('exit', (code, signal) => {
    cleanup();
    if (signal) process.kill(process.pid, signal);
    process.exit(code ?? 0);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

