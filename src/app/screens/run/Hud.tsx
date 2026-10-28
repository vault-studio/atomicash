// HUD de la run (04_ART_UI.md §2) con estética de terminal de fósforo de los 50: PV y RAD arriba a la izquierda,
// tiempo y XP arriba al centro, radar, bajas y pausa arriba a la derecha, armas, objeto y consumibles abajo a la
// derecha.
import { useTranslation } from 'react-i18next';
import { CONSUMABLE_IDS } from '../../../config/items';
import { RAD } from '../../../config/radiation';
import { PLAYER } from '../../../config/run';
import { WEAPONS } from '../../../config/weapons';
import type { Banner, World } from '../../../engine/types';
import type { HudSnapshot } from '../../runSession';
import { Minimap } from './Minimap';

export const fmtTime = (s: number): string => {
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
};

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
          <span className="meter__val">{t('run.rad', { n: Math.round(hud.rad) })}</span>
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
              <span className="meter__over">{t(`entities.${hud.boss.id}`)}</span>
            </div>
          </div>
        )}
        {hud.rain && <div className="hud__status">{t('run.rain')}</div>}
      </div>

      <div className="hud__tr">
        <button className="btn-icon" onClick={onPause} aria-label={t('run.pause')}>
          ❚❚
        </button>
        <div className="hud__radar panel">
          <Minimap world={world} />
          <span className="hud__kills">{t('run.kills', { n: hud.kills })}</span>
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
                  <span className="slot__name">{t(`weapons.${w.id}.short`)}</span>
                  <span className="slot__pips" aria-label={t('run.level', { n: w.lvl })}>
                    {Array.from({ length: PLAYER.maxWeaponLevel }, (_, k) => (
                      <i key={k} className={k < w.lvl ? 'is-on' : ''} />
                    ))}
                  </span>
                </>
              )}
            </div>
          ))}
          <div
            className={`slot slot--item ${hud.item ? '' : 'is-empty'}`}
            title={hud.item ? t(`items.${hud.item}.desc`) : ''}
          >
            {hud.item && <span className="slot__name">{t(`items.${hud.item}.name`)}</span>}
          </div>
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
              <span className="slot__name">{t(`consumables.${id}.short`)}</span>
              <span className="slot__lvl">{hud.cons[id]}</span>
              <span className="slot__key">{i + 5}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
