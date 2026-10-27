import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { StatSurvivorId } from '../config/survivors';
import { RunScreen } from './screens/RunScreen';
import { SurvivorSelect } from './screens/SurvivorSelect';

export function App() {
  const { t } = useTranslation();
  const [charId, setCharId] = useState<StatSurvivorId | null>(null);

  return (
    <>
      {charId ? (
        <RunScreen charId={charId} onExit={() => setCharId(null)} />
      ) : (
        <SurvivorSelect onPick={setCharId} />
      )}
      <div className="rotate">{t('app.rotate')}</div>
    </>
  );
}
