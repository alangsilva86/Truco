import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, repoRoot, '');
  const proxyTarget = env.TRUCO_PROXY_TARGET || 'http://127.0.0.1:2567';

  return {
    envDir: repoRoot,
    plugins: [react(), tailwindcss()],
    server: {
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
        },
        '/health': {
          target: proxyTarget,
          changeOrigin: true,
        },
        '/version': {
          target: proxyTarget,
          changeOrigin: true,
        },
        '/monitor': {
          target: proxyTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
