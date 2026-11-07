// Campaña de tres actos: jefes, transición, desbloqueos por rol, eventos especiales, élites y victoria.
import { describe, expect, it } from 'vitest';
import { ACT_IDS, CAMPAIGN, type ActId } from '../src/config/acts';
import { AI, ELITES, ENEMY_STATS, MIRROR_ID, type StatEnemyId } from '../src/config/enemies';
import { ENTITIES, ENTITY_IDS } from '../src/config/entities';
import { DAILY } from '../src/config/modes';
import { BUILDINGS, PROP_LIST } from '../src/config/props';
import { RUN } from '../src/config/run';
import { HORDES, WAVES } from '../src/config/waves';
import { validateConfig } from '../src/config/validate';
import {
  actCurtain,
  actTime,
  advanceAct,
  nextSpecialAt,
  updateCampaign,
} from '../src/engine/systems/campaign';
import { addChest, killEnemy, nearest } from '../src/engine/systems/combat';
import { spawnEnemy } from '../src/engine/systems/enemies';
import { putBomb } from '../src/engine/systems/mirror';
import { chooseEndless } from '../src/engine/systems/modes';
import { startDownpour } from '../src/engine/systems/rains';
import { rollSpecial, spawnBoss, spawnElite, spawnable, unlocked } from '../src/engine/systems/spawning';
import { worldObjectAt, createCellObject } from '../src/engine/obstacles';
import type { Enemy, InputState, World } from '../src/engine/types';
import { createWorld, killPlayer, tick } from '../src/engine/world';

const STEP = 1 / RUN.tickHz;
const STILL: InputState = { moveX: 0, moveY: 0 };

const run = (w: World, sec: number, input = STILL): void => {
  for (let i = 0; i < Math.round(sec * RUN.tickHz); i++) tick(w, input, STEP);
};

const alive = (w: World): Enemy[] => w.enemies.items.slice(0, w.enemies.count).filter((e) => !e.dead);
const pickups = (w: World) => w.pickups.items.slice(0, w.pickups.count);

/** Jugador invencible sin armas y sin cartas de nivel. */
function fresh(act: ActId = 1, seed = 1, hazards = true): World {
  const w = createWorld('dot', seed, { startWeapon: null, act, hazards });
  w.player.god = true;
  w.xpNext = Infinity;
  return w;
}

/** Mundo en el segundo `t` del acto (con `advanceAct` el acto empieza en `w.time`). */
const at = (w: World, t: number): void => {
  w.time = w.actStart + t;
};

/** Mata al jefe del acto en curso (lo saca si hace falta). */
function killBoss(w: World): Enemy {
  const kind = CAMPAIGN.acts[w.act].boss;
  if (!w.bossSpawned[kind]) spawnBoss(w, kind);
  const b = alive(w).find((e) => e.type === kind)!;
  killEnemy(w, b, 'llave');
  return b;
}

