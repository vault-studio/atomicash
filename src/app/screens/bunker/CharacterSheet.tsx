// Ficha del personaje (se abre desde Expedición): retrato grande a la izquierda y, al lado, pestañas Ficha / Árbol.
// La ficha enseña nivel, estrellas, pasiva y arma inicial; el árbol se paga con las chapas del personaje. Abajo a la
// izquierda, el botón para salir de expedición con él.
import { useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { SURVIVOR_LEVEL, STARS } from '../../../config/meta';
import { SURVIVORS, type RosterId, type StatSurvivorId } from '../../../config/survivors';
import { setStarter, starCost, starUp } from '../../../meta/actions';
import { useSave, useSaveData } from '../../../store/save';
import { weaponIcon } from '../../icons';
import { RARITY_COLOR, Stars } from './common';
import { HeroPortrait } from './Portraits';
import { Tree } from './Tree';

const TABS = ['sheet', 'tree'] as const;
type Tab = (typeof TABS)[number];

/** Barra de progreso con su etiqueta encima. */
function Gauge({ label, value, max, full }: { label: string; value: number; max: number; full?: boolean }) {
  return (
    <div className={full ? 'gauge is-full' : 'gauge'}>
      <span className="gauge__label">{label}</span>
      <span className="gauge__bar">
        <span style={{ width: `${full ? 100 : Math.min(100, (value / max) * 100)}%` }} />
      </span>
    </div>
  );
}

/** Bonificaciones en lista grande; si todas son 0, «sin bonificación todavía». */
function Bonuses({ rows }: { rows: [key: string, n: number][] }) {
  const { t } = useTranslation();
  const on = rows.filter(([, n]) => n > 0);
  if (!on.length) return <p className="sheet__none">{t('sheet.noBonus')}</p>;
  return (
    <ul className="sheet__bonus">
      {on.map(([k, n]) => (
        <li key={k}>{t(`sheet.${k}`, { n })}</li>
      ))}
    </ul>
  );
}

/**
 * Pestaña Ficha: cuatro bloques que llenan el hueco (2×2): nivel y estrellas con su cifra en grande y lo que dan,
 * pasiva y arma inicial con su icono grande.
 */
function SheetTab({ id }: { id: RosterId }) {
  const { t } = useTranslation();
  const o = useSaveData((d) => d.survivors[id]);
  const act = useSave((s) => s.act);
  if (!o) return null;

  const cost = starCost(o);
  const maxLevel = o.level >= SURVIVOR_LEVEL.max;
  const nextXp = SURVIVOR_LEVEL.next(o.level);
  const starPct = (o.stars - 1) * STARS.pctPerStar;
  const starters = [SURVIVORS[id].weapon, ...o.learnedStarters];
  const starter = o.starter ?? SURVIVORS[id].weapon;

  return (
    <div className="sheet__cols">
      <section className="sheet__block">
        <h3>{t('sheet.level')}</h3>
        <div className="sheet__row">
          <strong className="sheet__big">{o.level}</strong>
          <Bonuses
            rows={[
              ['bonusHp', (o.level - 1) * SURVIVOR_LEVEL.hpPerLevel],
              ['bonusDmg', (o.level - 1) * SURVIVOR_LEVEL.dmgPerLevel],
            ]}
          />
        </div>
        <Gauge
          label={
            maxLevel ? t('collection.maxLevel') : t('collection.xp', { xp: Math.floor(o.xp), next: nextXp })
          }
          value={o.xp}
          max={maxLevel ? 1 : nextXp}
          full={maxLevel}
        />
      </section>

      <section className="sheet__block">
        <h3>{t('sheet.stars')}</h3>
        <div className="sheet__row">
          <span className="sheet__stars">
            <Stars n={o.stars} />
          </span>
          <Bonuses
            rows={[
              ['bonusHp', starPct],
              ['bonusDmg', starPct],
              ['bonusSpd', starPct],
            ]}
          />
        </div>
        <div className="sheet__row sheet__row--end">
          <Gauge
            label={cost === null ? t('collection.maxStars') : t('collection.shards', { n: o.shards, cost })}
            value={o.shards}
            max={cost ?? 1}
            full={cost === null}
          />
          <button
            className="btn sheet__btn"
            disabled={cost === null || o.shards < cost}
            onClick={() => act((d) => starUp(d, id))}
          >
            ★ {t('collection.starUp')}
          </button>
        </div>
      </section>

      <section className="sheet__block">
        <h3>{t('sheet.passive')}</h3>
        <p className="sheet__passive">{t(`passives.${id}`)}</p>
      </section>

      <section className="sheet__block">
        <h3>{t('collection.starter')}</h3>
        <div className="sheet__row">
          <img className="sheet__wicon" src={weaponIcon(starter)} alt="" />
          <div className="sheet__weapon">
            <strong>{t(`weapons.${starter}.name`)}</strong>
            {starters.length > 1 && (
              <select
                value={starter}
                aria-label={t('collection.starter')}
                onChange={(e) => act((d) => setStarter(d, id, e.target.value as (typeof starters)[number]))}
              >
                {starters.map((w) => (
                  <option key={w} value={w}>
                    {t(`weapons.${w}.name`)}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

interface Props {
  id: RosterId;
  onBack: () => void;
  onStart: (id: StatSurvivorId) => void;
}

export function CharacterSheet({ id, onBack, onStart }: Props) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('sheet');

  return (
    <main className="sheet" style={{ '--rarity': RARITY_COLOR[SURVIVORS[id].rarity] } as CSSProperties}>
      <header className="sheet__head">
        <button className="term-btn" onClick={onBack}>
          {t('sheet.back')}
        </button>
        <h1>{t(`entities.${id}`)}</h1>
        <nav className="sheet__tabs" role="tablist">
          {TABS.map((k) => (
            <button
              key={k}
              role="tab"
              aria-selected={k === tab}
              className="tabs__tab"
              onClick={() => setTab(k)}
            >
              {t(k === 'sheet' ? 'sheet.tabSheet' : 'sheet.tabTree')}
            </button>
          ))}
        </nav>
      </header>
      <div className="sheet__body">
        <aside className="sheet__side">
          <div className="sheet__portrait">
            <HeroPortrait id={id} />
          </div>
          <button className="btn btn--primary sheet__go" onClick={() => onStart(id)}>
            {t('sheet.go')}
          </button>
        </aside>
        <section className="sheet__main">
          {tab === 'sheet' ? <SheetTab id={id} /> : <Tree charId={id} />}
        </section>
      </div>
    </main>
  );
}
