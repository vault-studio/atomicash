// Subida de nivel y cofres (04_ART_UI.md §2): 3 tarjetas de carta de diner, teclas 1 2 3 y «Cambiar (R)».
// Los cofres giran como una tragaperras antes de dejar elegir (dossier §7): el de jefe hace rodar sus 3 objetos y el
// especial, los cupones.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { audio } from '../../../audio/audio';
import { ITEM_IDS } from '../../../config/items';
import { CACHE_ROLL } from '../../../config/run';
import { cardKey } from '../../../engine/systems/progression';
import type { Choice, World } from '../../../engine/types';
import { cardView } from '../../cardText';

/** Tiempos de la tragaperras, en ms: giro del primer rodillo, separación entre paradas y cambio de símbolo. */
const SPIN = { first: 700, gap: 450, step: 70 } as const;

interface Props {
  choice: Choice;
  world: World;
  onPick: (i: number) => void;
  onReroll: () => void;
  onBanish: (i: number) => void;
  onLock: (i: number) => void;
}

/** Rodillos que se paran uno tras otro; devuelve cuántos han parado y un contador que avanza mientras giran. */
function useSpin(reels: number, active: boolean): { landed: number; frame: number } {
  const [landed, setLanded] = useState(active ? 0 : reels);
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (!active) return;
    const timers = Array.from({ length: reels }, (_, i) =>
      window.setTimeout(
        () => {
          setLanded(i + 1);
          audio.play('pickup');
        },
        SPIN.first + i * SPIN.gap,
      ),
    );
    const iv = window.setInterval(() => {
      setFrame((f) => f + 1);
      audio.play('select');
    }, SPIN.step);
    const stop = window.setTimeout(() => window.clearInterval(iv), SPIN.first + (reels - 1) * SPIN.gap);
    return () => {
      timers.forEach(window.clearTimeout);
      window.clearTimeout(stop);
      window.clearInterval(iv);
    };
  }, [reels, active]);
  return { landed, frame };
}

export function Cards({ choice, world, onPick, onReroll, onBanish, onLock }: Props) {
  const { t } = useTranslation();
  const canReroll = choice.type === 'level' && world.rerolls > 0;
  const level = choice.type === 'level';
  const lockedKey = world.locked ? cardKey(world.locked) : null;
  const slot = choice.type !== 'level';
  const reels = choice.type === 'cache' ? 3 : choice.cards.length;
  const { landed, frame } = useSpin(reels, slot);
  const ready = landed >= reels;

  const coupons = choice.cards[0]?.kind === 'coupons' ? choice.cards[0].n : 0;
  const tier = coupons >= CACHE_ROLL.jackpot ? 'jackpot' : coupons >= CACHE_ROLL.double[0] ? 'double' : null;
  useEffect(() => {
    if (ready && slot) audio.play(tier === 'jackpot' ? 'win' : 'level');
  }, [ready, slot, tier]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const n = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(e.code);
      if (n >= 0 && n < choice.cards.length) {
        e.preventDefault();
        if (ready) onPick(n);
      } else if (e.code === 'KeyR' && canReroll) {
        e.preventDefault();
        onReroll();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [choice, canReroll, ready, onPick, onReroll]);

  if (choice.type === 'endless') {
    return (
      <div className="overlay" role="dialog" aria-modal="true">
        <h2 className="overlay__title">{t('cards.endlessTitle')}</h2>
        <p className="endless__text">{t('cards.endlessDesc')}</p>
        <div className="overlay__actions">
          <button className="btn btn--primary" autoFocus onClick={() => onPick(0)}>
            {t('cards.endlessGo')}
          </button>
          <button className="btn" onClick={() => onPick(1)}>
            {t('cards.endlessStop')}
          </button>
        </div>
      </div>
    );
  }

  if (choice.type === 'cache') {
    const digits = String(coupons).padStart(3, '0').split('');
    return (
      <div className="overlay" role="dialog" aria-modal="true">
        <h2 className="overlay__title">{t('cards.cacheTitle')}</h2>
        <div className={`slotm ${ready ? 'is-ready' : ''} ${tier ? `is-${tier}` : ''}`}>
          <div className="slotm__reels">
            {digits.map((d, i) => (
              <span key={i} className={`slotm__reel ${i < landed ? 'is-landed' : ''}`}>
                {i < landed ? d : (frame + i * 3) % 10}
              </span>
            ))}
          </div>
          <p className="slotm__label">
            {ready ? (tier ? t(`cards.${tier}`) : t('cards.cache')) : t('cards.spinning')}
          </p>
          {ready && (
            <p className="slotm__prize">
              {t('cards.coupons', { n: coupons })} · {t('cards.cacheDesc')}
            </p>
          )}
        </div>
        <button className="btn btn--primary" disabled={!ready} autoFocus onClick={() => onPick(0)}>
          {t('cards.collect')}
        </button>
      </div>
    );
  }

  return (
    <div className="overlay" role="dialog" aria-modal="true">
      <h2 className="overlay__title">{t(choice.type === 'level' ? 'cards.levelUp' : 'cards.itemTitle')}</h2>
      <div className="choice">
        {choice.cards.map((c, i) => {
          const spinning = i >= landed;
          if (spinning) {
            const id = ITEM_IDS[(frame + i * 2) % ITEM_IDS.length]!;
            return (
              <div key={i} className="choice__card rare is-spinning" aria-hidden="true">
                <span className="choice__tag">{t('cards.item')}</span>
                <strong className="choice__title">{t(`items.${id}.name`)}</strong>
                <span className="choice__desc">{t('cards.spinning')}</span>
              </div>
            );
          }
          const v = cardView(t, world, c);
          const locked = level && cardKey(c) === lockedKey;
          const pickable = c.kind === 'up' || c.kind === 'new' || c.kind === 'trait';
          return (
            <div key={i} className="choice__slot">
              <button
                className={`choice__card ${v.cls} ${slot ? 'is-landed' : ''} ${locked ? 'is-locked' : ''}`}
                disabled={!ready}
                onClick={() => onPick(i)}
              >
                <span className="choice__tag">
                  {locked && '🔒 '}
                  {v.tag}
                </span>
                {v.icon && <img className="choice__icon" src={v.icon} alt="" />}
                <strong className="choice__title">{v.title}</strong>
                <span className="choice__desc">{v.desc}</span>
                <kbd className="choice__key">{i + 1}</kbd>
              </button>
              {level && (world.banishes > 0 || world.locks > 0 || locked) && (
                <div className="choice__tools">
                  {world.banishes > 0 && pickable && (
                    <button className="term-btn" onClick={() => onBanish(i)} title={t('cards.banishHint')}>
                      {t('cards.banish', { n: world.banishes })}
                    </button>
                  )}
                  {(locked || (world.locks > 0 && c.kind !== 'heal' && c.kind !== 'purge')) && (
                    <button className="term-btn" onClick={() => onLock(i)} title={t('cards.lockHint')}>
                      {locked ? t('cards.unlock') : t('cards.lock', { n: world.locks })}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {choice.type === 'level' && (
        <button className="btn" disabled={!canReroll} onClick={onReroll}>
          {t('cards.reroll', { n: world.rerolls })}
        </button>
      )}
    </div>
  );
}
