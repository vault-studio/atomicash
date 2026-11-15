// Quemaduras y daño de los charcos de fuego.
import { WEAPONS } from '../../../config/weapons';
import { type Enemy, type World } from '../../types';
import { hitEnemy } from '../combat';

/** Pone una quemadura en un hueco libre; si no hay, renueva la que antes se acaba. */
function addBurn(e: Enemy, dps: number): void {
  const B = WEAPONS.coctel.burn;
  let slot = 0;
  for (let s = 1; s < e.burnT.length; s++) if (e.burnT[s]! < e.burnT[slot]!) slot = s;
  // Primera quemadura: el primer golpe llega al cabo de un segundo.
  let any = false;
  for (let s = 0; s < e.burnT.length; s++) if (e.burnT[s]! > 0) any = true;
  if (!any) e.burnTick = 1;
  e.burnT[slot] = B.dur;
  e.burnD[slot] = dps;
}

/** Enemigo dentro de un charco que quema en este tick (una vez por tick aunque pise varios). */
export function touchFire(w: World, e: Enemy, base: number, dt: number): void {
  if (e.fireAt === w.ticks) return;
  const dps = w.mods.burnDmg ? base * (1 + w.mods.burnDmg / 100) : base;
  if (e.fireAt === w.ticks - 1) {
    // Sigue dentro: otra quemadura por cada `stay` s seguidos.
    e.fireIn += dt;
    if (e.fireIn >= WEAPONS.coctel.burn.stay) {
      e.fireIn -= WEAPONS.coctel.burn.stay;
      addBurn(e, dps);
    }
  } else {
    // Acaba de pisarlo.
    e.fireIn = 0;
    addBurn(e, dps);
  }
  e.fireAt = w.ticks;
}

/** Quemaduras: se consumen y, cada segundo, hacen la suma de las que lleva. */
export function updateBurns(w: World, dt: number): void {
  const items = w.enemies.items;
  for (let i = 0; i < w.enemies.count; i++) {
    const e = items[i]!;
    if (e.dead) continue;
    const T = e.burnT;
    let dps = 0;
    for (let s = 0; s < T.length; s++) {
      if (T[s]! <= 0) continue;
      dps += e.burnD[s]!;
      T[s] = T[s]! - dt;
    }
    if (dps === 0) continue;
    e.burnTick -= dt;
    if (e.burnTick <= 0) {
      e.burnTick += 1;
      hitEnemy(w, e, dps, 'coctel', 0);
    }
  }
}
