-- Atomic Ash · rankings nuevos: «Daño total» y «Tiempo en acabar» (solo victorias, gana el más rápido),
-- cada uno diario, semanal y de siempre. Sustituyen a «Tiempo aguantado» y «Daño a jefes».

alter table public.leaderboard_runs
  add column dmg_total bigint not null default 0 check (dmg_total >= 0);

create index leaderboard_dmg on public.leaderboard_runs (created_at, dmg_total desc) where not hidden;
create index leaderboard_finish on public.leaderboard_runs (created_at, time_sec) where not hidden and won;

drop view if exists public.leaderboard_time;
drop view if exists public.leaderboard_boss;

-- Mejor marca de cada jugador en el periodo (`day` = hoy, `week` = desde el lunes, `all` = siempre; en UTC).
-- `board`: `dmg` (más daño total) o `finish` (menos tiempo en ganar). Lo llama el cliente con `rpc('leaderboard')`.
create function public.leaderboard(board text, period text, max_rows int default 50)
returns table (
  id bigint,
  nickname text,
  char_id text,
  time_sec int,
  kills int,
  dmg_total bigint,
  won boolean,
  created_at timestamptz
)
language sql stable security invoker set search_path = public as $$
  with since as (
    select case period
      when 'day' then date_trunc('day', now())
      when 'week' then date_trunc('week', now())
      else '-infinity'::timestamptz
    end as t
  ),
  best as (
    select distinct on (r.user_id) r.id, r.nickname, r.char_id, r.time_sec, r.kills, r.dmg_total, r.won, r.created_at
    from leaderboard_runs r, since
    where not r.hidden
      and r.created_at >= since.t
      and (board <> 'finish' or r.won)
      and (board <> 'dmg' or r.dmg_total > 0)
    order by r.user_id,
      case when board = 'finish' then r.time_sec end asc,
      r.dmg_total desc
  )
  select * from best
  order by
    case when board = 'finish' then time_sec end asc,
    dmg_total desc
  limit least(greatest(max_rows, 1), 100);
$$;

grant execute on function public.leaderboard(text, text, int) to anon, authenticated;
