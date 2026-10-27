import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { artAssets } from './tools/artAssets.ts';

export default defineConfig({
  plugins: [react(), artAssets()],
  // DECISIÓN: `assets/` es la carpeta de arte de la biblia (concept, models, sprites, icons).
  // No se usa como publicDir para no copiar conceptos ni .glb al build; el plugin artAssets
  // solo publica sprites/, icons/ y manifest.json. El JS/CSS compilado va a `static/`.
  publicDir: false,
  build: { assetsDir: 'static' },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // Permite forzar el GC en los tests de allocations (tests/alloc.test.ts).
    pool: 'forks',
    execArgv: ['--expose-gc'],
  },
});
