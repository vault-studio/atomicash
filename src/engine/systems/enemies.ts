// Enemigos: aparición, IA (persecución, tirador, predicador, embestida, torreta, babosa, jefes) y separación.
// Sin allocations: recorre el pool por índice y usa buffers del World.
// No usar Math.hypot en el bucle caliente: V8 reserva memoria en cada llamada (argumentos variables).
import {
  AI,
  ELITES,
  ENEMY_RULES,
  ENEMY_STATS,
  GORE,
  MAX_ENEMY_RADIUS,
  enemyRadius,
  RAGE,
  type EliteId,
  type EnemyStats,
  type StatEnemyId,
} from '../../config/enemies';
import { WEAPONS } from '../../config/weapons';
import { IRRADIATED } from '../../config/radiation';
import { FX, KNOCKBACK, PLAYER } from '../../config/run';
import { SPAWN } from '../../config/waves';
import { ENDLESS } from '../../config/modes';
import { addShake, banner, boom, burst, hitStop, textFx } from '../fx';
import {
  MODE_AIM,
  MODE_CHASE,
  MODE_DASH,
  ORBIT_SLOTS,
  type AttackAnim,
  type Enemy,
  type EnemyBullet,
  type Slime,
  type Telegraph,
  type World,
} from '../types';
import { blockCircle, hitsObstacle } from '../obstacles';
import { addRad, hurtPlayer, irradiatedChance } from './combat';
import { SFX, sfx } from '../sfx';

const TAU = Math.PI * 2;
const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
/** Eslóganes de la torreta (i18n `slogans.<n>`). */
export const SLOGAN_COUNT = 6;

export function createEnemy(): Enemy {
  return {
    id: 0,
    type: 'dron',
    x: 0,
    y: 0,
    prevX: 0,
    prevY: 0,
    r: 0,
    hp: 0,
    maxHp: 0,
    speed: 0,
    dmg: 0,
    xp: 0,
    facingX: Math.SQRT1_2,
    facingY: Math.SQRT1_2,
    moving: false,
    born: 0,
    dead: false,
    irr: false,
    rage: false,
    boss: false,
    flying: false,
    gar: -1,
    atkCd: 0,
    kbx: 0,
    kby: 0,
    flash: 0,
    mode: MODE_CHASE,
    mt: 0,
    dx: 0,
    dy: 0,
    burst: 0,
    bt: 0,
    stun: 0,
    frozen: 0,
    act: 0,
    alt: false,
    phase: 1,
    lastAtk: -9,
    atkAnim: 'attack',
    trail: 0,
    timer: 0,
    side: 1,
    elite: null,
    march: 0,
    hitT: new Float64Array(ORBIT_SLOTS),
    burnT: new Float64Array(WEAPONS.coctel.burn.stacks),
    burnD: new Float64Array(WEAPONS.coctel.burn.stacks),
    burnTick: 0,
    fireAt: -2,
    fireIn: 0,
  };
}

export const createBullet = (): EnemyBullet => ({ x: 0, y: 0, vx: 0, vy: 0, r: 0, dmg: 0, rad: 0, life: 0 });
export const createTele = (): Telegraph => ({
  x: 0,
  y: 0,
  r: 0,
  lx: 0,
  ly: 0,
  t: 0,
  dur: 0,
  dmg: 0,
  spawn: null,
});
export const createSlime = (): Slime => ({ x: 0, y: 0, r: 0, life: 0, max: 0, rad: 0 });

function firstTimer(type: StatEnemyId): number {
  switch (type) {
    case 'tirador':
      return AI.tirador.fireCd;
    case 'cortacesped':
      return AI.cortacesped.every;
    case 'torreta':
      return AI.torreta.every;
    case 'predicador':
      return AI.predicador.every;
    case 'rey_rata':
      return AI.rey_rata.every;
    case 'dirigible':
      return AI.dirigible.every;
    case 'coloso':
      return AI.coloso.every;
    default:
      return 0;
  }
}

/**
 * Crea un enemigo en (x, y). Si ya hay `w.maxEnemies`, recicla el más lejano al jugador (nunca un jefe ni una guarnición).
 * `irr`: forzar (o impedir) la variante irradiada; si falta, se sortea.
 */
