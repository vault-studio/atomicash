// Simulación con semilla fija (T0). La instantánea es la referencia: un refactor de datos debe dejarla igual y un
// cambio de balance la actualiza a propósito (`npx vitest run tests/sim -u`). Con SIM_OUT=<carpeta> guarda los JSON.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { ROSTER } from '../../src/config/survivors';
import { reportsToCsv } from '../../src/engine/runReport';
import { simulate, type SimResult } from '../../src/sim/sim';

const SEED = 1;
const SECONDS = 600;
const out = process.env.SIM_OUT ?? (process.env.npm_lifecycle_event === 'sim' ? 'out/sim' : undefined);

const all: SimResult[] = [];
function save(name: string, r: SimResult): void {
  all.push(r);
  if (!out) return;
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, `${name}.json`), JSON.stringify(r.report, null, 2));
}
afterAll(() => {
  if (out && all.length) writeFileSync(join(out, 'summary.csv'), reportsToCsv(all.map((r) => r.report)));
});

/** Lo que compara la instantánea (sin los arrays largos por tramo). */
const summary = (r: SimResult) => ({
  time: Math.round(r.time * 10) / 10,
  hp: r.hp,
  kills: r.kills,
  level: r.level,
  bosses: r.bosses,
  dmg: r.dmg,
  weapons: r.weapons.map((x) => `${x.id}${x.lvl}`).join(','),
  perMin: r.perMin.map((m) => `${m.level}/${m.hp}/${m.alive}/${m.kills}`).join(' '),
});

describe('simulación con semilla fija', () => {
  it('es determinista: dos pasadas iguales dan lo mismo', () => {
    const a = simulate({ charId: 'dot', seed: 7, seconds: 90 });
    const b = simulate({ charId: 'dot', seed: 7, seconds: 90 });
    expect(b).toEqual(a);
  });

  for (const charId of ROSTER) {
    it(`referencia ${charId} (semilla ${SEED}, ${SECONDS} s)`, { timeout: 120_000 }, () => {
      const r = simulate({ charId, seed: SEED, seconds: SECONDS });
      save(charId, r);
      expect(summary(r)).toMatchSnapshot();
    });
  }
});
