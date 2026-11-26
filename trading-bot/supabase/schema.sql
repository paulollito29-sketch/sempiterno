-- =====================================================================================
-- cryptobot · esquema de Supabase (Postgres) para el panel web
-- Crea un proyecto NUEVO (no el de sempiterno), abre SQL Editor y ejecuta este archivo.
-- Luego registra tu usuario (Authentication → Users) y corre al final:
--   insert into public.app_owners (user_id) values ('<tu-user-id>');
-- El motor escribe con la clave de servicio (service_role, solo en el servidor).
-- El panel lee con la clave anónima + RLS: solo los dueños registrados ven y cambian datos,
-- y si activaste la verificación en dos pasos (MFA), se exige en cada sesión.
-- =====================================================================================

create extension if not exists pgcrypto;

-- ---------- dueños del panel
create table if not exists public.app_owners (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.app_owners o where o.user_id = auth.uid());
$$;

-- MFA: si el usuario tiene un factor verificado, la sesión debe ser aal2.
create or replace function public.mfa_ok() returns boolean
language sql stable security definer set search_path = public, auth as $$
  select case
    when exists (select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified')
      then coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
    else true
  end;
$$;

-- ---------- configuración y estado
create table if not exists public.bot_config (
  id int primary key default 1 check (id = 1),
  watchlist jsonb not null default '["BTCUSDT","ETHUSDT","SOLUSDT"]',
  mode text not null default 'manual' check (mode in ('manual','paper','semi_auto_api','auto_api')),
  cost_profile text not null default 'lemon',
  capital_usd numeric not null default 1000,
  risk jsonb not null default '{}',
  summary_hour_utc int not null default 12,
  paused boolean not null default false,
  updated_at timestamptz default now()
);

create table if not exists public.config_audit (
  id bigint generated always as identity primary key,
  ts timestamptz not null default now(),
  changed_by uuid,
  old_row jsonb,
  new_row jsonb
);

create or replace function public.audit_config() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.config_audit (changed_by, old_row, new_row)
  values (auth.uid(), to_jsonb(old), to_jsonb(new));
  return new;
end;
$$;

drop trigger if exists trg_audit_config on public.bot_config;
create trigger trg_audit_config after insert or update on public.bot_config
for each row execute function public.audit_config();

create table if not exists public.bot_state (
  id int primary key default 1 check (id = 1),
  data jsonb not null default '{}',
  updated_at timestamptz default now()
);

-- ---------- comandos del panel → motor (pausa, kill, ejecuciones, cartera, config)
create table if not exists public.bot_commands (
  id text primary key default gen_random_uuid()::text,
  created_at timestamptz not null default now(),
  command text not null check (command in (
    'pause','resume','kill','mark_executed','mark_skipped','set_capital',
    'set_holding','remove_holding','update_config','run_cycle')),
  payload jsonb not null default '{}',
  status text not null default 'pending' check (status in ('pending','done','error')),
  processed_at timestamptz,
  result text
);
create index if not exists bot_commands_status_idx on public.bot_commands (status, created_at);

-- ---------- ciclos de 20 minutos
create table if not exists public.cycles (
  id text primary key,
  ts timestamptz,
  decision_time timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  status text,
  mode text,
  equity numeric,
  symbols jsonb,
  ranking jsonb,
  new_recommendations jsonb,
  model_version text,
  approved_model boolean,
  defensive text,
  warnings jsonb
);
create index if not exists cycles_ts_idx on public.cycles (ts desc);

-- ---------- recomendaciones
create table if not exists public.recommendations (
  id text primary key,
  symbol text not null,
  action text not null,
  cycle_ts timestamptz,
  ref_price numeric,
  created_at timestamptz not null,
  status text not null,
  mode text,
  entry_max_price numeric,
  size_frac numeric,
  size_usd numeric,
  qty numeric,
  stop_price numeric,
  target_price numeric,
  stop_pct numeric,
  target_pct numeric,
  horizon_end timestamptz,
  probability numeric,
  threshold numeric,
  base_rate numeric,
  expected_return numeric,
  sigma_d numeric,
  regime text,
  reason_code text,
  reasons jsonb,
  expires_at timestamptz,
  executed_at timestamptz,
  executed_price numeric,
  executed_qty numeric,
  outcome_status text,
  outcome_return numeric,
  outcome_reason text,
  closed_at timestamptz,
  model_version text,
  approved_model boolean,
  message text
);
create index if not exists recommendations_created_idx on public.recommendations (created_at desc);
create index if not exists recommendations_status_idx on public.recommendations (status);

-- ---------- cartera y operaciones cerradas (exportables para impuestos)
create table if not exists public.holdings (
  symbol text primary key,
  qty numeric not null,
  avg_price numeric not null,
  cost_usd numeric not null,
  opened_at timestamptz,
  stop_price numeric,
  target_price numeric,
  horizon_end timestamptz,
  rec_id text,
  reduced boolean default false,
  stop_alerted boolean default false,
  target_alerted boolean default false,
  source text,
  updated_at timestamptz
);

create table if not exists public.trades (
  id text primary key,
  symbol text not null,
  opened_at timestamptz,
  closed_at timestamptz,
  qty numeric,
  entry_price numeric,
  exit_price numeric,
  pnl_usd numeric,
  pnl_pct numeric,
  reason text,
  mode text,
  rec_open text,
  rec_close text
);

create table if not exists public.equity_snapshots (
  ts timestamptz primary key,
  equity numeric,
  cash numeric,
  exposure numeric,
  drawdown numeric,
  mode text
);

-- ---------- datos para gráficos
create table if not exists public.market_bars (
  id text primary key,          -- SYMBOL|ts
  symbol text not null,
  ts timestamptz not null,
  open numeric, high numeric, low numeric, close numeric, volume numeric,
  regime text,
  p_stress numeric,
  trend_vote numeric
);
create index if not exists market_bars_symbol_ts_idx on public.market_bars (symbol, ts desc);

create table if not exists public.events (
  id text primary key,
  ts timestamptz not null,
  level text,
  kind text,
  symbol text,
  message text,
  data jsonb
);
create index if not exists events_ts_idx on public.events (ts desc);

create table if not exists public.heartbeats (
  component text primary key,
  ts timestamptz not null,
  info jsonb
);

-- ---------- investigación y modelos
create table if not exists public.backtests (
  id text primary key,
  created_at timestamptz,
  profile text,
  period jsonb,
  selected jsonb,
  baselines jsonb,
  statistics jsonb,
  gate jsonb,
  champion text,
  curves jsonb,
  calibration jsonb,
  symbols jsonb
);

create table if not exists public.models (
  version text primary key,
  created_at timestamptz,
  status text,
  uses_meta boolean,
  cost_profile text,
  gate jsonb,
  oos_metrics jsonb,
  feature_importance jsonb,
  params jsonb,
  n_events int,
  train_start text,
  train_end text,
  notes text
);

-- =====================================================================================
-- RLS: el panel solo ve y cambia datos si eres dueño (y MFA si la activaste).
-- La clave de servicio del motor ignora RLS.
-- =====================================================================================
do $$
declare t text;
begin
  foreach t in array array['bot_config','bot_state','bot_commands','cycles','recommendations','holdings',
                           'trades','equity_snapshots','market_bars','events','heartbeats','backtests',
                           'models','config_audit','app_owners']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists owner_read on public.%I', t);
    execute format('create policy owner_read on public.%I for select to authenticated using (public.is_owner() and public.mfa_ok())', t);
  end loop;
end $$;

-- Escrituras permitidas desde el panel: solo comandos y la configuración.
drop policy if exists owner_insert_commands on public.bot_commands;
create policy owner_insert_commands on public.bot_commands for insert to authenticated
  with check (public.is_owner() and public.mfa_ok() and status = 'pending');

drop policy if exists owner_update_config on public.bot_config;
create policy owner_update_config on public.bot_config for update to authenticated
  using (public.is_owner() and public.mfa_ok())
  with check (public.is_owner() and public.mfa_ok() and mode in ('manual','paper'));
-- (Pasar a modo API se hace con el comando update_config, que el motor valida.)

-- ---------- tiempo real para el panel
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;
alter publication supabase_realtime add table public.recommendations, public.cycles, public.holdings,
  public.events, public.bot_commands, public.heartbeats;

insert into public.bot_config (id) values (1) on conflict (id) do nothing;
insert into public.bot_state (id) values (1) on conflict (id) do nothing;
