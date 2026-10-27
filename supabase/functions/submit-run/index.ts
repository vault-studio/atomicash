// Edge Function `submit-run` (Deno): valida una run y la guarda en el ranking con la service role.
// El cliente nunca escribe en `leaderboard_runs` (RLS sin política de insert).
import { createClient } from 'npm:@supabase/supabase-js@2';
import { checkNickname, checkRun, type RunSubmission } from '../_shared/runCheck.ts';

/** Una run por usuario cada `RATE_SEC` segundos (una partida real dura minutos). */
const RATE_SEC = 60;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const service = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  // Identidad del jugador a partir de su JWT.
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer /, '');
  const { data: auth, error: authErr } = await service.auth.getUser(jwt);
  if (authErr || !auth.user) return json({ error: 'auth' }, 401);
  const userId = auth.user.id;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'json' }, 400);
  }
  const errs = checkRun(body);
  if (errs.length) return json({ error: 'invalid', details: errs }, 422);
  const run = body as RunSubmission;

  const { data: prof } = await service
    .from('profiles')
    .select('nickname')
    .eq('user_id', userId)
    .maybeSingle();
  if (!prof || checkNickname(prof.nickname)) return json({ error: 'nickname' }, 409);

  const since = new Date(Date.now() - RATE_SEC * 1000).toISOString();
  const { count } = await service
    .from('leaderboard_runs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', since);
  if ((count ?? 0) > 0) return json({ error: 'rate' }, 429);

  const { data, error } = await service
    .from('leaderboard_runs')
    .insert({
      user_id: userId,
      nickname: prof.nickname,
      char_id: run.charId,
      time_sec: run.timeSec,
      kills: run.kills,
      boss_dmg: run.bossDmg,
      bosses: run.bosses,
      level: run.level,
      won: run.won,
      seed: run.seed,
    })
    .select('id')
    .single();
  if (error) return json({ error: 'db' }, 500);
  return json({ id: data.id });
});
