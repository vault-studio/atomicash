// Criterio de F1-04: 1 000 entidades sin allocations por frame.
import { PerformanceObserver, performance } from 'node:perf_hooks';
import { describe, expect, it } from 'vitest';
import { ENEMY_RULES, STAT_ENEMY_IDS } from '../src/config/enemies';
import { RUN } from '../src/config/run';
import { removeEnemyAt, spawnEnemy } from '../src/engine/systems/enemies';
import { createWorld, tick } from '../src/engine/world';
import type { InputState, World } from '../src/engine/types';
import { createWeapon } from '../src/engine/systems/weapons';
import type { WeaponId } from '../src/config/weapons';

const N = 1000;
const STEP = 1 / RUN.tickHz;

function crowd(): World {
  const w = createWorld('dot', 1, { maxEnemies: N });
  const p = w.player;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const d = 80 + (i % 20) * 30;
    const type = STAT_ENEMY_IDS[i % STAT_ENEMY_IDS.length]!;
    spawnEnemy(w, type, p.x + Math.cos(a) * d, p.y + Math.sin(a) * d);
  }
  return w;
}

const gc = (globalThis as { gc?: () => void }).gc;

describe('motor sin allocations', () => {
  it('el pool y el spatial hash no se realocan con 1 000 enemigos', () => {
    const w = crowd();
    expect(w.enemies.count).toBe(N);
    const input: InputState = { moveX: 1, moveY: 0.3 };
    for (let i = 0; i < 60; i++) tick(w, input, STEP);
    const items = w.enemies.items;
    const len = items.length;
    const cap = w.enemyGrid.capacity;
    const first = items[0];
    for (let i = 0; i < 600; i++) tick(w, input, STEP);
    expect(w.enemies.items).toBe(items);
    expect(items.length).toBe(len);
    expect(items[0]).toBe(first);
    expect(w.enemyGrid.capacity).toBe(cap);
  });

  // `heapUsed` no sirve aquí: sube y baja según cuándo pase el GC. Lo fiable es que, si el bucle
  // no reserva memoria, el espacio joven no se llena y no hay ninguna recolección mientras corre.
  // Con una sola allocation de 16 B por enemigo y tick, 2 000 ticks llenarían ~32 MB: decenas de GC.
  it.runIf(gc)(
    '2 000 ticks con 1 000 enemigos no disparan ningún GC',
    async () => {
      const w = crowd();
      const input: InputState = { moveX: -0.5, moveY: 1 };
      const run = (n: number): void => {
        for (let i = 0; i < n; i++) tick(w, input, STEP);
      };

      const gcs: number[] = [];
      const obs = new PerformanceObserver((list) => {
        for (const e of list.getEntries()) gcs.push(e.startTime);
      });
      obs.observe({ entryTypes: ['gc'] });
      // Calentamiento con el observador ya puesto: al arrancar el bucle el JIT compila y puede
      // haber algún scavenge suelto que no depende del número de ticks.
      run(1000);
      gc!();
      run(200);
      const t0 = performance.now();
      run(2000);
      const t1 = performance.now();
      // Las entradas de GC llegan de forma asíncrona.
      await new Promise((r) => setTimeout(r, 50));
      obs.disconnect();

      expect(gcs.filter((t) => t >= t0 && t <= t1)).toEqual([]);
    },
    30_000,
  );

  // Cada arma por separado: proyectiles, charcos, rayos, petardos y bajas salen de pools.
  const LOADOUTS: WeaponId[][] = [
    ['llave', 'pistola_clavos', 'escopeta_chatarra', 'tesla'],
    ['coctel', 'geiger', 'megafono', 'rifle_cerrojo'],
    ['martillo_pilon', 'petardos', 'desfibrilador', 'nucleo_cobalto'],
    ['dinamo', 'remachadora', 'nucleo_inestable', 'dardos_incendiarios'],
  ];
  for (const loadout of LOADOUTS) {
    it.runIf(gc)(
      `combate sin GC: ${loadout.join(', ')}`,
      async () => {
        const w = crowd();
        w.weapons = loadout.map((id) => createWeapon(id, 5));
        w.player.god = true;
        // Sin subidas de nivel (abrir tarjetas sí reserva memoria, y pausa el motor).
        w.xpNext = Infinity;
        for (let i = 0; i < w.enemies.count; i++) {
          const e = w.enemies.items[i]!;
          // El Coloso no cae: su muerte abre la victoria (tarjetas, cinemática), que sí reserva memoria y no es combate.
          e.hp = e.maxHp = e.type === 'coloso' ? 1e9 : 400;
        }
        let k = 0;
        const run = (n: number): void => {
          for (let i = 0; i < n; i++, k++)
            tick(w, { moveX: Math.cos(k / 50), moveY: Math.sin(k / 50) }, STEP);
        };
        const gcs: number[] = [];
        const obs = new PerformanceObserver((list) => {
          for (const e of list.getEntries()) gcs.push(e.startTime);
        });
        obs.observe({ entryTypes: ['gc'] });
        run(600);
        gc!();
        run(100);
        const t0 = performance.now();
        run(900);
        const t1 = performance.now();
        await new Promise((r) => setTimeout(r, 50));
        obs.disconnect();
        expect(w.kills).toBeGreaterThan(0);
        expect(gcs.filter((t) => t >= t0 && t <= t1)).toEqual([]);
      },
      30_000,
    );
  }

  it('los enemigos se separan en vez de apilarse', () => {
    const w = createWorld('dot', 1);
    for (let i = 0; i < 50; i++) spawnEnemy(w, 'necrofago', 500, 500);
    for (let i = 0; i < 120; i++) tick(w, { moveX: 0, moveY: 0 }, STEP);
    const es = w.enemies.items.slice(0, w.enemies.count);
    let overlaps = 0;
    for (let i = 0; i < es.length; i++)
      for (let j = i + 1; j < es.length; j++) {
        const a = es[i]!;
        const b = es[j]!;
        if (Math.hypot(a.x - b.x, a.y - b.y) < (a.r + b.r) * 0.5) overlaps++;
      }
    expect(overlaps).toBe(0);
  });

  it('persiguen al jugador', () => {
    // Sin arma: el retroceso de los disparos falsearía la distancia recorrida.
    const w = createWorld('dot', 1, { startWeapon: null });
    const e = spawnEnemy(w, 'dron', w.player.x + 400, w.player.y);
    const d0 = Math.hypot(e.x - w.player.x, e.y - w.player.y);
    for (let i = 0; i < 60; i++) tick(w, { moveX: 0, moveY: 0 }, STEP);
    expect(d0 - Math.hypot(e.x - w.player.x, e.y - w.player.y)).toBeCloseTo(122, 0);
    expect(e.facingX).toBeCloseTo(-1);
  });

  it(`al superar ${ENEMY_RULES.maxAlive} vivos recicla el más lejano`, () => {
    const w = createWorld('dot', 1);
    const p = w.player;
    for (let i = 0; i < ENEMY_RULES.maxAlive; i++) spawnEnemy(w, 'dron', p.x + 100, p.y);
    const far = spawnEnemy(w, 'dron', p.x + 1000, p.y);
    expect(w.enemies.count).toBe(ENEMY_RULES.maxAlive);
    const created = spawnEnemy(w, 'necrofago', p.x - 50, p.y);
    expect(w.enemies.count).toBe(ENEMY_RULES.maxAlive);
    expect(created).toBe(far);
    expect(created.type).toBe('necrofago');
    removeEnemyAt(w, 0);
    expect(w.enemies.count).toBe(ENEMY_RULES.maxAlive - 1);
  });
});