export function spawnEnemy(w: World, type: StatEnemyId, x: number, y: number, irr?: boolean): Enemy {
  const pool = w.enemies;
  let e: Enemy;
  if (pool.count >= w.maxEnemies) {
    const p = w.player;
    let far = 0;
    let farD = -1;
    for (let i = 0; i < pool.count; i++) {
      const o = pool.items[i] as Enemy;
      // Ni jefes, ni élites ni guarniciones: su cofre depende de matarlos.
      if ((o.boss || o.elite || o.gar >= 0) && !o.dead) continue;
      const d = (o.x - p.x) ** 2 + (o.y - p.y) ** 2 + (o.dead ? 1e12 : 0);
      if (d > farD) {
        farD = d;
        far = i;
      }
    }
    e = pool.items[far] as Enemy;
  } else {
    e = pool.acquire();
  }
  const s: EnemyStats = ENEMY_STATS[type];
  const boss = s.boss === true;
  const isIrr = boss ? false : (irr ?? w.rng() < irradiatedChance(w));
  const endless = w.endless ? 1 + ((w.time - w.endlessAt) / 60) * ENDLESS.hpPerMin : 1;
  const hp = s.hp * (boss ? 1 : (1 + w.time * ENEMY_RULES.hpPerSec) * endless) * (isIrr ? IRRADIATED.hp : 1);
  e.id = w.nextId++;
  e.type = type;
  e.x = e.prevX = x;
  e.y = e.prevY = y;
  e.r = enemyRadius(type);
  e.hp = e.maxHp = hp;
  e.speed = s.speed;
  e.dmg = s.dmg;
  e.xp = s.xp;
  e.facingX = Math.SQRT1_2;
  e.facingY = Math.SQRT1_2;
  e.moving = false;
  e.born = w.time;
  e.dead = false;
  e.irr = isIrr;
  e.rage = false;
  e.boss = boss;
  e.flying = s.flying === true;
  e.gar = -1;
  e.atkCd = 0;
  e.kbx = e.kby = 0;
  e.flash = 0;
  e.mode = MODE_CHASE;
  e.mt = 0;
  e.dx = e.dy = 0;
  e.burst = 0;
  e.bt = 0;
  e.stun = 0;
  e.frozen = 0;
  e.act = 0;
  e.alt = false;
  e.phase = 1;
  e.lastAtk = -9;
  e.atkAnim = 'attack';
  e.trail = 0;
  e.timer = firstTimer(type) * (0.4 + w.rng() * 0.6);
  e.side = w.rng() < 0.5 ? -1 : 1;
  e.elite = null;
  e.march = 0;
  e.hitT.fill(-1e9);
  e.burnT.fill(0);
  e.burnTick = 0;
  e.fireAt = -2;
  e.fireIn = 0;
  if (boss) w.bossAlive++;
  return e;
}

/** Convierte un enemigo recién creado en élite con el prefijo `kind`. */
export function makeElite(e: Enemy, kind: EliteId): void {
  e.elite = kind;
  e.irr = false;
  e.hp = e.maxHp = e.maxHp * ELITES.hp;
  e.r = Math.round(e.r * ELITES.r);
  e.xp *= ELITES.xp;
  if (kind === 'veloz') e.speed *= ELITES.veloz.speed;
}

/** Elimina el enemigo de la posición `i` del pool (el último ocupa su hueco). */
export function removeEnemyAt(w: World, i: number): void {
  w.enemies.releaseAt(i);
}

/** Retira del pool los enemigos muertos en este tick. */
export function compactEnemies(w: World): void {
  const pool = w.enemies;
  for (let i = pool.count - 1; i >= 0; i--) if ((pool.items[i] as Enemy).dead) pool.releaseAt(i);
}

/** Furia (RAGE): rojo, pega, corre y aguanta más. Solo una vez por enemigo. */
function enrage(e: Enemy): void {
  e.rage = true;
  e.hp *= RAGE.hp;
  e.maxHp *= RAGE.hp;
  e.dmg *= RAGE.dmg;
  e.speed *= RAGE.speed;
}

/** Sermón del predicador: enfurece a los enemigos normales que tiene cerca (ni jefes ni élites, como la furia; tampoco antes de `RAGE.minLevel`). */
function sermon(w: World, e: Enemy): void {
  const A = AI.predicador;
  const items = w.enemies.items;
  const n = w.level >= RAGE.minLevel ? w.enemies.count : 0;
  for (let i = 0; i < n; i++) {
    const o = items[i] as Enemy;
    if (o === e || o.dead || o.rage || o.boss || o.elite) continue;
    const dx = o.x - e.x;
    const dy = o.y - e.y;
    if (dx * dx + dy * dy < A.r * A.r) {
      enrage(o);
      o.flash = 0.15;
    }
  }
  burst(w, e.x, e.y, 14, GORE.predicador, 1.4);
  if (w.rng() < A.sloganChance) textFx(w, 'slogan', e.x, e.y, (w.rng() * SLOGAN_COUNT) | 0);
}

