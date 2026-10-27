import { describe, expect, it } from 'vitest';
import { GACHA, RARITIES, STARS, UPGRADES, upgradeCost } from '../src/config/meta';
import { SURVIVORS } from '../src/config/survivors';
import {
  applyRun,
  buyOffer,
  buyUpgrade,
  chooseStarter,
  claimMission,
  dayKey,
  grantSurvivor,
  merchantStock,
  pullBoxes,
  refreshDaily,
  rollRarity,
  runOptionsFor,
  setStarter,
  starUp,
} from '../src/meta/actions';
import { defaultSave, exportSave, importSave, migrate, normalize } from '../src/meta/save';
import { createRng } from '../src/engine/rng';
import { createWorld, results, type RunResults } from '../src/engine/world';
import type { SurvivorRarity } from '../src/config/survivors';

const NOW = new Date(2026, 9, 28, 12, 0, 0);

function fakeRun(over: Partial<RunResults> = {}): RunResults {
  return {
    charId: 'dot',
    won: false,
    time: 600,
    kills: 800,
    level: 20,
    bosses: 1,
    dmg: 1,
    rad: 0,
    credits: 150,
    consUsed: 2,
    consLeft: { stim: 1, iodine: 0, grenade: 0, turbo: 0 },
    consStart: { stim: 2, iodine: 0, grenade: 0, turbo: 0 },
    dmgBy: [],
    weapons: [],
    ...over,
  };
}

describe('cajas de suministros', () => {
  it('10 000 tiradas con semilla caen dentro de ±1 % de las probabilidades públicas', () => {
    const rng = createRng(1234);
    const n = 10_000;
    const count: Record<SurvivorRarity, number> = { common: 0, rare: 0, epic: 0, legendary: 0 };
    for (let i = 0; i < n; i++) count[rollRarity(rng)]++;
    for (const r of RARITIES) expect(Math.abs(count[r] / n - GACHA.rates[r])).toBeLessThan(0.01);
  });

  it('las probabilidades suman 1', () => {
    expect(RARITIES.reduce((a, r) => a + GACHA.rates[r], 0)).toBeCloseTo(1, 10);
  });

  it('garantía: nunca pasan más de 90 tiradas seguidas sin legendario', () => {
    const s = defaultSave();
    s.profile.credits = 1e9;
    const rng = createRng(7);
    let since = 0;
    for (let i = 0; i < 50; i++) {
      for (const g of pullBoxes(s, 'paramo', 100, rng)!) {
        since = g.rarity === 'legendary' ? 0 : since + 1;
        expect(since).toBeLessThan(GACHA.pity);
      }
    }
  });

  it('la tirada número 90 sin legendario es legendaria', () => {
    const s = defaultSave();
    s.profile.credits = 1e9;
    s.gacha.pity.paramo = GACHA.pity - 1;
    const g = pullBoxes(s, 'paramo', 1, () => 0.0)!;
    // rng 0 daría común; la garantía lo convierte en legendario.
    expect(g[0]!.rarity).toBe('legendary');
    expect(s.gacha.pity.paramo).toBe(0);
  });

  it('×10 garantiza al menos un raro o mejor', () => {
    const s = defaultSave();
    s.profile.credits = 1e9;
    // rng ~0 siempre da común.
    const g = pullBoxes(s, 'paramo', 10, () => 0.0001)!;
    expect(g.some((x) => x.rarity !== 'common')).toBe(true);
  });

  it('cobra y no tira sin créditos', () => {
    const s = defaultSave();
    s.profile.credits = GACHA.cost[1] - 1;
    expect(pullBoxes(s, 'paramo', 1, createRng(1))).toBeNull();
    s.profile.credits = GACHA.cost[1];
    expect(pullBoxes(s, 'paramo', 1, createRng(1))).toHaveLength(1);
    expect(s.profile.credits).toBe(0);
  });
});

