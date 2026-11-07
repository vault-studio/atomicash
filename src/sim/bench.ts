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

/**
 * Lo que aparece en cada escenario: grupos (tipo y cuántos) en anillo a `r` del jugador, con la vida del segundo `at`
 * de la partida (los jefes no escalan). Se limpia cuando no queda ninguno de esos tipos (no cuentan las crías).
 */
const SETUP: Record<
  Scenario,
  { groups: readonly { type: StatEnemyId; n: number }[]; r: number; at: number }
> = {
  horde: { groups: [{ type: 'necrofago', n: 120 }], r: 260, at: 0 },
  boss: { groups: [{ type: 'rey_rata', n: 1 }], r: 300, at: 0 },
  armored: {
    groups: [
      { type: 'blindado', n: 8 },
      { type: 'excavadora', n: 4 },
    ],
    r: 260,
    at: 420,
  },
};

const LIMIT = 120;

/** Segundos que tarda la build en limpiar el escenario (LIMIT si no lo consigue). Jugador invencible y quieto. */
export function benchScenario(build: BenchBuild, sc: Scenario, seed = 1): number {
  // El llamador debe restaurar los valores (resetTuning) después.
  applyTuning({ spawn: { rateMult: 0 } });
  const w: World = createWorld('dot', seed, { hazards: false, startWeapon: null });
  w.player.god = true;
  w.xpNext = Infinity;
  w.nextElite = w.nextSpecial = Infinity;
  for (const k of BOSS_IDS) w.bossSpawned[k] = true;
  w.weapons = build.weapons.map((x) => createWeapon(x.id, x.lvl));
  const S = SETUP[sc];
  const p = w.player;
  w.time = S.at;
  const n = S.groups.reduce((s, g) => s + g.n, 0);
  let k = 0;
  for (const g of S.groups)
    for (let i = 0; i < g.n; i++, k++) {
      const a = (k / n) * Math.PI * 2;
      spawnEnemy(w, g.type, p.x + Math.cos(a) * S.r, p.y + Math.sin(a) * S.r, false);
    }
  const step = 1 / RUN.tickHz;
  while (w.time - S.at < LIMIT) {
    if (w.choice) w.choice = null;
    tick(w, { moveX: 0, moveY: 0 }, step);
    let left = 0;
    for (let i = 0; i < w.enemies.count; i++) {
      const e = w.enemies.items[i]!;
      if (!e.dead && S.groups.some((g) => g.type === e.type)) left++;
    }
    if (left === 0) return Math.round((w.time - S.at) * 10) / 10;
  }
  return LIMIT;
}
