// Stats derivados del jugador: base del superviviente × rasgos × objeto × RAD × turbo.
import { ITEMS, type ItemDef, CONSUMABLES, FIELD_PICKUPS } from '../config/items';
import { radTier } from '../config/radiation';
import { CAPS, DMG_TAKEN, PLAYER, RUN } from '../config/run';
import { survivorStats, type SurvivorStats } from '../config/survivors';
import type { PlayerStats, World } from './types';

/** Junta los objetos equipados: suerte y enfriamiento suman; el resto multiplica. */
function itemBonus(w: World): Required<ItemDef> {
  const b = { luck: 0, radGain: 1, speed: 0, magnet: 0, cd: 0, dmg: 0, hpMult: 1 };
  let speed = 1;
  let magnet = 1;
  let dmg = 1;
  for (const id of w.items) {
    const it: ItemDef = ITEMS[id];
    b.luck += it.luck ?? 0;
    b.radGain *= it.radGain ?? 1;
    speed *= 1 + (it.speed ?? 0);
    magnet *= 1 + (it.magnet ?? 0);
    b.cd += it.cd ?? 0;
    dmg *= 1 + (it.dmg ?? 0);
    b.hpMult *= it.hpMult ?? 1;
  }
  b.speed = speed - 1;
  b.magnet = magnet - 1;
  b.dmg = dmg - 1;
  return b;
}

export function createStats(): PlayerStats {
  return {
    maxHp: 0,
    speed: 0,
    magnet: 0,
    armor: 0,
    luck: 0,
    dmgMult: 1,
    cdMult: 1,
    regen: 0,
    xpMult: 1,
    red: 0,
    dodge: 0,
    crit: 0,
    area: 1,
    pierce: 0,
    kb: 1,
    radGain: 1,
    radDecayBonus: 0,
    meleeMult: 1,
    bossMult: 1,
  };
}

/** Recalcula `w.st` en el sitio. Si cambian los PV máximos, conserva el porcentaje de vida. */
export function recalc(w: World): void {
  const p = w.player;
  const ch: SurvivorStats = survivorStats(w.charId);
  const tr = w.tr;
  const it = itemBonus(w);
  const tier = radTier(p.rad);
  const turbo = p.turbo > 0 ? CONSUMABLES.turbo.mult : 1;
  const st = w.st;

  const maxHp = Math.max(1, Math.round((ch.hp + tr.hp) * (1 - tier.hpPen) * it.hpMult));
  st.speed = ch.speed * (1 + (ch.speedPct ?? 0) + tr.spd / 100) * (1 + it.speed) * turbo;
  st.magnet = PLAYER.magnetBase * (1 + (ch.magnetPct ?? 0) + tr.mag / 100) * (1 + it.magnet);
  st.armor = tr.armor;
  st.luck = tr.luck + it.luck;
  let dmg = (1 + tr.dmg / 100) * (1 + tier.dmg * (ch.radDmgMult ?? 1)) * (1 + it.dmg) * turbo;
  if (p.hp < 0.4 * p.maxHp) dmg *= 1 + tr.adren / 100;
  st.dmgMult = dmg;
  st.cdMult = (1 - Math.min(CAPS.cdReduction, tr.cd / 100 + it.cd)) * (p.nuka > 0 ? FIELD_PICKUPS.nukaCd : 1);
  st.regen = (ch.regen ?? 0) + tr.regen;
  st.xpMult = 1 + tr.xp / 100;
  st.red = Math.min(CAPS.dmgReduction, tr.red / 100);
  st.dodge = Math.min(CAPS.dodge, tr.dodge / 100);
  st.crit = Math.min(CAPS.crit, tr.crit / 100);
  st.area = 1 + tr.area / 100;
  st.pierce = tr.pierce;
  st.kb = 1 + tr.kb / 100;
  st.radGain = (ch.radGain ?? 1) * it.radGain;
  st.radDecayBonus = tr.radDecay;
  st.meleeMult = 1 + (ch.meleePct ?? 0);
  st.bossMult = 1 + (ch.bossPct ?? 0);
  if (st.maxHp !== maxHp && st.maxHp > 0) p.hp = (p.hp * maxHp) / st.maxHp;
  st.maxHp = maxHp;
  p.maxHp = maxHp;
}

/** El daño recibido crece con el tiempo de la run. */
export function timeDmgMult(t: number): number {
  const f = Math.min(1, t / (RUN.duration * DMG_TAKEN.reachAtFrac));
  return DMG_TAKEN.start + (DMG_TAKEN.max - DMG_TAKEN.start) * f;
}