function markAttack(w: World, e: Enemy, anim: AttackAnim = 'attack'): void {
  e.lastAtk = w.time;
  e.atkAnim = anim;
}

export function fireBullet(
  w: World,
  x: number,
  y: number,
  ux: number,
  uy: number,
  spd: number,
  dmg: number,
  rad: number,
): void {
  sfx(w, SFX.eshot, x, y);
  const b = w.ebullets.acquire();
  b.x = x;
  b.y = y;
  b.vx = ux * spd;
  b.vy = uy * spd;
  b.r = ENEMY_RULES.bulletR;
  b.dmg = dmg;
  b.rad = rad;
  b.life = ENEMY_RULES.bulletLife;
}

function telegraph(
  w: World,
  x: number,
  y: number,
  r: number,
  dur: number,
  dmg: number,
  spawn: StatEnemyId | null = null,
  lx = 0,
  ly = 0,
): void {
  const t = w.tele.acquire();
  t.x = x;
  t.y = y;
  t.r = r;
  t.lx = lx;
  t.ly = ly;
  t.t = 0;
  t.dur = dur;
  t.dmg = dmg;
  t.spawn = spawn;
}

/** Salto del Coloso: aviso donde está ahora el jugador y velocidad para llegar justo al acabar el aviso. */
function startLeap(w: World, e: Enemy): void {
  const A = AI.coloso;
  const p = w.player;
  telegraph(w, p.x, p.y, A.stompR, A.stompWarn, A.stompDmg);
  e.dx = (p.x - e.x) / A.stompWarn;
  e.dy = (p.y - e.y) / A.stompWarn;
  e.stun = A.stompWarn;
  e.alt = true;
}

function leapTick(w: World, e: Enemy, dt: number): void {
  e.stun -= dt;
  if (e.stun <= 0 && e.alt) {
    e.alt = false;
    addShake(w, 12, 16);
  }
}

/** Marca en el suelo el pasillo de una embestida (solo aviso: el daño lo hace el contacto). */
function dashLane(w: World, e: Enemy, aim: number, spd: number, dur: number): void {
  const len = spd * dur + e.r;
  telegraph(w, e.x, e.y, e.r, aim, 0, null, e.dx * len, e.dy * len);
}

function ring(w: World, type: StatEnemyId, cx: number, cy: number, n: number, dist: number): void {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    spawnEnemy(w, type, cx + Math.cos(a) * dist, cy + Math.sin(a) * dist, false);
  }
}

// Velocidad deseada calculada por la IA (evita devolver objetos).
let vx = 0;
let vy = 0;

/** Velocidad efectiva: la de un enfurecido no pasa de `RAGE.speedCap` × la del jugador. */
const speedOf = (w: World, e: Enemy): number =>
  e.rage ? Math.min(e.speed, w.st.speed * RAGE.speedCap) : e.speed;

