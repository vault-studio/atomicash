// IA de los jefes: Rey Rata, Dirigible y Coloso.
import { AI } from '../../../config/enemies';
import { addShake, banner, hitStop } from '../../fx';
import { MODE_AIM, MODE_CHASE, MODE_DASH, type Enemy, type World } from '../../types';
import { markFall } from '../../scars';
import { leapTick, markAttack, ring, startLeap, telegraph } from './actions';
import { dashDone, dashLane } from './dash';
import { spawnEnemy } from './spawn';
import { TAU, clamp, cur, curSrc } from './state';

/** Rey Rata: embestidas encadenadas y, entre ciclos, llama a sus ratas. */
export function reyRata(w: World, e: Enemy, dt: number): void {
  const p = w.player;
  const d = cur.d;
  const ux = cur.ux;
  const uy = cur.uy;
  const spd = cur.spd;
  const A = AI.rey_rata;
  if (e.mode === MODE_CHASE) {
    cur.vx = ux * spd;
    cur.vy = uy * spd;
    e.timer -= dt;
    if (e.phase === 1 && e.hp / e.maxHp < A.p2) {
      e.phase = 2;
      banner(w, 'banner.ratPhase');
      addShake(w, 6);
      ring(w, A.summonType, p.x, p.y, 4, A.summonDist + 30);
    }
    const p2 = e.phase >= 2;
    // `burst` = embestidas que le quedan en el ciclo; `mt` en persecución = tiempo parado llamando a las ratas.
    if (e.mt > 0) {
      cur.vx = cur.vy = 0;
      e.mt -= dt;
    } else if (e.timer <= 0) {
      if (e.burst > 0) {
        e.burst--;
        e.mode = MODE_AIM;
        e.mt = p2 ? A.aimP2 : A.aim;
        e.dx = ux;
        e.dy = uy;
        // Como la embestida por datos: llega hasta el jugador y sigue `dashOver` px (`dashDone`).
        dashLane(w, e, e.mt, d + A.dashOver);
        markAttack(w, e, 'attack_1');
      } else {
        markAttack(w, e, 'attack_2');
        ring(w, A.summonType, p.x, p.y, p2 ? A.summonP2 : A.summon, A.summonDist);
        e.mt = A.summonStop;
        e.timer = A.summonStop;
        e.burst = p2 ? A.chainP2 : A.chain;
      }
    }
  } else if (e.mode === MODE_AIM) {
    cur.vx = cur.vy = 0;
    e.mt -= dt;
    if (e.mt <= 0) {
      e.mode = MODE_DASH;
      e.mt = A.dashMax;
    }
  } else {
    cur.vx = e.dx * A.dashSpd;
    cur.vy = e.dy * A.dashSpd;
    e.mt -= dt;
    if (e.mt <= 0 || dashDone(w, e, A.dashSpd, A.dashOver)) {
      e.mode = MODE_CHASE;
      // Si acaba antes del tope, `mt` no debe leerse en persecución como «parado llamando a las ratas».
      e.mt = 0;
      // El Rey Rata enlaza la siguiente embestida casi sin pausa.
      e.timer = e.phase >= 2 ? A.gapP2 : A.gap;
    }
  }
}

