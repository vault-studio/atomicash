// Embestida por datos (CAMBIOS §1): `enemies.<id>.dash` vale para cualquier tipo, avisa antes de lanzarse y puede apuntar
// a donde va a estar el jugador.
import { afterEach, describe, expect, it } from 'vitest';
import { ENEMY_STATS, type DashSpec } from '../src/config/enemies';
import { RUN } from '../src/config/run';
import { applyTuning, resetTuning } from '../src/config/tuning';
import { spawnEnemy } from '../src/engine/systems/enemies';
import { MODE_AIM, MODE_CHASE, MODE_DASH, type Enemy, type World } from '../src/engine/types';
import { createWorld, tick } from '../src/engine/world';

const STEP = 1 / RUN.tickHz;
const added: (keyof typeof ENEMY_STATS)[] = [];
afterEach(() => {
  resetTuning();
  // Quita las embestidas que un test haya añadido a un tipo que no la tiene en los datos.
  for (const id of added.splice(0)) delete (ENEMY_STATS[id] as { dash?: DashSpec }).dash;
});

function quietWorld(): World {
  // Sin oleadas: solo lo que pone el test.
  applyTuning({ spawn: { rateMult: 0 } });
  const w = createWorld('dot', 3, { hazards: false, startWeapon: null });
  w.player.god = true;
  return w;
}

const step = (w: World, mx = 0, my = 0): void => tick(w, { moveX: mx, moveY: my }, STEP);

/** Pone la embestida de `e` lista para empezar en el próximo tick. */
const ready = (e: Enemy): void => {
  e.timer = 0;
};

