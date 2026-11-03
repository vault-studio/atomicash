// Roles (CAMBIOS §4): todos los enemigos tienen rol y solo los pesados bloquean de verdad al jugador.
import { afterEach, describe, expect, it } from 'vitest';
import { ENEMY_STATS, MOB_IDS, type EnemyStats } from '../src/config/enemies';
import { RUN } from '../src/config/run';
import { applyTuning, resetTuning } from '../src/config/tuning';
import { spawnEnemy } from '../src/engine/systems/enemies';
import { createWorld, tick } from '../src/engine/world';

afterEach(resetTuning);

function walkInto(type: 'blindado' | 'necrofago'): number {
  applyTuning({ spawn: { rateMult: 0 } });
  const w = createWorld('dot', 1, { hazards: false, startWeapon: null });
  w.player.god = true;
  const p = w.player;
  const e = spawnEnemy(w, type, p.x + 60, p.y, false);
  e.speed = 0;
  e.frozen = 99;
  const x0 = p.x;
  for (let i = 0; i < RUN.tickHz; i++) tick(w, { moveX: 1, moveY: 0 }, 1 / RUN.tickHz);
  return p.x - x0;
}

describe('roles de enemigos', () => {
  it('todo enemigo normal tiene rol', () => {
    for (const id of MOB_IDS) expect((ENEMY_STATS[id] as EnemyStats).role, id).toBeDefined();
  });

  it('un pesado no se deja atravesar', () => {
    expect(walkInto('blindado')).toBeLessThan(60);
  });

  it('un enemigo normal no frena al jugador', () => {
    expect(walkInto('necrofago')).toBeGreaterThan(150);
  });
});