describe('datos de la campaña', () => {
  it('la configuración es válida', () => {
    expect(validateConfig()).toEqual([]);
  });

  it('un jefe por acto, en orden, en el mismo segundo de cada acto', () => {
    expect(ACT_IDS.map((a) => CAMPAIGN.acts[a].boss)).toEqual(['rey_rata', 'dirigible', 'coloso']);
    expect(CAMPAIGN.bossAt).toBe(120);
  });

  it('el reparto por rol y acto es el acordado', () => {
    const want: Record<string, readonly (readonly StatEnemyId[])[]> = {
      normal: [['necrofago'], ['aspiradora'], ['predicador']],
      shooter: [['liquidador'], ['torreta'], ['tirador']],
      interceptor: [['sabueso'], ['interceptor'], ['motorista']],
      launcher: [['bidonero'], ['nevera'], ['mortero']],
      heavy: [['babosa'], ['excavadora'], ['blindado']],
      chaser: [['reptador'], ['dron', 'aspiradora_cria'], ['saqueador']],
    };
    for (const [role, acts] of Object.entries(want))
      acts.forEach((ids, i) => {
        for (const id of ids) {
          expect(ENEMY_STATS[id].role, id).toBe(role);
          expect(ENTITIES[id].act, id).toBe(i + 1);
        }
      });
  });

  it('cada oleada, cerco y guarnición solo lleva enemigos de su acto, y hay tres oleadas por acto', () => {
    for (const a of ACT_IDS)
      expect(WAVES.filter((x) => x.act === a).map((x) => x.from)).toEqual([0, 60, 120]);
    for (const wave of WAVES)
      for (const id of Object.keys(wave.mix) as StatEnemyId[]) expect(ENTITIES[id].act, id).toBe(wave.act);
    for (const a of ACT_IDS) {
      for (const id of Object.keys(HORDES.ring.mix[a]) as StatEnemyId[]) expect(ENTITIES[id].act).toBe(a);
      for (const groups of Object.values(BUILDINGS.enemies[a]))
        for (const [id] of groups) expect(ENTITIES[id].act).toBe(a);
    }
  });

  it('hinchado y cortacésped no salen en oleadas, cercos ni guarniciones', () => {
    for (const id of ['hinchado', 'cortacesped']) {
      for (const wave of WAVES) expect(wave.mix).not.toHaveProperty(id);
      for (const a of ACT_IDS) {
        expect(HORDES.ring.mix[a]).not.toHaveProperty(id);
        expect(HORDES.stampede.types[a].some((x) => x.type === id)).toBe(false);
        expect(HORDES.wall.types[a].some((x) => x.type === id)).toBe(false);
        for (const groups of Object.values(BUILDINGS.enemies[a]))
          expect(groups.some(([t]) => t === id)).toBe(false);
      }
    }
  });

  it('los jefes invocan enemigos de su acto', () => {
    expect(ENTITIES[AI.rey_rata.summonType].act).toBe(1);
    expect(ENTITIES[AI.dirigible.p2SummonType].act).toBe(2);
    expect(ENTITIES[AI.coloso.summonType].act).toBe(3);
    expect(ENTITIES[AI.coloso.turretType].act).toBe(3);
  });

  it('todas las entidades siguen teniendo un acto válido', () => {
    for (const id of ENTITY_IDS) expect(ACT_IDS).toContain(ENTITIES[id].act);
  });
});

describe('orden de jefes y reloj del acto', () => {
  it('el acto empieza en el de `opts.act`, y su reloj en 0', () => {
    const w = fresh(3);
    expect(w.act).toBe(3);
    expect(actTime(w)).toBe(0);
    run(w, 1);
    expect(actTime(w)).toBeCloseTo(1);
  });

  it('el jefe sale en el segundo 120 del acto, también tras cambiar de acto', () => {
    const w = fresh(1, 1, false);
    w.time = 500;
    advanceAct(w);
    expect(w.act).toBe(2);
    expect(w.actStart).toBe(500);
    w.nextElite = w.nextSpecial = w.nextObjective = Infinity;
    at(w, CAMPAIGN.bossAt - 1);
    run(w, 0.5);
    expect(w.bossSpawned.dirigible).toBeUndefined();
    run(w, 0.6);
    expect(w.bossSpawned.dirigible).toBe(true);
    expect(w.bossSpawned.rey_rata).toBeUndefined();
    expect(w.bossSpawned.coloso).toBeUndefined();
  });

  it('Rey Rata → Acto 2, Dirigible → Acto 3, Coloso → victoria, en una partida seguida', () => {
    const w = fresh(1, 2, false);
    w.player.god = true;
    w.nextElite = w.nextSpecial = w.nextObjective = Infinity;
    const seen: string[] = [];
    for (const act of ACT_IDS) {
      expect(w.act).toBe(act);
      at(w, CAMPAIGN.bossAt);
      w.nextElite = w.nextSpecial = w.nextObjective = Infinity;
      run(w, 0.1);
      const boss = alive(w).find((e) => e.boss)!;
      seen.push(boss.type);
      killEnemy(w, boss, 'llave');
      // El cofre del jefe abre una elección que aquí se ignora; la del infinito es la que cierra la partida.
      for (let k = 0; k < 40 * RUN.tickHz && w.act === act && !w.won; k++) {
        tick(w, STILL, STEP);
        if (w.choice) w.choice = null;
        w.victory = false;
      }
    }
    expect(seen).toEqual(['rey_rata', 'dirigible', 'coloso']);
    expect(w.won).toBe(true);
    expect(w.choice?.type).toBe('endless');
    expect(w.bosses).toBe(3);
  });
});

