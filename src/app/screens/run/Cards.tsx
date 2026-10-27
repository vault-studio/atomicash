// Subida de nivel y cofres (04_ART_UI.md §2): 3 tarjetas de carta de diner, teclas 1 2 3 y «Cambiar (R)».
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { Choice, World } from '../../../engine/types';
import { cardView } from '../../cardText';

interface Props {
  choice: Choice;
  world: World;
  onPick: (i: number) => void;
  onReroll: () => void;
}

export function Cards({ choice, world, onPick, onReroll }: Props) {
  const { t } = useTranslation();
  const canReroll = choice.type === 'level' && world.rerolls > 0;

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const n = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(e.code);
      if (n >= 0 && n < choice.cards.length) {
        e.preventDefault();
        onPick(n);
      } else if (e.code === 'KeyR' && canReroll) {
        e.preventDefault();
        onReroll();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [choice, canReroll, onPick, onReroll]);

  return (
    <div className="overlay" role="dialog" aria-modal="true">
      <h2 className="overlay__title">{t(choice.type === 'level' ? 'cards.levelUp' : 'cards.itemTitle')}</h2>
      <div className="choice">
        {choice.cards.map((c, i) => {
          const v = cardView(t, world, c);
          return (
            <button key={i} className={`choice__card ${v.cls}`} onClick={() => onPick(i)}>
              <span className="choice__tag">{v.tag}</span>
              <strong className="choice__title">{v.title}</strong>
              <span className="choice__desc">{v.desc}</span>
              <kbd className="choice__key">{i + 1}</kbd>
            </button>
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
