import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // Keep local defaults available for a fresh checkout and CI builds. Both
  // values can still be overridden through frontend/.env or the environment.
  const devPort = Number(env.VITE_DEV_PORT || 5173);
  const backendUrl = env.VITE_BACKEND_URL || 'http://localhost:4000';

  return {
    plugins: [react(), tailwindcss()],
    resolve: { alias: { '@': path.resolve(__dirname, './src') } },
    server: {
      port: devPort,
      proxy: {
        '/api': backendUrl,
        '/preview': backendUrl,
        '/socket.io': { target: backendUrl, ws: true },
      },
    },
  };
});