describe('transición de acto', () => {
  it('al caer el jefe: fuera enemigos sin botín, balas, avisos, horda y lluvias; la chatarra va al jugador', () => {
    const w = fresh();
    const p = w.player;
    spawnBoss(w, 'rey_rata');
    const mob = spawnEnemy(w, 'necrofago', p.x + 300, p.y, false);
    const kills = w.kills;
    const xp = w.xp;
    w.horde = { kind: 'ring', t: 1, ax: 1, ay: 0 };
    w.rain = 5;
    startDownpour(w, 'scrap');
    w.objective = { kind: 'hold', x: 0, y: 0, r: 10, progress: 0, goal: 5, left: 9 };
    w.tele.acquire();
    w.ebullets.acquire();
    w.lobs.acquire();
    const gem = w.pickups.acquire();
    Object.assign(gem, { kind: 'gem', x: p.x + 5000, y: p.y, r: 3, val: 1, pull: false, sp: 0 });
    w.gemCount++;
    const parts = w.parts.count;
    killBoss(w);
    expect(w.kills).toBe(kills + 1);
    tick(w, STILL, STEP);
    expect(w.actClearAt).toBeGreaterThanOrEqual(0);
    expect(alive(w)).toHaveLength(0);
    expect(w.enemies.count).toBe(0);
    expect(w.kills).toBe(kills + 1);
    expect(w.bossAlive).toBe(0);
    expect(w.parts.count).toBeGreaterThan(parts);
    expect(w.horde).toBeNull();
    expect(w.downpour).toBeNull();
    expect(w.rain).toBe(0);
    expect(w.objective).toBeNull();
    expect(w.tele.count).toBe(0);
    expect(w.ebullets.count).toBe(0);
    expect(w.lobs.count).toBe(0);
    expect(gem.pull).toBe(true);
    expect(mob.dead).toBe(false); // desaparece sin morir: ni experiencia ni botín
    expect(w.xp).toBe(xp);
  });

  it('durante la caída no aparece nada: ni oleadas, ni élites, ni especiales, ni objetivos', () => {
    const w = fresh();
    killBoss(w);
    w.pickups.clear();
    w.nextElite = w.time + 0.1;
    w.nextSpecial = w.time + 0.1;
    w.nextObjective = w.time + 0.1;
    w.spawnAcc = 50;
    run(w, CAMPAIGN.clearMin - 0.2);
    expect(w.enemies.count).toBe(0);
    expect(w.horde).toBeNull();
    expect(w.objective).toBeNull();
    expect(w.rain).toBe(0);
  });

  it('el cofre del jefe se recoge normal y la espera acaba cuando pasa `clearMin` y no quedan cofres', () => {
    const w = fresh();
    killBoss(w);
    run(w, 0.1);
    const chest = pickups(w).find((k) => k.kind === 'chest')!;
    expect(chest).toBeDefined();
    run(w, CAMPAIGN.clearMin);
    expect(w.actFadeAt).toBe(-1); // sigue el cofre
    w.player.x = w.player.prevX = chest.x;
    w.player.y = w.player.prevY = chest.y;
    tick(w, STILL, STEP);
    if (w.choice) w.choice = null;
    tick(w, STILL, STEP);
    expect(pickups(w).some((k) => k.kind === 'chest')).toBe(false);
    expect(w.actFadeAt).toBeGreaterThanOrEqual(0);
  });

  it('sin cofres el fundido empieza en `clearMin`, y a `fade` s cambia de acto', () => {
    const w = fresh();
    killBoss(w);
    tick(w, STILL, STEP);
    const t0 = w.actClearAt;
    w.pickups.clear();
    run(w, CAMPAIGN.clearMin - 0.1);
    expect(w.actFadeAt).toBe(-1);
    run(w, 0.2);
    expect(w.actFadeAt).toBeGreaterThanOrEqual(t0 + CAMPAIGN.clearMin);
    const fadeAt = w.actFadeAt;
    run(w, CAMPAIGN.fade - 0.1);
    expect(w.act).toBe(1);
    run(w, 0.2);
    expect(w.act).toBe(2);
    expect(w.actStart).toBeGreaterThanOrEqual(fadeAt + CAMPAIGN.fade);
    expect(w.actClearAt).toBe(-1);
    expect(w.actFadeAt).toBe(-1);
  });

  it('en `clearMax` los cofres van al jugador, que los recoge solo', () => {
    const w = fresh();
    killBoss(w);
    run(w, 0.1);
    expect(pickups(w).some((k) => k.kind === 'chest')).toBe(true);
    addChest(w, 'cache', w.player.x + 2000, w.player.y, 18);
    run(w, CAMPAIGN.clearMax - 0.5);
    expect(pickups(w).filter((k) => k.kind === 'chest' || k.kind === 'cache')).toHaveLength(2);
    for (let i = 0; i < 2 * RUN.tickHz; i++) {
      tick(w, STILL, STEP);
      w.victory = false;
      if (w.choice) w.choice = null;
    }
    expect(pickups(w).filter((k) => k.kind === 'chest' || k.kind === 'cache')).toHaveLength(0);
  });

  it('con el jugador muerto no hay transición', () => {
    const w = fresh();
    killBoss(w);
    killPlayer(w);
    tick(w, STILL, STEP);
    expect(w.actClearAt).toBe(-1);
  });

  it('el acto nuevo empieza vacío, con el mapa despejado alrededor del jugador y sus obstáculos', () => {
    const w = fresh();
    run(w, 1, { moveX: 1, moveY: 0.4 });
    const p = w.player;
    p.x += 3000; // lejos de la salida, por si hay objetos
    p.y -= 2000;
    run(w, 0.1);
    const lvl = w.level;
    const weapons = w.weapons.length;
    spawnEnemy(w, 'necrofago', p.x + 200, p.y, false);
    addChest(w, 'cache', p.x + 500, p.y, 18);
    w.scars.set(1, { kind: 'rubble', v: 0, x: 0, y: 0 } as never);
    w.garrisons.push({ x: 0, y: 0, left: 3 });
    w.garrisoned.add('1,1');
    w.barrels.acquire();
    w.pools.acquire();
    w.mines.acquire();
    w.slimes.acquire();
    w.corpses.acquire();
    w.wrecks.acquire();
    const old = w.hazardCell.i;
    advanceAct(w);
    expect(w.act).toBe(2);
    expect(w.start).toEqual({ x: p.x, y: p.y });
    expect(w.hazardCell.i).toBe(old);
    for (const pool of [
      w.enemies,
      w.pickups,
      w.barrels,
      w.pools,
      w.mines,
      w.slimes,
      w.corpses,
      w.wrecks,
      w.tele,
      w.lobs,
      w.ebullets,
    ])
      expect(pool.count).toBe(0);
    expect(w.scars.size).toBe(0);
    expect(w.garrisons).toHaveLength(0);
    expect(w.garrisoned.size).toBe(0);
    expect(w.objective).toBeNull();
    expect(w.gemCount).toBe(0);
    expect(w.bossAlive).toBe(0);
    // Lo del jugador se conserva.
    expect(w.level).toBe(lvl);
    expect(w.weapons).toHaveLength(weapons);
    // Sin ácido ni objetos cerca, y lo que haya es del acto 2.
    for (const h of w.hazards) expect(Math.hypot(h.x - p.x, h.y - p.y)).toBeGreaterThan(100);
    const cell = createCellObject();
    let objects = 0;
    const ci = Math.floor(p.x / RUN.groundCell);
    const cj = Math.floor(p.y / RUN.groundCell);
    for (let j = cj - 30; j <= cj + 30; j++)
      for (let i = ci - 30; i <= ci + 30; i++) {
        if (!worldObjectAt(w, i, j, cell)) continue;
        objects++;
        expect(PROP_LIST[cell.prop]!.act).toBe(2);
      }
    expect(objects).toBeGreaterThan(0);
  });

  it('una guarnición de un acto no deja referencias rotas al pasar al siguiente', () => {
    const w = fresh(1, 5);
    const gar = w.garrisons.length;
    w.garrisons.push({ x: 0, y: 0, left: 1 });
    const e = spawnEnemy(w, 'necrofago', w.player.x + 200, w.player.y, false);
    e.gar = gar;
    advanceAct(w);
    const o = spawnEnemy(w, 'aspiradora', w.player.x + 200, w.player.y, false);
    expect(o.gar).toBe(-1);
    killEnemy(w, o, 'llave');
    run(w, 0.1);
    expect(w.act).toBe(2);
  });

  it('el evento «Tú mismo»: la bomba sin pisar vuelve a esperar; si ya salió la copia, queda hecho', () => {
    const w = fresh();
    w.time = 100;
    putBomb(w, w.player.x + 300, w.player.y);
    advanceAct(w);
    expect(w.mirror.phase).toBe(0);
    expect(w.mirror.at).toBeGreaterThanOrEqual(100);
    const w2 = fresh();
    w2.mirror.phase = 2;
    advanceAct(w2);
    expect(w2.mirror.phase).toBe(2);
  });

  it('es determinista con la misma semilla', () => {
    const play = (): number[] => {
      const w = fresh(1, 9);
      run(w, 2, { moveX: 1, moveY: 0 });
      killBoss(w);
      run(w, 1);
      if (w.choice) w.choice = null;
      w.pickups.clear();
      run(w, CAMPAIGN.clearMax + 5);
      return [w.act, w.actStart, w.start.x, w.start.y, w.nextElite, w.nextSpecial, w.rng()];
    };
    expect(play()).toEqual(play());
  });

  it('el depurador salta de acto sin pasar del último', () => {
    const w = fresh();
    advanceAct(w);
    advanceAct(w);
    expect(w.act).toBe(3);
    advanceAct(w);
    expect(w.act).toBe(3);
  });
});

