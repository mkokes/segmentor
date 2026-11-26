/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const normalizeBase = (base: string | undefined) => {
  const trimmed = (base ?? '').trim().replace(/^\/+|\/+$/g, '');
  return trimmed ? `/${trimmed}/` : '/';
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        manifest: {
          name: 'Segmentor — Segmented Woodturning Studio',
          short_name: 'Segmentor',
          description:
            'Design closed-segment, open-segment, and stave woodturned bowls and vases with kerf-accurate cut sheets and 1:1 printable templates.',
          theme_color: '#1C1410',
          background_color: '#1C1410',
          display: 'standalone',
        },
      }),
    ],
    base: normalizeBase(env.VITE_BASE_PATH),
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
    },
  };
});
