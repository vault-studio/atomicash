// Builds (CAMBIOS §5): cada especialización gana en lo suyo y ninguna build es la mejor en todo.
import { afterEach, describe, expect, it } from 'vitest';
import { resetTuning } from '../../src/config/tuning';
import { WEAPONS, type WeaponBase } from '../../src/config/weapons';
import { benchScenario, SCENARIOS, type BenchBuild, type Scenario } from '../../src/sim/bench';

afterEach(resetTuning);

const BUILDS: Record<Scenario | 'mix', BenchBuild> = {
  horde: {
    name: 'hordas',
    weapons: [
      { id: 'tesla', lvl: 5 },
      { id: 'geiger', lvl: 5 },
    ],
  },
  boss: {
    name: 'jefes',
    weapons: [
      { id: 'rifle_cerrojo', lvl: 5 },
      { id: 'pistola_clavos', lvl: 5 },
    ],
  },
  armored: {
    name: 'élites',
    weapons: [
      { id: 'martillo_pilon', lvl: 5 },
      { id: 'megafono', lvl: 5 },
    ],
  },
  mix: {
    name: 'mixta',
    weapons: [
      { id: 'coctel', lvl: 5 },
      { id: 'escopeta_chatarra', lvl: 5 },
    ],
  },
};

describe('builds por escenario', () => {
  it('todas las armas tienen especialización', () => {
    for (const [id, w] of Object.entries(WEAPONS) as [string, WeaponBase][]) expect(w.spec, id).toBeDefined();
  });

  it('cada especialización gana en su escenario y ninguna build gana en todos', () => {
    const t: Record<string, Record<Scenario, number>> = {};
    for (const [k, b] of Object.entries(BUILDS)) {
      t[k] = {} as Record<Scenario, number>;
      for (const sc of SCENARIOS) {
        t[k][sc] = benchScenario(b, sc);
        resetTuning();
      }
    }
    const best = (sc: Scenario) => Object.keys(t).reduce((a, b) => (t[b]![sc] < t[a]![sc] ? b : a));
    for (const sc of SCENARIOS) expect(best(sc), `${sc}: ${JSON.stringify(t)}`).toBe(sc);
    for (const k of Object.keys(t)) expect(SCENARIOS.every((sc) => best(sc) === k)).toBe(false);
  }, 300_000);
});
