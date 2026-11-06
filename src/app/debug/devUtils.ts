// Utilidades puras del depurador (solo desarrollo): parámetros de URL, build inicial, edición de valores por ruta,
// filtros del árbol y acciones sobre el mundo. Sin React ni DOM, para poder probarlas sin navegador.
// DECISIÓN: el depurador está exento de i18n (solo existe en desarrollo), así que los textos van en castellano.
import { isActId, type ActId } from '../../config/acts';
import { PLAYER } from '../../config/run';
import { ROSTER, type StatSurvivorId } from '../../config/survivors';
import { WEAPON_IDS, type WeaponId } from '../../config/weapons';
import type { StatEnemyId } from '../../config/enemies';
import type { World } from '../../engine/types';
import { spawnEnemy } from '../../engine/systems/enemies';
import { createWeapon } from '../../engine/systems/weapons';
import type { WorldOptions } from '../../engine/world';
import type { BotKind } from '../../sim/sim';

export const BOT_KINDS: readonly BotKind[] = ['kite', 'circle', 'line', 'still'];
export const SPEED_MIN = 0.25;
export const SPEED_MAX = 4;

export interface BuildItem {
  id: WeaponId;
  lvl: number;
}

export interface DevParams {
  char: StatSurvivorId;
  act: ActId;
  /** null = aleatoria. */
  seed: number | null;
  build: BuildItem[];
  god: boolean;
  speed: number;
  bot: BotKind | null;
  panel: boolean;
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

const isWeaponId = (s: string): s is WeaponId => (WEAPON_IDS as readonly string[]).includes(s);

/** Semilla aleatoria, del mismo rango que la del juego normal. */
export const randomSeed = (rand: () => number = Math.random): number => (rand() * 2 ** 31) | 0;

/** Texto → semilla entera, o null si no es un número. */
export function parseSeed(text: string | null | undefined): number | null {
  if (text === null || text === undefined || text.trim() === '') return null;
  const n = Number(text);
  return Number.isFinite(n) ? Math.trunc(n) | 0 : null;
}

/** Velocidad dentro de 0,25×–4×; lo no numérico da 1. */
export function clampSpeed(v: number): number {
  return Number.isFinite(v) ? clamp(v, SPEED_MIN, SPEED_MAX) : 1;
}

/**
 * Build `llave:3,tesla:2`: armas con su nivel (1 por defecto, hasta el máximo del juego). Ignora ids desconocidos y
 * repetidos; lo ignorado se devuelve aparte para avisar en el panel.
 */
export function parseBuild(text: string | null | undefined): { items: BuildItem[]; ignored: string[] } {
  const items: BuildItem[] = [];
  const ignored: string[] = [];
  for (const raw of (text ?? '').split(',')) {
    const part = raw.trim();
    if (!part) continue;
    const [id = '', lv] = part.split(':').map((x) => x.trim());
    const lvl = lv === undefined || lv === '' ? 1 : Number(lv);
    if (!isWeaponId(id) || !Number.isFinite(lvl) || items.some((b) => b.id === id)) {
      ignored.push(part);
      continue;
    }
    items.push({ id, lvl: clamp(Math.round(lvl), 1, PLAYER.maxWeaponLevel) });
  }
  return { items, ignored };
}

export const formatBuild = (items: readonly BuildItem[]): string =>
  items.map((b) => `${b.id}:${b.lvl}`).join(',');

const isOn = (v: string | null): boolean => v === '1' || v === 'true';

/** Estado inicial desde la URL (`?dev&char=gus&act=2&seed=7&weapons=llave:3,tesla:2&god=1&speed=2&bot=kite&panel=0`). */
export function parseDevParams(search: string): DevParams {
  const q = new URLSearchParams(search);
  const char = q.get('char');
  const bot = q.get('bot');
  const speed = q.get('speed');
  const act = Number(q.get('act'));
  return {
    char: (ROSTER as readonly string[]).includes(char ?? '') ? (char as StatSurvivorId) : ROSTER[0],
    act: isActId(act) ? act : 1,
    seed: parseSeed(q.get('seed')),
    build: parseBuild(q.get('weapons')).items,
    god: isOn(q.get('god')),
    speed: speed === null ? 1 : clampSpeed(Number(speed)),
    bot: (BOT_KINDS as readonly string[]).includes(bot ?? '') ? (bot as BotKind) : null,
    panel: q.get('panel') !== '0',
  };
}

/** La primera arma de la build sustituye a la inicial; sin build no se toca nada. */
export const buildWorldOptions = (build: readonly BuildItem[]): WorldOptions | undefined =>
  build.length ? { startWeapon: build[0]!.id } : undefined;

/** Completa la build en un mundo recién creado: nivel de la primera arma y el resto añadidas con `createWeapon`. */
export function applyBuild(w: World, build: readonly BuildItem[]): void {
  build.forEach((b, i) => {
    const first = w.weapons[0];
    if (i === 0 && first && first.id === b.id) first.lvl = b.lvl;
    else if (!w.weapons.some((x) => x.id === b.id)) w.weapons.push(createWeapon(b.id, b.lvl, w.time));
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Edición de valores por ruta

export type Path = readonly (string | number)[];
type Rec = Record<string, unknown>;

export const pathKey = (p: Path): string => p.join('.');

export const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Valor en `path`, o undefined si no existe. */
export function getAt(root: unknown, path: Path): unknown {
  let cur = root;
  for (const k of path) {
    if (Array.isArray(cur)) cur = cur[Number(k)];
    else if (isRec(cur)) cur = cur[String(k)];
    else return undefined;
  }
  return cur;
}

function setIn(target: unknown, path: Path, value: unknown): void {
  let cur = target;
  for (let i = 0; i < path.length - 1; i++) {
    cur = Array.isArray(cur) ? cur[Number(path[i])] : isRec(cur) ? cur[String(path[i])] : undefined;
  }
  const last = path[path.length - 1]!;
  if (Array.isArray(cur)) cur[Number(last)] = value;
  else if (isRec(cur)) cur[String(last)] = value;
  else throw new Error(`Ruta inválida: ${pathKey(path)}`);
}

/**
 * Parche para `applyTuning` que cambia solo `path`. Las listas viajan enteras (así las sustituye `applyTuning`):
 * se clona la lista, se edita el elemento y se devuelve en su lugar. No modifica `root`.
 */
export function makePatch(root: unknown, path: Path, value: unknown): Rec {
  if (path.length === 0) throw new Error('Ruta vacía');
  const [head, ...rest] = path as [string | number, ...(string | number)[]];
  const key = String(head);
  if (rest.length === 0) return { [key]: value };
  const cur = isRec(root) ? root[key] : undefined;
  if (Array.isArray(cur)) {
    const copy = structuredClone(cur);
    setIn(copy, rest, value);
    return { [key]: copy };
  }
  if (!isRec(cur)) throw new Error(`Ruta inválida: ${pathKey(path)}`);
  return { [key]: makePatch(cur, rest, value) };
}

/** Todos los términos (separados por espacios) deben aparecer en la ruta. Sin filtro, todo cuadra. */
export function matchesFilter(path: Path, query: string): boolean {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return true;
  const key = pathKey(path).toLowerCase();
  return terms.every((t) => key.includes(t));
}

/** ¿Hay alguna hoja bajo `path` que cuadre con el filtro? (para podar el árbol). */
export function subtreeMatches(value: unknown, path: Path, query: string): boolean {
  if (Array.isArray(value)) return value.some((v, i) => subtreeMatches(v, [...path, i], query));
  if (isRec(value)) return Object.entries(value).some(([k, v]) => subtreeMatches(v, [...path, k], query));
  return matchesFilter(path, query);
}

/** Texto de un campo JSON → valor, o `undefined` si no es JSON válido. */
export function parseJsonField(text: string): { value: unknown } | undefined {
  try {
    return { value: JSON.parse(text) as unknown };
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Acciones sobre el mundo

/** Como la tecla J: `n` enemigos de `type` entre 350 y 600 px alrededor del jugador. */
export function spawnAround(w: World, type: StatEnemyId, n: number, rand: () => number = Math.random): void {
  const p = w.player;
  for (let i = 0; i < n; i++) {
    const a = rand() * Math.PI * 2;
    const d = 350 + rand() * 250;
    spawnEnemy(w, type, p.x + Math.cos(a) * d, p.y + Math.sin(a) * d);
  }
}

export interface DevStatus {
  time: number;
  level: number;
  alive: number;
  hp: number;
  maxHp: number;
}

export function devStatus(w: World): DevStatus {
  let alive = 0;
  for (let i = 0; i < w.enemies.count; i++) if (!w.enemies.items[i]!.dead) alive++;
  return { time: w.time, level: w.level, alive, hp: Math.max(0, w.player.hp), maxHp: w.player.maxHp };
}

export function formatStatus(s: DevStatus): string {
  const m = Math.floor(s.time / 60);
  const sec = Math.floor(s.time % 60);
  const clock = `${m}:${String(sec).padStart(2, '0')}`;
  return `${clock} · nivel ${s.level} · ${s.alive} enemigos · PV ${Math.round(s.hp)}/${Math.round(s.maxHp)}`;
}
