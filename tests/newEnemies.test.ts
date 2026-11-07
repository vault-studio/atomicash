// Liquidador, sabueso Geiger, bidonero, nevera de asalto y motorista de chatarra.
import { afterEach, describe, expect, it } from 'vitest';
import {
  AI,
  ELITES,
  ENEMY_STATS,
  GORE,
  MOB_IDS,
  STAT_ENEMY_IDS,
  type EnemyStats,
} from '../src/config/enemies';
import { ENTITIES } from '../src/config/entities';
import { IRRADIATED, RAD } from '../src/config/radiation';
import { RUN } from '../src/config/run';
import { applyTuning, resetTuning } from '../src/config/tuning';
import { ACT_IDS } from '../src/config/acts';
import { HORDES, WAVES } from '../src/config/waves';
import { cellKey, worldHazardAt } from '../src/engine/hazards';
import { hitsObstacle, createCellObject, worldObjectAt } from '../src/engine/obstacles';
import { houndSpeed, skidVelocity } from '../src/engine/rules';
import { hurtIndex } from '../src/engine/runStats';
import { addIce, iceSlowAt, markFall, scarFree } from '../src/engine/scars';
import { HIT_RAW, hitEnemy } from '../src/engine/systems/combat';
import { interruptEnemy, spawnEnemy } from '../src/engine/systems/enemies';
import { spawnElite, spawnable } from '../src/engine/systems/spawning';
import { launchSalvo } from '../src/engine/systems/shooters';
import { MODE_AIM, MODE_CHASE, MODE_DASH, type World } from '../src/engine/types';
import { createWorld, tick } from '../src/engine/world';

afterEach(resetTuning);
const T = RUN.groundCell;
const STEP = 1 / RUN.tickHz;
const idle = { moveX: 0, moveY: 0 };

/** Mundo sin director (nada sale solo) y con mapa, para que haya destrozos. */
function quiet(god = true): World {
  applyTuning({ spawn: { rateMult: 0 } });
  const w = createWorld('dot', 1, { startWeapon: null });
  w.nextSpecial = w.nextElite = w.nextObjective = Infinity;
  w.player.god = god;
  tick(w, idle, STEP);
  return w;
}
const run = (w: World, sec: number, input = idle): void => {
  for (let i = 0; i < Math.round(sec * RUN.tickHz); i++) tick(w, input, STEP);
};

/** Casilla libre a la derecha del jugador. */
function freeCell(w: World, dist = 2): { i: number; j: number; x: number; y: number } {
  const c0 = Math.floor(w.player.x / T);
  const c1 = Math.floor(w.player.y / T);
  for (let i = c0 + dist; i < c0 + 12; i++)
    for (let j = c1 - 6; j < c1 + 6; j++)
      if (scarFree(w, i, j)) return { i, j, x: (i + 0.5) * T, y: (j + 0.5) * T };
  throw new Error('sin casilla libre');
}

describe('datos de los enemigos nuevos', () => {
  const NEW = ['liquidador', 'sabueso', 'bidonero', 'nevera', 'motorista'] as const;

  it('están en los datos, con nombre, color de placeholder, restos y sin furia', () => {
    for (const id of NEW) {
      const s = ENEMY_STATS[id] as EnemyStats;
      expect(STAT_ENEMY_IDS, id).toContain(id);
      expect(MOB_IDS, id).toContain(id);
      expect(ENTITIES[id].category).toBe('enemies');
      expect(GORE[id].length, id).toBeGreaterThan(0);
      expect(s.rage?.enabled, id).toBe(false);
    }
    expect(ENTITIES.liquidador.act).toBe(1);
    expect(ENTITIES.sabueso.act).toBe(1);
    expect(ENTITIES.bidonero.act).toBe(1);
    expect(ENTITIES.nevera.act).toBe(2);
    expect(ENTITIES.motorista.act).toBe(3);
    for (const id of ['sabueso', 'nevera', 'motorista'] as const)
      expect((ENEMY_STATS[id] as EnemyStats).wreck, id).toBe(true);
    expect((ENEMY_STATS.motorista as EnemyStats).metal).toBeUndefined();
  });

  it('el tope se comparte por rol: interceptores, sabueso y motorista; mortero, bidonero y nevera', () => {
    for (const id of ['interceptor', 'sabueso', 'motorista', 'mortero', 'bidonero', 'nevera'] as const) {
      const s = ENEMY_STATS[id] as EnemyStats;
      expect(s.capRole, id).toBe(true);
      expect(s.cap, id).toBe(2);
    }
    expect(ENEMY_STATS.mortero.role).toBe('launcher');
    expect(ENEMY_STATS.bidonero.role).toBe('launcher');
    expect(ENEMY_STATS.nevera.role).toBe('launcher');
    expect(ENEMY_STATS.sabueso.role).toBe('interceptor');
    expect(ENEMY_STATS.motorista.role).toBe('interceptor');
    expect(ENEMY_STATS.liquidador.role).toBe('shooter');
  });
});