describe('colección', () => {
  it('los duplicados dan fichas y las fichas suben estrellas', () => {
    const s = defaultSave();
    expect(grantSurvivor(s, 'dot').isNew).toBe(true);
    const g = grantSurvivor(s, 'dot');
    expect(g.isNew).toBe(false);
    expect(s.survivors.dot!.shards).toBe(STARS.shardsPerDup.common);
    expect(starUp(s, 'dot')).toBe(false);
    s.survivors.dot!.shards = STARS.cost[0]!;
    expect(starUp(s, 'dot')).toBe(true);
    expect(s.survivors.dot!.stars).toBe(2);
    expect(s.survivors.dot!.shards).toBe(0);
  });

  it('un irradiado repetido vuelve irradiado al que tienes', () => {
    const s = defaultSave();
    grantSurvivor(s, 'mae');
    grantSurvivor(s, 'mae', true);
    expect(s.survivors.mae!.irradiated).toBe(true);
  });

  it('el perfil psicológico solo elige la primera vez', () => {
    const s = defaultSave();
    chooseStarter(s, 'mae');
    chooseStarter(s, 'dot');
    expect(s.profile.starterChosen).toBe('mae');
    expect(s.profile.active).toBe('mae');
    expect(s.survivors.dot).toBeUndefined();
  });
});

describe('taller', () => {
  it('las mejoras solo aplican al personaje que las compró', () => {
    const s = defaultSave();
    grantSurvivor(s, 'dot');
    grantSurvivor(s, 'mae');
    s.profile.credits = 1e6;
    expect(buyUpgrade(s, 'dot', 'dmg')).toBe(true);
    expect(runOptionsFor(s, 'dot').bonus?.dmg).toBe(UPGRADES.dmg.per);
    expect(runOptionsFor(s, 'mae').bonus?.dmg).toBeUndefined();
    const w = createWorld('dot', 1, runOptionsFor(s, 'dot'));
    expect(w.tr.dmg).toBe(UPGRADES.dmg.per);
  });

  it('el coste crece y hay tope', () => {
    const s = defaultSave();
    grantSurvivor(s, 'dot');
    s.profile.credits = 1e6;
    expect(upgradeCost('mag', 1)).toBeGreaterThan(upgradeCost('mag', 0));
    for (let i = 0; i < UPGRADES.mag.max; i++) expect(buyUpgrade(s, 'dot', 'mag')).toBe(true);
    expect(buyUpgrade(s, 'dot', 'mag')).toBe(false);
  });

  it('las estrellas suben PV, daño y velocidad base un 5 % cada una', () => {
    const s = defaultSave();
    grantSurvivor(s, 'dot');
    s.survivors.dot!.stars = 3;
    const b = runOptionsFor(s, 'dot').bonus!;
    expect(b.dmg).toBe(10);
    expect(b.spd).toBe(10);
    expect(b.hp).toBe(Math.round(SURVIVORS.dot.hp * 0.1));
  });
});

describe('mercader', () => {
  it('el inventario es el mismo todo el día y cambia al siguiente', () => {
    const s = defaultSave();
    grantSurvivor(s, 'dot');
    const a = merchantStock(s, new Date(2026, 9, 28, 0, 1)).map((o) => o.key);
    const b = merchantStock(s, new Date(2026, 9, 28, 23, 59)).map((o) => o.key);
    expect(a).toEqual(b);
    const days = new Set<string>();
    for (let d = 1; d < 15; d++)
      days.add(
        merchantStock(s, new Date(2026, 9, d, 12))
          .map((o) => o.key)
          .join(),
      );
    expect(days.size).toBeGreaterThan(1);
  });

  it('los implantes van al activo y los manuales cambian el arma inicial', () => {
    const s = defaultSave();
    chooseStarter(s, 'dot');
    s.profile.credits = 1e6;
    const stock = merchantStock(s, NOW);
    const imp = stock.find((o) => o.kind === 'implant')!;
    expect(buyOffer(s, imp.key, NOW)).toBe(true);
    expect(s.survivors.dot!.implant).toBe(imp.kind === 'implant' ? imp.id : null);
    expect(buyOffer(s, imp.key, NOW)).toBe(false);
    const man = stock.find((o) => o.kind === 'manual');
    expect(man?.kind).toBe('manual');
    if (man?.kind !== 'manual') return;
    expect(buyOffer(s, man.key, NOW)).toBe(true);
    setStarter(s, 'dot', man.weapon);
    const w = createWorld('dot', 1, runOptionsFor(s, 'dot'));
    expect(w.weapons[0]!.id).toBe(man.weapon);
  });

  it('los consumibles entran en la mochila', () => {
    const s = defaultSave();
    s.profile.credits = 1e6;
    const c = merchantStock(s, NOW).find((o) => o.kind === 'consumable')!;
    if (c.kind !== 'consumable') return;
    const before = s.inventory.consumables[c.id];
    expect(buyOffer(s, c.key, NOW)).toBe(true);
    expect(s.inventory.consumables[c.id]).toBe(before + c.qty);
  });
});