describe('cortina', () => {
  it('sube durante el fundido y baja al empezar el acto, salvo en el primero', () => {
    const w = fresh();
    expect(actCurtain(w)).toBe(0);
    w.time = 50;
    w.actClearAt = 45;
    w.actFadeAt = 50;
    expect(actCurtain(w)).toBe(0);
    w.time = 50 + CAMPAIGN.fade / 2;
    expect(actCurtain(w)).toBeCloseTo(0.5);
    w.time = 50 + CAMPAIGN.fade;
    expect(actCurtain(w)).toBe(1);
    advanceAct(w);
    expect(actCurtain(w)).toBe(1);
    w.time += CAMPAIGN.fade / 2;
    expect(actCurtain(w)).toBeCloseTo(0.5);
    w.time += CAMPAIGN.fade;
    expect(actCurtain(w)).toBe(0);
  });
});

describe('desbloqueo por rol', () => {
  it('ningún tipo antes de su segundo, y solo los del acto', () => {
    for (const act of ACT_IDS) {
      const w = fresh(act, 1, false);
      const ids = Object.keys(ENEMY_STATS).filter((id) => {
        const s = ENEMY_STATS[id as StatEnemyId] as { boss?: boolean };
        return !s.boss && id !== MIRROR_ID;
      }) as StatEnemyId[];
      for (const id of ids) {
        const gate = CAMPAIGN.gates[ENEMY_STATS[id].role!];
        if (ENTITIES[id].act !== act) {
          at(w, 500);
          expect(unlocked(w, id), id).toBe(false);
          continue;
        }
        if (gate > 0) {
          at(w, gate - 0.01);
          expect(unlocked(w, id), id).toBe(false);
        }
        at(w, gate);
        expect(unlocked(w, id), id).toBe(true);
      }
    }
  });

  it('el tope de un tipo sigue contando en `spawnable`', () => {
    const w = fresh(2, 1, false);
    at(w, 100);
    expect(spawnable(w, 'torreta')).toBe(true);
    for (let i = 0; i < ENEMY_STATS.torreta.cap!; i++)
      spawnEnemy(w, 'torreta', w.player.x + 300, w.player.y + i * 50, false);
    expect(spawnable(w, 'torreta')).toBe(false);
  });

  it('una oleada real respeta los desbloqueos segundo a segundo', () => {
    const w = fresh(1, 3, false);
    w.nextElite = w.nextSpecial = w.nextObjective = Infinity;
    const firstAt: Partial<Record<StatEnemyId, number>> = {};
    let seen = w.nextId;
    for (let k = 0; k < 100 * RUN.tickHz; k++) {
      tick(w, STILL, STEP);
      for (const e of alive(w))
        if (e.id >= seen) firstAt[e.type] = Math.min(firstAt[e.type] ?? Infinity, actTime(w));
      seen = w.nextId;
    }
    for (const [id, t] of Object.entries(firstAt) as [StatEnemyId, number][])
      expect(t, id).toBeGreaterThanOrEqual(CAMPAIGN.gates[ENEMY_STATS[id].role!] - STEP);
  });
});

