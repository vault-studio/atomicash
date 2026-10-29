-- Atomic Ash · reto diario con ranking propio y modo infinito tras el Coloso (dossier §14 y §17).
-- `daily`: día UTC del reto (null en una partida normal). `endless_sec`: segundos jugados en infinito tras ganar
-- (`time_sec` sigue siendo lo que tardó en ganar, para «Tiempo en acabar»).

alter table public.leaderboard_runs
  add column daily text check (daily is null or daily ~ '^\d{4}-\d{2}-\d{2}$'),
  add column endless_sec int not null default 0 check (endless_sec >= 0);

create index leaderboard_daily on public.leaderboard_runs (daily, dmg_total desc) where not hidden and daily is not null;

-- `board`: `dmg`, `finish` o `daily`. Los retos diarios solo cuentan en `daily` (sin las mejoras del Búnker no se
-- comparan con las partidas normales), y `daily` solo mira el reto de hoy (UTC), sin periodo.
create or replace function public.leaderboard(board text, period text, max_rows int default 50)
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
      and (
        (board = 'daily' and r.daily = to_char(now() at time zone 'utc', 'YYYY-MM-DD'))
        or (board <> 'daily' and r.daily is null and r.created_at >= since.t)
      )
      and (board <> 'finish' or r.won)
      and (board = 'finish' or r.dmg_total > 0)
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