describe('embestida por datos', () => {
  it('el cortacésped (datos) avisa `aim` s parado con el pasillo marcado y luego embiste', () => {
    const w = quietWorld();
    const D = ENEMY_STATS.cortacesped.dash!;
    const p = w.player;
    const e = spawnEnemy(w, 'cortacesped', p.x + 300, p.y, false);
    ready(e);
    step(w);
    expect(e.mode).toBe(MODE_AIM);
    // El pasillo se marca en el suelo durante todo el aviso.
    expect(w.tele.count).toBe(1);
    const lane = w.tele.items[0]!;
    expect(lane.dur).toBe(D.aim);
    expect(lane.dmg).toBe(0);
    // Hasta el jugador (a 300 px) y `over` más, más su radio.
    expect(Math.hypot(lane.lx, lane.ly)).toBeCloseTo(300 + D.over + e.r, 3);
    // Parado todo el aviso.
    const x0 = e.x;
    const y0 = e.y;
    let t = STEP;
    while (e.mode === MODE_AIM) {
      step(w);
      t += STEP;
      if (e.mode === MODE_AIM) {
        expect(e.x).toBe(x0);
        expect(e.y).toBe(y0);
      }
    }
    expect(t).toBeGreaterThanOrEqual(D.aim - STEP);
    expect(t).toBeLessThanOrEqual(D.aim + 2 * STEP);
    expect(e.mode).toBe(MODE_DASH);
    // Embiste a `speed` px/s hasta pasar `over` px al jugador y luego vuelve a perseguir y reinicia el enfriamiento.
    const xs = e.x;
    step(w);
    expect((xs - e.x) / STEP).toBeCloseTo(D.speed, 0);
    while (e.mode === MODE_DASH) step(w);
    expect(e.mode).toBe(MODE_CHASE);
    expect(e.timer).toBe(D.every);
    expect(e.x).toBeLessThan(p.x - D.over + D.speed * STEP);
  });

  it('siempre llega hasta el jugador: desde el borde de `range` y aunque huya por el pasillo durante el aviso', () => {
    for (const id of ['cortacesped', 'saqueador'] as const) {
      const D = ENEMY_STATS[id].dash!;
      const w = quietWorld();
      const p = w.player;
      const e = spawnEnemy(w, id, p.x + D.range - 10, p.y, false);
      ready(e);
      step(w);
      expect(e.mode).toBe(MODE_AIM);
      // Huye en línea recta alejándose, por el propio pasillo.
      while (e.mode === MODE_AIM) step(w, -1, 0);
      let passed = false;
      while (e.mode === MODE_DASH) {
        step(w, -1, 0);
        if (e.x < p.x) passed = true;
      }
      expect(passed).toBe(true);
    }
  });

  it('la dirección se fija al empezar el aviso: si el jugador se aparta, falla', () => {
    const w = quietWorld();
    const p = w.player;
    const e = spawnEnemy(w, 'cortacesped', p.x + 300, p.y, false);
    const y0 = e.y;
    ready(e);
    step(w);
    expect(e.dy).toBeCloseTo(0, 1);
    // El jugador huye en vertical durante el aviso y la carrera.
    for (let i = 0; i < 60 && e.mode !== MODE_CHASE; i++) step(w, 0, 1);
    expect(e.y).toBeCloseTo(y0, 0);
  });

  it('no empieza fuera de `range`', () => {
    const w = quietWorld();
    const D = ENEMY_STATS.cortacesped.dash!;
    const e = spawnEnemy(w, 'cortacesped', w.player.x + D.range + 200, w.player.y, false);
    ready(e);
    for (let i = 0; i < 10; i++) step(w);
    expect(e.mode).toBe(MODE_CHASE);
    expect(w.tele.count).toBe(0);
  });

  it('con lead > 0 apunta por delante de un jugador en movimiento; con lead 0, a donde está', () => {
    const aimAt = (lead: number): number => {
      applyTuning({ enemies: { saqueador: { dash: { lead } } } });
      const w = quietWorld();
      const p = w.player;
      const e = spawnEnemy(w, 'saqueador', p.x + 300, p.y, false);
      // El jugador ya va en vertical cuando empieza el aviso.
      for (let i = 0; i < 5; i++) step(w, 0, 1);
      e.x = e.prevX = p.x + 300;
      e.y = e.prevY = p.y;
      expect(p.vy).toBeGreaterThan(0);
      ready(e);
      step(w, 0, 1);
      expect(e.mode).toBe(MODE_AIM);
      return e.dy;
    };
    expect(ENEMY_STATS.saqueador.dash!.lead).toBeGreaterThan(0);
    const ahead = aimAt(ENEMY_STATS.saqueador.dash!.lead);
    const at = aimAt(0);
    // Apuntar a donde está = casi horizontal (el jugador solo se ha movido un tick); por delante = claramente hacia donde va.
    expect(Math.abs(at)).toBeLessThan(0.05);
    expect(ahead).toBeGreaterThan(0.2);
    expect(ahead).toBeGreaterThan(at + 0.15);
  });

  it('el saqueador tiene embestida por datos y la usa', () => {
    const w = quietWorld();
    const D = ENEMY_STATS.saqueador.dash!;
    const e = spawnEnemy(w, 'saqueador', w.player.x + 300, w.player.y, false);
    let maxSpeed = 0;
    let aimed = false;
    for (let i = 0; i < 8 * RUN.tickHz; i++) {
      const x = e.x;
      step(w);
      if (e.mode === MODE_AIM) aimed = true;
      maxSpeed = Math.max(maxSpeed, Math.abs(e.x - x) / STEP);
    }
    expect(aimed).toBe(true);
    expect(maxSpeed).toBeGreaterThan(D.speed * 0.9);
  });

  it('cualquier enemigo con `dash` en los datos la usa, sin código de su tipo', () => {
    const w = quietWorld();
    added.push('necrofago');
    (ENEMY_STATS.necrofago as { dash?: DashSpec }).dash = {
      every: 3,
      aim: 0.3,
      speed: 500,
      over: 40,
      maxDur: 2,
      range: 400,
      lead: 0,
    };
    const e = spawnEnemy(w, 'necrofago', w.player.x + 300, w.player.y, false);
    expect(e.timer).toBeGreaterThan(0);
    expect(e.timer).toBeLessThanOrEqual(3);
    ready(e);
    step(w);
    expect(e.mode).toBe(MODE_AIM);
    while (e.mode === MODE_AIM) step(w);
    const x = e.x;
    step(w);
    expect((x - e.x) / STEP).toBeCloseTo(500, 0);
  });

  it('el Rey Rata sigue con su propio ciclo (sin `dash` en los datos)', () => {
    expect(ENEMY_STATS.rey_rata.dash).toBeUndefined();
  });
});
