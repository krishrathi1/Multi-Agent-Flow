import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const devPort = Number(env.VITE_DEV_PORT);
  if (!Number.isInteger(devPort) || devPort <= 0) throw new Error('VITE_DEV_PORT must be configured');
  if (!env.VITE_BACKEND_URL) throw new Error('VITE_BACKEND_URL must be configured');

  return {
    plugins: [react(), tailwindcss()],
    resolve: { alias: { '@': path.resolve(__dirname, './src') } },
    server: {
      port: devPort,
      proxy: {
        '/api': env.VITE_BACKEND_URL,
        '/socket.io': { target: env.VITE_BACKEND_URL, ws: true },
      },
    },
  };
});
