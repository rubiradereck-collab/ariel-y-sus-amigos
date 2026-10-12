-- =====================================================================
-- CASINO LOBBY: FAVORITOS, RECIENTES Y JUEGO DICE (PROVABLY FAIR)
-- =====================================================================

-- 1. TABLA DE FAVORITOS
create table if not exists public.game_favorites (
  user_id uuid references auth.users(id) on delete cascade,
  game_slug text not null,
  created_at timestamptz default now(),
  primary key (user_id, game_slug)
);

alter table public.game_favorites enable row level security;

do $$ begin
  create policy "fav_own_all" on public.game_favorites for all to authenticated
    using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;

-- 2. TABLA DE REGISTRO HISTÓRICO DE CASINO SI NO EXISTE
create table if not exists public.casino_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  game text not null,
  bet bigint not null,
  payout bigint not null default 0,
  multiplier numeric not null default 0,
  details jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

alter table public.casino_log enable row level security;

do $$ begin
  create policy "casino_log_select_own" on public.casino_log
    for select to authenticated using (user_id = auth.uid());
exception when duplicate_object then null; end $$;

-- 3. JUEGO INSTANTÁNEO DICE (DADOS CON PROVABLY FAIR)
create or replace function public.casino_dice_roll(
  p_bet bigint,
  p_target int,
  p_mode text -- 'over' | 'under'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_roll int;
  v_win boolean := false;
  v_mult numeric;
  v_payout bigint := 0;
  v_server_seed text;
  v_client_hash text;
  v_new_bal bigint;
begin
  if v_uid is null then
    return jsonb_build_object('success', false, 'message', 'not_authenticated');
  end if;

  if p_bet <= 0 then
    return jsonb_build_object('success', false, 'message', 'invalid_bet');
  end if;

  if p_target < 2 or p_target > 98 then
    return jsonb_build_object('success', false, 'message', 'target_out_of_range');
  end if;

  -- Débito atómico
  perform public._wallet_debit(v_uid, p_bet);

  -- Semilla y Provably Fair Hash
  v_server_seed := encode(gen_random_bytes(16), 'hex');
  v_client_hash := encode(digest(v_server_seed, 'sha256'), 'hex');

  -- Tirada aleatoria del 1 al 100
  v_roll := (public._secure_int(100)) + 1;

  if p_mode = 'over' then
    v_win := (v_roll > p_target);
    v_mult := round(99.0 / (100.0 - p_target), 4);
  else
    v_win := (v_roll < p_target);
    v_mult := round(99.0 / p_target::numeric, 4);
  end if;

  if v_win then
    v_payout := floor(p_bet * v_mult)::bigint;
    v_new_bal := public._wallet_credit(v_uid, v_payout);
  else
    select coins into v_new_bal from public.user_stats where user_id = v_uid;
  end if;

  -- Registrar en log de casino
  insert into public.casino_log (user_id, game, bet, payout, multiplier, details)
  values (v_uid, 'dice', p_bet, v_payout, v_mult, jsonb_build_object(
    'target', p_target,
    'mode', p_mode,
    'roll', v_roll,
    'win', v_win,
    'server_seed', v_server_seed,
    'hash', v_client_hash
  ));

  return jsonb_build_object(
    'success', true,
    'roll', v_roll,
    'win', v_win,
    'payout', v_payout,
    'multiplier', v_mult,
    'new_coins', v_new_bal,
    'server_seed', v_server_seed,
    'hash', v_client_hash
  );
end $$;

grant execute on function public.casino_dice_roll to authenticated;