describe('oleadas', () => {
  it('cada uno sale en su acto: liquidador, sabueso y bidonero en el 1, nevera en el 2, motorista en el 3', () => {
    const act = { liquidador: 1, sabueso: 1, bidonero: 1, nevera: 2, motorista: 3 } as const;
    for (const wave of WAVES)
      for (const [id, a] of Object.entries(act))
        if (wave.act !== a) expect(wave.mix, `${id} en el acto ${wave.act}`).not.toHaveProperty(id);
    for (const act2 of ACT_IDS)
      for (const [id, a] of Object.entries(act))
        if (a !== act2) expect(HORDES.ring.mix[act2]).not.toHaveProperty(id);
  });

  it('en una partida larga del Acto 1 no pasan de su tope ni salen los de otros actos', () => {
    const w = createWorld('dot', 3, { startWeapon: null, hazards: false, maxEnemies: 300 });
    w.player.god = true;
    w.bossSpawned.rey_rata = true;
    w.time = 800;
    const seen = new Set<string>();
    let worstCeptors = 0;
    let worstLaunchers = 0;
    for (let i = 0; i < 40 * RUN.tickHz; i++) {
      tick(w, idle, STEP);
      if (i % 5 !== 0) continue;
      let ceptors = 0;
      let launchers = 0;
      for (let k = 0; k < w.enemies.count; k++) {
        const e = w.enemies.items[k]!;
        if (e.dead) continue;
        seen.add(e.type);
        const role = ENEMY_STATS[e.type].role;
        if (role === 'interceptor') ceptors++;
        else if (role === 'launcher') launchers++;
      }
      worstCeptors = Math.max(worstCeptors, ceptors);
      worstLaunchers = Math.max(worstLaunchers, launchers);
    }
    for (let k = 0; k < 150; k++) seen.add(spawnElite(w).type);
    expect(seen.has('nevera')).toBe(false);
    expect(seen.has('motorista')).toBe(false);
    expect(worstCeptors).toBeLessThanOrEqual(2);
    expect(worstLaunchers).toBeLessThanOrEqual(2);
    for (const id of ['sabueso', 'motorista', 'interceptor'] as const) expect(ELITES.exclude).toContain(id);
  });

  it('se pueden crear desde el depurador (spawnEnemy)', () => {
    const w = quiet();
    const p = w.player;
    for (const id of ['nevera', 'motorista'] as const) {
      const e = spawnEnemy(w, id, p.x + 500, p.y, false);
      expect(e.type).toBe(id);
      expect(e.hp).toBeCloseTo(ENEMY_STATS[id].hp, 0);
    }
  });
});

describe('tope compartido (capRole)', () => {
  it('con dos interceptores de cualquier tipo no sale otro; con uno, sí', () => {
    const w = quiet();
    w.act = 3;
    w.time = 600;
    const p = w.player;
    expect(spawnable(w, 'motorista')).toBe(true);
    const a = spawnEnemy(w, 'interceptor', p.x + 900, p.y, false);
    spawnEnemy(w, 'sabueso', p.x + 900, p.y, false);
    expect(spawnable(w, 'motorista')).toBe(false);
    // Los muertos no cuentan.
    a.dead = true;
    expect(spawnable(w, 'motorista')).toBe(true);
  });

  it('con dos lanzadores de cualquier tipo no sale otro', () => {
    const w = quiet();
    w.act = 3;
    w.time = 600;
    const p = w.player;
    spawnEnemy(w, 'bidonero', p.x + 900, p.y, false);
    spawnEnemy(w, 'nevera', p.x + 900, p.y, false);
    expect(spawnable(w, 'mortero')).toBe(false);
    // Un tirador de balas no es un lanzador.
    expect(spawnable(w, 'tirador')).toBe(true);
  });
});

