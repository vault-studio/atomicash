// F1-06/F1-07: armas, daño, chatarra, XP y tarjetas.
import { describe, expect, it } from 'vitest';
import { PLAYER, RUN, xpForLevel } from '../src/config/run';
import { TRAITS } from '../src/config/traits';
import { FUSIONS, WEAPONS, WEAPON_IDS, type WeaponId } from '../src/config/weapons';
import { dropGems, hitEnemy, hurtPlayer } from '../src/engine/systems/combat';
import { spawnEnemy } from '../src/engine/systems/enemies';
import {
  applyChoice,
  fusionOptions,
  gainXp,
  openLevelChoice,
  reroll,
  consumeItem,
  weaponOptions,
} from '../src/engine/systems/progression';
import { createWeapon } from '../src/engine/systems/weapons';
import type { InputState, World } from '../src/engine/types';
import { createWorld, results, tick } from '../src/engine/world';

const STEP = 1 / RUN.tickHz;
const STILL: InputState = { moveX: 0, moveY: 0 };

function quiet(seed = 1, weapon: WeaponId | null = null): World {
  const w = createWorld('dot', seed, { startWeapon: weapon, hazards: false });
  w.nextEvent = Infinity;
  w.spawnAcc = -1e9;
  return w;
}

const run = (w: World, sec: number, input = STILL): void => {
  for (let i = 0; i < Math.round(sec * RUN.tickHz); i++) tick(w, input, STEP);
};

describe('curva de XP (02_GAMEPLAY.md §4)', () => {
  it('sigue a + b·(n−1) + floor(c·(n−1)^1.5)', () => {
    expect(xpForLevel(1)).toBe(10);
    expect(xpForLevel(2)).toBe(16);
    expect(xpForLevel(5)).toBe(10 + 24 + Math.floor(0.8 * 8));
    expect(xpForLevel(30)).toBe(10 + 6 * 29 + Math.floor(0.8 * Math.pow(29, 1.5)));
  });

  it('es creciente', () => {
    for (let n = 1; n < 80; n++) expect(xpForLevel(n + 1)).toBeGreaterThan(xpForLevel(n));
  });

  it('acumula varias subidas y abre una elección por cada una', () => {
    const w = quiet();
    gainXp(w, xpForLevel(1) + xpForLevel(2) + 1, true);
    expect(w.level).toBe(3);
    expect(w.pendingLevels).toBe(2);
    expect(w.choice?.type).toBe('level');
    applyChoice(w, 0);
    expect(w.pendingLevels).toBe(1);
    expect(w.choice).not.toBeNull();
    applyChoice(w, 0);
    expect(w.choice).toBeNull();
  });
});

describe('tarjetas', () => {
  it('ofrece 3 tarjetas sin repetir', () => {
    for (let seed = 1; seed < 200; seed++) {
      const w = quiet(seed, 'llave');
      openLevelChoice(w);
      const cards = w.choice!.cards;
      expect(cards).toHaveLength(3);
      const keys = cards.map((c) => c.kind + ('id' in c ? c.id : ''));
      expect(new Set(keys).size).toBe(3);
    }
  });

  it('no ofrece armas nuevas con los huecos llenos ni exclusivas de otro', () => {
    const w = quiet(1, 'llave');
    const opts = weaponOptions(w)
      .filter((c) => c.kind === 'new')
      .map((c) => ('id' in c ? c.id : ''));
    expect(opts).toContain('martillo_pilon');
    expect(opts).not.toContain('desfibrilador');
    expect(opts).not.toContain('dinamo');
    while (w.weapons.length < PLAYER.weaponSlots)
      w.weapons.push(createWeapon(['geiger', 'coctel', 'megafono'][w.weapons.length - 1] as 'geiger'));
    expect(w.weapons).toHaveLength(PLAYER.weaponSlots);
    expect(weaponOptions(w).every((c) => c.kind === 'up')).toBe(true);
  });

  it('no ofrece subir un arma al máximo', () => {
    const w = quiet(1, 'llave');
    w.weapons[0]!.lvl = PLAYER.maxWeaponLevel;
    expect(weaponOptions(w).some((c) => c.kind === 'up')).toBe(false);
  });

  it('ofrece el Apaño con las dos armas al máximo y libera un hueco', () => {
    for (const f of FUSIONS) {
      const w = quiet(1, null);
      w.weapons.push(createWeapon(f.a, 5), createWeapon(f.b, 5));
      expect(fusionOptions(w)).toEqual([{ kind: 'fusion', id: f.result }]);
      openLevelChoice(w);
      const i = w.choice!.cards.findIndex((c) => c.kind === 'fusion');
      expect(i).toBe(0);
      applyChoice(w, i);
      expect(w.weapons.map((x) => x.id)).toEqual([f.result]);
      // Las piezas no vuelven a ofrecerse.
      const ids = weaponOptions(w).map((c) => ('id' in c ? c.id : ''));
      expect(ids).not.toContain(f.a);
      expect(ids).not.toContain(f.b);
    }
  });

  it('un rasgo suma su valor y respeta el tope', () => {
    const w = quiet();
    w.choice = { type: 'level', cards: [{ kind: 'trait', id: 'ammo', rarity: 'common', value: 8 }] };
    w.pendingLevels = 1;
    const before = w.st.dmgMult;
    applyChoice(w, 0);
    expect(w.tr.dmg).toBe(8);
    expect(w.st.dmgMult).toBeCloseTo(before * 1.08);
    w.tr.dmg = TRAITS.ammo.max;
    openLevelChoice(w);
    expect(w.choice!.cards.some((c) => c.kind === 'trait' && c.id === 'ammo')).toBe(false);
  });

  it('el cambio de tarjetas gasta un uso', () => {
    const w = quiet(1, 'llave');
    openLevelChoice(w);
    expect(reroll(w)).toBe(true);
    expect(w.rerolls).toBe(PLAYER.rerolls - 1);
    expect(reroll(w)).toBe(PLAYER.rerolls > 1);
  });

  it('el motor se pausa con una elección abierta', () => {
    const w = quiet();
    openLevelChoice(w);
    const t = w.time;
    run(w, 1);
    expect(w.time).toBe(t);
  });
});

