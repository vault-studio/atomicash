// HUD de la run (04_ART_UI.md §2) con estética de terminal de fósforo de los 50: PV y RAD arriba a la izquierda,
// tiempo y XP arriba al centro, radar, bajas y pausa arriba a la derecha, armas, objeto y consumibles abajo a la
// derecha.
import { useTranslation } from 'react-i18next';
import { CONSUMABLE_IDS } from '../../../config/items';
import { RAD } from '../../../config/radiation';
import { PLAYER, STREAK } from '../../../config/run';
import { WEAPONS } from '../../../config/weapons';
import type { Banner, World } from '../../../engine/types';
import { hudIcon, weaponIcon } from '../../icons';
import type { HudSnapshot } from '../../runSession';
import { Minimap } from './Minimap';

export const fmtTime = (s: number): string => {
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
};

/**
 * Aviso de horda en el borde de la pantalla por donde llegará (el anillo, en todos los bordes). La flecha se pega al
 * rectángulo de la pantalla siguiendo la dirección.
 */
function HordeWarning({ horde }: { horde: NonNullable<HudSnapshot['horde']> }) {
  if (horde.kind === 'ring') return <div className="hud__edge-ring" />;
  return <EdgeArrow sx={horde.sx} sy={horde.sy} kind="horde" />;
}

/** Flecha pegada al borde de la pantalla en la dirección (sx, sy): roja para hordas, amarilla para objetivos. */
function EdgeArrow({ sx, sy, kind }: { sx: number; sy: number; kind: 'horde' | 'objective' }) {
  const k = 1 / Math.max(Math.abs(sx), Math.abs(sy));
  const left = 50 + sx * k * 44;
  const top = 50 + sy * k * 40;
  const deg = (Math.atan2(sy, sx) * 180) / Math.PI;
  return (
    <div className={`hud__edge is-${kind}`} style={{ left: `${left}%`, top: `${top}%` }}>
      <span className="hud__edge-arrow" style={{ transform: `rotate(${deg}deg)` }}>
        ➤
      </span>
      <span className="hud__edge-sign">{kind === 'horde' ? '!' : '◎'}</span>
    </div>
  );
}

interface Props {
  hud: HudSnapshot;
  world: World;
  onPause: () => void;
  onConsume: (i: number) => void;
}

function useBannerText(): (b: Banner) => string {
  const { t } = useTranslation();
  return (b) => {
    const params: Record<string, string> = { ...b.params };
    if (b.params.boss) params.name = t(`entities.${b.params.boss}`).toUpperCase();
    if (b.params.weapon) params.name = t(`weapons.${b.params.weapon}.name`);
    if (b.params.elite) params.prefix = t(`elites.${b.params.elite}`);
    if (b.params.enemy) params.name = t(`entities.${b.params.enemy}`);
    return t(b.key, params);
  };
}

