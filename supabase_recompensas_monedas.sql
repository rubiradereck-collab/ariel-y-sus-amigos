-- =====================================================================
-- SISTEMA INTEGRAL DE RECOMPENSAS Y ECONOMÍA DE MONEDAS
-- =====================================================================
-- 1. Bono Diario con Racha (Daily Claim)
-- 2. Fondo de Rescate por Bancarrota (Casino Faucet)
-- 3. Bono por Subir de Nivel (Level-Up Bonus: Nivel * 100 🪙)
-- 4. Monedas por Interacción Social (Chat + Likes en el Muro)
-- 5. Ruleta de la Suerte Diaria Gratuita (Daily Lucky Wheel)
-- =====================================================================

create extension if not exists pgcrypto;

-- 1. TABLA DE SEGUIMIENTO DE RECOMPENSAS
create table if not exists public.user_coin_rewards (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  last_daily_claim timestamptz,
  daily_streak int not null default 0,
  last_bankruptcy_claim timestamptz,
  last_wheel_spin timestamptz,
  last_chat_coin timestamptz,
  chat_coins_today int not null default 0,
  chat_coins_date date not null default current_date
);

alter table public.user_coin_rewards enable row level security;

do $$ begin
  create policy "rewards_select_own" on public.user_coin_rewards
    for select to authenticated using (user_id = auth.uid());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "rewards_update_own" on public.user_coin_rewards
    for update to authenticated using (user_id = auth.uid());
exception when duplicate_object then null; end $$;

-- Helper privado para inicializar/bloquear fila de recompensas
create or replace function public._get_or_create_coin_rewards(p_uid uuid)
returns public.user_coin_rewards
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.user_coin_rewards;
begin
  insert into public.user_coin_rewards (user_id)
  values (p_uid)
  on conflict (user_id) do nothing;

  select * into r from public.user_coin_rewards where user_id = p_uid for update;
  return r;
end $$;

-- 2. ESTADO GLOBAL DE RECOMPENSAS (RPC PARA EL FRONTEND)
create or replace function public.get_rewards_status()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_r public.user_coin_rewards;
  v_coins bigint := 0;
  v_xp bigint := 0;
  v_level int := 1;
  v_daily_avail boolean := true;
  v_daily_rem int := 0;
  v_wheel_avail boolean := true;
  v_wheel_rem int := 0;
  v_bank_avail boolean := false;
  v_bank_rem int := 0;
  v_next_streak int := 1;
begin
  if v_uid is null then
    return jsonb_build_object('success', false, 'message', 'not_authenticated');
  end if;

  v_r := public._get_or_create_coin_rewards(v_uid);

  select coalesce(coins, 0), coalesce(xp, 0), coalesce(level, 1)
  into v_coins, v_xp, v_level
  from public.user_stats
  where user_id = v_uid;

  -- Bono diario (20 horas de cooldown)
  if v_r.last_daily_claim is not null and v_r.last_daily_claim > (now() - interval '20 hours') then
    v_daily_avail := false;
    v_daily_rem := greatest(0, extract(epoch from ((v_r.last_daily_claim + interval '20 hours') - now()))::int);
  end if;

  -- Calcular racha siguiente
  if v_r.last_daily_claim is not null and v_r.last_daily_claim > (now() - interval '48 hours') then
    v_next_streak := least(7, v_r.daily_streak + 1);
  else
    v_next_streak := 1;
  end if;

  -- Ruleta diaria (20 horas de cooldown)
  if v_r.last_wheel_spin is not null and v_r.last_wheel_spin > (now() - interval '20 hours') then
    v_wheel_avail := false;
    v_wheel_rem := greatest(0, extract(epoch from ((v_r.last_wheel_spin + interval '20 hours') - now()))::int);
  end if;

  -- Auxilio de bancarrota (coins < 20 y 1 hora de cooldown)
  if v_coins < 20 then
    if v_r.last_bankruptcy_claim is null or v_r.last_bankruptcy_claim <= (now() - interval '1 hour') then
      v_bank_avail := true;
    else
      v_bank_rem := greatest(0, extract(epoch from ((v_r.last_bankruptcy_claim + interval '1 hour') - now()))::int);
    end if;
  else
    v_bank_avail := false;
  end if;

  return jsonb_build_object(
    'coins', v_coins,
    'xp', v_xp,
    'level', v_level,
    'daily_available', v_daily_avail,
    'daily_remaining_seconds', v_daily_rem,
    'daily_streak', coalesce(v_r.daily_streak, 0),
    'daily_next_reward', 150 + (v_next_streak * 25),
    'wheel_available', v_wheel_avail,
    'wheel_remaining_seconds', v_wheel_rem,
    'bankruptcy_eligible', v_coins < 20,
    'bankruptcy_available', v_bank_avail,
    'bankruptcy_remaining_seconds', v_bank_rem,
    'chat_coins_today', case when v_r.chat_coins_date = current_date then v_r.chat_coins_today else 0 end
  );
