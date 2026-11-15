// Piezas de la ficha del personaje: medidores, bonos y ventanas de información (nivel, estrellas, arma).
import { useTranslation } from 'react-i18next';
import { RARITIES, SURVIVOR_LEVEL, STARS } from '../../../config/meta';
import { TREE_POINTS } from '../../../config/tree';
import { FUSIONS, type WeaponId } from '../../../config/weapons';
import { weaponParams } from '../../cardText';
import { weaponIcon } from '../../icons';
import { Stars } from './common';

/** Barra de progreso con su etiqueta encima. */
export function Gauge({
  label,
  value,
  max,
  full,
}: {
  label: string;
  value: number;
  max: number;
  full?: boolean;
}) {
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
export function Bonuses({ rows }: { rows: [key: string, n: number][] }) {
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
export function LevelInfo({ level }: { level: number }) {
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
export function StarsInfo({ stars }: { stars: number }) {
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
export function StarterInfo({ weapon }: { weapon: WeaponId }) {
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
