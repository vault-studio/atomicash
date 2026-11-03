// Blindaje plano en el motor (CAMBIOS §5): resta por impacto, las armas que perforan lo ignoran y nunca hay inmunidad.
import { describe, expect, it } from 'vitest';
import { ARMOR, ELITES, ENEMY_STATS } from '../src/config/enemies';
import { WEAPONS } from '../src/config/weapons';
import { HIT_RAW, hitEnemy } from '../src/engine/systems/combat';
import { spawnEnemy } from '../src/engine/systems/enemies';
import { createWorld } from '../src/engine/world';

function target(type: 'blindado' | 'saqueador') {
  const w = createWorld('dot', 1, { hazards: false, startWeapon: null });
  const e = spawnEnemy(w, type, w.player.x + 400, w.player.y, false);
  e.hp = e.maxHp = 1e6;
  return { w, e };
}

describe('blindaje plano en el motor', () => {
  it('los golpes pequeños apenas hacen daño a un blindado, sin bajar de minFrac', () => {
    const { w, e } = target('blindado');
    const armor = ENEMY_STATS.blindado.armor!;
    expect(hitEnemy(w, e, 30, 'llave', HIT_RAW)).toBe(30 - armor);
    expect(hitEnemy(w, e, 2, 'pistola_clavos', HIT_RAW)).toBeCloseTo(2 * ARMOR.minFrac);
  });

  it('un arma que perfora ignora ese blindaje', () => {
    const { w, e } = target('blindado');
    expect(WEAPONS.rifle_cerrojo.armorPierce).toBeGreaterThanOrEqual(ENEMY_STATS.blindado.armor!);
    expect(hitEnemy(w, e, 40, 'rifle_cerrojo', HIT_RAW)).toBe(40);
  });

  it('el élite blindado suma su blindaje al del tipo', () => {
    const { w, e } = target('saqueador');
    expect(hitEnemy(w, e, 20, 'llave', HIT_RAW)).toBe(20);
    e.elite = 'blindado';
    expect(hitEnemy(w, e, 20, 'llave', HIT_RAW)).toBe(20 - ELITES.blindado.armor);
  });
});
