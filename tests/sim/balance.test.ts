// Barrido de balance (T16): varias semillas × personajes × builds iniciales × estrategias de movimiento. Solo corre con
// `npm run balance` (tarda); escribe out/balance/summary.csv para compararlo con `node tools/simdiff.mjs`.
// Variables opcionales: BAL_SEEDS (n.º de semillas, 6), BAL_SECONDS (600), BAL_OUT (out/balance).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'vitest';
import { ROSTER } from '../../src/config/survivors';
import type { WeaponId } from '../../src/config/weapons';
import { reportsToCsv } from '../../src/engine/runReport';
import { simulate, type BotKind, type SimResult } from '../../src/sim/sim';

const RUN = process.env.npm_lifecycle_event === 'balance' || process.env.BALANCE === '1';
const SEEDS = Number(process.env.BAL_SEEDS ?? 6);
const SECONDS = Number(process.env.BAL_SECONDS ?? 600);
const OUT = process.env.BAL_OUT ?? 'out/balance';
/** Builds iniciales por especialización (CAMBIOS §5) y la del propio personaje (null). */
const STARTS: (WeaponId | null)[] = [null, 'tesla', 'rifle_cerrojo', 'escopeta_chatarra'];
const BOTS: BotKind[] = ['kite', 'circle', 'line', 'still'];

describe.runIf(RUN)('balance', () => {
  it('barrido', { timeout: 3_600_000 }, () => {
    const rows: SimResult[] = [];
    const extra: Record<string, unknown>[] = [];
    for (const charId of ROSTER)
      for (const start of STARTS)
        for (const bot of BOTS)
          for (let s = 1; s <= SEEDS; s++) {
            if (start && bot !== 'kite') continue;
            const r = simulate({
              charId,
              seed: s,
              seconds: SECONDS,
              bot,
              ...(start ? { startWeapon: start } : {}),
            });
            rows.push(r);
            extra.push({ start: start ?? 'propia', bot });
          }
    mkdirSync(OUT, { recursive: true });
    writeFileSync(
      join(OUT, 'summary.csv'),
      reportsToCsv(
        rows.map((r) => r.report),
        extra,
      ),
    );
  });
});
