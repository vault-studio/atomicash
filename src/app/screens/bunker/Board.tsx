// Tablón: expediente en fichas grandes, misiones del día como órdenes con su sello al cobrarlas (se reinician a
// medianoche local), logros como medallas con su progreso alrededor y el ranking.
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { ACHIEVEMENTS, ACHIEVEMENT_IDS, MISSIONS, type MissionKind } from '../../../config/meta';
import { achievementProgress, claimMission } from '../../../meta/actions';
import { useSave } from '../../../store/save';
import { hudIcon, pickupIcon, weaponIcon } from '../../icons';
import { fmtTime } from '../run/Hud';
import { Screen, untilMidnight } from './common';
import { Leaderboard } from './Online';

/** Dibujo de cada tipo de misión. */
const MISSION_ICON: Readonly<Record<MissionKind, string>> = {
  kills: weaponIcon('rifle_cerrojo'),
  surviveMin: hudIcon('heal'),
  surviveWith: hudIcon('heal'),
  runs: pickupIcon('crate'),
  bosses: pickupIcon('bomb'),
  consumables: hudIcon('stim'),
};

const pct = (v: number): CSSProperties => ({ '--p': `${Math.round(v * 100)}%` }) as CSSProperties;

export function Board({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const data = useSave((s) => s.data);
  const act = useSave((s) => s.act);
  const st = data.profile.stats;
  const got = ACHIEVEMENT_IDS.filter((id) => data.missions.achievements[id] === true).length;

  const record: readonly [string, string][] = [
    ['runs', st.runs.toLocaleString()],
    ['kills', st.kills.toLocaleString()],
    ['best', fmtTime(st.bestTimeSec)],
    ['bosses', st.bossesKilled.toLocaleString()],
    ['wins', st.wins.toLocaleString()],
    ['pulls', data.gacha.pulls.toLocaleString()],
  ];

  return (
    <Screen title={t('bunker.board.cmd')} onBack={onBack}>
      <div className="board">
        <section className="board__record" aria-label={t('board.profile')}>
          {record.map(([k, v]) => (
            <div key={k} className="board__stat">
              <span className="board__num">{v}</span>
              <span className="board__lbl">{t(`board.${k}`)}</span>
            </div>
          ))}
        </section>

        <h2 className="board__h">
          {t('board.daily')}
          <small>{t('board.renew', { time: untilMidnight(new Date()) })}</small>
        </h2>
        <ul className="board__missions">
          {data.missions.daily.map((m, i) => {
            const def = MISSIONS[m.id];
            const done = m.progress >= def.goal;
            const cls = ['order', done && !m.claimed && 'is-ready', m.claimed && 'is-claimed']
              .filter(Boolean)
              .join(' ');
            return (
              <li key={m.id} className={cls}>
                <img className="order__icon" src={MISSION_ICON[def.kind]} alt="" />
                <strong className="order__title">
                  {t(`missions.${def.kind}`, { n: def.goal, name: m.char ? t(`entities.${m.char}`) : '' })}
                </strong>
                <span className="order__count">
                  <b>{Math.min(m.progress, def.goal).toLocaleString()}</b> / {def.goal.toLocaleString()}
                </span>
                <span className="order__bar" style={pct(Math.min(1, m.progress / def.goal))} />
                <span className="order__reward">
                  <img src={pickupIcon('coupon')} alt="" />+{def.reward}
                </span>
                {m.claimed ? (
                  <span className="order__stamp">{t('board.claimed')}</span>
                ) : (
                  <button
                    className="btn btn--primary"
                    disabled={!done}
                    onClick={() => act((d) => claimMission(d, i))}
                  >
                    {t('board.claimShort')}
                  </button>
                )}
              </li>
            );
          })}
        </ul>

        <h2 className="board__h">
          {t('board.achievements')}
          <small>
            {got}/{ACHIEVEMENT_IDS.length}
          </small>
        </h2>
        <ul className="board__medals">
          {ACHIEVEMENT_IDS.map((id) => {
            const def = ACHIEVEMENTS[id];
            const won = data.missions.achievements[id] === true;
            const p = Math.min(def.goal, achievementProgress(data, id));
            return (
              <li key={id} className={won ? 'medal is-won' : 'medal'}>
                <span className="medal__ring" style={pct(won ? 1 : p / def.goal)}>
                  <span className="medal__core">{won ? '★' : `${Math.floor((p / def.goal) * 100)}%`}</span>
                </span>
                <strong className="medal__name">{t(`achievements.${id}.name`)}</strong>
                <small className="medal__desc">{t(`achievements.${id}.desc`, { n: def.goal })}</small>
                <span className="medal__reward">
                  {won ? '✔ ' : `${p.toLocaleString()}/${def.goal.toLocaleString()} · `}
                  {t('board.reward', { credits: def.credits, shards: def.shards })}
                </span>
              </li>
            );
          })}
        </ul>

        <h2 className="board__h">{t('online.ranking')}</h2>
        <Leaderboard />
      </div>
    </Screen>
  );
}