function think(w: World, e: Enemy, d: number, ux: number, uy: number, dt: number): void {
  const p = w.player;
  const spd = speedOf(w, e);
  const irrRad = e.irr ? IRRADIATED.rad : 0;
  switch (e.type) {
    case 'tirador': {
      const A = AI.tirador;
      if (d > (e.moving ? A.hold : A.hold + A.resume)) {
        vx = ux * spd;
        vy = uy * spd;
      } else {
        vx = 0;
        vy = 0;
      }
      e.timer -= dt;
      if (e.timer <= 0 && d < A.range) {
        e.timer = A.fireCd;
        fireBullet(w, e.x, e.y, ux, uy, A.bulletSpd, e.dmg, irrRad);
        markAttack(w, e);
      }
      break;
    }
    case 'predicador': {
      const A = AI.predicador;
      if (d > A.keepMax) {
        vx = ux * spd;
        vy = uy * spd;
      } else if (d < A.keepMin) {
        vx = -ux * spd;
        vy = -uy * spd;
      } else {
        vx = -uy * spd * A.strafe * e.side;
        vy = ux * spd * A.strafe * e.side;
      }
      e.timer -= dt;
      if (e.timer <= 0 && d < A.range) {
        e.timer = A.every;
        sermon(w, e);
        markAttack(w, e);
      }
      break;
    }
    case 'cortacesped':
    case 'rey_rata': {
      const A = e.type === 'rey_rata' ? AI.rey_rata : AI.cortacesped;
      if (e.mode === MODE_CHASE) {
        vx = ux * spd;
        vy = uy * spd;
        e.timer -= dt;
        if (e.type === 'cortacesped') {
          if (e.timer <= 0 && d < AI.cortacesped.range) {
            e.mode = MODE_AIM;
            e.mt = A.aim;
            e.dx = ux;
            e.dy = uy;
            markAttack(w, e);
          }
        } else {
          const R = AI.rey_rata;
          if (e.phase === 1 && e.hp / e.maxHp < R.p2) {
            e.phase = 2;
            banner(w, 'banner.ratPhase');
            addShake(w, 6);
            ring(w, 'necrofago', e.x, e.y, 4, R.summonDist + 30);
          }
          const p2 = e.phase >= 2;
          // `burst` = embestidas que le quedan en el ciclo; `mt` en persecución = tiempo parado llamando a las ratas.
          if (e.mt > 0) {
            vx = vy = 0;
            e.mt -= dt;
          } else if (e.timer <= 0) {
            if (e.burst > 0) {
              e.burst--;
              e.mode = MODE_AIM;
              e.mt = p2 ? R.aimP2 : R.aim;
              e.dx = ux;
              e.dy = uy;
              dashLane(w, e, e.mt, R.dashSpd, R.dash);
              markAttack(w, e, 'attack_1');
            } else {
              markAttack(w, e, 'attack_2');
              ring(w, R.summonType, e.x, e.y, p2 ? R.summonP2 : R.summon, R.summonDist);
              e.mt = R.summonStop;
              e.timer = R.summonStop;
              e.burst = p2 ? R.chainP2 : R.chain;
            }
          }
        }
      } else if (e.mode === MODE_AIM) {
        vx = vy = 0;
        e.mt -= dt;
        if (e.mt <= 0) {
          e.mode = MODE_DASH;
          e.mt = A.dash;
        }
      } else {
        vx = e.dx * A.dashSpd;
        vy = e.dy * A.dashSpd;
        e.mt -= dt;
        if (e.mt <= 0) {
          e.mode = MODE_CHASE;
          if (e.type === 'cortacesped') e.timer = AI.cortacesped.every;
          // El Rey Rata enlaza la siguiente embestida casi sin pausa.
          else e.timer = e.phase >= 2 ? AI.rey_rata.gapP2 : AI.rey_rata.gap;
        }
      }
      break;
    }
    case 'torreta': {
      const A = AI.torreta;
      vx = vy = 0;
      e.timer -= dt;
      if (e.burst > 0) {
        e.bt -= dt;
        if (e.bt <= 0) {
          e.burst--;
          e.bt = A.burstGap;
          fireBullet(w, e.x, e.y, ux, uy, A.bulletSpd, e.dmg, irrRad);
        }
      } else if (e.timer <= 0 && d < A.range) {
        e.timer = A.every;
        e.burst = A.burst;
        e.bt = 0;
        markAttack(w, e);
        if (w.rng() < A.sloganChance) textFx(w, 'slogan', e.x, e.y, (w.rng() * SLOGAN_COUNT) | 0);
      }
      e.facingX = ux;
      e.facingY = uy;
      break;
    }
    case 'babosa': {
      const A = AI.babosa;
      vx = ux * spd;
      vy = uy * spd;
      e.trail -= dt;
      if (e.trail <= 0) {
        e.trail = A.trailEvery;
        let s: Slime;
        if (w.slimes.count < SPAWN.maxSlime) s = w.slimes.acquire();
        else {
          // Lleno: reemplaza el rastro con menos vida.
          let oi = 0;
          for (let i = 1; i < w.slimes.count; i++)
            if (w.slimes.items[i]!.life < w.slimes.items[oi]!.life) oi = i;
          s = w.slimes.items[oi]!;
        }
        s.x = e.x;
        s.y = e.y;
        s.r = A.trailR;
        s.life = s.max = A.trailLife;
        s.rad = A.trailRad;
      }
      break;
    }
    case 'dirigible': {
      const A = AI.dirigible;
      // Orbita al jugador a `orbitR`.
      const tx = -uy * e.side;
      const ty = ux * e.side;
      const err = clamp((d - A.orbitR) * 1.5, -spd, spd);
      vx = tx * spd + ux * err;
      vy = ty * spd + uy * err;
      const p2 = e.hp / e.maxHp < A.p2;
      if (p2 && e.phase === 1) {
        e.phase = 2;
        banner(w, 'banner.blimpDown');
        addShake(w, 6);
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
          const l = Math.sqrt(vx * vx + vy * vy) || 1;
          const bx = vx / l;
          const by = vy / l;
          for (let i = 0; i < A.bombCount; i++) {
            const off = (i - (A.bombCount - 1) / 2) * A.bombSpacing;
            telegraph(w, p.x + bx * off, p.y + by * off, A.bombR, A.bombWarn, A.bombDmg);
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
      break;
    }
    case 'coloso': {
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
        vx = e.dx;
        vy = e.dy;
        leapTick(w, e, dt);
      } else {
        vx = ux * sp;
        vy = uy * sp;
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
            telegraph(
              w,
              p.x + Math.cos(a) * rr,
              p.y + Math.sin(a) * rr,
              A.debrisR,
              A.debrisWarn,
              A.debrisDmg,
            );
          }
        } else {
          markAttack(w, e, 'attack_2');
          spawnEnemy(w, 'torreta', e.x + 110, e.y, false);
          ring(w, 'necrofago', e.x, e.y, A.summonGhouls, A.summonDist);
        }
      }
      break;
    }
    default:
      vx = ux * spd;
      vy = uy * spd;
  }
}