describe('solo enemigos del acto', () => {
  it('en tres actos seguidos con semilla fija no aparece nadie de otro acto', () => {
    const w = fresh(1, 11);
    for (const act of ACT_IDS) {
      expect(w.act).toBe(act);
      const seen = new Set<StatEnemyId>();
      let id = w.nextId;
      for (let k = 0; k < 110 * RUN.tickHz; k++) {
        tick(w, { moveX: Math.cos(k / 200), moveY: Math.sin(k / 170) }, STEP);
        if (w.choice) w.choice = null;
        w.victory = false;
        for (let i = 0; i < w.enemies.count; i++) {
          const e = w.enemies.items[i]!;
          if (e.id >= id && !e.dead && e.type !== MIRROR_ID) seen.add(e.type);
        }
        id = w.nextId;
        // Limpia de vez en cuando para que el tope de vivos no pare las apariciones.
        if (k % 600 === 0) for (const e of alive(w)) if (!e.boss) e.dead = true;
      }
      expect(seen.size).toBeGreaterThan(1);
      for (const type of seen) expect(ENTITIES[type].act, `${type} en el acto ${act}`).toBe(act);
      if (act < 3) {
        w.mirror.phase = 2;
        advanceAct(w);
      }
    }
  });

  it('el endless sigue con la última oleada del Acto 3, con evento cada `endlessEvery`, sin jefes', () => {
    const w = fresh(3, 4, false);
    spawnBoss(w, 'coloso');
    const b = alive(w).find((e) => e.boss)!;
    killEnemy(w, b, 'llave');
    expect(w.won).toBe(true);
    chooseEndless(w, true);
    expect(w.endless).toBe(true);
    expect(w.nextSpecial).toBeCloseTo(w.time + CAMPAIGN.specials.endlessEvery);
    w.nextElite = Infinity;
    w.nextObjective = Infinity;
    at(w, 300);
    w.nextSpecial = w.time + 1;
    run(w, 1.1);
    expect(w.rain > 0 || w.horde !== null).toBe(true);
    expect(w.nextSpecial).toBeGreaterThanOrEqual(w.time + CAMPAIGN.specials.endlessEvery - 1);
    run(w, 5);
    expect(w.bossAlive).toBe(0);
    expect(alive(w).some((e) => e.type === 'coloso')).toBe(false);
    for (const e of alive(w)) expect(ENTITIES[e.type].act).toBe(3);
  });
});

