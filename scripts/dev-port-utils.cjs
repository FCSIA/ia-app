const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const devStateDir = path.join(repoRoot, '.dev');
const apiPortFile = path.join(devStateDir, 'api-port.json');

function parsePort(value) {
  const port = Number(value);
  return Number.isInteger(port) && port > 0 && port < 65536 ? port : undefined;
}

function getCliPort(args = process.argv.slice(2)) {
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--port' || arg === '-p') return parsePort(args[index + 1]);
    if (arg.startsWith('--port=')) return parsePort(arg.slice('--port='.length));
    if (arg.startsWith('-p=')) return parsePort(arg.slice('-p='.length));
  }
  return undefined;
}

function isPortAvailable(port, host = '::') {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, host);
  });
}

async function findAvailablePort(startPort, host = '::') {
  for (let port = startPort; port < startPort + 100; port += 1) {
    if (await isPortAvailable(port, host)) return port;
  }
  throw new Error(`No available port found from ${startPort} to ${startPort + 99}`);
}

function ensureDevStateDir() {
  fs.mkdirSync(devStateDir, { recursive: true });
}

function writeApiPort(port) {
  ensureDevStateDir();
  fs.writeFileSync(apiPortFile, JSON.stringify({ port, url: `http://localhost:${port}` }, null, 2));
}

function clearApiPort() {
  try {
    fs.rmSync(apiPortFile, { force: true });
  } catch {
    // Best-effort cleanup only.
  }
}

function readApiPort() {
  try {
    return JSON.parse(fs.readFileSync(apiPortFile, 'utf8'));
  } catch {
    return null;
  }
}

function banner(service, lines) {
  const width = 78;
  const border = '!'.repeat(width);
  const body = lines.map((line) => {
    const text = ` ${service}: ${line}`;
    return `!!${text.padEnd(width - 4, ' ')}!!`;
  });
  console.log(['', border, ...body, border, ''].join('\n'));
}

module.exports = {
  apiPortFile,
  banner,
  clearApiPort,
  findAvailablePort,
  getCliPort,
  parsePort,
  readApiPort,
  writeApiPort,
};

