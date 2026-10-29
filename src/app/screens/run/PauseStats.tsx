// Estadísticas del personaje en la pausa: atributos actuales (rasgos, objeto, RAD, turbo) y resumen de la partida.
import { useTranslation } from 'react-i18next';
import { PLAYER } from '../../../config/run';
import { survivorStats } from '../../../config/survivors';
import { SOURCE_INDEX } from '../../../config/weapons';
import type { World } from '../../../engine/types';
import { currentDps } from '../../../engine/world';
import { weaponIcon } from '../../icons';
import { headOf } from '../bunker/Portraits';
import { fmtTime } from './Hud';

const pct = (v: number): string => `${v > 0 ? '+' : ''}${Math.round(v * 100)} %`;

/** Fila de la tabla; `off` atenúa los atributos sin mejorar. */
type Row = [key: string, value: string | number, off?: boolean];

export function PauseStats({ world: w }: { world: World }) {
  const { t } = useTranslation();
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
    ['area', pct(st.area - 1), st.area === 1],
    ['pierce', st.pierce, st.pierce === 0],
    ['kb', pct(st.kb - 1), st.kb === 1],
    ['magnet', pct(st.magnet / PLAYER.magnetBase - 1), st.magnet === PLAYER.magnetBase],
    ['xp', pct(st.xpMult - 1), st.xpMult === 1],
    ['luck', st.luck, st.luck === 0],
    ['rad', Math.round(p.rad)],
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
      <div className="pstats__cols">
        <table>
          <caption>{t('pauseStats.attributes')}</caption>
          <tbody>{rows(attrs.slice(0, half))}</tbody>
        </table>
        <table>
          <caption aria-hidden="true">&nbsp;</caption>
          <tbody>{rows(attrs.slice(half))}</tbody>
        </table>
        <div>
          <table>
            <caption>{t('pauseStats.run')}</caption>
            <tbody>{rows(run)}</tbody>
          </table>
          <table>
            <caption>{t('pauseStats.weapons')}</caption>
            <tbody>
              {w.weapons.map((wp) => (
                <tr key={wp.id}>
                  <th scope="row">
                    <img className="wicon" src={weaponIcon(wp.id)} alt="" />
                    {t(`weapons.${wp.id}.name`)} <small>{t('run.level', { n: wp.lvl })}</small>
                  </th>
                  <td>{Math.round(w.dmgBy[SOURCE_INDEX[wp.id]!]!).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