describe('eventos especiales', () => {
  it('`rollSpecial`: mitad emboscadas, mitad lluvias, y dentro de cada grupo todos', () => {
    expect(['ring', 'stampede', 'wall'].sort()).toEqual([...HORDES.order].sort());
    expect(rollSpecial(0.49, 0, 0.5)).toBe('ring');
    expect(rollSpecial(0.49, 0.5, 0.5)).toBe('stampede');
    expect(rollSpecial(0.49, 0.99, 0.5)).toBe('wall');
    expect(rollSpecial(0.5, 0, 0.5)).toBe('scrap');
    expect(rollSpecial(0.5, 0.5, 0.5)).toBe('acid');
    expect(rollSpecial(0.5, 0.99, 0.5)).toBe('radioactive');
    // Marabunta: siempre emboscada.
    expect(rollSpecial(0.99, 0, DAILY.hordes.chance)).toBe('ring');
  });

  it('caen en los segundos 40 y 80 de cada acto, sin más, y salen de los dos tipos', () => {
    expect(CAMPAIGN.specials.times).toEqual([40, 80]);
    let hordes = 0;
    let rains = 0;
    for (let seed = 1; seed <= 12; seed++) {
      for (const act of ACT_IDS) {
        const w = fresh(act, seed);
        w.nextElite = w.nextObjective = Infinity;
        w.bossSpawned[CAMPAIGN.acts[act].boss] = true;
        expect(w.nextSpecial).toBe(40);
        const check = (t: number): void => {
          w.time = t - 0.5;
          w.spawnAcc = -1e9;
          tick(w, STILL, STEP);
          expect(w.horde).toBeNull();
          expect(w.downpour).toBeNull();
          expect(w.rain).toBeLessThanOrEqual(0);
          w.time = t;
          tick(w, STILL, STEP);
          const any = w.horde !== null || w.downpour !== null || w.rain > 0;
          expect(any).toBe(true);
          if (w.horde) hordes++;
          else rains++;
          w.horde = null;
          w.downpour = null;
          w.rain = 0;
        };
        check(40);
        check(80);
        expect(w.nextSpecial).toBe(Infinity);
      }
    }
    expect(hordes).toBeGreaterThan(0);
    expect(rains).toBeGreaterThan(0);
  });

  it('`nextSpecialAt` se mide desde el inicio del acto', () => {
    const w = fresh();
    w.time = 300;
    advanceAct(w);
    expect(w.nextSpecial).toBe(340);
    w.specialIdx = 1;
    expect(nextSpecialAt(w)).toBe(380);
    w.specialIdx = 2;
    expect(nextSpecialAt(w)).toBe(Infinity);
  });

  it('las hordas de cada acto solo traen enemigos del acto ya desbloqueados', () => {
    for (const act of ACT_IDS)
      for (const kind of HORDES.order)
        for (const t of [40, 80]) {
          const w = fresh(act, 7, false);
          w.nextElite = w.nextSpecial = w.nextObjective = Infinity;
          w.spawnAcc = -1e9;
          at(w, t);
          w.horde = { kind, t: 0.01, ax: 1, ay: 0 };
          tick(w, STILL, STEP);
          const list = alive(w);
          expect(list.length).toBeGreaterThan(0);
          for (const e of list) {
            expect(ENTITIES[e.type].act, e.type).toBe(act);
            expect(t, e.type).toBeGreaterThanOrEqual(CAMPAIGN.gates[ENEMY_STATS[e.type].role!]);
          }
        }
  });
});

