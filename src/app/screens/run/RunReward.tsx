// Lo que la run deja en el Búnker: XP del superviviente, niveles y logros. Va dentro del ticket.
import { useTranslation } from 'react-i18next';
import type { RunReward as Reward } from '../../../meta/actions';

export function RunReward({ reward }: { reward: Reward }) {
  const { t } = useTranslation();
  return (
    <div className="ticket__reward">
      <p>{t('reward.xp', { n: reward.xp })}</p>
      {reward.dailyBonus > 0 && <p className="ticket__ach">{t('reward.daily', { n: reward.dailyBonus })}</p>}
      {reward.levelUps > 0 && <p>{t('reward.levelUp', { n: reward.levelUps })}</p>}
      {reward.achievements.map((a) => (
        <p key={a} className="ticket__ach">
          {t('reward.achievement', { name: t(`achievements.${a}.name`) })}
        </p>
      ))}
    </div>
  );
}
