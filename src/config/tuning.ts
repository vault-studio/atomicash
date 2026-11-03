// Valores de balance (T1): personajes, enemigos, IA, furia, élites, jefes, armas, oleadas y hordas viven en
// `src/data/tuning.json`. Los módulos de config los reexportan con sus tipos; el motor nunca lee el JSON directamente.
// DECISIÓN: el depurador (solo en desarrollo) modifica en sitio estos mismos objetos con `applyTuning`, así que los
// consumidores no cambian y el JSON exportado puede sustituir tal cual a los valores por defecto.
import raw from '../data/tuning.json';

export type Tuning = typeof raw;
export type TuningSection = keyof Tuning;

/** Los objetos de balance que leen los sistemas. Mutables solo a través de `applyTuning`. */
export const TUNING: Tuning = raw;

/** Copia intacta de los valores por defecto, para volver a ellos. */
const DEFAULTS: Tuning = structuredClone(raw);

export type DeepReadonly<T> = T extends readonly (infer U)[]
  ? readonly DeepReadonly<U>[]
  : T extends object
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : T;

/**
 * El JSON ensancha los literales (`'dron'` → `string`): `Retype` vuelve a estrechar los campos indicados en `B` y deja
 * el resto de solo lectura.
 */
export type Retype<A, B> = {
  readonly [K in keyof A]: K extends keyof B
    ? B[K] extends readonly unknown[] | string | number | boolean
      ? B[K]
      : Retype<A[K], B[K]>
    : DeepReadonly<A[K]>;
};

/** `B` aplicado a cada entrada de un diccionario (p. ej. el `kind` de cada arma). */
export type RetypeEach<A, B> = { readonly [K in keyof A]: Retype<A[K], B> };

export const tuningDefaults = (): Tuning => structuredClone(DEFAULTS);

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Copia en sitio los valores de `src` sobre `dst`: solo claves que ya existen y del mismo tipo, para que un JSON viejo
 * o mal formado no rompa la partida. Las listas (oleadas, tipos de horda) se sustituyen enteras. Devuelve las rutas
 * ignoradas.
 */
export function mergeInto(
  dst: Record<string, unknown>,
  src: unknown,
  path = '',
  skipped: string[] = [],
): string[] {
  if (!isObj(src)) {
    skipped.push(path || '(raíz)');
    return skipped;
  }
  for (const [k, v] of Object.entries(src)) {
    const p = path ? `${path}.${k}` : k;
    if (!(k in dst)) {
      skipped.push(p);
      continue;
    }
    const cur = dst[k];
    if (isObj(cur)) mergeInto(cur, v, p, skipped);
    else if (Array.isArray(cur)) {
      if (Array.isArray(v)) cur.splice(0, cur.length, ...structuredClone(v));
      else skipped.push(p);
    } else if (typeof cur === typeof v) dst[k] = v;
    else skipped.push(p);
  }
  return skipped;
}

/** Aplica un JSON de balance (completo o parcial) sobre los valores vigentes. Devuelve las rutas ignoradas. */
export function applyTuning(src: unknown): string[] {
  version++;
  return mergeInto(TUNING as unknown as Record<string, unknown>, src);
}

/** Vuelve a los valores por defecto (los del archivo). */
export function resetTuning(): void {
  applyTuning(structuredClone(DEFAULTS));
}

let version = 0;
/** Sube cada vez que cambian los valores: quien precalcule algo a partir de ellos lo rehace al verlo cambiar. */
export const tuningVersion = (): number => version;

/** Valores vigentes, listos para exportar a `tuning.json`. */
export const exportTuning = (): string => JSON.stringify(TUNING, null, 2) + '\n';
