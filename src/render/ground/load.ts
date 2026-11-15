// Carga de baldosas y objetos del mapa de cada acto.
import { Assets, type Texture } from 'pixi.js';
import type { ActId } from '../../config/acts';
import { PROP_LIST, RUBBLE_PROPS } from '../../config/props';
import { TILES, type TileIndex, type TileInfo } from '../../config/render';

export interface GroundTile {
  readonly tex: Texture;
  readonly head: number;
  /** Lo que sobresale, para ordenarlo con los personajes. */
  readonly top: Texture | null;
  readonly acid: number;
  readonly weight: number;
}

interface Prop {
  readonly tex: Texture;
  readonly ax: number;
  readonly ay: number;
}

export interface GroundTiles {
  readonly sand: readonly GroundTile[];
  readonly deco: readonly GroundTile[];
  /** Lagos de ácido, de menor a mayor. */
  readonly acid: readonly GroundTile[];
  /** Suelo roto bajo los escombros. */
  readonly broken: readonly GroundTile[];
  /** Lago de hielo que deja la nevera; null si no cargó. */
  readonly ice: GroundTile | null;
  /** Objetos sueltos que van encima de la arena, en el orden de `PROP_LIST`; null si no cargó o es de otro acto. */
  readonly props: readonly (Prop | null)[];
}

/** Carga las texturas de los objetos del acto; las que fallen quedan a null (el obstáculo sigue estando). */
function loadProps(act: ActId): Promise<(Prop | null)[]> {
  return Promise.all(
    PROP_LIST.map(async (p, k) => {
      if ((p.act ?? 1) !== act && !RUBBLE_PROPS.includes(k)) return null;
      try {
        return { tex: await Assets.load<Texture>(TILES.propsDir + p.file), ax: p.ax, ay: p.ay };
      } catch {
        return null;
      }
    }),
  );
}

/** Carga `tiles.json` y las texturas del acto; las que fallen se saltan. */
export async function loadGroundTiles(act: ActId): Promise<GroundTiles> {
  const index = await Assets.load<TileIndex>(TILES.index);
  const load = async (set: readonly TileInfo[], weights?: readonly number[]): Promise<GroundTile[]> => {
    const out = await Promise.all(
      set.map(async (t, i) => {
        try {
          const [tex, top] = await Promise.all([
            Assets.load<Texture>(TILES.dir + t.file),
            t.top ? Assets.load<Texture>(TILES.dir + t.top) : Promise.resolve(null),
          ]);
          return { tex, top, head: t.head, acid: t.acid ?? 0, weight: weights?.[i] ?? 1 };
        } catch {
          return null;
        }
      }),
    );
    return out.filter((t) => t !== null && t.weight > 0) as GroundTile[];
  };
  const [props, broken, sand, frost, ...decoSets] = await Promise.all([
    loadProps(act),
    load(index.sets[TILES.broken] ?? []),
    load(index.sets[TILES.acts[act].sand] ?? [], TILES.acts[act].weights),
    load(index.sets[TILES.iceLake] ?? []),
    ...TILES.deco.map((name) => load(index.sets[name] ?? [])),
  ]);
  const deco = decoSets.flat();
  return {
    sand: (sand ?? []).filter((t) => t.acid === 0),
    deco: deco.filter((t) => t.acid === 0),
    acid: [...(sand ?? []), ...deco].filter((t) => t.acid > 0).sort((x, y) => x.acid - y.acid),
    broken: broken ?? [],
    // El lago más pequeño del bioma de hielo: lo que deja la nevera, en cualquier acto.
    ice: frost?.filter((t) => t.acid > 0).sort((x, y) => x.acid - y.acid)[0] ?? null,
    props,
  };
}