/** Dirigible: orbita al jugador y alterna paracaidistas y bombas en pasillo. */
export function dirigible(w: World, e: Enemy, dt: number): void {
  const p = w.player;
  const d = cur.d;
  const ux = cur.ux;
  const uy = cur.uy;
  const spd = cur.spd;
  const A = AI.dirigible;
  // Orbita al jugador a `orbitR`.
  const tx = -uy * e.side;
  const ty = ux * e.side;
  const err = clamp((d - A.orbitR) * 1.5, -spd, spd);
  cur.vx = tx * spd + ux * err;
  cur.vy = ty * spd + uy * err;
  const p2 = e.hp / e.maxHp < A.p2;
  if (p2 && e.phase === 1) {
    e.phase = 2;
    banner(w, 'banner.blimpDown');
    addShake(w, 6);
  }
  // Es obligatorio matarlo para pasar de acto: con armas de suelo solas, baja a su alcance pasado un rato.
  if (e.flying && w.time - e.born >= A.groundAfter) {
    e.flying = false;
    banner(w, 'banner.blimpLow');
  }
  e.timer -= dt;
  if (e.timer <= 0) {
    e.timer = p2 ? A.everyP2 : A.every;
    if (!e.alt) {
      markAttack(w, e, 'attack_1');
      for (let i = 0; i < A.paraCount; i++) {
        const a = w.rng() * TAU;
        const rr = A.paraMin + w.rng() * (A.paraMax - A.paraMin);
        telegraph(
          w,
          p.x + Math.cos(a) * rr,
          p.y + Math.sin(a) * rr,
          A.paraR,
          A.paraWarn,
          A.paraDmg,
          'torreta',
        );
      }
    } else {
      markAttack(w, e, 'attack_2');
      const l = Math.sqrt(cur.vx * cur.vx + cur.vy * cur.vy) || 1;
      const bx = cur.vx / l;
      const by = cur.vy / l;
      for (let i = 0; i < A.bombCount; i++) {
        const off = (i - (A.bombCount - 1) / 2) * A.bombSpacing;
        markFall(w, p.x + bx * off, p.y + by * off, A.bombR, A.bombWarn, A.bombDmg, 0, curSrc, 'shell');
      }
      // El pasillo de la pasada, de punta a punta (solo aviso).
      const half = ((A.bombCount - 1) / 2) * A.bombSpacing + A.bombR;
      telegraph(
        w,
        p.x - bx * half,
        p.y - by * half,
        A.laneR,
        A.bombWarn,
        0,
        null,
        bx * half * 2,
        by * half * 2,
      );
      if (p2) ring(w, A.p2SummonType, p.x, p.y, A.p2Summon, A.p2SummonDist);
    }
    e.alt = !e.alt;
  }
}

/** Coloso: salto, lluvia de escombros e invocaciones, por fases. */
export function coloso(w: World, e: Enemy, dt: number): void {
  const p = w.player;
  const ux = cur.ux;
  const uy = cur.uy;
  const spd = cur.spd;
  const A = AI.coloso;
  const f = e.hp / e.maxHp;
  const ph = f > A.p2 ? 1 : f > A.p3 ? 2 : 3;
  if (ph !== e.phase) {
    e.phase = ph;
    banner(w, 'banner.colossusPhase', { n: String(ph) });
    addShake(w, 10);
    hitStop(w, 0.12);
  }
  const sp = spd * (ph === 3 ? A.spdP3 : 1);
  if (e.stun > 0) {
    // En el aire: vuela en línea recta hasta el punto de caída (dx, dy ya es la velocidad del salto).
    cur.vx = e.dx;
    cur.vy = e.dy;
    leapTick(w, e, dt);
  } else {
    cur.vx = ux * sp;
    cur.vy = uy * sp;
  }
  e.timer -= dt;
  if (e.timer <= 0) {
    e.timer = ph === 3 ? A.everyP3 : A.every;
    const rot = ph >= 2 ? 3 : 2;
    const act = e.act++ % rot;
    if (act === 0) {
      markAttack(w, e, 'attack_1');
      startLeap(w, e);
    } else if (act === 1) {
      markAttack(w, e, 'attack_2');
      const n = A.debrisBase + A.debrisPerPhase * ph;
      for (let i = 0; i < n; i++) {
        const a = w.rng() * TAU;
        const rr = i === 0 ? 0 : 40 + w.rng() * A.debrisSpread;
        telegraph(w, p.x + Math.cos(a) * rr, p.y + Math.sin(a) * rr, A.debrisR, A.debrisWarn, A.debrisDmg);
      }
    } else {
      markAttack(w, e, 'attack_2');
      spawnEnemy(w, A.turretType, e.x + A.turretDist, e.y, false);
      ring(w, A.summonType, e.x, e.y, A.summonGhouls, A.summonDist);
    }
  }
}
