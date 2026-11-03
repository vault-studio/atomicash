// Estadísticas del personaje en la pausa: atributos actuales (rasgos, objeto, RAD, turbo) y resumen de la partida.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CAPS, PLAYER } from '../../../config/run';
import { survivorStats } from '../../../config/survivors';
import { FUSIONS, SOURCE_INDEX, type WeaponId } from '../../../config/weapons';
import type { World } from '../../../engine/types';
import { currentDps } from '../../../engine/world';
import { weaponIcon } from '../../icons';
import { headOf } from '../bunker/Portraits';
import { fmtTime } from './Hud';

const pct = (v: number): string => `${v > 0 ? '+' : ''}${Math.round(v * 100)} %`;

/** Fila de la tabla; `off` atenúa los atributos sin mejorar. */
type Row = [key: string, value: string | number, off?: boolean];

/** Arma con su icono y nombre, en una línea. */
function WeaponChip({ id }: { id: WeaponId }) {
  const { t } = useTranslation();
  return (
    <span className="pstats__chip">
      <img className="wicon" src={weaponIcon(id)} alt="" />
      {t(`weapons.${id}.name`)}
    </span>
  );
}

/** Combinaciones del arma elegida: con qué se fusiona y si ya puede salir, o de qué dos viene si es una fusión. */
function Combos({ world: w, id }: { world: World; id: WeaponId | null }) {
  const { t } = useTranslation();
  if (!id) return <p className="pstats__combo">{t('pauseStats.fuse.pickWeapon')}</p>;
  const mine = w.weapons.find((x) => x.id === id);
  const parts = FUSIONS.filter((f) => f.result === id);
  const uses = FUSIONS.filter((f) => f.a === id || f.b === id);
  if (parts.length === 0 && uses.length === 0)
    return <p className="pstats__combo">{t('pauseStats.fuse.none')}</p>;
  return (
    <ul className="pstats__combos">
      {parts.map((f) => (
        <li key={f.result}>
          <span>{t('pauseStats.fuse.from')}</span> <WeaponChip id={f.a} /> + <WeaponChip id={f.b} />
        </li>
      ))}
      {uses.map((f) => {
        const other = f.a === id ? f.b : f.a;
        const have = w.weapons.find((x) => x.id === other);
        const ready =
          !!mine && !!have && mine.lvl >= PLAYER.maxWeaponLevel && have.lvl >= PLAYER.maxWeaponLevel;
        const state = ready
          ? t('pauseStats.fuse.ready')
          : have
            ? t('pauseStats.fuse.haveNotMax', { max: PLAYER.maxWeaponLevel })
            : t('pauseStats.fuse.missing');
        return (
          <li key={f.result} className={ready ? 'is-ready' : have ? 'is-have' : undefined}>
            <span>{t('pauseStats.fuse.with')}</span> <WeaponChip id={other} /> → <WeaponChip id={f.result} />
            <em>{state}</em>
          </li>
        );
      })}
    </ul>
  );
}

export function PauseStats({ world: w }: { world: World }) {
  const { t } = useTranslation();
  const [sel, setSel] = useState<WeaponId | null>(null);
  const p = w.player;
  const st = w.st;
  const base = survivorStats(w.charId);

  const attrs: Row[] = [
    ['hp', `${Math.ceil(p.hp)} / ${st.maxHp}`],
    ['regen', `${st.regen.toFixed(1)} ${t('run.hp')}/s`, st.regen === 0],
    ['armor', st.armor, st.armor === 0],
    ['red', pct(st.red), st.red === 0],
    ['dodge', pct(st.dodge), st.dodge === 0],
    ['speed', `${Math.round(st.speed)} (${pct(st.speed / base.speed - 1)})`],
    ['dmg', pct(st.dmgMult - 1), Math.abs(st.dmgMult - 1) < 0.005],
    ['cd', pct(1 - st.cdMult), st.cdMult === 1],
    ['crit', pct(st.crit), st.crit === 0],
    ['critDmg', `×${st.critMult.toFixed(2)}`, st.critMult === CAPS.critMult],
    ['area', pct(st.area - 1), st.area === 1],
    ['pierce', st.pierce, st.pierce === 0],
    ['kb', pct(st.kb - 1), st.kb === 1],
    ['magnet', pct(st.magnet / PLAYER.magnetBase - 1), st.magnet === PLAYER.magnetBase],
    ['xp', pct(st.xpMult - 1), st.xpMult === 1],
    ['luck', st.luck, st.luck === 0],
    ['rad', Math.floor(p.rad)],
  ];
  const half = Math.ceil(attrs.length / 2);
  const run: Row[] = [
    ['time', fmtTime(w.time)],
    ['level', w.level],
    ['kills', w.kills],
    ['bosses', w.bosses],
    ['dmgTotal', Math.round(w.dmgTotal).toLocaleString()],
    ['dps', Math.round(currentDps(w))],
    ['coupons', w.coupons],
  ];

  const rows = (list: Row[]) =>
    list.map(([k, v, off]) => (
      <tr key={k} className={off ? 'is-off' : undefined}>
        <th scope="row">{t(`pauseStats.${k}`)}</th>
        <td>{v}</td>
      </tr>
    ));

  const head = headOf(w.charId);
  return (
    <div className={`pstats ${head ? 'pstats--head' : ''}`}>
      {head && <img className="pstats__head" src={head} alt="" />}
      <h3 className="pstats__name">
        {t(`entities.${w.charId}`)} · {t('run.level', { n: w.level })}
      </h3>
      <div className="pstats__grid">
        <div className="pstats__left">
          <div className="pstats__cols">
            <table>
              <caption>{t('pauseStats.attributes')}</caption>
              <tbody>{rows(attrs.slice(0, half))}</tbody>
            </table>
            <table>
              <caption aria-hidden="true">&nbsp;</caption>
              <tbody>{rows(attrs.slice(half))}</tbody>
            </table>
            <table>
              <caption>{t('pauseStats.run')}</caption>
              <tbody>{rows(run)}</tbody>
            </table>
          </div>
          <div className="pstats__panel">
            <Combos world={w} id={sel && w.weapons.some((x) => x.id === sel) ? sel : null} />
          </div>
        </div>
        <ul className="pstats__tiles" aria-label={t('pauseStats.weaponsTitle')}>
          {w.weapons.map((wp) => {
            const dmg = w.dmgBy[SOURCE_INDEX[wp.id]!]!;
            const dps = dmg / Math.max(1, w.time - wp.got);
            return (
              <li key={wp.id}>
                <button
                  className={wp.id === sel ? 'pstats__tile is-sel' : 'pstats__tile'}
                  aria-pressed={wp.id === sel}
                  onClick={() => setSel(wp.id === sel ? null : wp.id)}
                >
                  <img className="pstats__wicon" src={weaponIcon(wp.id)} alt="" />
                  <span className="pstats__wtext">
                    <span className="pstats__wname">
                      {t(`weapons.${wp.id}.name`)} <small>{t('run.level', { n: wp.lvl })}</small>
                    </span>
                    <span>{t('pauseStats.weaponDmg', { n: Math.round(dmg).toLocaleString() })}</span>
                    <span>{t('pauseStats.weaponDps', { n: Math.round(dps).toLocaleString() })}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
