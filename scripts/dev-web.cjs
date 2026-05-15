const { spawn } = require('node:child_process');
const {
  apiPortFile,
  banner,
  findAvailablePort,
  getCliPort,
  parsePort,
  readApiPort,
} = require('./dev-port-utils.cjs');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForApiPort(timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const state = readApiPort();
    if (state?.port) return state.port;
    await sleep(100);
  }
  return null;
}

async function main() {
  const requestedWebPort = getCliPort() ?? parsePort(process.env.WEB_PORT) ?? parsePort(process.env.PORT) ?? 3000;
  const apiPort = parsePort(process.env.API_PORT) ?? await waitForApiPort();
  const apiUrl = apiPort ? `http://localhost:${apiPort}` : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001');
  let webPort = await findAvailablePort(requestedWebPort);
  if (apiPort && webPort === apiPort) {
    webPort = await findAvailablePort(apiPort + 1);
  }

  banner('WEB DEV SERVER', [
    webPort === requestedWebPort
      ? `using requested port ${webPort}`
      : `port ${requestedWebPort} was busy, using fallback port ${webPort}`,
    apiPort
      ? `connected to API at ${apiUrl}`
      : `API port file not found at ${apiPortFile}; using ${apiUrl}`,
    `WEB_URL=http://localhost:${webPort}`,
  ]);

  const child = spawn('next', ['dev', '-p', String(webPort)], {
    cwd: 'apps/web',
    env: {
      ...process.env,
      PORT: String(webPort),
      NEXT_PUBLIC_API_URL: apiUrl,
      API_PROXY_TARGET: apiUrl,
    },
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  child.on('exit', (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    process.exit(code ?? 0);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