describe('misiones y logros', () => {
  it('las diarias se reinician a medianoche local', () => {
    const s = defaultSave();
    refreshDaily(s, new Date(2026, 9, 28, 23, 59));
    s.missions.daily[0]!.progress = 5;
    refreshDaily(s, new Date(2026, 9, 28, 23, 59, 59));
    expect(s.missions.daily[0]!.progress).toBe(5);
    refreshDaily(s, new Date(2026, 9, 29, 0, 0, 1));
    expect(s.missions.day).toBe(dayKey(new Date(2026, 9, 29)));
    expect(s.missions.daily.every((m) => m.progress === 0)).toBe(true);
    expect(s.missions.daily).toHaveLength(3);
  });

  it('una run suma créditos, XP, estadísticas y progreso; las cumplidas se cobran una vez', () => {
    const s = defaultSave();
    chooseStarter(s, 'dot');
    const rew = applyRun(s, fakeRun(), NOW);
    expect(s.profile.credits).toBeGreaterThanOrEqual(150);
    expect(rew.xp).toBeGreaterThan(0);
    expect(s.survivors.dot!.level).toBeGreaterThan(1);
    expect(s.profile.stats.kills).toBe(800);
    expect(s.inventory.consumables.stim).toBe(defaultSave().inventory.consumables.stim - 1);
    const i = s.missions.daily.findIndex((m) => m.progress > 0);
    if (i < 0) return;
    s.missions.daily[i]!.progress = 1e9;
    const c = s.profile.credits;
    expect(claimMission(s, i)).toBe(true);
    expect(s.profile.credits).toBeGreaterThan(c);
    expect(claimMission(s, i)).toBe(false);
  });

  it('los logros se desbloquean una sola vez', () => {
    const s = defaultSave();
    chooseStarter(s, 'dot');
    expect(applyRun(s, fakeRun({ kills: 1000 }), NOW).achievements).toContain('firstBlood');
    expect(applyRun(s, fakeRun({ kills: 1 }), NOW).achievements).not.toContain('firstBlood');
  });

  it('results() incluye los consumibles sobrantes', () => {
    const w = createWorld('dot', 1, { consumables: { stim: 1, iodine: 0, grenade: 2, turbo: 0 } });
    expect(results(w).consLeft).toEqual({ stim: 1, iodine: 0, grenade: 2, turbo: 0 });
  });
});

describe('guardado', () => {
  it('exportar e importar conserva la partida', () => {
    const s = defaultSave();
    chooseStarter(s, 'errante');
    s.profile.credits = 4321;
    s.survivors.errante!.upgrades.hp = 2;
    const back = importSave(exportSave(s));
    expect(back).toEqual(s);
  });

  it('rechaza JSON ajeno o roto', () => {
    expect(importSave('no es json')).toBeNull();
    expect(importSave('{"app":"otro","data":{}}')).toBeNull();
  });

  it('migra una partida v0 del prototipo a v1', () => {
    const v0 = {
      profile: { credits: 77, starterChosen: 'mae', stats: { runs: 3 } },
      survivors: { mae: { level: 4, implants: ['cortex'], upgrades: { hp: 1 } }, fake: { level: 2 } },
      gacha: { pityCounter: { paramo: 12 } },
      settings: { musicVol: 2, language: 'en' },
    };
    const s = migrate(v0, 0);
    expect(s.version).toBe(1);
    expect(s.profile.credits).toBe(77);
    expect(s.profile.active).toBe('mae');
    expect(s.survivors.mae!.implant).toBe('cortex');
    expect(s.survivors.mae!.upgrades.hp).toBe(1);
    expect(Object.keys(s.survivors)).toEqual(['mae']);
    expect(s.gacha.pity.paramo).toBe(12);
    expect(s.settings.musicVol).toBe(1);
    expect(s.settings.language).toBe('en');
  });

  it('normalize de basura da una partida nueva válida', () => {
    expect(normalize(null)).toEqual(defaultSave());
    expect(normalize(42).profile.credits).toBe(0);
  });
});
