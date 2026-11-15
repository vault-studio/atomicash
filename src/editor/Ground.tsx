// Suelo y rejilla del mapa del editor. Las baldosas son las del bioma, con los pesos del juego
// (TILES.acts en config/render) y sin lagos; «cualquiera» pinta rombos lisos.
import { memo, useEffect, useState } from 'react';
import { isActId } from '../config/acts';
import type { EventBiome } from '../config/events';
import { TILES, type TileIndex, type TileInfo } from '../config/render';
import { TILE_SCALE, cellWorld, cellsOf, diamond, isoX, isoY, mapHalf } from './geometry';

interface Tile {
  readonly info: TileInfo;
  readonly weight: number;
}

/** Número estable en [0, 1) para cada casilla, para que el suelo no cambie al repintar. */
function cellRand(x: number, y: number): number {
  let h = Math.imul(x + 1013, 73856093) ^ Math.imul(y + 2029, 19349663);
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

function useTiles(biome: EventBiome): { tiles: Tile[]; height: number } {
  const [index, setIndex] = useState<TileIndex | null>(null);
  useEffect(() => {
    fetch('/' + TILES.index)
      .then((r) => (r.ok ? (r.json() as Promise<TileIndex>) : null))
      .then(setIndex)
      .catch(() => setIndex(null));
  }, []);
  if (!index || !isActId(biome as number)) return { tiles: [], height: 0 };
  const act = TILES.acts[biome as 1 | 2 | 3];
  const tiles = (index.sets[act.sand] ?? [])
    .map((info, i) => ({ info, weight: act.weights[i] ?? 1 }))
    .filter((t) => !t.info.acid && t.weight > 0);
  return { tiles, height: index.height };
}

function pick(tiles: readonly Tile[], x: number, y: number): Tile | undefined {
  const total = tiles.reduce((a, t) => a + t.weight, 0);
  let r = cellRand(x, y) * total;
  for (const t of tiles) {
    if (r < t.weight) return t;
    r -= t.weight;
  }
  return tiles[0];
}

export const Ground = memo(function Ground({ biome, size }: { biome: EventBiome; size: number }) {
  const { tiles, height } = useTiles(biome);
  return (
    <>
      {tiles.length > 0 &&
        cellsOf(size).map(([x, y]) => {
          const t = pick(tiles, x, y)!;
          const [wx, wy] = cellWorld(x, y);
          const h = height + t.info.head;
          // Ancla en el centro del rombo, no de la imagen (como render/ground/view.ts).
          const ay = (t.info.head + height / 2) / h;
          const style = {
            left: isoX(wx, wy) - (TILES.imageWidth * TILE_SCALE) / 2,
            top: isoY(wx, wy) - ay * h * TILE_SCALE,
            width: TILES.imageWidth * TILE_SCALE,
            height: h * TILE_SCALE,
          };
          return (
            <img
              key={`${x},${y}`}
              className="ev-tile"
              src={'/' + TILES.dir + t.info.file}
              style={style}
              alt=""
            />
          );
        })}
    </>
  );
});

/** Rejilla de casillas y marcas: casillas que bloquean, huella de la selección y casilla bajo el cursor. */
export function Grid({
  size,
  plain,
  blocked,
  marked,
  hover,
  hoverOk,
}: {
  size: number;
  plain: boolean;
  blocked: readonly [number, number][];
  marked: readonly [number, number][];
  hover: readonly [number, number][];
  hoverOk: boolean;
}) {
  const m = mapHalf(size);
  const box = { left: -m.w, top: -m.h, width: 2 * m.w, height: 2 * m.h };
  const vb = `${-m.w} ${-m.h} ${2 * m.w} ${2 * m.h}`;
  const poly = (cls: string) => (c: readonly [number, number]) => (
    <polygon key={`${cls}${c[0]},${c[1]}`} className={cls} points={diamond(c[0], c[1])} />
  );
  return (
    <svg className="ev-grid" style={box} viewBox={vb}>
      {cellsOf(size).map(poly(plain ? 'ev-cell ev-cell--plain' : 'ev-cell'))}
      {blocked.map(poly('ev-cell--blocks'))}
      {marked.map(poly('ev-cell--sel'))}
      {hover.map(poly(hoverOk ? 'ev-cell--hover' : 'ev-cell--bad'))}
    </svg>
  );
}