describe('élites', () => {
  it('el primero cae en el intervalo, también tras cambiar de acto', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const w = fresh(1, seed);
      expect(w.nextElite).toBeGreaterThanOrEqual(ELITES.everyMin);
      expect(w.nextElite).toBeLessThanOrEqual(ELITES.everyMax);
      w.time = 200;
      advanceAct(w);
      expect(w.nextElite).toBeGreaterThanOrEqual(200 + ELITES.everyMin);
      expect(w.nextElite).toBeLessThanOrEqual(200 + ELITES.everyMax);
    }
    expect([ELITES.everyMin, ELITES.everyMax]).toEqual([10, 40]);
  });

  it('solo de enemigos del acto ya desbloqueados y que puedan ser élites', () => {
    for (const act of ACT_IDS)
      for (let t = 0; t <= 110; t += 10) {
        const w = fresh(act, t + 1, false);
        at(w, t);
        for (let i = 0; i < 8; i++) {
          const e = spawnElite(w);
          expect(ENTITIES[e.type].act, e.type).toBe(act);
          expect(ELITES.exclude).not.toContain(e.type);
          expect(t, e.type).toBeGreaterThanOrEqual(CAMPAIGN.gates[ENEMY_STATS[e.type].role!]);
        }
      }
  });

  it('con un jefe vivo se retrasan', () => {
    const w = fresh();
    at(w, 120);
    w.bossSpawned.rey_rata = false;
    tick(w, STILL, STEP);
    expect(w.bossAlive).toBe(1);
    expect(w.nextElite).toBeGreaterThan(w.time);
  });
});

describe('victoria', () => {
  it('el Coloso gana la partida y pregunta por el infinito; rendirse la acaba', () => {
    const w = fresh(3);
    killBoss(w);
    expect(w.won).toBe(true);
    expect(w.actClearAt).toBe(-1);
    expect(w.actBossDown).toBe(false);
    expect(w.choice?.type).toBe('endless');
    chooseEndless(w, false);
    expect(w.over).toBe(true);
    updateCampaign(w);
    expect(w.act).toBe(3);
  });
});

describe('el Dirigible no bloquea la campaña', () => {
  it('pasado `groundAfter` baja al alcance de las armas de suelo y no se atasca en obstáculos', () => {
    const w = fresh(2);
    const e = spawnEnemy(w, 'dirigible', w.player.x + 280, w.player.y, false);
    run(w, AI.dirigible.groundAfter - 1);
    expect(e.flying).toBe(true);
    expect(nearest(w, w.player.x, w.player.y, 2000, true)?.type).not.toBe('dirigible');
    run(w, 1.5);
    expect(e.flying).toBe(false);
    expect(nearest(w, e.x, e.y, 1, true)).toBe(e);
  });
});
