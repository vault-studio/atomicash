// Pestaña «Estadísticas» (CAMBIOS §6.4): resumen de la partida en curso y exportación a JSON o CSV.
import { useEffect, useState } from 'react';
import { buildReport, reportsToCsv, type RunReport } from '../../engine/runReport';
import type { DevCtx } from './devTypes';

function download(name: string, text: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

const top = (xs: { src: string; dmg: number; pct: number }[]): string =>
  xs
    .slice(0, 5)
    .map((x) => `${x.src} ${x.pct}%`)
    .join(' · ') || '—';

export function StatsTab({ ctx }: { ctx: DevCtx }) {
  const [rep, setRep] = useState<RunReport | null>(null);
  useEffect(() => {
    const read = (): void => {
      const w = ctx.getSession()?.world;
      setRep(w ? buildReport(w) : null);
    };
    read();
    const id = setInterval(read, 1000);
    return () => clearInterval(id);
  }, [ctx]);
  if (!rep) return <div className="dev-dim">Sin partida.</div>;
  const name = `atomicash-${rep.charId}-s${rep.seed}-${Math.round(rep.time)}s`;
  return (
    <>
      <section className="dev-sec">
        <h3>Partida</h3>
        <div>
          {rep.charId} · semilla {rep.seed} · {(rep.time / 60).toFixed(1)} min · nivel {rep.level} ·{' '}
          {rep.kills} bajas
        </div>
        <div>
          Muerte: {rep.deathMin === null ? 'vivo' : `min ${rep.deathMin} por ${rep.deathCause ?? '?'}`} ·
          rodeado {rep.surrounded} veces
        </div>
        <div>Build: {rep.build || '—'}</div>
      </section>
      <section className="dev-sec">
        <h3>Daño</h3>
        <div>Recibido: {top(rep.damageTaken)}</div>
        <div>Infligido: {top(rep.damageDealt)}</div>
        <div>
          DPS:{' '}
          {rep.damageDealt
            .slice(0, 4)
            .map((x) => `${x.src} ${x.dps}`)
            .join(' · ') || '—'}
        </div>
      </section>
      <section className="dev-sec">
        <h3>Esquivas</h3>
        <div>
          Aturdimientos {rep.stuns} · cargas {rep.chargesHit} recibidas / {rep.chargesDodged} esquivadas ·
          disparos {rep.shellsHit} / {rep.shellsDodged} · furias {rep.rages}
        </div>
      </section>
      <section className="dev-sec">
        <h3>Exportar</h3>
        <button onClick={() => download(`${name}.json`, JSON.stringify(rep, null, 2), 'application/json')}>
          JSON
        </button>
        <button onClick={() => download(`${name}.csv`, reportsToCsv([rep]), 'text/csv')}>CSV</button>
      </section>
    </>
  );
}