end $$;

-- 3. RECLAMAR BONO DIARIO CON RACHA
create or replace function public.claim_daily_coins()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_r public.user_coin_rewards;
  v_streak int := 1;
  v_reward_coins bigint := 175;
  v_reward_xp bigint := 50;
  v_new_coins bigint;
begin
  if v_uid is null then
    return jsonb_build_object('success', false, 'message', 'not_authenticated');
  end if;

  v_r := public._get_or_create_coin_rewards(v_uid);

  if v_r.last_daily_claim is not null and v_r.last_daily_claim > (now() - interval '20 hours') then
    return jsonb_build_object(
      'success', false,
      'reason', 'cooldown',
      'remaining_seconds', greatest(0, extract(epoch from ((v_r.last_daily_claim + interval '20 hours') - now()))::int),
      'message', 'Ya reclamaste tu sueldo de hoy. Vuelve en unas horas.'
    );
  end if;

  if v_r.last_daily_claim is not null and v_r.last_daily_claim > (now() - interval '48 hours') then
    v_streak := least(7, v_r.daily_streak + 1);
  else
    v_streak := 1;
  end if;

  v_reward_coins := 150 + (v_streak * 25);

  -- Actualizar racha y timestamp
  update public.user_coin_rewards
  set last_daily_claim = now(),
      daily_streak = v_streak
  where user_id = v_uid;

  -- Abonar monedas y XP
  update public.user_stats
  set coins = coins + v_reward_coins,
      xp = xp + v_reward_xp,
      lifetime_xp = lifetime_xp + v_reward_xp,
      level = floor(sqrt((lifetime_xp + v_reward_xp) / 25.0))::int + 1,
      updated_at = now()
  where user_id = v_uid
  returning coins into v_new_coins;

  return jsonb_build_object(
    'success', true,
    'coins_awarded', v_reward_coins,
    'xp_awarded', v_reward_xp,
    'streak', v_streak,
    'new_coins', v_new_coins,
    'message', '¡Has recibido ' || v_reward_coins || ' 🪙 y ' || v_reward_xp || ' XP con tu racha de ' || v_streak || ' días!'
  );
end $$;

-- 4. AUXILIO DE BANCARROTA (CASINO FAUCET)
create or replace function public.claim_bankruptcy_aid()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_r public.user_coin_rewards;
  v_coins bigint;
  v_new_coins bigint;
begin
  if v_uid is null then
    return jsonb_build_object('success', false, 'message', 'not_authenticated');
  end if;

  select coins into v_coins from public.user_stats where user_id = v_uid for update;
  if v_coins is null then v_coins := 0; end if;

  if v_coins >= 20 then
    return jsonb_build_object(
      'success', false,
      'reason', 'not_broke',
      'message', 'Aún tienes ' || v_coins || ' 🪙. Solo puedes pedir auxilio con menos de 20 🪙.'
    );
  end if;

  v_r := public._get_or_create_coin_rewards(v_uid);

  if v_r.last_bankruptcy_claim is not null and v_r.last_bankruptcy_claim > (now() - interval '1 hour') then
    return jsonb_build_object(
      'success', false,
      'reason', 'cooldown',
      'remaining_seconds', greatest(0, extract(epoch from ((v_r.last_bankruptcy_claim + interval '1 hour') - now()))::int),
      'message', 'El prestamista está ocupado. Vuelve en unos minutos.'
    );
  end if;

  update public.user_coin_rewards
  set last_bankruptcy_claim = now()
  where user_id = v_uid;

  update public.user_stats
  set coins = coins + 50,
      updated_at = now()
  where user_id = v_uid
  returning coins into v_new_coins;

  return jsonb_build_object(
    'success', true,
    'coins_awarded', 50,
    'new_coins', v_new_coins,
    'message', 'El fondo de rescate clandestino te ha entregado 50 🪙. ¡Aprovecha bien tus fichas!'
  );
