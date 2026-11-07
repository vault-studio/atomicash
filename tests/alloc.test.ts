// Criterio de F1-04: 1 000 entidades sin allocations por frame.
import { PerformanceObserver, performance } from 'node:perf_hooks';
import { describe, expect, it } from 'vitest';
import { BOSS_IDS, ENEMY_RULES, MIRROR_ID, RAGE, STAT_ENEMY_IDS } from '../src/config/enemies';
import { RUN } from '../src/config/run';
import { removeEnemyAt, spawnEnemy } from '../src/engine/systems/enemies';
import { createWorld, tick } from '../src/engine/world';
import type { InputState, World } from '../src/engine/types';
import { createWeapon } from '../src/engine/systems/weapons';
import type { WeaponId } from '../src/config/weapons';

// Sin la copia del evento «Tú mismo, otra vez»: no sale en oleadas, y un tirador más cambia la mezcla de la multitud.
const CROWD_IDS = STAT_ENEMY_IDS.filter((id) => id !== MIRROR_ID);
const REFILL_IDS = CROWD_IDS.filter((id) => !(BOSS_IDS as readonly string[]).includes(id));
const N = 1000;
const STEP = 1 / RUN.tickHz;

function crowd(): World {
  const w = createWorld('dot', 1, { maxEnemies: N });
  const p = w.player;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const d = 80 + (i % 20) * 30;
    const type = CROWD_IDS[i % CROWD_IDS.length]!;
    spawnEnemy(w, type, p.x + Math.cos(a) * d, p.y + Math.sin(a) * d);
  }
  return w;
}

/** Repone las bajas hasta `N` (una bomba de suelo se lleva a media multitud), lejos del jugador y sin jefes. */
function refill(w: World): void {
  const p = w.player;
  for (let i = w.enemies.count; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const type = REFILL_IDS[i % REFILL_IDS.length]!;
    const e = spawnEnemy(w, type, p.x + Math.cos(a) * 500, p.y + Math.sin(a) * 500);
    e.hp = e.maxHp = ENEMY_HP;
  }
}

const gc = (globalThis as { gc?: () => void }).gc;

// Calentamiento del combate: el JIT tarda en optimizar el código de cada arma, y sin optimizar sí se reserva memoria.
const WARMUP_TICKS = 2500;
// Ventana de medida del combate, por tramos: si el mundo se para, la prueba no mide nada y pasa sola.
const SLICES = 9;
const SLICE_TICKS = 100;
/** Vida de la multitud, y de quien la repone: un golpe no basta, pero va cayendo gente. */
const ENEMY_HP = 400;

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
      w.player.god = true; // Si muere, `tick` deja de hacer nada y ya no se mide.
      w.xpNext = Infinity; // Sin tarjetas de nivel: reservan memoria y paran el mundo.
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
      const ticks = w.ticks;
      const t0 = performance.now();
      run(2000);
      const t1 = performance.now();
      // Las entradas de GC llegan de forma asíncrona.
      await new Promise((r) => setTimeout(r, 50));
      obs.disconnect();

      expect(w.ticks - ticks).toBe(2000);
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
        // Sin subidas de nivel (abrir tarjetas sí reserva memoria, y pausa el motor), pero con la furia ya activa.
        w.level = RAGE.minLevel;
        w.xpNext = Infinity;
        // Solo el bucle de combate: que el director no saque jefes por bajas (su llegada reserva memoria y no es combate).
        for (const k of BOSS_IDS) w.bossSpawned[k] = true;
        for (let i = 0; i < w.enemies.count; i++) {
          const e = w.enemies.items[i]!;
          // Los jefes no caen: el Coloso abre la victoria y el Rey Rata y el Dirigible sueltan un cofre, y al recogerlo
          // `tick` se queda parado en la elección de objeto. Eso reserva memoria y no es combate.
          e.hp = e.maxHp = e.boss ? 1e9 : ENEMY_HP;
        }
        let k = 0;
        const run = (n: number): void => {
          for (let i = 0; i < n; i++, k++) {
            tick(w, { moveX: Math.cos(k / 50), moveY: Math.sin(k / 50) }, STEP);
            refill(w);
          }
        };
        const gcs: number[] = [];
        const obs = new PerformanceObserver((list) => {
          for (const e of list.getEntries()) gcs.push(e.startTime);
        });
        obs.observe({ entryTypes: ['gc'] });
        run(WARMUP_TICKS);
        gc!();
        run(100);
        // Nada de `expect` en la ventana: reservan memoria. Se apunta cada tramo y se comprueba al final.
        const ms = new Float64Array(SLICES);
        const ticked = new Int32Array(SLICES);
        const killsBefore = w.kills;
        const t0 = performance.now();
        for (let s = 0; s < SLICES; s++) {
          const ticks = w.ticks;
          const start = performance.now();
          run(SLICE_TICKS);
          ms[s] = performance.now() - start;
          ticked[s] = w.ticks - ticks;
        }
        const t1 = performance.now();
        await new Promise((r) => setTimeout(r, 50));
        obs.disconnect();
        // El mundo ha seguido en marcha, con gente muriendo, en toda la ventana.
        expect(w.choice).toBeNull();
        expect(w.over).toBe(false);
        expect(Array.from(ticked)).toEqual(new Array<number>(SLICES).fill(SLICE_TICKS));
        expect(Array.from(ms).filter((v) => !(v > 0))).toEqual([]);
        expect(w.kills).toBeGreaterThan(killsBefore);
        expect(gcs.filter((t) => t >= t0 && t <= t1)).toEqual([]);
      },
      60_000,
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
