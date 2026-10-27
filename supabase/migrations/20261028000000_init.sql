-- Atomic Ash · Fase 4: cuentas, guardado en la nube, ranking y moderación básica (05_TECH.md §8).
-- Las cuentas son de Supabase Auth: invitado anónimo que luego vincula Google (mismo user id, no se pierde nada).

-- ---------- perfiles (apodo público) ----------
create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  nickname text not null unique
    check (char_length(nickname) between 3 and 16 and nickname ~ '^[[:alnum:]_ -]+$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
create policy "perfiles visibles" on public.profiles for select using (true);
create policy "crear mi perfil" on public.profiles for insert with check (auth.uid() = user_id);
create policy "editar mi perfil" on public.profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- guardado en la nube (JSON + versión) ----------
create table public.saves (
  user_id uuid primary key references auth.users (id) on delete cascade,
  version int not null,
  data jsonb not null check (pg_column_size(data) < 200000),
  updated_at timestamptz not null default now()
);

alter table public.saves enable row level security;
create policy "leer mi partida" on public.saves for select using (auth.uid() = user_id);
create policy "crear mi partida" on public.saves for insert with check (auth.uid() = user_id);
create policy "subir mi partida" on public.saves for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- ranking ----------
create table public.leaderboard_runs (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  nickname text not null,
  char_id text not null,
  time_sec int not null check (time_sec between 0 and 1500),
  kills int not null check (kills >= 0),
  boss_dmg int not null check (boss_dmg between 0 and 30000),
  bosses int not null check (bosses between 0 and 3),
  level int not null check (level >= 1),
  won boolean not null,
  seed bigint not null,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);

create index leaderboard_time on public.leaderboard_runs (time_sec desc, kills desc) where not hidden;
create index leaderboard_boss on public.leaderboard_runs (boss_dmg desc, time_sec asc) where not hidden;
create index leaderboard_user on public.leaderboard_runs (user_id, created_at desc);

alter table public.leaderboard_runs enable row level security;
-- Lectura pública de lo no oculto. Nadie inserta desde el cliente: solo la Edge Function `submit-run`
-- con la service role (que se salta RLS) después de validar la run.
create policy "ranking visible" on public.leaderboard_runs for select using (not hidden);

-- Mejor marca de cada jugador por ranking (lo que muestra el juego).
create view public.leaderboard_time with (security_invoker = true) as
  select distinct on (user_id) id, nickname, char_id, time_sec, kills, won, created_at
  from public.leaderboard_runs where not hidden
  order by user_id, time_sec desc, kills desc;

create view public.leaderboard_boss with (security_invoker = true) as
  select distinct on (user_id) id, nickname, char_id, boss_dmg, time_sec, created_at
  from public.leaderboard_runs where not hidden and boss_dmg > 0
  order by user_id, boss_dmg desc, time_sec asc;

-- ---------- moderación: reportes ----------
create table public.reports (
  id bigint generated always as identity primary key,
  run_id bigint not null references public.leaderboard_runs (id) on delete cascade,
  reporter uuid not null references auth.users (id) on delete cascade default auth.uid(),
  reason text not null check (reason in ('nickname', 'cheat', 'other')),
  created_at timestamptz not null default now(),
  unique (run_id, reporter)
);

alter table public.reports enable row level security;
create policy "reportar" on public.reports for insert with check (auth.uid() = reporter);

-- Tres reportes de personas distintas ocultan la entrada hasta que un moderador la revise
-- (en el panel de Supabase: `update leaderboard_runs set hidden = false where id = …`).
create function public.hide_reported() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update leaderboard_runs set hidden = true
  where id = new.run_id and (select count(*) from reports where run_id = new.run_id) >= 3;
  return new;
end $$;

create trigger reports_hide after insert on public.reports
  for each row execute function public.hide_reported();