describe('liquidador', () => {
  it('cada chorro suma `shotRad` de RAD; la bala del tirador, no', () => {
    for (const [type, expected] of [
      ['liquidador', AI.liquidador.shotRad],
      ['tirador', 0],
    ] as const) {
      const w = quiet(false);
      const p = w.player;
      // Mucha vida (por encima del máximo) para que un golpe no la mate ni se vea compensado.
      p.hp = 1e6;
      const e = spawnEnemy(w, type, p.x + 300, p.y, false);
      e.timer = 0;
      let hurt = false;
      for (let i = 0; i < 4 * RUN.tickHz && !hurt; i++) {
        tick(w, idle, STEP);
        hurt = p.hp < 1e6;
      }
      expect(hurt, type).toBe(true);
      expect(p.rad, type).toBeCloseTo(expected * w.st.radGain);
    }
  });

  it('el irradiado suma además los suyos', () => {
    const w = quiet(false);
    const p = w.player;
    p.hp = 1e6;
    const e = spawnEnemy(w, 'liquidador', p.x + 460, p.y, true);
    e.timer = 0;
    // Lejos del jugador (sin su aura): solo cuentan las balas.
    for (let i = 0; i < 5 * RUN.tickHz && p.hp === 1e6; i++) tick(w, idle, STEP);
    expect(p.rad).toBeCloseTo((AI.liquidador.shotRad + IRRADIATED.rad) * w.st.radGain);
  });
});

describe('sabueso Geiger', () => {
  it('corre spd·(1 + radSpeed·rad/RAD.max): con 0 RAD, su base', () => {
    const spd = ENEMY_STATS.sabueso.speed;
    expect(houndSpeed(spd, AI.sabueso.radSpeed, 0, RAD.max)).toBe(spd);
    expect(houndSpeed(spd, AI.sabueso.radSpeed, RAD.max, RAD.max)).toBeCloseTo(spd * 1.5);
    expect(houndSpeed(spd, AI.sabueso.radSpeed, 40, RAD.max)).toBeCloseTo(spd * (1 + 0.5 * 0.4));
  });

  it('en la partida, más rápido con RAD alta y igual a su base con 0', () => {
    const dist = (rad: number): number => {
      const w = quiet();
      const p = w.player;
      p.rad = rad;
      const e = spawnEnemy(w, 'sabueso', p.x + 900, p.y, false);
      const x0 = e.x;
      run(w, 0.5);
      return x0 - e.x;
    };
    const base = dist(0);
    expect(base).toBeCloseTo(ENEMY_STATS.sabueso.speed * 0.5, 0);
    expect(dist(50) / base).toBeCloseTo(1 + AI.sabueso.radSpeed * 0.5, 1);
    expect(dist(RAD.max) / base).toBeCloseTo(1 + AI.sabueso.radSpeed, 1);
  });

  it('un golpe corta su carrera como al interceptor', () => {
    const w = quiet();
    const e = spawnEnemy(w, 'sabueso', w.player.x + 900, w.player.y, false);
    expect(interruptEnemy(e)).toBe(true);
    expect(e.mode).toBe(MODE_AIM);
    expect(e.timer).toBe(AI.sabueso.recover);
  });
});

