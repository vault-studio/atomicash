import { describe, expect, it } from 'vitest';
import { ENTITIES, ENTITY_IDS, act1Priority, sheetPath } from '../src/config/entities';
import { validateConfig } from '../src/config/validate';
import en from '../src/i18n/en.json';
import es from '../src/i18n/es.json';

describe('registro de entidades', () => {
  it('la config valida sin errores', () => {
    expect(validateConfig()).toEqual([]);
  });

  it('contiene todas las entidades de la biblia de arte', () => {
    const count = (c: string) => ENTITY_IDS.filter((id) => ENTITIES[id].category === c).length;
    expect(count('characters')).toBe(9);
    expect(count('enemies')).toBe(16);
    expect(count('bosses')).toBe(7); // 3 jefes + 4 variantes de fase
    expect(count('props')).toBe(10);
  });

  it('la prioridad del Acto 1 son 3 jugables, 11 enemigos, 3 jefes y 4 armas', () => {
    const p = act1Priority();
    // Gus aún no tiene armas propias con arte: Dot y Benny llevan dos cada uno.
    expect(p).toHaveLength(21);
    expect(p).toEqual(
      expect.arrayContaining(['dot', 'gus', 'benny', 'aspiradora_cria', 'coloso', 'petardos']),
    );
    expect(p).not.toContain('mae');
    expect(p).not.toContain('coloso_p2');
  });

  it('asigna las animaciones por tipo', () => {
    expect(ENTITIES.dot.anims).toEqual(['idle', 'run', 'hit', 'death']);
    expect(ENTITIES.dron.anims).toEqual(['move', 'attack', 'death']);
    expect(ENTITIES.torreta.anims).toContain('idle');
    expect(ENTITIES.coloso_p3.anims).toEqual(ENTITIES.coloso.anims);
    expect(ENTITIES.llave.anims).toEqual([]);
  });

  it('construye las rutas de sprites como el manifiesto', () => {
    expect(sheetPath(ENTITIES.dot, 'run')).toBe('characters/dot/dot_run');
    expect(sheetPath(ENTITIES.rey_rata_dmg, 'idle')).toBe('bosses/rey_rata_dmg/rey_rata_dmg_idle');
  });

  it('todas las entidades tienen nombre en ES y EN', () => {
    for (const id of ENTITY_IDS) {
      expect(es.entities, id).toHaveProperty(id);
      expect(en.entities, id).toHaveProperty(id);
    }
  });
});

describe('i18n', () => {
  const keys = (o: object, prefix = ''): string[] =>
    Object.entries(o).flatMap(([k, v]) =>
      typeof v === 'object' && v !== null ? keys(v as object, prefix + k + '.') : [prefix + k],
    );

  it('ES y EN tienen las mismas claves', () => {
    expect(keys(en).sort()).toEqual(keys(es).sort());
  });
});
