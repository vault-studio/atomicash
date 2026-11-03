import { describe, expect, it } from 'vitest';
import { reportsToCsv, type RunReport } from '../src/engine/runReport';
import {
  createRunStats,
  hurtIndex,
  noteHurt,
  noteKill,
  noteLevel,
  notePick,
  samplePressure,
  sectorOf,
  surroundedBy,
} from '../src/engine/runStats';

describe('colector de estadísticas', () => {
  it('daño recibido por fuente, vida perdida por minuto y causa de la muerte', () => {
    const rs = createRunStats();
    noteHurt(rs, hurtIndex('necrofago'), 10, 30);
    noteHurt(rs, hurtIndex('interceptor'), 5, 70);
    noteHurt(rs, -1, 3, 75);
    expect(rs.dmgTaken[hurtIndex('necrofago')]).toBe(10);
    expect(rs.hpLostMin).toEqual([10, 8]);
    expect(rs.lastSrc).toBe(hurtIndex('interceptor'));
  });

  it('tiempo para matar desde el primer golpe', () => {
    const rs = createRunStats();
    noteKill(rs, 'dron', 12, 10);
    noteKill(rs, 'dron', 20, 19);
    const i = hurtIndex('dron');
    expect(rs.killsBy[i]).toBe(2);
    expect(rs.ttkSum[i]! / rs.killsBy[i]!).toBe(1.5);
  });

  it('niveles y decisiones con su minuto; arma nueva guarda cuándo llegó', () => {
    const rs = createRunStats();
    noteLevel(rs, 2, 40);
    notePick(rs, 40, 'new', 'tesla');
    expect(rs.levelAt[2]).toBe(40);
    expect(rs.weaponAt.tesla).toBe(40);
    expect(rs.picks).toEqual([{ t: 40, kind: 'new', id: 'tesla' }]);
  });

  it('rodeado: cuenta solo al entrar', () => {
    const rs = createRunStats();
    samplePressure(rs, 1, 10, true);
    samplePressure(rs, 1.5, 10, true);
    samplePressure(rs, 2, 10, false);
    samplePressure(rs, 2.5, 10, true);
    expect(rs.surrounded).toBe(2);
  });

  it('detecta un cerco por sectores ocupados', () => {
    const ring = (n: number, r: number) =>
      Array.from({ length: n }, (_, i) => ({
        x: Math.cos((i / n) * Math.PI * 2) * r,
        y: Math.sin((i / n) * Math.PI * 2) * r,
        dead: false,
      }));
    const occ = new Uint8Array(8);
    const w = (items: { x: number; y: number; dead: boolean }[]) => ({
      player: { x: 0, y: 0 },
      enemies: { count: items.length, items },
    });
    expect(surroundedBy(w(ring(12, 150)), 220, 8, 7, occ)).toBe(true);
    expect(surroundedBy(w(ring(12, 150).slice(0, 6)), 220, 8, 7, occ)).toBe(false);
    expect(surroundedBy(w(ring(12, 400)), 220, 8, 7, occ)).toBe(false);
    expect(sectorOf(1, 0, 8)).not.toBe(sectorOf(-1, 0, 8));
  });

  it('exporta CSV con una columna por fuente y tipo', () => {
    const base = {
      charId: 'dot',
      seed: 1,
      time: 60,
      won: false,
      level: 3,
      kills: 9,
      deathMin: 1,
      deathCause: 'dron',
      build: 'llave:1',
      surrounded: 0,
      stuns: 0,
      chargesHit: 0,
      chargesDodged: 0,
      shellsHit: 0,
      shellsDodged: 0,
      rages: 0,
      damageTaken: [{ src: 'dron', dmg: 5, pct: 100 }],
      damageDealt: [{ src: 'llave', dmg: 50, dps: 1, pct: 100 }],
      ttk: [{ type: 'dron', kills: 9, ttk: 0.5 }],
    } as unknown as RunReport;
    const csv = reportsToCsv([base], [{ bot: 'kite' }])
      .trim()
      .split('\n');
    expect(csv[0]).toContain('taken.dron');
    expect(csv[0]).toContain('ttk.dron');
    expect(csv[0]!.startsWith('bot,char')).toBe(true);
    expect(csv[1]).toContain('llave:1');
  });
});
