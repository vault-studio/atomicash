// Ficha del personaje (se abre desde Expedición): retrato grande a la izquierda y, al lado, pestañas Ficha / Taller /
// Árbol. La ficha enseña nivel, estrellas, pasiva y arma inicial (con su ventana de ayuda «i»); el taller reúne
// mejoras, implante y arsenal, que se pagan con cupones; el árbol, con los puntos que dan el nivel y las estrellas. Abajo a la izquierda,
// el botón para salir de expedición con él.
import { useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { SURVIVORS, type RosterId, type StatSurvivorId } from '../../../config/survivors';
import { useSaveData } from '../../../store/save';
import { RARITY_COLOR } from './common';
import { HeroPortrait } from './Portraits';
import { SheetWorkshop } from './SheetWorkshop';
import { Tree } from './Tree';
import { SheetTab } from './SheetTab';

const TABS = ['sheet', 'workshop', 'tree'] as const;
type Tab = (typeof TABS)[number];
const TAB_LABEL: Record<Tab, string> = {
  sheet: 'sheet.tabSheet',
  workshop: 'sheet.tabWorkshop',
  tree: 'sheet.tabTree',
};

interface Props {
  id: RosterId;
  onBack: () => void;
  onStart: (id: StatSurvivorId) => void;
}

export function CharacterSheet({ id, onBack, onStart }: Props) {
  const { t } = useTranslation();
  const credits = useSaveData((d) => d.profile.credits);
  const [tab, setTab] = useState<Tab>('sheet');

  return (
    <main className="sheet" style={{ '--rarity': RARITY_COLOR[SURVIVORS[id].rarity] } as CSSProperties}>
      <header className="sheet__head">
        <button className="term-btn" onClick={onBack}>
          {t('sheet.back')}
        </button>
        <h1>{t(`entities.${id}`)}</h1>
        <span className="credits sheet__credits">{t('bunker.credits', { n: credits })}</span>
        <nav className="sheet__tabs" role="tablist">
          {TABS.map((k) => (
            <button
              key={k}
              role="tab"
              aria-selected={k === tab}
              className="tabs__tab"
              onClick={() => setTab(k)}
            >
              {t(TAB_LABEL[k])}
            </button>
          ))}
        </nav>
      </header>
      <div className={tab === 'workshop' ? 'sheet__body sheet__body--wide' : 'sheet__body'}>
        <aside className="sheet__side">
          <div className="sheet__portrait">
            <HeroPortrait id={id} />
          </div>
          <button className="btn btn--primary sheet__go" onClick={() => onStart(id)}>
            {t('sheet.go')}
          </button>
        </aside>
        <section className="sheet__main">
          {tab === 'sheet' && <SheetTab id={id} />}
          {tab === 'workshop' && <SheetWorkshop id={id} />}
          {tab === 'tree' && <Tree charId={id} />}
        </section>
      </div>
    </main>
  );
}
