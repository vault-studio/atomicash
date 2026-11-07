// Enemigos: aparición, IA (persecución, tirador, predicador, embestida, torreta, babosa, jefes) y separación.
// Sin allocations: recorre el pool por índice y usa buffers del World.
// No usar Math.hypot en el bucle caliente (V8 reserva memoria en cada llamada): `hypot2` da lo mismo sin reservar.
// Ni pasar decimales como argumentos a funciones del bucle: van en `cur` y `body` (ver `cur`).
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
  type DashSpec,
  type EnemyStats,
  type GunnerAI,
  type InterceptorAI,
  type SalvoAI,
  type RageOverride,
  type StatEnemyId,
} from '../../config/enemies';
import { WEAPONS } from '../../config/weapons';
import { IRRADIATED, RAD } from '../../config/radiation';
import { FX, KNOCKBACK, PLAYER } from '../../config/run';
import { SPAWN } from '../../config/waves';
import { ENDLESS, RAINS } from '../../config/modes';
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
  type TeleFall,
  type Telegraph,
  type World,
} from '../types';
import { blockBody, body, hitsObstacle } from '../obstacles';
import { decimalFields } from '../pool';
import { houndSpeed, hypot2, interceptPoint, skidVelocity, tryStun, turnToward, type Vec } from '../rules';
import { RAGE_END, RAGE_START, rageForce, rageStep, rageTrigger } from '../rage';
import { hurtIndex } from '../runStats';
import { addRad, hurtPlayer, irradiatedChance } from './combat';
import { landFall, markFall } from '../scars';
import { mirrorAngle, mirrorBulletDmg, mirrorShotCount, mirrorThink, mirrorVel } from './mirror';
import { mortarThink, mortarVel } from './shooters';
import { SFX, sfx } from '../sfx';

const TAU = Math.PI * 2;
const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
/** Eslóganes de la torreta (i18n `slogans.<n>`). */
export const SLOGAN_COUNT = 6;
/** Fuentes de las salvas (mortero, bidonero y nevera): sus impactos cuentan como recibidos o esquivados. */
const MORTAR_SRC = hurtIndex('mortero');
const BARREL_SRC = hurtIndex('bidonero');
const FRIDGE_SRC = hurtIndex('nevera');

export function createEnemy(): Enemy {
  // Todo número que pueda llevar decimales arranca con uno (spawnEnemy pone el valor real): si arrancara entero, V8
  // cambiaría el mapa del Enemy la primera vez que guarde un decimal, a media partida, y desharía lo optimizado del
  // bucle de IA (reserva memoria).
  return {
    id: 0,
    type: 'dron',
    x: 0.5,
    y: 0.5,
    prevX: 0.5,
    prevY: 0.5,
    r: 0.5,
    hp: 0.5,
    maxHp: 0.5,
    speed: 0.5,
    dmg: 0.5,
    xp: 0,
    facingX: Math.SQRT1_2,
    facingY: Math.SQRT1_2,
    moving: false,
    born: 0.5,
    dead: false,
    irr: false,
    rage: false,
    rageT: 0.5,
    rageCd: 0.5,
    chase: 0.5,
    rageN: 0,
    rageDmg: 0.5,
    boss: false,
    flying: false,
    gar: -1,
    atkCd: 0.5,
    kbx: 0.5,
    kby: 0.5,
    flash: 0.5,
    mode: MODE_CHASE,
    mt: 0.5,
    dx: 0.5,
    dy: 0.5,
    burst: 0.5,
    bt: 0.5,
    stun: 0.5,
    frozen: 0.5,
    slowT: 0.5,
    slowK: 0.5,
    act: 0,
    alt: false,
    phase: 1,
    lastAtk: 0.5,
    atkAnim: 'attack',
    trail: 0.5,
    timer: 0.5,
    side: 1,
    elite: null,
    skin: null,
    march: 0.5,
    hitT: new Float64Array(ORBIT_SLOTS),
    burnT: new Float64Array(WEAPONS.coctel.burn.stacks),
    burnD: new Float64Array(WEAPONS.coctel.burn.stacks),
    burnTick: 0.5,
    fireAt: -2,
    poolAt: 0.5,
    hitAt: 0.5,
    fireIn: 0.5,
  };
}

export const createBullet = (): EnemyBullet => ({
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  r: 0,
  dmg: 0,
  rad: 0,
  life: 0,
  src: -1,
});

