// Furia en el bucle de IA (empezar, mantener, acabar), muertes de aliados que enfurecen y sermón del predicador.
import { AI, ENEMY_STATS, GORE, RAGE, type RageOverride } from '../../../config/enemies';
import { burst, textFx } from '../../fx';
import { type Enemy, type World } from '../../types';
import { RAGE_END, RAGE_START, rageForce, rageStep, rageTrigger } from './rageRules';
import { SLOGAN_COUNT } from './think';

/** Efectos de empezar la furia: más daño de contacto y, la primera vez, más vida (la velocidad se calcula en `speedOf`). */
function onRageStart(w: World, e: Enemy, ovr: RageOverride | undefined): void {
  if (e.rageN === 1) {
    const hp = ovr !== undefined && ovr.hp !== undefined ? ovr.hp : RAGE.hp;
    e.hp *= hp;
    e.maxHp *= hp;
  }
  e.rageDmg = e.dmg;
  e.dmg *= ovr !== undefined && ovr.dmg !== undefined ? ovr.dmg : RAGE.dmg;
  w.rs.rages++;
}

/** Un tick del ciclo de furia de  (aparte de updateEnemies: sus ramas raras no deben deshacer lo optimizado del bucle). */
export function rageTick(w: World, e: Enemy, dt: number): void {
  const ovr = ENEMY_STATS[e.type].rage;
  const r = rageStep(e, dt, RAGE, ovr, w.level);
  if (r === RAGE_START) onRageStart(w, e, ovr);
  else if (r === RAGE_END) onRageEnd(e);
}

/** Al calmarse recupera su daño; la vida extra se queda. */
function onRageEnd(e: Enemy): void {
  e.dmg = e.rageDmg;
}

/**
 * Muerte de un aliado (CAMBIOS §1): por cada enemigo normal muerto en este tick, los cercanos con `allyDeathR` se
 * enfurecen. Se recorre antes de retirar los muertos; no toca `killEnemy`.
 */
function allyDeaths(w: World): void {
  const items = w.enemies.items;
  const n = w.enemies.count;
  let any = false;
  for (let i = 0; i < n && !any; i++) {
    const a = items[i] as Enemy;
    any = a.dead && !a.boss && !a.elite;
  }
  if (!any) return;
  for (let j = 0; j < n; j++) {
    const o = items[j] as Enemy;
    if (o.dead || o.rage || o.boss || o.elite) continue;
    const ovr = ENEMY_STATS[o.type].rage;
    const r = ovr !== undefined && ovr.allyDeathR !== undefined ? ovr.allyDeathR : RAGE.allyDeathR;
    if (!(r > 0)) continue;
    const r2 = r * r;
    for (let i = 0; i < n; i++) {
      const a = items[i] as Enemy;
      if (!a.dead || a.boss || a.elite) continue;
      const dx = o.x - a.x;
      const dy = o.y - a.y;
      if (dx * dx + dy * dy >= r2) continue;
      if (rageTrigger(o, RAGE, ovr, w.level) === RAGE_START) onRageStart(w, o, ovr);
      break;
    }
  }
}

/** Retira del pool los enemigos muertos en este tick (antes, los que mueren le enfurecen a sus vecinos). */
export function compactEnemies(w: World): void {
  const pool = w.enemies;
  allyDeaths(w);
  for (let i = pool.count - 1; i >= 0; i--) if ((pool.items[i] as Enemy).dead) pool.releaseAt(i);
}

/** Sermón del predicador: enfurece a los enemigos normales que tiene cerca (ni jefes ni élites; tampoco antes del nivel mínimo ni a quien no puede), aunque estén en enfriamiento. */
export function sermon(w: World, e: Enemy): void {
  const A = AI.predicador;
  const items = w.enemies.items;
  const n = w.enemies.count;
  for (let i = 0; i < n; i++) {
    const o = items[i] as Enemy;
    if (o === e || o.dead || o.rage || o.boss || o.elite) continue;
    const dx = o.x - e.x;
    const dy = o.y - e.y;
    if (dx * dx + dy * dy < A.r * A.r) {
      const ovr = ENEMY_STATS[o.type].rage;
      if (rageForce(o, RAGE, ovr, w.level) === RAGE_START) {
        onRageStart(w, o, ovr);
        o.flash = 0.15;
      }
    }
  }
  burst(w, e.x, e.y, 14, GORE.predicador, 1.4);
  if (w.rng() < A.sloganChance) textFx(w, 'slogan', e.x, e.y, (w.rng() * SLOGAN_COUNT) | 0);
}
