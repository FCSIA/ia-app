import { execSync } from 'node:child_process';

const port = Number(process.argv[2] ?? 3000);
if (!Number.isFinite(port) || port < 1 || port > 65535) {
  console.error('Usage: node scripts/ensure-port.mjs <port>');
  process.exit(1);
}

function findPids(targetPort) {
  const pids = new Set();

  if (process.platform === 'win32') {
    const output = execSync('netstat -ano', { encoding: 'utf8' });
    for (const line of output.split(/\r?\n/)) {
      if (!line.includes(`:${targetPort}`) || !line.includes('LISTENING')) continue;
      const pid = Number(line.trim().split(/\s+/).at(-1));
      if (pid > 0) pids.add(pid);
    }
    return [...pids];
  }

  try {
    const output = execSync(`lsof -ti tcp:${targetPort}`, { encoding: 'utf8' });
    return output
      .split(/\s+/)
      .map((value) => Number(value))
      .filter((pid) => pid > 0);
  } catch {
    return [];
  }
}

function killPid(pid) {
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
    } else {
      execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
    }
    return true;
  } catch {
    return false;
  }
}

const pids = findPids(port).filter((pid) => pid !== process.pid);
if (pids.length === 0) {
  process.exit(0);
}

for (const pid of pids) {
  if (killPid(pid)) {
    console.log(`Freed port ${port} (stopped PID ${pid})`);
  }
}