end $$;

-- 5. RULETA DE LA SUERTE DIARIA GRATUITA (DAILY LUCKY WHEEL)
create or replace function public.spin_daily_wheel()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_r public.user_coin_rewards;
  v_roll int;
  v_slot_idx int;
  v_prize_label text;
  v_prize_type text;
  v_prize_amt bigint := 0;
  v_new_coins bigint;
begin
  if v_uid is null then
    return jsonb_build_object('success', false, 'message', 'not_authenticated');
  end if;

  v_r := public._get_or_create_coin_rewards(v_uid);

  if v_r.last_wheel_spin is not null and v_r.last_wheel_spin > (now() - interval '20 hours') then
    return jsonb_build_object(
      'success', false,
      'reason', 'cooldown',
      'remaining_seconds', greatest(0, extract(epoch from ((v_r.last_wheel_spin + interval '20 hours') - now()))::int),
      'message', 'Ya giraste la ruleta de la suerte hoy. Vuelve en unas horas.'
    );
  end if;

  -- Número aleatorio de 0 a 99
  v_roll := ((get_byte(gen_random_bytes(2), 0) * 256 + get_byte(gen_random_bytes(2), 1)) % 100);

  if v_roll < 35 then
    -- 35%: 50 monedas
    v_slot_idx := 0;
    v_prize_label := '50 🪙 Monedas';
    v_prize_type := 'coins';
    v_prize_amt := 50;
  elsif v_roll < 60 then
    -- 25%: 100 monedas
    v_slot_idx := 1;
    v_prize_label := '100 🪙 Monedas';
    v_prize_type := 'coins';
    v_prize_amt := 100;
  elsif v_roll < 75 then
    -- 15%: 200 monedas
    v_slot_idx := 2;
    v_prize_label := '200 🪙 Monedas';
    v_prize_type := 'coins';
    v_prize_amt := 200;
  elsif v_roll < 80 then
    -- 5%: Jackpot 500 monedas
    v_slot_idx := 3;
    v_prize_label := 'JACKPOT: 500 🪙';
    v_prize_type := 'coins';
    v_prize_amt := 500;
  elsif v_roll < 90 then
    -- 10%: 75 XP
    v_slot_idx := 4;
    v_prize_label := '75 XP';
    v_prize_type := 'xp';
    v_prize_amt := 75;
  elsif v_roll < 96 then
    -- 6%: 150 XP
    v_slot_idx := 5;
    v_prize_label := '150 XP';
    v_prize_type := 'xp';
    v_prize_amt := 150;
  elsif v_roll < 98 then
    -- 2%: Poción de Suerte
    v_slot_idx := 6;
    v_prize_label := '🧪 1x Poción de Suerte';
    v_prize_type := 'item';
    v_prize_amt := 1;
  else
    -- 2%: Dinamita
    v_slot_idx := 7;
    v_prize_label := '🧨 1x Dinamita';
    v_prize_type := 'item';
    v_prize_amt := 1;
  end if;

  -- Aplicar premio
  if v_prize_type = 'coins' then
    update public.user_stats
    set coins = coins + v_prize_amt,
        updated_at = now()
    where user_id = v_uid
    returning coins into v_new_coins;
  elsif v_prize_type = 'xp' then
    update public.user_stats
    set xp = xp + v_prize_amt,
        lifetime_xp = lifetime_xp + v_prize_amt,
        level = floor(sqrt((lifetime_xp + v_prize_amt) / 25.0))::int + 1,
        updated_at = now()
    where user_id = v_uid
    returning coins into v_new_coins;
  elsif v_prize_type = 'item' then
    if v_slot_idx = 6 then
      insert into public.inventory(user_id, item_id, qty)
      values (v_uid, 'pocion_suerte', 1)
      on conflict (user_id, item_id) do update set qty = public.inventory.qty + 1;
    else
      insert into public.inventory(user_id, item_id, qty)
      values (v_uid, 'dinamita', 1)
      on conflict (user_id, item_id) do update set qty = public.inventory.qty + 1;
    end if;
    select coins into v_new_coins from public.user_stats where user_id = v_uid;
  end if;

  update public.user_coin_rewards
  set last_wheel_spin = now()
  where user_id = v_uid;

  return jsonb_build_object(
    'success', true,
    'slot_index', v_slot_idx,
    'prize_label', v_prize_label,
    'prize_type', v_prize_type,
    'prize_amount', v_prize_amt,
    'new_coins', v_new_coins,
    'message', '¡Premio ganado: ' || v_prize_label || '!'
  );
