// Banco de builds por escenario (CAMBIOS §5): cada build se mide contra una horda, un jefe y un grupo de blindados, sin
// oleadas ni azar del director. Sirve para comprobar que ninguna build es la mejor en todo.
import { RUN } from '../config/run';
import { BOSS_IDS, type StatEnemyId } from '../config/enemies';
import { applyTuning } from '../config/tuning';
import type { WeaponId } from '../config/weapons';
import { spawnEnemy } from '../engine/systems/enemies';
import { createWeapon } from '../engine/systems/weapons';
import type { World } from '../engine/types';
import { createWorld, tick } from '../engine/world';

export type Scenario = 'horde' | 'boss' | 'armored';
export const SCENARIOS: readonly Scenario[] = ['horde', 'boss', 'armored'];

export interface BenchBuild {
  name: string;
  weapons: readonly { id: WeaponId; lvl: number }[];
}

/** Lo que aparece en cada escenario: tipo, cuántos y a qué distancia del jugador (en anillo). */
const SETUP: Record<Scenario, { type: StatEnemyId; n: number; r: number }> = {
  horde: { type: 'necrofago', n: 120, r: 260 },
  boss: { type: 'rey_rata', n: 1, r: 300 },
  armored: { type: 'blindado', n: 10, r: 260 },
};

const LIMIT = 120;

/** Segundos que tarda la build en limpiar el escenario (LIMIT si no lo consigue). Jugador invencible y quieto. */
export function benchScenario(build: BenchBuild, sc: Scenario, seed = 1): number {
  // El llamador debe restaurar los valores (resetTuning) después.
  applyTuning({ spawn: { rateMult: 0 } });
  const w: World = createWorld('dot', seed, { hazards: false, startWeapon: null });
  w.player.god = true;
  w.xpNext = Infinity;
  w.nextElite = w.nextHorde = w.nextEvent = Infinity;
  for (const k of BOSS_IDS) w.bossSpawned[k] = true;
  w.weapons = build.weapons.map((x) => createWeapon(x.id, x.lvl));
  const S = SETUP[sc];
  const p = w.player;
  for (let i = 0; i < S.n; i++) {
    const a = (i / S.n) * Math.PI * 2;
    spawnEnemy(w, S.type, p.x + Math.cos(a) * S.r, p.y + Math.sin(a) * S.r, false);
  }
  const step = 1 / RUN.tickHz;
  while (w.time < LIMIT) {
    if (w.choice) w.choice = null;
    tick(w, { moveX: 0, moveY: 0 }, step);
    let left = 0;
    for (let i = 0; i < w.enemies.count; i++) if (w.enemies.items[i]!.type === S.type) left++;
    if (left === 0) return Math.round(w.time * 10) / 10;
  }
  return LIMIT;
}
