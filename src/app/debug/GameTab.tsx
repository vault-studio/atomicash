// Pestaña «Partida»: personaje, semilla, build, velocidad, piloto automático y generadores de enemigos.
import { useEffect, useState } from 'react';
import { BOSS_IDS, MOB_IDS, type BossKind, type StatEnemyId } from '../../config/enemies';
import { ROSTER, type StatSurvivorId } from '../../config/survivors';
import type { HordeKind } from '../../config/waves';
import { WEAPON_IDS } from '../../config/weapons';
import { announceHorde, spawnBoss } from '../../engine/systems/spawning';
import type { BotKind } from '../../sim/sim';
import type { RunSession } from '../runSession';
import type { DevCtx } from './devTypes';
import {
  BOT_KINDS,
  SPEED_MAX,
  SPEED_MIN,
  clampSpeed,
  devStatus,
  formatStatus,
  parseBuild,
  randomSeed,
  spawnAround,
} from './devUtils';

const HORDE_KINDS: readonly HordeKind[] = ['ring', 'stampede', 'wall'];

function StatusLine({ getSession }: { getSession: DevCtx['getSession'] }) {
  const [text, setText] = useState('—');
  useEffect(() => {
    const id = setInterval(() => {
      const s = getSession();
      setText(s ? formatStatus(devStatus(s.world)) : '—');
    }, 250);
    return () => clearInterval(id);
  }, [getSession]);
  return <div className="dev-status">{text}</div>;
}

export function GameTab({ ctx }: { ctx: DevCtx }) {
  const { setup, live } = ctx;
  const [mob, setMob] = useState<StatEnemyId>(MOB_IDS[0]!);
  const [count, setCount] = useState(10);
  const [horde, setHorde] = useState<HordeKind>('ring');
  const [boss, setBoss] = useState<BossKind>(BOSS_IDS[0]!);
  const ignored = parseBuild(setup.buildText).ignored;
  const withSession = (fn: (s: RunSession) => void) => () => {
    const s = ctx.getSession();
    if (s) fn(s);
  };

  return (
    <>
      <StatusLine getSession={ctx.getSession} />

      <section className="dev-sec">
        <h3>Nueva partida</h3>
        <label className="dev-row">
          <span>Personaje</span>
          <select
            value={setup.char}
            onChange={(e) => ctx.patchSetup({ char: e.target.value as StatSurvivorId })}
          >
            {ROSTER.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="dev-row">
          <span>Semilla</span>
          <input
            type="text"
            inputMode="numeric"
            value={setup.seedText}
            onChange={(e) => ctx.patchSetup({ seedText: e.target.value, fixedSeed: true })}
          />
        </label>
        <div className="dev-row">
          <label className="dev-check">
            <input
              type="checkbox"
              checked={setup.fixedSeed}
              onChange={(e) => ctx.patchSetup({ fixedSeed: e.target.checked })}
            />
            semilla fija
          </label>
          <button onClick={() => ctx.patchSetup({ seedText: String(randomSeed()), fixedSeed: true })}>
            nueva
          </button>
          <span className="dev-dim">en curso: {ctx.seed}</span>
        </div>
        <label className="dev-row">
          <span>Build</span>
          <input
            type="text"
            placeholder="llave:3,tesla:2"
            value={setup.buildText}
            onChange={(e) => ctx.patchSetup({ buildText: e.target.value })}
          />
        </label>
        <div className="dev-dim">
          Armas: {WEAPON_IDS.join(', ')}. La primera sustituye al arma inicial.
          {ignored.length > 0 && <span className="dev-warn"> Ignorado: {ignored.join(', ')}</span>}
        </div>
        <button className="dev-big" onClick={ctx.restart}>
          Reiniciar
        </button>
      </section>

      <section className="dev-sec">
        <h3>Ahora</h3>
        <label className="dev-check">
          <input
            type="checkbox"
            checked={live.god}
            onChange={(e) => ctx.patchLive({ god: e.target.checked })}
          />
          invencible
        </label>
        <div className="dev-row">
          <span>Velocidad</span>
          <input
            type="range"
            min={SPEED_MIN}
            max={SPEED_MAX}
            step={0.25}
            value={live.speed}
            onChange={(e) => ctx.patchLive({ speed: clampSpeed(Number(e.target.value)) })}
          />
          <span className="dev-num">{live.speed}×</span>
        </div>
        <div className="dev-row">
          <button onClick={() => ctx.patchLive({ paused: !live.paused })}>
            {live.paused ? 'Reanudar' : 'Pausar'}
          </button>
          <button onClick={() => ctx.patchLive({ speed: 1 })}>1×</button>
        </div>
        <label className="dev-row">
          <span>Piloto</span>
          <select
            value={live.bot ?? ''}
            onChange={(e) => ctx.patchLive({ bot: (e.target.value || null) as BotKind | null })}
          >
            <option value="">manual</option>
            {BOT_KINDS.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="dev-sec">
        <h3>Generar</h3>
        <div className="dev-row">
          <select value={mob} onChange={(e) => setMob(e.target.value as StatEnemyId)}>
            {MOB_IDS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            max={500}
            value={count}
            onChange={(e) => setCount(Math.max(1, Math.min(500, Math.trunc(Number(e.target.value)) || 1)))}
          />
          <button onClick={withSession((s) => spawnAround(s.world, mob, count))}>Generar</button>
        </div>
        <div className="dev-row">
          <select value={horde} onChange={(e) => setHorde(e.target.value as HordeKind)}>
            {HORDE_KINDS.map((h) => (
              <option key={h} value={h}>
                horda {h}
              </option>
            ))}
          </select>
          <button onClick={withSession((s) => announceHorde(s.world, horde))}>Lanzar</button>
        </div>
        <div className="dev-row">
          <select value={boss} onChange={(e) => setBoss(e.target.value as BossKind)}>
            {BOSS_IDS.map((b) => (
              <option key={b} value={b}>
                jefe {b}
              </option>
            ))}
          </select>
          <button onClick={withSession((s) => spawnBoss(s.world, boss))}>Invocar</button>
        </div>
      </section>
    </>
  );
}
