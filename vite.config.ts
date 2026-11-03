import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { artAssets } from './tools/artAssets.ts';
import { pwa } from './tools/pwa.ts';
import { devTuning } from './tools/devTuning.ts';

export default defineConfig({
  plugins: [react(), artAssets(), pwa(), devTuning()],
  // DECISIÓN: `assets/` es la carpeta de arte de la biblia (concept, models, sprites, icons).
  // No se usa como publicDir para no copiar conceptos ni .glb al build; el plugin artAssets
  // solo publica sprites/, icons/ y manifest.json. El JS/CSS compilado va a `static/`.
  publicDir: false,
  // `privacidad.html` es la política de privacidad que piden Google OAuth y Google Play (Vercel la sirve en /privacidad).
  build: { assetsDir: 'static', rollupOptions: { input: ['index.html', 'privacidad.html'] } },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // Los tests no ven las claves de `.env.local`: el online se prueba siempre apagado.
    env: { VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' },
    // Permite forzar el GC en los tests de allocations (tests/alloc.test.ts).
    pool: 'forks',
    execArgv: ['--expose-gc'],
  },
});
