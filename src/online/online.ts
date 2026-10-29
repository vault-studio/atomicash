// Capa online (Fase 4): cuentas de invitado → Google, partida en la nube, ranking y reportes con Supabase.
// Todo es opcional: sin `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` no se carga ni una línea de Supabase
// (import dinámico) y el juego sigue 100 % local.
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { checkNickname, type RunSubmission } from '../../supabase/functions/_shared/runCheck';
import type { RunResults } from '../engine/world';
import { migrate, type SaveData } from '../meta/save';

const URL = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const ONLINE_ENABLED = Boolean(URL && KEY);

let clientP: Promise<SupabaseClient> | null = null;

/** Cliente perezoso: el paquete de Supabase solo se descarga si hay configuración. */
function client(): Promise<SupabaseClient> {
  if (!ONLINE_ENABLED) return Promise.reject(new Error('offline'));
  clientP ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(URL!, KEY!, { auth: { persistSession: true, autoRefreshToken: true } }),
  );
  return clientP;
}

export interface Account {
  userId: string;
  /** Invitado anónimo (aún sin Google). */
  guest: boolean;
  email: string | null;
  nickname: string | null;
}

async function toAccount(sb: SupabaseClient, u: User): Promise<Account> {
  const { data } = await sb.from('profiles').select('nickname').eq('user_id', u.id).maybeSingle();
  return {
    userId: u.id,
    guest: u.is_anonymous ?? !u.email,
    email: u.email ?? null,
    nickname: (data?.nickname as string | undefined) ?? null,
  };
}

/** Sesión actual o, si no hay, una de invitado anónimo. */
export async function ensureAccount(): Promise<Account> {
  const sb = await client();
  const { data } = await sb.auth.getSession();
  let user = data.session?.user ?? null;
  if (!user) {
    const { data: anon, error } = await sb.auth.signInAnonymously();
    if (error || !anon.user) throw error ?? new Error('anon');
    user = anon.user;
  }
  return toAccount(sb, user);
}

/** Vincula Google a la cuenta de invitado (mismo usuario: no se pierde el progreso). Redirige a Google. */
export async function linkGoogle(): Promise<void> {
  const sb = await client();
  const { error } = await sb.auth.linkIdentity({
    provider: 'google',
    options: { redirectTo: window.location.origin + window.location.pathname },
  });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  const sb = await client();
  await sb.auth.signOut();
}

export type NickError = 'type' | 'format' | 'blocked' | 'taken' | 'error';

export async function setNickname(userId: string, nick: string): Promise<NickError | null> {
  const bad = checkNickname(nick);
  if (bad) return bad as NickError;
  const sb = await client();
  const { error } = await sb
    .from('profiles')
    .upsert({ user_id: userId, nickname: nick.trim(), updated_at: new Date().toISOString() });
  if (!error) return null;
  return error.code === '23505' ? 'taken' : 'error';
}

// ---------- partida en la nube ----------

export interface CloudSave {
  data: SaveData;
  updatedAt: string;
}

export async function uploadSave(userId: string, s: SaveData): Promise<string> {
  const sb = await client();
  const updatedAt = new Date().toISOString();
  const { error } = await sb
    .from('saves')
    .upsert({ user_id: userId, version: s.version, data: s, updated_at: updatedAt });
  if (error) throw error;
  return updatedAt;
}

export async function downloadSave(userId: string): Promise<CloudSave | null> {
  const sb = await client();
  const { data, error } = await sb
    .from('saves')
    .select('data, version, updated_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  // Lo que venga de la nube pasa por la misma migración que lo local.
  return { data: migrate(data.data, data.version as number), updatedAt: data.updated_at as string };
}

// ---------- ranking ----------

export function toSubmission(r: RunResults): RunSubmission {
  return {
    charId: r.charId,
    timeSec: Math.floor(r.endless ? r.winTime : r.time),
    kills: r.kills,
    bossDmg: r.bossDmg,
    dmgTotal: r.dmg,
    bosses: r.bosses,
    level: r.level,
    won: r.won,
    seed: r.seed | 0,
    daily: r.daily,
    // En infinito, el ranking «Tiempo en acabar» mira lo que tardó en ganar; el resto va aparte.
    endlessSec: r.endless ? Math.floor(r.time - r.winTime) : 0,
  };
}

export async function submitRun(sub: RunSubmission): Promise<boolean> {
  const sb = await client();
  const { error } = await sb.functions.invoke('submit-run', { body: sub });
  return !error;
}

/**
 * `dmg`: más daño total; `finish`: menos tiempo en acabar la partida (solo victorias); `daily`: reto diario de hoy
 * (más daño total, sin periodo).
 */
export type BoardKind = 'dmg' | 'finish' | 'daily';
/** Hoy, esta semana (desde el lunes) o siempre; en UTC. */
export type BoardPeriod = 'day' | 'week' | 'all';

export interface BoardRow {
  id: number;
  nickname: string;
  charId: string;
  timeSec: number;
  kills: number;
  dmgTotal: number;
  won: boolean;
}

/** Mejor marca de cada jugador en el ranking y periodo pedidos (función `leaderboard` de la base de datos). */
export async function fetchBoard(kind: BoardKind, period: BoardPeriod, limit = 50): Promise<BoardRow[]> {
  const sb = await client();
  const { data, error } = await sb.rpc('leaderboard', { board: kind, period, max_rows: limit });
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: r.id as number,
    nickname: r.nickname as string,
    charId: r.char_id as string,
    timeSec: r.time_sec as number,
    kills: r.kills as number,
    dmgTotal: Number(r.dmg_total),
    won: r.won as boolean,
  }));
}

export type ReportReason = 'nickname' | 'cheat' | 'other';

export async function reportRun(runId: number, reason: ReportReason): Promise<boolean> {
  const sb = await client();
  const { error } = await sb.from('reports').insert({ run_id: runId, reason });
  // 23505: ya lo habías reportado; cuenta como hecho.
  return !error || error.code === '23505';
}
