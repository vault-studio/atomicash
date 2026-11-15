// Daño, curación y radiación del jugador.
import { IRRADIATED, RAD, radTier } from '../../../config/radiation';
import { FX, JUICE, PLAYER, STREAK } from '../../../config/run';
import { DAILY } from '../../../config/modes';
import { TREE_FX } from '../../../config/tree';
import { banner, hitStop, textFx } from '../../fx';
import { timeDmgMult } from '../../stats';
import { noteHurt } from '../../runStats';
import { SFX, sfx } from '../../sfx';
import { type World } from '../../types';
import { clamp } from './hit';

export function heal(w: World, amount: number): void {
  const p = w.player;
  p.hp = Math.min(p.maxHp, p.hp + amount);
}

export function addRad(w: World, amount: number): void {
  if (amount <= 0) return;
  const p = w.player;
  p.rad = clamp(p.rad + amount * w.st.radGain, 0, RAD.max);
  if (p.rad > p.radPeak) p.radPeak = p.rad;
}

export function irradiatedChance(w: World): number {
  return (
    IRRADIATED.base +
    w.time * IRRADIATED.perSec +
    radTier(w.player.rad).irr +
    (w.dailyMod === 'irradiated' ? DAILY.irradiated.chance : 0)
  );
}

/** Daño al jugador. Devuelve el daño hecho, −1 si lo esquivó y 0 si era invulnerable. */
/** `src`: fuente para las estadísticas (índice en HURT_SOURCES, ver runStats.ts). */
export function hurtPlayer(w: World, raw: number, rad = 0, noScale = false, src = -1): number {
  const p = w.player;
  const st = w.st;
  if (p.inv > 0 || p.god || p.deadAt !== null) return 0;
  if (st.dodge > 0 && w.rng() < st.dodge) {
    p.inv = 0.2;
    if (w.mods.dodgeRush) p.rush = TREE_FX.rushDur;
    sfx(w, SFX.dodge);
    textFx(w, 'dodge', p.x, p.y, 0);
    return -1;
  }
  const tm = noScale ? 1 : timeDmgMult(w.time);
  const d =
    Math.max(1, raw * tm - st.armor) * (1 - st.red) * (w.dailyMod === 'glass' ? DAILY.glass.taken : 1);
  p.hp -= d;
  noteHurt(w.rs, src, d, w.time);
  p.inv = PLAYER.invuln;
  // Un golpe recibido corta la racha (si ya multiplicaba, se avisa).
  if (w.streak >= STREAK.tiers[STREAK.tiers.length - 1]!.at) banner(w, 'banner.streakLost');
  // Único «Sangre fría»: conserva parte de la racha.
  w.streak = Math.floor((w.streak * (w.mods.coldBlood ?? 0)) / 100);

  p.lastHit = w.time;
  sfx(w, SFX.hurt);
  w.shake = Math.min(FX.shakeMax, w.shake + 3);
  hitStop(w, JUICE.hitStop.hurt);
  if (rad > 0) addRad(w, rad);
  textFx(w, 'hurt', p.x, p.y, Math.round(d));
  return d;
}