/** Lo que hace cada prefijo de élite en cada tick (el blindaje y la división van en combat.ts). */
function eliteTick(w: World, e: Enemy, d: number, dt: number): void {
  if (e.elite === 'radiactivo') {
    if (d < ELITES.radiactivo.auraR) addRad(w, ELITES.radiactivo.auraRad * dt);
  } else if (e.elite === 'vampirico') {
    e.hp = Math.min(e.maxHp, e.hp + e.maxHp * ELITES.vampirico.regen * dt);
  }
}

export function updateEnemies(w: World, dt: number): void {
  const pool = w.enemies;
  const items = pool.items;
  const n = pool.count;
  const p = w.player;
  const grid = w.enemyGrid;
  const out = w.scratch;
  const kd = Math.exp(-KNOCKBACK.decay * dt);
  const alive = p.deadAt === null;
  if (w.rageFrom === Infinity && w.level >= RAGE.minLevel) w.rageFrom = w.time;

  for (let i = 0; i < n; i++) {
    const e = items[i] as Enemy;
    if (e.dead) continue;
    e.prevX = e.x;
    e.prevY = e.y;
    e.flash -= dt;
    e.atkCd -= dt;
    if (!e.rage && !e.boss && !e.elite && w.time - Math.max(e.born, w.rageFrom) >= RAGE.after) enrage(e);
    // Congelado por la crio-granada: ni se mueve ni ataca.
    if (e.frozen > 0) {
      e.frozen -= dt;
      e.moving = false;
      continue;
    }

    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    const ux = dx / d;
    const uy = dy / d;
    vx = 0;
    vy = 0;
    if (e.march > 0) {
      // Horda en formación: sigue recto aunque el jugador se aparte.
      e.march -= dt;
      vx = e.dx * speedOf(w, e);
      vy = e.dy * speedOf(w, e);
    } else if (!e.boss && e.stun > 0) {
      // Aturdido por los petardos: no avanza ni ataca, pero el empuje sigue.
      e.stun -= dt;
    } else if (alive) think(w, e, d, ux, uy, dt);
    if (e.elite && alive) eliteTick(w, e, d, dt);
    if (e.irr && alive && d < IRRADIATED.auraR) addRad(w, IRRADIATED.auraRad * dt);
    // Si ya está encima del jugador, no lo empuja (solo se separa).
    // El Coloso en pleno salto (alt) no se para encima del jugador ni rodea obstáculos: va por el aire.
    if (
      e.mode === MODE_CHASE &&
      e.march <= 0 &&
      d <= e.r + p.r &&
      e.type !== 'dirigible' &&
      !(e.type === 'coloso' && e.alt)
    ) {
      vx = 0;
      vy = 0;
    }

    // Separación con los vecinos solapados (no aplica a jefes, voladores ni torretas).
    let sx = 0;
    let sy = 0;
    if (!e.boss && !e.flying && e.type !== 'torreta') {
      const k = grid.query(e.x, e.y, e.r, MAX_ENEMY_RADIUS, out);
      for (let j = 0; j < k && j < ENEMY_RULES.maxNeighbors; j++) {
        const oi = out[j]!;
        if (oi === i) continue;
        const o = items[oi] as Enemy;
        if (o.flying || o.dead) continue;
        let ox = e.x - o.x;
        let oy = e.y - o.y;
        let od = Math.sqrt(ox * ox + oy * oy);
        if (od < 1e-6) {
          // Centros coincidentes: separa en una dirección determinista según el orden en el pool.
          ox = i < oi ? 1 : -1;
          oy = 0;
          od = 1;
        }
        const overlap = e.r + o.r - od;
        if (overlap > 0) {
          const push =
            Math.min(overlap, ENEMY_RULES.separationMaxPush) * (o.boss ? 1 : ENEMY_RULES.separationShare);
          sx += (ox / od) * push;
          sy += (oy / od) * push;
        }
      }
    }

    const nx = e.x + (vx + e.kbx) * dt + sx;
    const ny = e.y + (vy + e.kby) * dt + sy;
    e.x = nx;
    e.y = ny;
    // Los de tierra rodean los obstáculos; los voladores pasan por encima.
    if (!e.flying && !(e.type === 'coloso' && e.alt) && e.type !== 'torreta')
      blockCircle(w, e, e.r, vx + e.kbx, vy + e.kby, e.side);
    e.kbx *= kd;
    e.kby *= kd;

    // Orientación para el sprite.
    const vl = Math.sqrt(vx * vx + vy * vy);
    e.moving = vl > ENEMY_RULES.movingSpeed;
    if (e.mode === MODE_AIM) {
      e.facingX = e.dx;
      e.facingY = e.dy;
    } else if (e.type !== 'torreta') {
      if (e.moving) {
        e.facingX = vx / vl;
        e.facingY = vy / vl;
      } else {
        e.facingX = ux;
        e.facingY = uy;
      }
    }

    // Contacto.
    if (alive && !e.flying && e.dmg > 0 && e.type !== 'torreta' && d < p.r + e.r && e.atkCd <= 0) {
      const s: EnemyStats = ENEMY_STATS[e.type];
      const r = hurtPlayer(w, e.dmg, (s.rad ?? 0) + (e.irr ? IRRADIATED.rad : 0));
      if (r !== 0) {
        e.atkCd = PLAYER.contactCd;
        if (!e.boss) markAttack(w, e);
        if (r > 0 && e.elite === 'vampirico')
          e.hp = Math.min(e.maxHp, e.hp + e.maxHp * ELITES.vampirico.healOnHit);
      }
    }
  }
}

