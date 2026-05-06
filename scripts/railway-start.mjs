/* global console, process */

import { spawn } from 'node:child_process';

const runtime = String(process.env.APP_RUNTIME ?? '')
  .trim()
  .toLowerCase();

const commandByRuntime = {
  server: ['npm', ['run', 'start:server']],
  web: ['npm', ['run', 'start:web']],
};

const target = commandByRuntime[runtime];

if (!target) {
  console.error(
    '[railway-start] APP_RUNTIME must be set to "server" or "web" before running npm start.',
  );
  process.exit(1);
}

const [command, args] = target;
const child = spawn(command, args, {
  shell: process.platform === 'win32',
  stdio: 'inherit',
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
