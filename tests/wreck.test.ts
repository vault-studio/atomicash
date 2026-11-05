import { describe, expect, it } from 'vitest';
import { ENEMY_STATS, type EnemyStats } from '../src/config/enemies';
import { ENTITIES, isEntityId } from '../src/config/entities';
import { FX_ART } from '../src/config/render';
import { FX } from '../src/config/run';
import { updateFx } from '../src/engine/fx';
import { killEnemy } from '../src/engine/systems/combat';
import { spawnEnemy } from '../src/engine/systems/enemies';
import type { Enemy, World } from '../src/engine/types';
import { createWorld } from '../src/engine/world';
import { pieceAt, shatter, wreckRand, type PieceState } from '../src/render/wreckMath';

const spawn = (w: World, type: Parameters<typeof spawnEnemy>[1]): Enemy => spawnEnemy(w, type, 300, 300)!;
const stats = (): [string, EnemyStats][] => Object.entries(ENEMY_STATS) as [string, EnemyStats][];

describe('muerte de los robots', () => {
  it('los robots llevan `wreck`: máquinas de piezas rígidas, sin dejar fuera ninguno nuevo', () => {
    for (const [id, s] of stats()) {
      if (!isEntityId(id)) continue;
      const robot = s.metal === true && ENTITIES[id].method === 'rigid';
      expect(s.wreck === true, id).toBe(robot);
    }
  });

  it('un robot deja restos y no cadáver; los demás, al revés', () => {
    const w = createWorld('dot', 1);
    killEnemy(w, spawn(w, 'aspiradora'), 'barril');
    expect(w.wrecks.count).toBe(1);
    expect(w.corpses.count).toBe(0);
    killEnemy(w, spawn(w, 'necrofago'), 'barril');
    expect(w.wrecks.count).toBe(1);
    expect(w.corpses.count).toBe(1);
  });

  it('la explosión no hace daño', () => {
    const w = createWorld('dot', 1);
    const near = spawn(w, 'necrofago');
    const hp = near.hp;
    const hpPlayer = w.player.hp;
    w.player.x = 300;
    w.player.y = 300;
    killEnemy(w, spawn(w, 'excavadora'), 'barril');
    for (let i = 0; i < 60; i++) updateFx(w, 1 / 60);
    expect(near.hp).toBe(hp);
    expect(w.player.hp).toBe(hpPlayer);
  });

  it('los restos desaparecen pasado su tiempo; los de un jefe duran más', () => {
    const w = createWorld('dot', 1);
    killEnemy(w, spawn(w, 'dron'), 'barril');
    killEnemy(w, spawn(w, 'dirigible'), 'barril');
    expect(w.wrecks.count).toBe(2);
    w.time += FX.wreckTime + 1;
    updateFx(w, 1 / 60);
    expect(w.wrecks.count).toBe(1);
    expect(w.wrecks.items[0]!.sprite).toBe('dirigible');
    w.time += FX.wreckBossTime;
    updateFx(w, 1 / 60);
    expect(w.wrecks.count).toBe(0);
  });

  it('con el tope lleno se retira el resto que antes iba a desaparecer', () => {
    const w = createWorld('dot', 1);
    for (let i = 0; i < FX.maxWrecks + 5; i++) {
      w.time = i;
      killEnemy(w, spawn(w, 'aspiradora_cria'), 'barril');
    }
    expect(w.wrecks.count).toBe(FX.maxWrecks);
    let oldest = Infinity;
    for (let i = 0; i < w.wrecks.count; i++) oldest = Math.min(oldest, w.wrecks.items[i]!.t);
    expect(oldest).toBe(5);
  });
});

describe('piezas', () => {
  const W = 64;
  // Un disco, como un sprite con fondo transparente.
  const disc = new Uint8Array(W * W);
  for (let y = 0; y < W; y++)
    for (let x = 0; x < W; x++) if (Math.hypot(x - 32, y - 32) < 26) disc[y * W + x] = 255;

  it('cada píxel visible cae en un trozo y ninguno en dos', () => {
    const { owner, shards } = shatter(disc, W, W, 6, 0.4, FX_ART.wreck.shatter);
    let total = 0;
    for (const s of shards) total += s.area;
    expect(total).toBe(disc.reduce((n, a) => n + (a > 0 ? 1 : 0), 0));
    for (let i = 0; i < disc.length; i++) expect(owner[i]! >= 0).toBe(disc[i]! > 0);
    expect(shards.filter((s) => s.area > 0).length).toBe(6);
  });

  it('una imagen vacía no da trozos', () => {
    expect(shatter(new Uint8Array(W * W), W, W, 6, 0.4, FX_ART.wreck.shatter).shards).toHaveLength(0);
  });

  it('empiezan formando el robot, acaban en el suelo y ahí se quedan', () => {
    const M = FX_ART.wreck.motion;
    const o: PieceState = { x: 0, y: 0, z: 0, rot: 0, f: 0 };
    pieceAt(o, 0.3, 2, 10, -40, 0.1, 140, 0, 0, M);
    expect([o.x, o.y, o.z]).toEqual([10, 0, 40]);
    pieceAt(o, 0.3, 2, 10, -40, 0.1, 140, 0, 5, M);
    const rest = { ...o };
    expect(o.f).toBe(1);
    expect(o.z).toBe(0);
    pieceAt(o, 0.3, 2, 10, -40, 0.1, 140, 0, 20, M);
    expect(o).toEqual(rest);
  });

  it('lo que iba volando tarda más en caer', () => {
    const M = FX_ART.wreck.motion;
    const a: PieceState = { x: 0, y: 0, z: 0, rot: 0, f: 0 };
    const b: PieceState = { ...a };
    pieceAt(a, 0.3, 2, 10, -40, 0.1, 140, 0, 0.3, M);
    pieceAt(b, 0.3, 2, 10, -40, 0.1, 140, 200, 0.3, M);
    expect(b.f).toBeLessThan(a.f);
  });

  it('el mismo robot revienta igual con la misma semilla', () => {
    expect(wreckRand(0.5, 1, 2)).toBe(wreckRand(0.5, 1, 2));
    expect(wreckRand(0.5, 1, 2)).not.toBe(wreckRand(0.6, 1, 2));
  });
});
