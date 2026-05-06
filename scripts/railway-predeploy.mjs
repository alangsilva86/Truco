/* global console, process */

import { spawn } from 'node:child_process';

const runtime = String(process.env.APP_RUNTIME ?? '')
  .trim()
  .toLowerCase();

if (runtime !== 'server') {
  console.log(
    `[railway-predeploy] Skipping database migrations for APP_RUNTIME=${runtime || 'unset'}.`,
  );
  process.exit(0);
}

const child = spawn('npm', ['run', 'db:migrate', '-w', '@truco/server'], {
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
