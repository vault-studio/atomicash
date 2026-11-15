// Una pieza colocada en el mapa, en su punto de apoyo y ordenada por profundidad.
import { memo } from 'react';
import { ArtView, Placeholder } from './ArtView';
import type { Entry } from './catalog';
import { isoX, isoY, pieceWorld } from './geometry';
import type { Piece } from './state';

export const PieceView = memo(function PieceView({
  piece,
  entry,
  selected,
  ghost = false,
}: {
  piece: Piece;
  entry: Entry | undefined;
  selected: boolean;
  ghost?: boolean;
}) {
  const [wx, wy] = pieceWorld(piece);
  const cls = `ev-piece${selected ? ' ev-piece--sel' : ''}${ghost ? ' ev-piece--ghost' : ''}`;
  const style = { left: isoX(wx, wy), top: isoY(wx, wy), zIndex: Math.round(wx + wy + 10000) };
  return (
    <div className={cls} style={style} data-uid={piece.uid}>
      {entry?.art ? (
        <ArtView art={entry.art} scale={entry.art.scale} flip={piece.flip} anchored />
      ) : (
        <Placeholder
          entry={entry ?? ({ id: piece.id, color: '#f0f', radius: 12 } as Entry)}
          radius={entry?.radius ?? 12}
          anchored
        />
      )}
      {piece.type === 'enemy' && piece.count > 1 && <span className="ev-count">×{piece.count}</span>}
    </div>
  );
});
