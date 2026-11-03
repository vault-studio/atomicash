// Búnker (04_ART_UI.md §2): menú principal como entradas de una terminal de fósforo verde.
import { useTranslation } from 'react-i18next';
import { MISSIONS } from '../../../config/meta';
import { useSaveData } from '../../../store/save';
import { FullscreenButton } from '../../fullscreen';
import { Screen } from './common';

export const BUNKER_VIEWS = ['expedition', 'supplies', 'stores', 'board', 'settings'] as const;
export type BunkerView = (typeof BUNKER_VIEWS)[number];

interface Props {
  onGo: (v: BunkerView) => void;
}

export function Bunker({ onGo }: Props) {
  const { t } = useTranslation();
  const active = useSaveData((d) => d.profile.active);
  const daily = useSaveData((d) => d.missions.daily);
  const claimable = daily.filter((m) => !m.claimed && m.progress >= MISSIONS[m.id].goal).length;

  return (
    <Screen title={t('app.title')} actions={<FullscreenButton />}>
      <p>{t('app.subtitle')}</p>
      {active && <p className="bunker__active">{t('bunker.active', { name: t(`entities.${active}`) })}</p>}
      <nav className="bunker__menu">
        {BUNKER_VIEWS.map((v, i) => (
          <button key={v} className="bunker__entry" autoFocus={i === 0} onClick={() => onGo(v)}>
            <span className="bunker__cmd">&gt; {t(`bunker.${v}.cmd`)}</span>
            <span className="bunker__desc">
              {t(`bunker.${v}.desc`)}
              {v === 'board' && claimable > 0 && <b className="badge">{claimable}</b>}
            </span>
          </button>
        ))}
      </nav>
    </Screen>
  );
}