describe('bidonero', () => {
  it('su salva son barriles; cada impacto en casilla libre deja un lago de ácido y no escombros', () => {
    const w = quiet();
    const c = freeCell(w);
    const p = w.player;
    p.x = c.x - T;
    p.y = c.y;
    p.facingX = 1;
    p.facingY = 0;
    const e = spawnEnemy(w, 'bidonero', p.x - 400, p.y, false);
    e.timer = 0;
    tick(w, idle, STEP);
    expect(w.tele.count).toBe(AI.bidonero.shells);
    const cells = new Set<number>();
    for (let k = 0; k < w.tele.count; k++) {
      const t = w.tele.items[k]!;
      expect(t.fall).toBe('barrel');
      expect(t.hz).toBe(AI.bidonero.lake);
      const i = Math.floor(t.x / T);
      const j = Math.floor(t.y / T);
      if (scarFree(w, i, j)) cells.add(cellKey(i, j));
    }
    expect(cells.size).toBeGreaterThan(0);
    e.timer = 99;
    run(w, AI.bidonero.warn + AI.bidonero.shells * AI.bidonero.stagger + 0.5);
    let acid = 0;
    for (const [k, s] of w.scars) {
      expect(s.kind).not.toBe('rubble');
      if (s.kind !== 'acid') continue;
      acid++;
      expect(cells.has(k)).toBe(true);
      expect(s.v).toBe(AI.bidonero.lake);
    }
    expect(acid).toBe(cells.size);
    for (const k of cells) {
      const i = Math.floor(k / 0x10000);
      const j = k % 0x10000;
      expect(worldHazardAt(w, i, j)).toBe(AI.bidonero.lake);
    }
    expect(w.rs.shellsHit + w.rs.shellsDodged).toBe(AI.bidonero.shells);
  });

  it('en una casilla ocupada no deja lago', () => {
    const w = quiet();
    const c = freeCell(w);
    addIce(w, c.i, c.j);
    markFall(w, c.x, c.y, 10, 0.05, 1, 0, hurtIndex('bidonero'), 'barrel', 0);
    run(w, 0.3);
    expect(w.scars.get(cellKey(c.i, c.j))?.kind).toBe('ice');
  });

  it('un golpe de control le reinicia la carga', () => {
    const w = quiet();
    const e = spawnEnemy(w, 'bidonero', w.player.x + 900, w.player.y, false);
    expect(e.timer).toBeLessThan(AI.bidonero.every);
    expect(interruptEnemy(e)).toBe(true);
    expect(e.timer).toBe(AI.bidonero.every);
  });
});

describe('nevera de asalto', () => {
  it('sus impactos son hielo; la mancha frena al jugador mientras la pisa y no al salir', () => {
    const w = quiet();
    const c = freeCell(w);
    markFall(w, c.x, c.y, 10, 0.05, AI.nevera.shellDmg, 0, hurtIndex('nevera'), 'ice');
    run(w, 0.3);
    expect(w.scars.get(cellKey(c.i, c.j))?.kind).toBe('ice');
    const p = w.player;
    const v = w.st.speed * STEP;
    const step = (x: number): number => {
      p.x = p.prevX = x;
      p.y = p.prevY = c.y;
      const x0 = p.x;
      tick(w, { moveX: 1, moveY: 0 }, STEP);
      return p.x - x0;
    };
    expect(step(c.x)).toBeCloseTo(v * AI.nevera.iceSlow, 5);
    // Saliendo del círculo de la mancha (aún dentro de la casilla) va a velocidad normal.
    expect(step(c.x + T * AI.nevera.iceR + 4)).toBeCloseTo(v, 5);
    expect(iceSlowAt(w, c.x - T * 3, c.y)).toBe(1);
  });

  it('el hielo no hace daño, no bloquea el paso ni las balas y deja pasar a los enemigos', () => {
    const w = quiet();
    const c = freeCell(w);
    expect(addIce(w, c.i, c.j)).toBe(true);
    // Solo cabe un destrozo por casilla.
    expect(addIce(w, c.i, c.j)).toBe(false);
    expect(hitsObstacle(w, c.x, c.y)).toBe(false);
    expect(worldObjectAt(w, c.i, c.j, createCellObject())).toBe(false);
    expect(worldHazardAt(w, c.i, c.j)).toBe(-1);
    const p = w.player;
    p.x = c.x;
    p.y = c.y;
    const hp = p.hp;
    p.god = false;
    run(w, 1);
    expect(p.rad).toBe(0);
    expect(p.hp).toBe(hp);
  });

  it('su salva marca bloques de hielo y cuenta como salva', () => {
    const w = quiet();
    const n = launchSalvo(w, hurtIndex('nevera'), AI.nevera, 'ice');
    expect(n).toBe(AI.nevera.shells);
    for (let k = 0; k < w.tele.count; k++) expect(w.tele.items[k]!.fall).toBe('ice');
    run(w, AI.nevera.warn + AI.nevera.shells * AI.nevera.stagger + 0.5);
    expect(w.rs.shellsHit + w.rs.shellsDodged).toBe(AI.nevera.shells);
  });
});

