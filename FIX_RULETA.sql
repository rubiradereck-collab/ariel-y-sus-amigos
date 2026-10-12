-- =====================================================================
-- FIX_RULETA.sql: Corrección inmediata para la Ruleta de la Suerte
-- (Usa random() nativo de PostgreSQL para no requerir pgcrypto ni extensiones)
-- =====================================================================

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

  -- Número aleatorio de 0 a 99 (100% nativo en PostgreSQL)
  v_roll := floor(random() * 100)::int;

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

grant execute on function public.spin_daily_wheel to authenticated;