end $$;

-- 6. MONEDAS POR CHAT (1 VEZ CADA 30s, HASTA 50 AL DÍA)
create or replace function public.claim_chat_coin()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_r public.user_coin_rewards;
  v_today_coins int;
begin
  if v_uid is null then
    return jsonb_build_object('success', false);
  end if;

  v_r := public._get_or_create_coin_rewards(v_uid);

  -- Si cambió el día, reiniciar contador diario
  if v_r.chat_coins_date <> current_date then
    v_today_coins := 0;
    update public.user_coin_rewards
    set chat_coins_today = 0, chat_coins_date = current_date
    where user_id = v_uid;
  else
    v_today_coins := v_r.chat_coins_today;
  end if;

  -- Límite diario de 50 monedas
  if v_today_coins >= 50 then
    return jsonb_build_object('success', false, 'reason', 'daily_cap');
  end if;

  -- Cooldown de 30 segundos
  if v_r.last_chat_coin is not null and v_r.last_chat_coin > (now() - interval '30 seconds') then
    return jsonb_build_object('success', false, 'reason', 'cooldown');
  end if;

  -- Otorgar 2 monedas
  update public.user_coin_rewards
  set last_chat_coin = now(),
      chat_coins_today = v_today_coins + 2
  where user_id = v_uid;

  update public.user_stats
  set coins = coins + 2,
      updated_at = now()
  where user_id = v_uid;

  return jsonb_build_object('success', true, 'coins_awarded', 2);
end $$;

-- 7. TRIGGER: PREMIO AUTOMÁTICO POR SUBIR DE NIVEL (NIVEL * 100 🪙)
create or replace function public.on_user_stats_level_up()
returns trigger
language plpgsql
security definer
as $$
declare
  v_bonus bigint;
begin
  if new.level > old.level then
    v_bonus := (new.level * 100);
    new.coins := new.coins + v_bonus;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_user_stats_level_up on public.user_stats;
create trigger trg_user_stats_level_up
before update of level on public.user_stats
for each row
when (new.level > old.level)
execute function public.on_user_stats_level_up();

-- 8. TRIGGER: MONEDAS POR LIKES EN EL MURO (+5 🪙 AL AUTOR DEL POST)
create or replace function public.on_post_reaction_give_coins()
returns trigger
language plpgsql
security definer
as $$
declare
  v_author uuid;
begin
  select author_id into v_author from public.posts where id = new.post_id;
  -- Evitar auto-likes
  if v_author is not null and v_author <> new.user_id then
    update public.user_stats
    set coins = coins + 5,
        updated_at = now()
    where user_id = v_author;
  end if;
  return new;
exception when others then
  return new;
end;
$$;

drop trigger if exists trg_post_reaction_coins on public.reactions;
create trigger trg_post_reaction_coins
after insert on public.reactions
for each row
execute function public.on_post_reaction_give_coins();

-- Permisos de ejecución
grant execute on function public.get_rewards_status to authenticated;
grant execute on function public.claim_daily_coins to authenticated;
grant execute on function public.claim_bankruptcy_aid to authenticated;
grant execute on function public.spin_daily_wheel to authenticated;
grant execute on function public.claim_chat_coin to authenticated;