describe('motorista de chatarra', () => {
  /** Motorista que acaba de pasar de largo al jugador, a punto de fallar la carga. */
  function missed(): { w: World; e: ReturnType<typeof spawnEnemy> } {
    const w = quiet();
    const p = w.player;
    const e = spawnEnemy(w, 'motorista', p.x + 200, p.y, false);
    e.dx = 1;
    e.dy = 0;
    e.alt = true;
    tick(w, idle, STEP);
    return { w, e };
  }

  it('si falla la carga derrapa `recover` s siguiendo su rumbo, frenando hasta parar', () => {
    const { w, e } = missed();
    expect(e.mode).toBe(MODE_DASH);
    expect(w.rs.chargesDodged).toBe(1);
    // Se ve su animación de ataque.
    expect(w.time - e.lastAtk).toBeLessThan(STEP * 2);
    const hx = e.dx;
    const hy = e.dy;
    const x0 = e.x;
    run(w, AI.motorista.recover * 0.5);
    expect(e.mode).toBe(MODE_DASH);
    // No gira hacia el jugador (que está detrás).
    expect(e.dx).toBe(hx);
    expect(e.dy).toBe(hy);
    const half = e.x - x0;
    run(w, AI.motorista.recover * 0.5);
    const total = e.x - x0;
    // Frena de skidSpeed·spd a 0 de forma lineal: recorre la mitad de skidSpeed·spd·recover.
    expect(total).toBeCloseTo(
      (ENEMY_STATS.motorista.speed * AI.motorista.skidSpeed * AI.motorista.recover) / 2,
      -1,
    );
    // La primera mitad del tiempo recorre más que la segunda.
    expect(half).toBeGreaterThan(total - half);
    expect(skidVelocity(320, 0.5, 0, 2)).toBe(0);
    expect(skidVelocity(320, 0.5, 2, 2)).toBe(160);
  });

  it('derrapando recibe daño × exposedMult; cargando, el normal', () => {
    const { w, e } = missed();
    const dmg = (en: typeof e): number => {
      const hp = en.hp;
      hitEnemy(w, en, 10, 'llave', HIT_RAW);
      return hp - en.hp;
    };
    const p = w.player;
    const other = spawnEnemy(w, 'motorista', p.x - 700, p.y, false);
    const normal = dmg(other);
    expect(normal).toBeCloseTo(10);
    expect(dmg(e)).toBeCloseTo(10 * AI.motorista.exposedMult);
    // Otro tipo en MODE_DASH no se ve afectado.
    const dron = spawnEnemy(w, 'dron', p.x - 700, p.y, false);
    dron.mode = MODE_DASH;
    expect(dmg(dron)).toBeCloseTo(10);
  });

  it('tras el derrape da la vuelta y vuelve a cargar', () => {
    const { w, e } = missed();
    run(w, AI.motorista.recover + 0.2);
    expect(e.mode).toBe(MODE_CHASE);
    const hits = w.rs.chargesHit;
    let back = false;
    for (let i = 0; i < 10 * RUN.tickHz && !back; i++) {
      tick(w, idle, STEP);
      back = w.rs.chargesHit > hits;
    }
    expect(back).toBe(true);
  });

  it('acertando no derrapa: frena como el interceptor', () => {
    const w = quiet();
    const p = w.player;
    const e = spawnEnemy(w, 'motorista', p.x + 150, p.y, false);
    run(w, 1);
    expect(w.rs.chargesHit).toBeGreaterThan(0);
    expect(e.mode === MODE_AIM || e.mode === MODE_CHASE).toBe(true);
    expect(e.mode).not.toBe(MODE_DASH);
  });

  it('un golpe de control corta su carrera', () => {
    const w = quiet();
    const e = spawnEnemy(w, 'motorista', w.player.x + 900, w.player.y, false);
    expect(interruptEnemy(e)).toBe(true);
    expect(e.mode).toBe(MODE_AIM);
    expect(e.timer).toBe(AI.motorista.recover);
  });
});
