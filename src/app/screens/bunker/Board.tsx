// Tablón: misiones diarias (se reinician a medianoche local), logros permanentes y ficha del perfil.
import { useTranslation } from 'react-i18next';
import { ACHIEVEMENTS, ACHIEVEMENT_IDS, MISSIONS } from '../../../config/meta';
import { achievementProgress, claimMission } from '../../../meta/actions';
import { useSave } from '../../../store/save';
import { fmtTime } from '../run/Hud';
import { Screen } from './common';
import { Leaderboard } from './Online';

export function Board({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const data = useSave((s) => s.data);
  const act = useSave((s) => s.act);
  const st = data.profile.stats;

  return (
    <Screen title={t('bunker.board.cmd')} onBack={onBack}>
      <h2>{t('board.daily')}</h2>
      <ul className="shop">
        {data.missions.daily.map((m, i) => {
          const def = MISSIONS[m.id];
          const done = m.progress >= def.goal;
          return (
            <li key={m.id} className="shop__row">
              <span>
                <strong>
                  {t(`missions.${def.kind}`, {
                    n: def.goal,
                    name: m.char ? t(`entities.${m.char}`) : '',
                  })}
                </strong>{' '}
                <small>
                  {Math.min(m.progress, def.goal)}/{def.goal}
                </small>
                <span className="progress">
                  <span style={{ width: `${Math.min(1, m.progress / def.goal) * 100}%` }} />
                </span>
              </span>
              <button
                className="btn"
                disabled={!done || m.claimed}
                onClick={() => act((d) => claimMission(d, i))}
              >
                {m.claimed ? t('board.claimed') : t('board.claim', { n: def.reward })}
              </button>
            </li>
          );
        })}
      </ul>

      <h2>{t('board.achievements')}</h2>
      <ul className="shop">
        {ACHIEVEMENT_IDS.map((id) => {
          const def = ACHIEVEMENTS[id];
          const got = data.missions.achievements[id] === true;
          const p = Math.min(def.goal, achievementProgress(data, id));
          return (
            <li key={id} className={got ? 'shop__row is-done' : 'shop__row'}>
              <span>
                <strong>{t(`achievements.${id}.name`)}</strong>{' '}
                <small>{t(`achievements.${id}.desc`, { n: def.goal })}</small>
              </span>
              <span>
                {got ? '✔' : `${p}/${def.goal}`} ·{' '}
                {t('board.reward', { credits: def.credits, shards: def.shards })}
              </span>
            </li>
          );
        })}
      </ul>

      <h2>{t('online.ranking')}</h2>
      <Leaderboard />

      <h2>{t('board.profile')}</h2>
      <dl className="stats">
        <dt>{t('board.runs')}</dt>
        <dd>{st.runs}</dd>
        <dt>{t('board.kills')}</dt>
        <dd>{st.kills.toLocaleString()}</dd>
        <dt>{t('board.best')}</dt>
        <dd>{fmtTime(st.bestTimeSec)}</dd>
        <dt>{t('board.bosses')}</dt>
        <dd>{st.bossesKilled}</dd>
        <dt>{t('board.wins')}</dt>
        <dd>{st.wins}</dd>
        <dt>{t('board.pulls')}</dt>
        <dd>{data.gacha.pulls}</dd>
      </dl>
    </Screen>
  );
}