export function Hud({ hud, world, onPause, onConsume }: Props) {
  const { t } = useTranslation();
  const bannerText = useBannerText();
  const hpFrac = hud.maxHp > 0 ? hud.hp / hud.maxHp : 0;
  const slots = Array.from({ length: hud.slots }, (_, i) => hud.weapons[i] ?? null);

  return (
    <div className="hud">
      <div className="hud__tl panel">
        <div className={`meter meter--hp ${hpFrac < 0.3 ? 'is-low' : ''}`}>
          <span className="meter__label">{t('run.hp')}</span>
          <div className="meter__bar" aria-label={`${Math.ceil(hud.hp)} / ${hud.maxHp}`}>
            <div className="meter__fill" style={{ width: `${hpFrac * 100}%` }} />
          </div>
          <span className="meter__val">
            {Math.ceil(hud.hp)}/{hud.maxHp}
          </span>
        </div>
        <div className="meter meter--rad">
          <span className="meter__label">☢</span>
          <div className="meter__bar">
            <div
              className="meter__fill"
              style={{ width: `${(hud.rad / RAD.max) * 100}%`, background: hud.radColor }}
            />
          </div>
          <span className="meter__val">{t('run.rad', { n: Math.floor(hud.rad) })}</span>
        </div>
      </div>

      <div className="hud__tc">
        <div className={`hud__time ${hud.storm ? 'is-storm' : ''}`}>{fmtTime(hud.time)}</div>
        <div className="meter meter--xp">
          <span className="meter__label">{t('run.level', { n: hud.level })}</span>
          <div className="meter__bar">
            <div className="meter__fill" style={{ width: `${(hud.xp / hud.xpNext) * 100}%` }} />
          </div>
        </div>
        {hud.boss && (
          <div className="meter meter--boss">
            <div className="meter__bar">
              <div className="meter__fill" style={{ width: `${hud.boss.frac * 100}%` }} />
              {hud.boss.marks.map((m) => (
                <i key={m} className="meter__mark" style={{ left: `${m * 100}%` }} />
              ))}
              <span className="meter__over">
                {t(`entities.${hud.boss.id}`)}
                {hud.boss.marks.length > 0 && ` · ${t('run.bossPhase', { n: hud.boss.phase })}`}
              </span>
            </div>
          </div>
        )}
        {hud.elite && (
          <div className="meter meter--elite">
            <div className="meter__bar">
              <div className="meter__fill" style={{ width: `${hud.elite.frac * 100}%` }} />
              <span className="meter__over">
                {t('run.elitePrefix', {
                  prefix: t(`elites.${hud.elite.prefix}`),
                  name: t(`entities.${hud.elite.id}`),
                })}
              </span>
            </div>
          </div>
        )}
        {hud.rain && <div className="hud__status">{t('run.rain')}</div>}
        {hud.endless !== null && (
          <div className="hud__status hud__status--endless">
            {t('run.endless', { n: Math.floor(hud.endless) })}
          </div>
        )}
        {hud.dailyMod && <div className="hud__daily">{t(`daily.mod.${hud.dailyMod}.name`)}</div>}
        {hud.objective && (
          <div className="hud__objective">
            <span>{t(`run.objective.${hud.objective.kind}`)}</span>
            <div className="meter__bar">
              <div
                className="meter__fill"
                style={{ width: `${Math.min(1, hud.objective.progress / hud.objective.goal) * 100}%` }}
              />
              <span className="meter__over">
                {hud.objective.kind === 'hold'
                  ? `${Math.floor(hud.objective.progress)}/${hud.objective.goal} s`
                  : `${hud.objective.progress}/${hud.objective.goal}`}{' '}
                · {Math.ceil(hud.objective.left)} s
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="hud__tr">
        <button className="btn-icon" onClick={onPause} aria-label={t('run.pause')}>
          ❚❚
        </button>
        <div className="hud__radar panel">
          <Minimap world={world} />
          <span className="hud__kills">{t('run.kills', { n: hud.kills })}</span>
          {hud.streak >= STREAK.show && (
            <span className={`hud__streak ${hud.streakMult > 1 ? 'is-hot' : ''}`}>
              {t('run.streak', { n: hud.streak })}
              {hud.streakMult > 1 && <b> ×{hud.streakMult}</b>}
            </span>
          )}
        </div>
      </div>

      <div className="hud__banners" aria-live="polite">
        {hud.banners.slice(-2).map((b, i) => (
          <div key={`${b.key}-${i}`} className="hud__banner" style={{ opacity: Math.min(1, b.life * 1.5) }}>
            {bannerText(b)}
          </div>
        ))}
      </div>

      <div className="hud__br panel">
        <span className="panel__label">{t('run.weapons')}</span>
        <div className="slots">
          {slots.map((w, i) => (
            <div
              key={i}
              className={`slot ${w ? '' : 'is-empty'}`}
              style={w ? { borderColor: WEAPONS[w.id].color } : undefined}
              title={w ? t(`weapons.${w.id}.name`) : t('run.slotEmpty')}
            >
              {w && (
                <>
                  <img className="slot__icon" src={weaponIcon(w.id)} alt={t(`weapons.${w.id}.short`)} />
                  <span className="slot__pips" aria-label={t('run.level', { n: w.lvl })}>
                    {Array.from({ length: PLAYER.maxWeaponLevel }, (_, k) => (
                      <i key={k} className={k < w.lvl ? 'is-on' : ''} />
                    ))}
                  </span>
                </>
              )}
            </div>
          ))}
          {Array.from({ length: PLAYER.itemSlots }, (_, i) => hud.items[i] ?? null).map((it, i) => (
            <div
              key={`item${i}`}
              className={`slot slot--item ${it ? '' : 'is-empty'}`}
              title={it ? `${t(`items.${it}.name`)}: ${t(`items.${it}.desc`)}` : t('run.itemEmpty')}
            >
              {it && <img className="slot__icon" src={hudIcon(it)} alt={t(`items.${it}.name`)} />}
            </div>
          ))}
        </div>
        <span className="panel__label">{t('run.kit')}</span>
        <div className="slots slots--cons">
          {CONSUMABLE_IDS.map((id, i) => (
            <button
              key={id}
              className="slot slot--cons"
              disabled={hud.cons[id] <= 0}
              onClick={() => onConsume(i)}
              title={`${t(`consumables.${id}.name`)}: ${t(`consumables.${id}.desc`)} (${i + 5})`}
            >
              <img className="slot__icon" src={hudIcon(id)} alt={t(`consumables.${id}.short`)} />
              <span className="slot__lvl">{hud.cons[id]}</span>
              <span className="slot__key">{i + 5}</span>
            </button>
          ))}
        </div>
      </div>

      {hud.horde && <HordeWarning horde={hud.horde} />}
      {hud.objective?.dir && (
        <EdgeArrow sx={hud.objective.dir.sx} sy={hud.objective.dir.sy} kind="objective" />
      )}
    </div>
  );
}
