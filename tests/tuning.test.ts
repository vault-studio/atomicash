import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { ENEMY_STATS, RAGE } from '../src/config/enemies';
import { SURVIVORS } from '../src/config/survivors';
import { applyTuning, exportTuning, resetTuning, TUNING, tuningDefaults } from '../src/config/tuning';
import { validateConfig } from '../src/config/validate';
import { WAVES } from '../src/config/waves';

afterEach(resetTuning);

describe('archivo de datos (tuning.json)', () => {
  it('carga y es coherente con el resto de la configuración', () => {
    expect(validateConfig()).toEqual([]);
    expect(Object.keys(TUNING)).toEqual(expect.arrayContaining(['survivors', 'enemies', 'weapons', 'waves']));
  });

  it('los módulos de config son los mismos objetos que el archivo', () => {
    expect(ENEMY_STATS).toBe(TUNING.enemies);
    expect(SURVIVORS.dot.hp).toBe(TUNING.survivors.dot.hp);
  });

  it('exportar sin cambios da el archivo tal cual', () => {
    const file = JSON.parse(readFileSync('src/data/tuning.json', 'utf8'));
    expect(JSON.parse(exportTuning())).toEqual(file);
  });

  it('aplicar cambia los valores en sitio y volver a defaults los restaura', () => {
    const skipped = applyTuning({ enemies: { dron: { hp: 99 } }, rage: { chaseAfter: 3 } });
    expect(skipped).toEqual([]);
    expect(ENEMY_STATS.dron.hp).toBe(99);
    expect(RAGE.chaseAfter).toBe(3);
    resetTuning();
    expect(ENEMY_STATS.dron.hp).toBe(tuningDefaults().enemies.dron.hp);
    expect(RAGE.chaseAfter).toBe(tuningDefaults().rage.chaseAfter);
  });

  it('ignora claves desconocidas y tipos que no encajan sin romper nada', () => {
    const skipped = applyTuning({ enemies: { dron: { hp: 'mucho', nope: 1 } }, inventado: {} });
    expect(skipped).toEqual(['enemies.dron.hp', 'enemies.dron.nope', 'inventado']);
    expect(ENEMY_STATS.dron.hp).toBe(tuningDefaults().enemies.dron.hp);
  });

  it('las listas se sustituyen enteras', () => {
    const waves = structuredClone(tuningDefaults().waves).slice(0, 2);
    applyTuning({ waves });
    expect(WAVES).toHaveLength(2);
    resetTuning();
    expect(WAVES).toHaveLength(tuningDefaults().waves.length);
  });
});