describe('daño y bajas', () => {
  it('matar suelta chatarra que el imán atrae y da XP', () => {
    const w = quiet();
    const e = spawnEnemy(w, 'saqueador', w.player.x + 40, w.player.y, false);
    hitEnemy(w, e, 1e6, 'llave', 0);
    expect(e.dead).toBe(true);
    expect(w.kills).toBe(1);
    expect(w.gemCount).toBeGreaterThan(0);
    run(w, 1);
    expect(w.gemCount).toBe(0);
    expect(w.xp + (w.level - 1) * 1000).toBeGreaterThan(0);
  });

  it('las piezas de chatarra se reparten en 25/5/1', () => {
    const w = quiet();
    dropGems(w, 100, 100, 37);
    const vals = w.pickups.items
      .slice(0, w.pickups.count)
      .map((k) => k.val)
      .sort((a, b) => b - a);
    expect(vals).toEqual([25, 5, 5, 1, 1]);
  });

  it('la armadura resta y la reducción multiplica; mínimo 1', () => {
    const w = quiet();
    w.tr.armor = 3;
    w.tr.red = 20;
    tick(w, STILL, STEP);
    const hp = w.player.hp;
    const d = hurtPlayer(w, 10, 0, true);
    expect(d).toBeCloseTo((10 - 3) * 0.8);
    expect(w.player.hp).toBeCloseTo(hp - d);
    w.player.inv = 0;
    expect(hurtPlayer(w, 1, 0, true)).toBeCloseTo(1 * 0.8);
  });

  it('cada arma hace daño a un grupo cercano', () => {
    for (const id of WEAPON_IDS) {
      const w = quiet(1, id);
      const p = w.player;
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const e = spawnEnemy(w, 'babosa', p.x + Math.cos(a) * 80, p.y + Math.sin(a) * 80, false);
        e.speed = 0;
        e.hp = e.maxHp = 1e6;
      }
      w.player.god = true;
      run(w, 3);
      expect(w.dmgTotal, id).toBeGreaterThan(0);
    }
  });

  it('la ristra de petardos cae sobre el grupo más denso y aturde', () => {
    const w = quiet(1, 'petardos');
    const p = w.player;
    // Un enemigo suelto a un lado y un grupo de seis al otro.
    const lone = spawnEnemy(w, 'babosa', p.x - 200, p.y, false);
    const pack = Array.from({ length: 6 }, (_, i) =>
      spawnEnemy(w, 'babosa', p.x + 200 + (i % 3) * 12, p.y + Math.floor(i / 3) * 12, false),
    );
    for (const e of [lone, ...pack]) {
      e.speed = 0;
      e.hp = e.maxHp = 1e6;
    }
    w.player.god = true;
    run(w, 0.5);
    expect(w.mines.count).toBeGreaterThan(0);
    for (let i = 0; i < w.mines.count; i++) expect(w.mines.items[i]!.x).toBeGreaterThan(p.x + 100);
    run(w, 1);
    expect(pack.some((e) => e.hp < e.maxHp)).toBe(true);
    expect(lone.hp).toBe(lone.maxHp);
    expect(pack.some((e) => e.stun > 0 || e.kbx !== 0)).toBe(true);
  });

  it('las armas no reservan estado fuera de sus pools tras muchas bajas', () => {
    const w = createWorld('mae', 3, { hazards: false });
    w.player.god = true;
    for (const id of ['tesla', 'coctel', 'geiger'] as const) w.weapons.push(createWeapon(id, 5));
    const shots = w.shots.items;
    let kills = 0;
    for (let i = 0; i < 60 * 60; i++) {
      tick(w, { moveX: Math.cos(i / 90), moveY: Math.sin(i / 90) }, STEP);
      if (w.choice) applyChoice(w, 0);
      kills = w.kills;
    }
    expect(kills).toBeGreaterThan(30);
    expect(w.shots.items).toBe(shots);
  });
});

describe('consumibles y resultados', () => {
  it('el estimulante no se gasta con la vida llena', () => {
    const w = quiet();
    const n = w.cons.stim;
    expect(consumeItem(w, 0)).toBe(false);
    w.player.hp = 10;
    expect(consumeItem(w, 0)).toBe(true);
    expect(w.cons.stim).toBe(n - 1);
    expect(w.player.hp).toBeGreaterThan(10);
  });

  it('la granada mata a los cercanos', () => {
    const w = quiet();
    const e = spawnEnemy(w, 'dron', w.player.x + 200, w.player.y, false);
    expect(consumeItem(w, 2)).toBe(true);
    expect(e.dead || w.enemies.count === 0).toBe(true);
  });

  it('los resultados calculan los créditos', () => {
    const w = quiet();
    w.time = 600;
    w.kills = 400;
    w.bosses = 1;
    const r = results(w);
    expect(r.credits).toBe(Math.floor(10 * 10 + 400 / 20 + 50));
  });

  it('las armas tienen datos coherentes', () => {
    for (const id of WEAPON_IDS) expect(WEAPONS[id].color).toMatch(/^#[0-9a-f]{6}$/i);
  });
});
