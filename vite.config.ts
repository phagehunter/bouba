import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

const version = JSON.parse(readFileSync('package.json', 'utf8')).version;

export default defineConfig({
  base: './', // relative paths, so the build works at any web address and inside the desktop and Android apps
  plugins: [svelte()],
  define: { __APP_VERSION__: JSON.stringify(version) },
  build: { outDir: 'dist', cssCodeSplit: false, chunkSizeWarningLimit: 8000 },
  test: { include: ['tests/**/*.test.ts'] },
});
