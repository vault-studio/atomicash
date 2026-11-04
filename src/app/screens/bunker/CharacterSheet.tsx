// Ficha del personaje (se abre desde Expedición): retrato grande a la izquierda y, al lado, pestañas Ficha / Taller /
// Árbol. La ficha enseña nivel, estrellas, pasiva y arma inicial (con su ventana de ayuda «i»); el taller reúne
// mejoras, implante y arsenal, que se pagan con cupones; el árbol, con los puntos que dan el nivel y las estrellas. Abajo a la izquierda,
// el botón para salir de expedición con él.
import { useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { RARITIES, SURVIVOR_LEVEL, STARS } from '../../../config/meta';
import { SURVIVORS, type RosterId, type StatSurvivorId } from '../../../config/survivors';
import { TREE_POINTS } from '../../../config/tree';
import { FUSIONS, type WeaponId } from '../../../config/weapons';
import { setStarter, starCost, starUp } from '../../../meta/actions';
import { useSave, useSaveData } from '../../../store/save';
import { weaponParams } from '../../cardText';
import { weaponIcon } from '../../icons';
import { BlockHead, RARITY_COLOR, Stars } from './common';
import { HeroPortrait } from './Portraits';
import { SheetWorkshop } from './SheetWorkshop';
import { Tree } from './Tree';

const TABS = ['sheet', 'workshop', 'tree'] as const;
type Tab = (typeof TABS)[number];
const TAB_LABEL: Record<Tab, string> = {
  sheet: 'sheet.tabSheet',
  workshop: 'sheet.tabWorkshop',
  tree: 'sheet.tabTree',
};

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

/** Tabla de la ventana de ayuda; la fila `current` va resaltada. */
function InfoTable({
  head,
  rows,
}: {
  head: string[];
  rows: { key: string; cells: React.ReactNode[]; current?: boolean }[];
}) {
  const { t } = useTranslation();
  return (
    <table className="infod__table">
      <thead>
        <tr>
          {head.map((h) => (
            <th key={h} scope="col">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.key} className={r.current ? 'is-current' : undefined}>
            {r.cells.map((c, i) => (
              <td key={i}>
                {c}
                {r.current && i === 0 && <small> {t('info.current')}</small>}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Ayuda del bloque Nivel: qué da cada nivel, cómo se gana la XP y lo que tienes ahora y al siguiente nivel. */
function LevelInfo({ level }: { level: number }) {
  const { t } = useTranslation();
  const row = (n: number, key: string) => ({
    key,
    cells: [
      n,
      t('sheet.bonusHp', { n: (n - 1) * SURVIVOR_LEVEL.hpPerLevel }),
      t('sheet.bonusDmg', { n: (n - 1) * SURVIVOR_LEVEL.dmgPerLevel }),
    ],
    current: key === 'now',
  });
  const rows = [row(level, 'now')];
  if (level < SURVIVOR_LEVEL.max) rows.push(row(level + 1, 'next'));
  return (
    <>
      <p>
        {t('info.level.gain', {
          hp: SURVIVOR_LEVEL.hpPerLevel,
          dmg: SURVIVOR_LEVEL.dmgPerLevel,
          max: SURVIVOR_LEVEL.max,
        })}
      </p>
      <p>
        {t('info.level.xp', {
          sec: SURVIVOR_LEVEL.perSec,
          kill: SURVIVOR_LEVEL.perKill,
          boss: SURVIVOR_LEVEL.perBoss,
        })}
      </p>
      <p>{t('info.level.treePoints', { every: TREE_POINTS.levelEvery })}</p>
      <InfoTable head={[t('info.level.col'), t('stats.hp'), t('stats.dmg')]} rows={rows} />
    </>
  );
}

/** Ayuda del bloque Estrellas: bono y coste de cada estrella, de dónde salen las chapas. */
function StarsInfo({ stars }: { stars: number }) {
  const { t } = useTranslation();
  const rows = Array.from({ length: STARS.max }, (_, i) => {
    const n = i + 1;
    const cost = STARS.cost[i];
    return {
      key: String(n),
      cells: [
        <Stars key="s" n={n} />,
        `+${(n - 1) * STARS.pctPerStar} %`,
        cost === undefined ? '—' : t('info.stars.cost', { n: cost }),
      ],
      current: n === stars,
    };
  });
  const shards = RARITIES.map((r) => `${t(`rarity.${r}`)} ${STARS.shardsPerDup[r]}`).join(' · ');
  return (
    <>
      <p>{t('info.stars.gain', { pct: STARS.pctPerStar })}</p>
      <p>{t('info.stars.treePoints', { n: TREE_POINTS.perStar })}</p>
      <InfoTable
        head={[t('info.stars.colStars'), t('info.stars.colBonus'), t('info.stars.colCost')]}
        rows={rows}
      />
      <p>{t('info.stars.shards', { list: shards })}</p>
    </>
  );
}

/** Ayuda del bloque Arma inicial: qué hace a nivel 1, con qué se combina y cómo mejorarla. */
function StarterInfo({ weapon }: { weapon: WeaponId }) {
  const { t } = useTranslation();
  const fusions = FUSIONS.filter((f) => f.a === weapon || f.b === weapon);
  const name = (w: WeaponId): string => t(`weapons.${w}.name`);
  return (
    <>
      <p className="infod__weapon">
        <img src={weaponIcon(weapon)} alt="" />
        <strong>{name(weapon)}</strong>
      </p>
      <p>{t(`weapons.${weapon}.desc`, weaponParams(weapon, 1))}</p>
      <h3>{t('info.starter.fusions')}</h3>
      {fusions.length ? (
        <ul>
          {fusions.map((f) => (
            <li key={f.result}>
              {t('info.starter.fusion', { a: name(f.a), b: name(f.b), result: name(f.result) })}
            </li>
          ))}
        </ul>
      ) : (
        <p>{t('info.starter.noFusions')}</p>
      )}
      <p>{t('info.starter.tree')}</p>
    </>
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
        <BlockHead title={t('sheet.level')} info={<LevelInfo level={o.level} />} />
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
        <BlockHead title={t('sheet.stars')} info={<StarsInfo stars={o.stars} />} />
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
        <BlockHead title={t('sheet.passive')} />
        <p className="sheet__passive">{t(`passives.${id}`)}</p>
      </section>

      <section className="sheet__block">
        <BlockHead title={t('collection.starter')} info={<StarterInfo weapon={starter} />} />
        <div className="sheet__center">
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