export function updateEnemyBullets(w: World, dt: number): void {
  const p = w.player;
  const pool = w.ebullets;
  for (let i = pool.count - 1; i >= 0; i--) {
    const b = pool.items[i]!;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0 || hitsObstacle(w, b.x, b.y)) {
      pool.releaseAt(i);
      continue;
    }
    const dx = b.x - p.x;
    const dy = b.y - p.y;
    const rr = p.r + b.r;
    if (dx * dx + dy * dy < rr * rr) {
      pool.releaseAt(i);
      hurtPlayer(w, b.dmg, b.rad);
    }
  }
}

export function updateTelegraphs(w: World, dt: number): void {
  const p = w.player;
  const pool = w.tele;
  for (let i = pool.count - 1; i >= 0; i--) {
    const t = pool.items[i]!;
    t.t += dt;
    if (t.t < t.dur) continue;
    const x = t.x;
    const y = t.y;
    const r = t.r;
    const dmg = t.dmg;
    const spawn = t.spawn;
    pool.releaseAt(i);
    if (dmg <= 0 && !spawn) continue;
    boom(w, x, y, r, 0.25, FX.colors.tele);
    addShake(w, 3);
    const dx = p.x - x;
    const dy = p.y - y;
    const rr = r + p.r;
    if (dx * dx + dy * dy < rr * rr) hurtPlayer(w, dmg);
    if (spawn) spawnEnemy(w, spawn, x, y, false);
  }
}

export function updateSlimes(w: World, dt: number): void {
  for (let i = w.slimes.count - 1; i >= 0; i--) {
    const s = w.slimes.items[i]!;
    s.life -= dt;
    if (s.life <= 0) w.slimes.releaseAt(i);
  }
}