/** Fuente (índice en HURT_SOURCES) del enemigo que está actuando: la heredan sus balas y avisos. */
let curSrc = -1;
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
  src: -1,
  rad: 0,
  fall: null,
  hz: 0,
});
export const createSlime = (): Slime => ({ x: 0, y: 0, r: 0, life: 0, max: 0, rad: 0 });

function firstTimer(type: StatEnemyId): number {
  switch (type) {
    case 'tirador':
      return AI.tirador.fireCd;
    case 'torreta':
      return AI.torreta.every;
    case 'predicador':
      return AI.predicador.every;
    case 'rey_rata':
      return AI.rey_rata.every;
    case 'mortero':
      return AI.mortero.every * 0.5;
    case 'copia':
      return AI.copia.every;
    case 'bidonero':
      return AI.bidonero.every * 0.5;
    case 'nevera':
      return AI.nevera.every * 0.5;
    case 'liquidador':
      return AI.liquidador.fireCd;
    case 'dirigible':
      return AI.dirigible.every;
    case 'coloso':
      return AI.coloso.every;
    default:
      // Quien tiene embestida por datos empieza con su primer enfriamiento.
      return ENEMY_STATS[type].dash?.every ?? 0;
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
  e.rageT = e.rageCd = e.chase = e.rageN = e.rageDmg = 0;
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
  e.slowT = 0;
  e.slowK = 1;
  e.act = 0;
  e.alt = false;
  e.phase = 1;
  e.lastAtk = -9;
  e.atkAnim = 'attack';
  e.trail = 0;
  e.timer = firstTimer(type) * (0.4 + w.rng() * 0.6);
  e.side = w.rng() < 0.5 ? -1 : 1;
  e.elite = null;
  e.skin = null;
  e.march = 0;
  e.hitT.fill(-1e9);
  e.burnT.fill(0);
  e.burnTick = 0;
  e.fireAt = -2;
  e.poolAt = -9;
  e.hitAt = -1;
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
function rageTick(w: World, e: Enemy, dt: number): void {
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
function sermon(w: World, e: Enemy): void {
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
  b.src = curSrc;
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
  t.src = curSrc;
  t.rad = 0;
  t.fall = null;
  t.hz = 0;
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
function dashLane(w: World, e: Enemy, aim: number, len: number): void {
  const l = len + e.r;
  telegraph(w, e.x, e.y, e.r, aim, 0, null, e.dx * l, e.dy * l);
}

/** Distancia (px) hasta el jugador medida sobre el pasillo de la embestida (`dx`, `dy`); negativa si ya lo ha pasado. */
function alongLane(w: World, e: Enemy): number {
  return (w.player.x - e.x) * e.dx + (w.player.y - e.y) * e.dy;
}

/**
 * La embestida nunca se queda corta: sigue en línea recta hasta dejar al jugador `over` px atrás. Solo acaba antes si
 * él corre por el pasillo más deprisa que ella (`spd`), porque entonces no lo alcanzaría nunca.
 */
function dashDone(w: World, e: Enemy, spd: number, over: number): boolean {
  const p = w.player;
  return alongLane(w, e) + over <= 0 || p.vx * e.dx + p.vy * e.dy >= spd;
}

function ring(w: World, type: StatEnemyId, cx: number, cy: number, n: number, dist: number): void {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    spawnEnemy(w, type, cx + Math.cos(a) * dist, cy + Math.sin(a) * dist, false);
  }
}

/**
 * Lo que el bucle de IA sabe del enemigo que actúa: distancia y dirección al jugador (`d`, `ux`, `uy`), velocidad
 * efectiva (`spd`) y, de vuelta, la velocidad deseada (`vx`, `vy`). Va aquí y no en argumentos: V8 guarda en su sitio
 * un decimal de un campo, pero cada decimal que cruza una llamada sin incorporar reserva memoria, y con 1 000
 * enemigos por tick eso llena el espacio joven. Tampoco sirven variables `let` de módulo: cada escritura reserva otra.
 */
const cur = decimalFields({ d: 0, ux: 0, uy: 0, spd: 0, vx: 0, vy: 0 });

/** Calcula `cur.spd`: un enfurecido corre a max(la suya, la del jugador × `RAGE.speed`), así que puede alcanzarlo. */
function speedOf(w: World, e: Enemy): void {
  if (!e.rage) {
    cur.spd = e.speed * e.slowK;
    return;
  }
  // Inline (sin llamar a rageSpeed): este es el camino caliente y las llamadas con decimales reservan memoria.
  const ovr = ENEMY_STATS[e.type].rage;
  const run = w.st.speed * (ovr !== undefined && ovr.speed !== undefined ? ovr.speed : RAGE.speed);
  cur.spd = (run > e.speed ? run : e.speed) * e.slowK;
}

// Bloques de IA según el tipo. Son funciones aparte, y `think` llama a cada habilidad desde un solo sitio: si tuviera
// una llamada por tipo, gastaría el presupuesto de inlining de V8 y sus ayudantes serían llamadas de verdad.

/** Bloque de IA de los interceptores: `ai.sabueso`, `ai.motorista` o, en cualquier otro caso, `ai.interceptor`. */
function interceptorAI(type: StatEnemyId): InterceptorAI {
  return type === 'sabueso' ? AI.sabueso : type === 'motorista' ? AI.motorista : AI.interceptor;
}

/** Bloque de IA de los tiradores de balas: `ai.liquidador` o, en cualquier otro caso, `ai.tirador`. */
const gunnerAI = (type: StatEnemyId): GunnerAI => (type === 'liquidador' ? AI.liquidador : AI.tirador);

/** Bloque de IA de los lanzadores: `ai.bidonero`, `ai.nevera` o, en cualquier otro caso, `ai.mortero`. */
function salvoAI(type: StatEnemyId): SalvoAI {
  return type === 'bidonero' ? AI.bidonero : type === 'nevera' ? AI.nevera : AI.mortero;
}

/** Lo que cae de cada lanzador: barriles de ácido, bloques de hielo u obuses. */
const salvoFall = (type: StatEnemyId): TeleFall =>
  type === 'bidonero' ? 'barrel' : type === 'nevera' ? 'ice' : 'shell';

/**
 * Interrumpe la habilidad que esté preparando o lanzando (CAMBIOS §5, control): la embestida vuelve a perseguir con su
 * enfriamiento entero, el interceptor corta su carrera y el mortero reinicia la carga. Los jefes no se interrumpen.
 */
export function interruptEnemy(e: Enemy): boolean {
  if (e.boss) return false;
  const dash = ENEMY_STATS[e.type].dash;
  if (dash !== undefined && e.mode !== MODE_CHASE) {
    e.mode = MODE_CHASE;
    e.timer = dash.every;
    return true;
  }
  const role = (ENEMY_STATS[e.type] as EnemyStats).role;
  if (role === 'interceptor' && e.mode === MODE_CHASE) {
    // Corta la carrera: frena y pierde lo acumulado para aturdir.
    e.mode = MODE_AIM;
    e.timer = interceptorAI(e.type).recover;
    e.mt = 0;
    e.alt = false;
    return true;
  }
  if (role === 'launcher') {
    const every = salvoAI(e.type).every;
    if (e.timer < every) {
      e.timer = every;
      return true;
    }
  }
  return false;
}

const aimPt: Vec = { x: 0, y: 0 };
const head: Vec = { x: 0, y: 0 };

/**
 * Embestida por datos (CAMBIOS §1, `enemies.<id>.dash`): vale para cualquier tipo. Cada `every` s, si el jugador está a
 * menos de `range`, se para `aim` s con el pasillo marcado en el suelo y corre a `speed` hasta dejar atrás al jugador
 * (`dashDone`; como mucho `maxDur` s, que `mt` cuenta). La dirección se fija al empezar el aviso: hacia el jugador (`lead` 0) o hacia donde va a estar
 * (`interceptPoint`, hasta `lead` s). Pone `cur.vx`/`cur.vy` y devuelve true mientras apunta o embiste; si no, devuelve false
 * y manda la IA normal del tipo.
 */
function dashTick(w: World, e: Enemy, D: DashSpec, dt: number): boolean {
  if (e.mode === MODE_CHASE) {
    e.timer -= dt;
    const d = cur.d;
    if (e.timer > 0 || d >= D.range) return false;
    e.mode = MODE_AIM;
    e.mt = D.aim;
    e.dx = cur.ux;
    e.dy = cur.uy;
    let reach = d;
    if (D.lead > 0) {
      const p = w.player;
      interceptPoint(e.x, e.y, p.x, p.y, p.vx, p.vy, D.speed, D.lead, aimPt);
      const tx = aimPt.x - e.x;
      const ty = aimPt.y - e.y;
      const tl = Math.sqrt(tx * tx + ty * ty);
      if (tl > 1e-6) {
        e.dx = tx / tl;
        e.dy = ty / tl;
        reach = tl;
      }
    }
    // El pasillo marca hasta el jugador o el punto apuntado (el más lejano) y `over` más; la carrera real lo sigue.
    const along = alongLane(w, e);
    dashLane(w, e, D.aim, (along > reach ? along : reach) + D.over);
    markAttack(w, e);
    cur.vx = cur.vy = 0;
    return true;
  }
  if (e.mode === MODE_AIM) {
    cur.vx = cur.vy = 0;
    e.mt -= dt;
    if (e.mt <= 0) {
      e.mode = MODE_DASH;
      e.mt = D.maxDur;
    }
    return true;
  }
  cur.vx = e.dx * D.speed;
  cur.vy = e.dy * D.speed;
  e.mt -= dt;
  if (e.mt <= 0 || dashDone(w, e, D.speed, D.over)) {
    e.mode = MODE_CHASE;
    e.mt = 0;
    e.timer = D.every;
  }
  return true;
}

/**
 * Interceptor (CAMBIOS §2): corre mucho más que el jugador pero gira despacio, y apunta a donde va a estar (le corta
 * la ruta de salida). `mt` = segundos que lleva de carrera; si alcanza al jugador tras `stunCharge` s, lo aturde.
 * Al alcanzarlo o pasar de largo (esquivado) frena `recover` s y vuelve a empezar la carrera. `A` es su bloque de IA
 * (`ai.interceptor`, `ai.sabueso`, `ai.motorista`). Con `skidSpeed` (motorista), si falla no frena de cara al jugador:
 * derrapa (MODE_DASH) `recover` s recto, expuesto (daño × `exposedMult`), y luego da la vuelta y carga otra vez.
 */
function interceptor(w: World, e: Enemy, dt: number, A: InterceptorAI): void {
  const p = w.player;
  const d = cur.d;
  const ux = cur.ux;
  const uy = cur.uy;
  const base = cur.spd;
  if (e.dx === 0 && e.dy === 0) {
    e.dx = ux;
    e.dy = uy;
  }
  if (e.mode === MODE_DASH) {
    // Derrape del motorista (`e.timer` = lo que le queda): sigue su rumbo, sin girar hacia el jugador, y va frenando.
    const k = skidVelocity(base, A.skidSpeed ?? 0, e.timer, A.recover);
    cur.vx = e.dx * k;
    cur.vy = e.dy * k;
    e.timer -= dt;
    if (e.timer <= 0) {
      e.mode = MODE_CHASE;
      e.mt = 0;
      e.alt = false;
    }
    return;
  }
  // El sabueso corre más cuanta más RAD lleva el jugador.
  const spd = A.radSpeed === undefined ? base : houndSpeed(base, A.radSpeed, p.rad, RAD.max);
  interceptPoint(e.x, e.y, p.x, p.y, p.vx, p.vy, spd, A.lead, aimPt);
  const tx = aimPt.x - e.x;
  const ty = aimPt.y - e.y;
  const tl = hypot2(tx, ty) || 1;
  turnToward(e.dx, e.dy, tx / tl, ty / tl, A.turn * dt, head);
  e.dx = head.x;
  e.dy = head.y;
  if (e.mode === MODE_AIM) {
    // Frenando tras una carrera.
    cur.vx = e.dx * spd * A.recoverSpeed;
    cur.vy = e.dy * spd * A.recoverSpeed;
    e.timer -= dt;
    if (e.timer <= 0) {
      e.mode = MODE_CHASE;
      e.mt = 0;
      e.alt = false;
    }
    return;
  }
  cur.vx = e.dx * spd;
  cur.vy = e.dy * spd;
  e.mt += dt;
  if (d < p.r + e.r) {
    w.rs.chargesHit++;
    if (e.atkCd <= 0) hurtPlayer(w, e.dmg, 0, false, curSrc);
    if (e.mt >= A.stunCharge && tryStun(p, A.stunDur, A.stunImmunity)) w.rs.stuns++;
    e.mode = MODE_AIM;
    e.timer = A.recover;
    // Frenando no pega: el daño es el del choque de la carrera.
    e.atkCd = Math.max(e.atkCd, A.recover);
    markAttack(w, e);
  } else if (d < A.missR) e.alt = true;
  else if (e.alt && e.dx * ux + e.dy * uy < 0) {
    // Pasó rozando y ya se aleja: esquivado.
    w.rs.chargesDodged++;
    e.timer = A.recover;
    if (A.skidSpeed === undefined) e.mode = MODE_AIM;
    else {
      // Fallo del motorista: derrapa.
      e.mode = MODE_DASH;
      markAttack(w, e);
    }
  }
}

/**
 * Tirador de balas (`ai.tirador`, `ai.liquidador`): se acerca hasta `hold`, se planta y dispara cada `fireCd` s. Cada
 * bala suma `shotRad` de RAD al jugador (más los del irradiado).
 */
function gunner(w: World, e: Enemy, dt: number, A: GunnerAI): void {
  const d = cur.d;
  if (d > (e.moving ? A.hold : A.hold + A.resume)) {
    cur.vx = cur.ux * cur.spd;
    cur.vy = cur.uy * cur.spd;
  } else {
    cur.vx = 0;
    cur.vy = 0;
  }
  e.timer -= dt;
  if (e.timer <= 0 && d < A.range) {
    e.timer = A.fireCd;
    const irrRad = e.irr ? IRRADIATED.rad : 0;
    fireBullet(w, e.x, e.y, cur.ux, cur.uy, A.bulletSpd, e.dmg, irrRad + (A.shotRad ?? 0));
    markAttack(w, e);
  }
}

function think(w: World, e: Enemy, dt: number): void {
  const p = w.player;
  curSrc = hurtIndex(e.type);
  speedOf(w, e);
  const d = cur.d;
  const ux = cur.ux;
  const uy = cur.uy;
  const spd = cur.spd;
  const dash = ENEMY_STATS[e.type].dash;
  if (dash !== undefined && dashTick(w, e, dash, dt)) return;
  switch (e.type) {
    case 'interceptor':
    case 'sabueso':
    case 'motorista':
      interceptor(w, e, dt, interceptorAI(e.type));
      break;
    case 'tirador':
    case 'liquidador':
      gunner(w, e, dt, gunnerAI(e.type));
      break;
    case 'copia': {
      // Ráfaga en abanico hacia el jugador; el número de balas y su daño salen de mirror.ts.
      if (mirrorThink(w, e, d, ux, uy, dt)) {
        const n = mirrorShotCount(w);
        const dmg = mirrorBulletDmg(w);
        for (let i = 0; i < n; i++) {
          const a = mirrorAngle(i, n);
          const c = Math.cos(a);
          const s = Math.sin(a);
          fireBullet(w, e.x, e.y, ux * c - uy * s, ux * s + uy * c, AI.copia.bulletSpd, dmg, 0);
        }
        markAttack(w, e);
      }
      cur.vx = mirrorVel.x;
      cur.vy = mirrorVel.y;
      break;
    }
    case 'mortero':
    case 'bidonero':
    case 'nevera': {
      const A = salvoAI(e.type);
      if (mortarThink(w, e, cur, dt, curSrc, A, salvoFall(e.type))) markAttack(w, e);
      cur.vx = mortarVel.x;
      cur.vy = mortarVel.y;
      break;
    }
    case 'predicador': {
      const A = AI.predicador;
      if (d > A.keepMax) {
        cur.vx = ux * spd;
        cur.vy = uy * spd;
      } else if (d < A.keepMin) {
        cur.vx = -ux * spd;
        cur.vy = -uy * spd;
      } else {
        cur.vx = -uy * spd * A.strafe * e.side;
        cur.vy = ux * spd * A.strafe * e.side;
      }
      e.timer -= dt;
      if (e.timer <= 0 && d < A.range) {
        e.timer = A.every;
        sermon(w, e);
        markAttack(w, e);
      }
      break;
    }
    case 'rey_rata': {
      const A = AI.rey_rata;
      if (e.mode === MODE_CHASE) {
        cur.vx = ux * spd;
        cur.vy = uy * spd;
        e.timer -= dt;
        if (e.phase === 1 && e.hp / e.maxHp < A.p2) {
          e.phase = 2;
          banner(w, 'banner.ratPhase');
          addShake(w, 6);
          ring(w, 'necrofago', p.x, p.y, 4, A.summonDist + 30);
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
      break;
    }
    case 'torreta': {
      const A = AI.torreta;
      cur.vx = cur.vy = 0;
      e.timer -= dt;
      if (e.burst > 0) {
        e.bt -= dt;
        if (e.bt <= 0) {
          e.burst--;
          e.bt = A.burstGap;
          fireBullet(w, e.x, e.y, ux, uy, A.bulletSpd, e.dmg, e.irr ? IRRADIATED.rad : 0);
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
      cur.vx = ux * spd;
      cur.vy = uy * spd;
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
      cur.vx = tx * spd + ux * err;
      cur.vy = ty * spd + uy * err;
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
          spawnEnemy(w, 'torreta', e.x + A.turretDist, e.y, false);
          ring(w, 'necrofago', e.x, e.y, A.summonGhouls, A.summonDist);
        }
      }
      break;
    }
    default:
      cur.vx = ux * spd;
      cur.vy = uy * spd;
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

  for (let i = 0; i < n; i++) {
    const e = items[i] as Enemy;
    if (e.dead) continue;
    e.prevX = e.x;
    e.prevY = e.y;
    e.flash -= dt;
    e.atkCd -= dt;
    // Congelado por la crio-granada: ni se mueve ni ataca (ni cuenta su furia).
    if (e.frozen > 0) {
      e.frozen -= dt;
      e.moving = false;
      continue;
    }
    if (!e.boss && !e.elite) rageTick(w, e, dt);
    if (e.slowT > 0) {
      e.slowT -= dt;
      if (e.slowT <= 0) e.slowK = 1;
    }

    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    const ux = dx / d;
    const uy = dy / d;
    let vx = 0;
    let vy = 0;
    if (e.march > 0) {
      // Horda en formación: sigue recto aunque el jugador se aparte.
      e.march -= dt;
      speedOf(w, e);
      vx = e.dx * cur.spd;
      vy = e.dy * cur.spd;
    } else if (!e.boss && e.stun > 0) {
      // Aturdido por los petardos: no avanza ni ataca, pero el empuje sigue.
      e.stun -= dt;
    } else if (alive) {
      cur.d = d;
      cur.ux = ux;
      cur.uy = uy;
      cur.vx = 0;
      cur.vy = 0;
      think(w, e, dt);
      vx = cur.vx;
      vy = cur.vy;
    }
    if (e.elite && alive) eliteTick(w, e, d, dt);
    if (e.irr && alive && d < IRRADIATED.auraR) addRad(w, IRRADIATED.auraRad * dt);
    // Si ya está encima del jugador, no lo empuja (solo se separa).
    // El Coloso en pleno salto (alt) no se para encima del jugador ni rodea obstáculos: va por el aire.
    if (
      e.mode === MODE_CHASE &&
      e.march <= 0 &&
      d <= e.r + p.r &&
      e.type !== 'dirigible' &&
      e.type !== 'copia' && // Nace encima del jugador y tiene que poder apartarse.
      !(e.type === 'coloso' && e.alt)
    ) {
      vx = 0;
      vy = 0;
    }

    // Separación con los vecinos solapados (no aplica a jefes, voladores ni torretas).
    let sx = 0;
    let sy = 0;
    if (!e.boss && !e.flying && e.type !== 'torreta') {
      const k = grid.queryCircle(e, MAX_ENEMY_RADIUS, out);
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
    if (!e.flying && !(e.type === 'coloso' && e.alt) && e.type !== 'torreta') {
      body.r = e.r;
      body.vx = vx + e.kbx;
      body.vy = vy + e.kby;
      body.side = e.side;
      blockBody(w, e);
    }
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
      const r = hurtPlayer(w, e.dmg, (s.rad ?? 0) + (e.irr ? IRRADIATED.rad : 0), false, hurtIndex(e.type));
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
      hurtPlayer(w, b.dmg, b.rad, false, b.src);
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
    const src = t.src;
    const rad = t.rad;
    const fall = t.fall;
    const hz = t.hz;
    pool.releaseAt(i);
    if (dmg <= 0 && !spawn) continue;
    const c = FX.colors;
    if (fall === 'scrap') boom(w, x, y, r, RAINS.scrap.dustLife, c.debris);
    else
      boom(
        w,
        x,
        y,
        r,
        0.25,
        fall === 'acid' || fall === 'barrel' ? c.bloater : fall === 'ice' ? c.freeze : c.tele,
      );
    addShake(w, 3);
    const dx = p.x - x;
    const dy = p.y - y;
    const rr = r + p.r;
    const hit = dx * dx + dy * dy < rr * rr;
    if (hit) hurtPlayer(w, dmg, rad, false, src);
    if (fall) landFall(w, fall, x, y, hz);
    if (src === MORTAR_SRC || src === BARREL_SRC || src === FRIDGE_SRC) {
      if (hit) w.rs.shellsHit++;
      else w.rs.shellsDodged++;
    }
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
