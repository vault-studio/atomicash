import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { StatSurvivorId } from '../config/survivors';
import { RunScreen } from './screens/RunScreen';
import { SurvivorSelect } from './screens/SurvivorSelect';

// DECISIÓN: ajustes fijos hasta el store persistido (F3-01).
const SETTINGS = { showDamage: false, reduceMotion: false, crt: true };

export function App() {
  const { t } = useTranslation();
  const [charId, setCharId] = useState<StatSurvivorId | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle('crt', SETTINGS.crt);
  }, []);

  return (
    <>
      {charId ? (
        <RunScreen charId={charId} settings={SETTINGS} onExit={() => setCharId(null)} />
      ) : (
        <SurvivorSelect onPick={setCharId} />
      )}
      <div className="rotate">{t('app.rotate')}</div>
    </>
  );
}
