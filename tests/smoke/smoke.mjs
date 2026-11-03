/* global process, console, window */
// Smoke test (T3): arranca el servidor de desarrollo, juega 60 s de partida con el piloto automático y comprueba que
// no hay errores en consola. Guarda una captura en out/smoke.png. Uso: npm run smoke [-- --char=gus --seed=3]
// DECISIÓN: usa el Edge o Chrome instalados (channel) para no descargar navegadores; si no hay ninguno, el Chromium
// de Playwright (npx playwright install chromium).
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split('=')[1] ?? d;
const CHAR = arg('char', 'dot');
const SEED = arg('seed', '1');
const GAME_SECONDS = Number(arg('seconds', '60'));
const SPEED = 2;

const server = await createServer({ server: { port: 5199, strictPort: false }, logLevel: 'error' });
await server.listen();
const url = server.resolvedUrls.local[0];

async function launch() {
  for (const channel of ['msedge', 'chrome', undefined]) {
    try {
      return await chromium.launch({
        channel,
        args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
      });
    } catch {
      // siguiente opción
    }
  }
  throw new Error('No hay navegador: instala Edge/Chrome o ejecuta `npx playwright install chromium`.');
}

const errors = [];
const browser = await launch();
let ok = false;
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${url}?dev&char=${CHAR}&seed=${SEED}&god=1&bot=kite&speed=${SPEED}&panel=0`);
  await page.waitForFunction(() => window.__world !== undefined, null, { timeout: 30_000 });
  const timeout = ((GAME_SECONDS / SPEED) * 3 + 30) * 1000;
  await page.waitForFunction((s) => window.__world.time >= s, GAME_SECONDS, { timeout, polling: 500 });
  const state = await page.evaluate(() => {
    const w = window.__world;
    return { time: w.time, level: w.level, kills: w.kills, alive: w.enemies.count };
  });
  mkdirSync('out', { recursive: true });
  await page.screenshot({ path: 'out/smoke.png' });
  console.log(
    `smoke: ${CHAR} semilla ${SEED} → ${state.time.toFixed(1)} s, nivel ${state.level}, bajas ${state.kills}, vivos ${state.alive}`,
  );
  ok = errors.length === 0;
} catch (e) {
  errors.push(String(e));
} finally {
  await browser.close();
  await server.close();
}
if (errors.length) console.error(`smoke: ${errors.length} error(es)\n` + errors.slice(0, 20).join('\n'));
console.log(ok ? 'smoke: OK (captura en out/smoke.png)' : 'smoke: FALLO');
process.exit(ok ? 0 : 1);
