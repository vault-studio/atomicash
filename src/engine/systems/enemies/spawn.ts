// Aparición de enemigos (con sus temporizadores iniciales), élites y retirada del pool.
import {
  AI,
  ELITES,
  ENEMY_RULES,
  ENEMY_STATS,
  enemyRadius,
  type EliteId,
  type EnemyStats,
  type StatEnemyId,
} from '../../../config/enemies';
import { IRRADIATED } from '../../../config/radiation';
import { ENDLESS } from '../../../config/modes';
import { MODE_CHASE, type Enemy, type World } from '../../types';
import { irradiatedChance } from '../combat';

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
