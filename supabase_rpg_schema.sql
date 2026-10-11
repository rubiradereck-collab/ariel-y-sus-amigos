-- =====================================================================
-- ARIEL Y SUS AMIGOS (Y JOEL) — RPG de Aventura + Casino
-- Ejecutar DESPUÉS de supabase_schema.sql (necesita public.profiles).
--
-- Reglas de seguridad:
--  * El cliente NUNCA escribe en estas tablas: solo lee (RLS) y llama RPC.
--  * Toda RPC es SECURITY DEFINER, usa auth.uid() y bloquea la fila del
--    jugador (FOR UPDATE) => sin dobles clics / carreras / duplicación.
--  * Las posiciones de las minas viven en active_bets, tabla SIN políticas
--    de lectura: el navegador jamás las ve hasta que explotan.
-- NOTA: user_stats.xp es el XP GASTABLE de este módulo. El nivel se calcula
-- con lifetime_xp (nunca baja). Si ya tienes XP en otra tabla, ver README.
-- =====================================================================

-- ============================ CATÁLOGOS ==============================
create table if not exists public.items (
  id text primary key,
  name text not null,
  emoji text not null,
  category text not null check (category in ('mineral','pez','material','consumible')),
  rarity text not null check (rarity in ('comun','raro','epico','legendario','mitico')),
  sell_price int not null default 0,
  buy_price int,
  description text
);

create table if not exists public.tools (
  id text primary key,
  kind text not null check (kind in ('pickaxe','rod')),
  tier int not null,
  name text not null,
  emoji text not null,
  cooldown_s int not null,
  luck numeric not null default 1
);

create table if not exists public.zones (
  id text primary key,
  kind text not null check (kind in ('mine','water')),
  name text not null,
  emoji text not null,
  min_level int not null,
  min_tier int not null,
  description text,
  loot jsonb not null            -- [{"i":"item","w":peso,"min":1,"max":3}]
);

create table if not exists public.recipes (
  id text primary key,
  name text not null,
  emoji text not null,
  kind text not null check (kind in ('tool','item')),
  result_id text not null,
  result_qty int not null default 1,
  ingredients jsonb not null default '{}',   -- {"item": qty}
  base_tool text,                            -- herramienta que se consume al mejorar
  coin_cost int not null default 0,
  min_level int not null default 1
);

-- ============================ JUGADOR ================================
create table if not exists public.user_stats (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  coins bigint not null default 100 check (coins >= 0),
  xp bigint not null default 0 check (xp >= 0),
  lifetime_xp bigint not null default 0,
  level int not null default 1,
  backpack_level int not null default 0,
  golem_level int not null default 0,
  golem_claimed_at timestamptz not null default now(),
  mine_ready_at timestamptz not null default now(),
  fish_ready_at timestamptz not null default now(),
  fish_zone text,
  fish_bite_at timestamptz,
  fish_deadline timestamptz,
  fish_bait boolean not null default false,
  bait_charges int not null default 0,
  luck_until timestamptz,
  stones_mined int not null default 0,
  fish_caught int not null default 0,
  items_crafted int not null default 0,
  treasures_found int not null default 0,
  titles text[] not null default '{}',
  active_title text,
  updated_at timestamptz not null default now()
);

create table if not exists public.inventory (
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_id text not null references public.items(id),
  qty int not null check (qty > 0),
  primary key (user_id, item_id)
);

create table if not exists public.user_tools (
  user_id uuid not null references public.profiles(id) on delete cascade,
  tool_id text not null references public.tools(id),
  equipped boolean not null default false,
  primary key (user_id, tool_id)
);

create table if not exists public.quests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  quest_date date not null,
  slot int not null,
  requirements jsonb not null,
  reward_coins int not null,
  reward_xp int not null,
  reward_title text,
  claimed boolean not null default false
);
create index if not exists quests_user_date on public.quests(user_id, quest_date);

create table if not exists public.economy_log (
  id bigserial primary key,
  user_id uuid not null,
  currency text not null,
  delta bigint not null,
  reason text not null,
  created_at timestamptz not null default now()
);
create index if not exists economy_log_user on public.economy_log(user_id, created_at desc);

-- ============================== CASINO ===============================
create table if not exists public.active_bets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  game text not null,
  amount int not null,
  currency text not null,
  mine_count int not null,
  mines int[] not null,
  revealed int[] not null default '{}',
  status text not null default 'active' check (status in ('active','won','lost')),
  created_at timestamptz not null default now()
);
create unique index if not exists one_active_bet_per_user
  on public.active_bets(user_id, game) where status = 'active';

create table if not exists public.casino_history (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  game text not null,
  bet int not null,
  currency text not null,
  payout bigint not null,
  detail jsonb,
  created_at timestamptz not null default now()
);
create index if not exists casino_history_game on public.casino_history(game, created_at desc);

create table if not exists public.duels (
  id uuid primary key default gen_random_uuid(),
  challenger_id uuid not null references public.profiles(id) on delete cascade,
  opponent_id uuid not null references public.profiles(id) on delete cascade,
  amount int not null,
  currency text not null,
  status text not null default 'pending'
    check (status in ('pending','resolved','declined','cancelled')),
  winner_id uuid,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

-- ================================ RLS ================================
alter table public.items          enable row level security;
alter table public.tools          enable row level security;
alter table public.zones          enable row level security;
alter table public.recipes        enable row level security;
alter table public.user_stats     enable row level security;
alter table public.inventory      enable row level security;
alter table public.user_tools     enable row level security;
alter table public.quests         enable row level security;
alter table public.economy_log    enable row level security;
alter table public.active_bets    enable row level security;  -- sin políticas: nadie la lee
alter table public.casino_history enable row level security;
alter table public.duels          enable row level security;

create policy "cat items"   on public.items   for select to authenticated using (true);
create policy "cat tools"   on public.tools   for select to authenticated using (true);
create policy "cat zones"   on public.zones   for select to authenticated using (true);
create policy "cat recipes" on public.recipes for select to authenticated using (true);
-- Stats visibles para todos (rankings, perfiles); solo el dueño ve lo suyo en lo demás.
create policy "stats leer"  on public.user_stats  for select to authenticated using (true);
create policy "inv propio"  on public.inventory   for select to authenticated using (user_id = (select auth.uid()));
create policy "tools propio" on public.user_tools for select to authenticated using (user_id = (select auth.uid()));
create policy "quests propio" on public.quests    for select to authenticated using (user_id = (select auth.uid()));
create policy "log propio"  on public.economy_log for select to authenticated using (user_id = (select auth.uid()));
create policy "historial"   on public.casino_history for select to authenticated using (true);
create policy "duelos mios" on public.duels for select to authenticated
  using (challenger_id = (select auth.uid()) or opponent_id = (select auth.uid()));

-- Defensa en profundidad: ni con una política mal puesta se puede escribir desde el cliente.
revoke insert, update, delete, truncate on
  public.items, public.tools, public.zones, public.recipes, public.user_stats,
  public.inventory, public.user_tools, public.quests, public.economy_log,
  public.active_bets, public.casino_history, public.duels
from anon, authenticated;
revoke all on public.active_bets from anon, authenticated;

-- ============================ HELPERS (_) ============================
create or replace function public._ensure_stats(p_uid uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare n int;
begin
  insert into public.user_stats(user_id) values (p_uid) on conflict do nothing;
  get diagnostics n = row_count;
  if n = 1 then
    insert into public.user_tools(user_id, tool_id, equipped)
    values (p_uid,'pick_wood',true),(p_uid,'rod_wood',true) on conflict do nothing;
  end if;
end $$;

create or replace function public._lock_stats(p_uid uuid) returns public.user_stats
language plpgsql security definer set search_path = public, pg_temp as $$
declare s public.user_stats;
begin
  perform public._ensure_stats(p_uid);
  select * into s from public.user_stats where user_id = p_uid for update;
  return s;
end $$;

create or replace function public._balance(p_uid uuid) returns jsonb
language sql security definer set search_path = public, pg_temp as $$
  select jsonb_build_object('coins', coins, 'xp', xp) from public.user_stats where user_id = p_uid
$$;

create or replace function public._adjust(p_uid uuid, p_cur text, p_delta bigint, p_reason text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare bal bigint;
begin
  if p_cur = 'coins' then select coins into bal from public.user_stats where user_id = p_uid;
  elsif p_cur = 'xp' then select xp into bal from public.user_stats where user_id = p_uid;
  else raise exception 'Moneda inválida'; end if;
  if bal + p_delta < 0 then raise exception 'Saldo insuficiente'; end if;
  if p_cur = 'coins' then update public.user_stats set coins = coins + p_delta, updated_at = now() where user_id = p_uid;
  else update public.user_stats set xp = xp + p_delta, updated_at = now() where user_id = p_uid; end if;
  insert into public.economy_log(user_id, currency, delta, reason) values (p_uid, p_cur, p_delta, p_reason);
end $$;

create or replace function public._grant_xp(p_uid uuid, p_n int) returns void
language sql security definer set search_path = public, pg_temp as $$
  update public.user_stats
     set xp = xp + p_n, lifetime_xp = lifetime_xp + p_n,
         level = floor(sqrt((lifetime_xp + p_n) / 25.0))::int + 1
   where user_id = p_uid
$$;

create or replace function public._xp_for(p_rarity text) returns int
language sql immutable as $$
  select case p_rarity when 'comun' then 2 when 'raro' then 6 when 'epico' then 15
                       when 'legendario' then 40 else 120 end
$$;

create or replace function public._add_item(p_uid uuid, p_item text, p_qty int) returns void
language sql security definer set search_path = public, pg_temp as $$
  insert into public.inventory(user_id, item_id, qty) values (p_uid, p_item, p_qty)
  on conflict (user_id, item_id) do update set qty = public.inventory.qty + excluded.qty
$$;

create or replace function public._take_item(p_uid uuid, p_item text, p_qty int) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.inventory set qty = qty - p_qty
   where user_id = p_uid and item_id = p_item and qty >= p_qty;
  if not found then raise exception 'Te faltan materiales: % x%', p_item, p_qty; end if;
  delete from public.inventory where user_id = p_uid and item_id = p_item and qty = 0;
end $$;

create or replace function public._bag_used(p_uid uuid) returns int
language sql security definer set search_path = public, pg_temp as $$
  select coalesce(sum(qty), 0)::int from public.inventory where user_id = p_uid
$$;

create or replace function public._bag_cap(p_level int) returns int
language sql immutable as $$ select 30 + 20 * p_level $$;

create or replace function public._tool_of(p_uid uuid, p_kind text) returns public.tools
language sql security definer set search_path = public, pg_temp as $$
  select t.* from public.user_tools ut join public.tools t on t.id = ut.tool_id
   where ut.user_id = p_uid and ut.equipped and t.kind = p_kind limit 1
$$;

-- RNG: random() de Postgres es impredecible para el cliente (corre solo en el servidor).
create or replace function public._rand_w(p_w numeric[]) returns int
language plpgsql volatile as $$
declare tot numeric := 0; r numeric; acc numeric := 0; i int; x numeric;
begin
  foreach x in array p_w loop tot := tot + x; end loop;
  r := random() * tot;
  for i in 1..array_length(p_w, 1) loop
    acc := acc + p_w[i];
    if r < acc then return i; end if;
  end loop;
  return array_length(p_w, 1);
end $$;

create or replace function public._roll_loot(p_loot jsonb, p_luck numeric) returns jsonb
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare e jsonb; w numeric; tot numeric := 0; acc numeric := 0; r numeric; rar text; lo int; hi int;
begin
  for e in select jsonb_array_elements(p_loot) loop
    select rarity into rar from public.items where id = e->>'i';
    tot := tot + (e->>'w')::numeric * case when rar = 'comun' then 1 else p_luck end;
  end loop;
  r := random() * tot;
  for e in select jsonb_array_elements(p_loot) loop
    select rarity into rar from public.items where id = e->>'i';
    acc := acc + (e->>'w')::numeric * case when rar = 'comun' then 1 else p_luck end;
    lo := (e->>'min')::int; hi := (e->>'max')::int;
    if r < acc then
      return jsonb_build_object('item', e->>'i', 'qty', lo + floor(random() * (hi - lo + 1))::int);
    end if;
  end loop;
  e := p_loot->0;
  return jsonb_build_object('item', e->>'i', 'qty', 1);
end $$;

create or replace function public._check_bet(p_amount int, p_cur text) returns void
language plpgsql immutable as $$
begin
  if p_cur not in ('coins','xp') then raise exception 'Moneda inválida'; end if;
  if p_amount is null or p_amount < 1 or p_amount > 10000 then
    raise exception 'La apuesta debe estar entre 1 y 10000'; end if;
end $$;

create or replace function public._house_log(p_uid uuid, p_game text, p_bet int, p_cur text, p_payout bigint, p_detail jsonb)
returns void language sql security definer set search_path = public, pg_temp as $$
  insert into public.casino_history(user_id, game, bet, currency, payout, detail)
  values (p_uid, p_game, p_bet, p_cur, p_payout, p_detail)
$$;

-- ============================ MINERÍA ================================
create or replace function public.ensure_stats() returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  perform public._lock_stats(auth.uid());
  return public._balance(auth.uid());
end $$;

create or replace function public.mine(p_zone text, p_dynamite boolean default false) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  uid uuid := auth.uid(); s public.user_stats; z public.zones; t public.tools;
  luck numeric; rolls int := 1; i int; r jsonb; qty int; used int; cap int; rar text;
  got jsonb := '[]'; xp int := 0; total int := 0; rare_hits int := 0;
  ev text := null; bonus int := 0; rv numeric; cd int;
begin
  if uid is null then raise exception 'No autenticado'; end if;
  s := public._lock_stats(uid);
  select * into z from public.zones where id = p_zone and kind = 'mine';
  if not found then raise exception 'Zona inválida'; end if;
  if s.level < z.min_level then raise exception 'Necesitas nivel %', z.min_level; end if;
  t := public._tool_of(uid, 'pickaxe');
  if t.id is null or t.tier < z.min_tier then raise exception 'Tu pico es demasiado débil para esta zona'; end if;
  if now() < s.mine_ready_at then raise exception 'Tu pico aún se está enfriando'; end if;

  used := public._bag_used(uid); cap := public._bag_cap(s.backpack_level);
  if used >= cap then raise exception 'Mochila llena: vende o mejora tu mochila'; end if;
  luck := t.luck * case when s.luck_until is not null and s.luck_until > now() then 1.5 else 1 end;

  if p_dynamite then perform public._take_item(uid, 'dinamita', 1); rolls := 5; end if;

  for i in 1..rolls loop
    r := public._roll_loot(z.loot, luck);
    qty := least((r->>'qty')::int, cap - used);
    exit when qty <= 0;
    perform public._add_item(uid, r->>'item', qty);
    select rarity into rar from public.items where id = r->>'item';
    used := used + qty; total := total + qty; xp := xp + public._xp_for(rar) * qty;
    if rar in ('epico','legendario','mitico') then rare_hits := rare_hits + 1; end if;
    got := got || jsonb_build_object('item', r->>'item', 'qty', qty);
  end loop;

  cd := t.cooldown_s + case when p_dynamite then 10 else 0 end;
  if not p_dynamite then
    rv := random();
    if rv < 0.04 then
      ev := 'cofre'; bonus := 30 + floor(random() * 150)::int;
      perform public._adjust(uid, 'coins', bonus, 'mine:cofre');
      rare_hits := rare_hits + 1;
    elsif rv < 0.09 then
      ev := 'derrumbe'; cd := cd + 20;
    end if;
  end if;

  update public.user_stats
     set mine_ready_at = now() + make_interval(secs => cd),
         stones_mined = stones_mined + total,
         treasures_found = treasures_found + rare_hits
   where user_id = uid;
  perform public._grant_xp(uid, xp);

  return jsonb_build_object('loot', got, 'event', ev, 'bonus', bonus, 'xp', xp,
                            'cooldown', cd, 'balance', public._balance(uid));
end $$;

-- ============================== PESCA ================================
create or replace function public.fish_cast(p_zone text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := auth.uid(); s public.user_stats; z public.zones; t public.tools;
        delay_ms int; win_ms int; bait boolean := false;
begin
  if uid is null then raise exception 'No autenticado'; end if;
  s := public._lock_stats(uid);
  select * into z from public.zones where id = p_zone and kind = 'water';
  if not found then raise exception 'Zona inválida'; end if;
  if s.level < z.min_level then raise exception 'Necesitas nivel %', z.min_level; end if;
  t := public._tool_of(uid, 'rod');
  if t.id is null or t.tier < z.min_tier then raise exception 'Tu caña es demasiado débil para esta zona'; end if;
  if now() < s.fish_ready_at then raise exception 'Aún estás recogiendo el sedal'; end if;
  if public._bag_used(uid) >= public._bag_cap(s.backpack_level) then
    raise exception 'Mochila llena: vende o mejora tu mochila'; end if;

  if s.bait_charges > 0 then bait := true; end if;
  delay_ms := 2000 + floor(random() * 4000)::int - case when bait then 800 else 0 end;
  win_ms := 1500 + 100 * t.tier;
  update public.user_stats
     set fish_zone = p_zone, fish_bait = bait,
         bait_charges = bait_charges - case when bait then 1 else 0 end,
         fish_bite_at = now() + make_interval(secs => delay_ms / 1000.0),
         fish_deadline = now() + make_interval(secs => (delay_ms + win_ms) / 1000.0)
   where user_id = uid;
  return jsonb_build_object('bite_in_ms', delay_ms, 'window_ms', win_ms, 'bait', bait);
end $$;

create or replace function public.fish_reel() returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := auth.uid(); s public.user_stats; z public.zones; t public.tools;
        r jsonb; qty int; rar text; luck numeric; xp int; cap int; used int;
begin
  if uid is null then raise exception 'No autenticado'; end if;
  s := public._lock_stats(uid);
  if s.fish_bite_at is null then raise exception 'No has lanzado la caña'; end if;
  update public.user_stats set fish_bite_at = null, fish_deadline = null where user_id = uid;

  if now() < s.fish_bite_at - interval '150 milliseconds' then
    update public.user_stats set fish_ready_at = now() + interval '8 seconds' where user_id = uid;
    return jsonb_build_object('ok', false, 'reason', 'early');
  elsif now() > s.fish_deadline then
    update public.user_stats set fish_ready_at = now() + interval '8 seconds' where user_id = uid;
    return jsonb_build_object('ok', false, 'reason', 'late');
  end if;

  select * into z from public.zones where id = s.fish_zone;
  t := public._tool_of(uid, 'rod');
  luck := coalesce(t.luck, 1)
          * case when s.luck_until is not null and s.luck_until > now() then 1.5 else 1 end
          * case when s.fish_bait then 1.4 else 1 end;
  r := public._roll_loot(z.loot, luck);
  cap := public._bag_cap(s.backpack_level); used := public._bag_used(uid);
  qty := greatest(least((r->>'qty')::int, cap - used), 0);
  select rarity into rar from public.items where id = r->>'item';
  xp := public._xp_for(rar) * greatest(qty, 1);
  if qty > 0 then perform public._add_item(uid, r->>'item', qty); end if;

  update public.user_stats
     set fish_ready_at = now() + make_interval(secs => coalesce(t.cooldown_s, 30)),
         fish_caught = fish_caught + qty,
         treasures_found = treasures_found + case when rar in ('epico','legendario','mitico') then 1 else 0 end
   where user_id = uid;
  perform public._grant_xp(uid, xp);
  return jsonb_build_object('ok', true, 'item', r->>'item', 'qty', qty, 'xp', xp,
                            'balance', public._balance(uid));
end $$;

-- ===================== TALLER, MERCADO, MOCHILA ======================
create or replace function public.craft(p_recipe text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := auth.uid(); s public.user_stats; r public.recipes; rec record; k text;
begin
  if uid is null then raise exception 'No autenticado'; end if;
  s := public._lock_stats(uid);
  select * into r from public.recipes where id = p_recipe;
  if not found then raise exception 'Receta inválida'; end if;
  if s.level < r.min_level then raise exception 'Necesitas nivel %', r.min_level; end if;
  if r.kind = 'tool' and exists (select 1 from public.user_tools where user_id = uid and tool_id = r.result_id) then
    raise exception 'Ya tienes esta herramienta'; end if;
  if r.coin_cost > 0 then perform public._adjust(uid, 'coins', -r.coin_cost, 'craft:' || r.id); end if;
  for rec in select key as k, value::int as v from jsonb_each_text(r.ingredients) loop
    perform public._take_item(uid, rec.k, rec.v);
  end loop;
  if r.base_tool is not null then
    delete from public.user_tools where user_id = uid and tool_id = r.base_tool;
    if not found then raise exception 'Necesitas tener la herramienta base para mejorarla'; end if;
  end if;
  if r.kind = 'tool' then
    select kind into k from public.tools where id = r.result_id;
    update public.user_tools set equipped = false
     where user_id = uid and tool_id in (select id from public.tools where kind = k);
    insert into public.user_tools(user_id, tool_id, equipped) values (uid, r.result_id, true);
  else
    if public._bag_used(uid) + r.result_qty > public._bag_cap(s.backpack_level) then
      raise exception 'Mochila llena'; end if;
    perform public._add_item(uid, r.result_id, r.result_qty);
  end if;
  update public.user_stats set items_crafted = items_crafted + 1 where user_id = uid;
  perform public._grant_xp(uid, 12);
  return jsonb_build_object('crafted', r.result_id, 'balance', public._balance(uid));
end $$;

create or replace function public.equip_tool(p_tool text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := auth.uid(); k text;
begin
  if uid is null then raise exception 'No autenticado'; end if;
  perform public._lock_stats(uid);
  if not exists (select 1 from public.user_tools where user_id = uid and tool_id = p_tool) then
    raise exception 'No tienes esa herramienta'; end if;
  select kind into k from public.tools where id = p_tool;
  update public.user_tools set equipped = (tool_id = p_tool)
   where user_id = uid and tool_id in (select id from public.tools where kind = k);
end $$;

create or replace function public.sell_item(p_item text, p_qty int) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := auth.uid(); price int; gain bigint;
begin
  if uid is null then raise exception 'No autenticado'; end if;
  if p_qty < 1 then raise exception 'Cantidad inválida'; end if;
  perform public._lock_stats(uid);
  select sell_price into price from public.items where id = p_item;
  if price is null or price <= 0 then raise exception 'Este objeto no se puede vender'; end if;
  perform public._take_item(uid, p_item, p_qty);
  gain := price::bigint * p_qty;
  perform public._adjust(uid, 'coins', gain, 'sell:' || p_item);
  return jsonb_build_object('gain', gain, 'balance', public._balance(uid));
end $$;

create or replace function public.sell_all_common() returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := auth.uid(); gain bigint; n int;
begin
  if uid is null then raise exception 'No autenticado'; end if;
  perform public._lock_stats(uid);
  select coalesce(sum(inv.qty * it.sell_price), 0), coalesce(sum(inv.qty), 0)
    into gain, n
    from public.inventory inv join public.items it on it.id = inv.item_id
   where inv.user_id = uid and it.rarity = 'comun' and it.category in ('mineral','pez') and it.sell_price > 0;
  if n = 0 then raise exception 'No tienes minerales ni peces comunes'; end if;
  delete from public.inventory inv using public.items it
   where inv.user_id = uid and it.id = inv.item_id
     and it.rarity = 'comun' and it.category in ('mineral','pez') and it.sell_price > 0;
  perform public._adjust(uid, 'coins', gain, 'sell:all_common');
  return jsonb_build_object('gain', gain, 'sold', n, 'balance', public._balance(uid));
end $$;

create or replace function public.buy_item(p_item text, p_qty int) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := auth.uid(); s public.user_stats; price int;
begin
  if uid is null then raise exception 'No autenticado'; end if;
  if p_qty < 1 or p_qty > 99 then raise exception 'Cantidad inválida'; end if;
  s := public._lock_stats(uid);
  select buy_price into price from public.items where id = p_item;
  if price is null then raise exception 'Este objeto no está a la venta'; end if;
  if public._bag_used(uid) + p_qty > public._bag_cap(s.backpack_level) then
    raise exception 'No te cabe en la mochila'; end if;
  perform public._adjust(uid, 'coins', -(price::bigint * p_qty), 'buy:' || p_item);
  perform public._add_item(uid, p_item, p_qty);
  return jsonb_build_object('balance', public._balance(uid));
end $$;

create or replace function public.use_item(p_item text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := auth.uid(); s public.user_stats; c int; r jsonb; q int;
begin
  if uid is null then raise exception 'No autenticado'; end if;
  s := public._lock_stats(uid);
  if p_item = 'pocion_suerte' then
    perform public._take_item(uid, p_item, 1);
    update public.user_stats set luck_until = greatest(now(), coalesce(luck_until, now())) + interval '10 minutes'
     where user_id = uid;
    return jsonb_build_object('msg', 'Suerte x1.5 por 10 minutos', 'balance', public._balance(uid));
  elsif p_item = 'cebo_avanzado' then
    perform public._take_item(uid, p_item, 1);
    update public.user_stats set bait_charges = bait_charges + 3 where user_id = uid;
    return jsonb_build_object('msg', '+3 lanzamientos con cebo avanzado', 'balance', public._balance(uid));
  elsif p_item = 'cofre' then
    perform public._take_item(uid, p_item, 1);
    c := 80 + floor(random() * 220)::int;
    perform public._adjust(uid, 'coins', c, 'use:cofre');
    r := public._roll_loot((select loot from public.zones where id = 'mine_6'), 2);
    q := least((r->>'qty')::int, greatest(public._bag_cap(s.backpack_level) - public._bag_used(uid), 0));
    if q > 0 then perform public._add_item(uid, r->>'item', q); end if;
    update public.user_stats set treasures_found = treasures_found + 1 where user_id = uid;
    return jsonb_build_object('msg', format('Cofre: +%s monedas y %sx %s', c, q, r->>'item'),
                              'balance', public._balance(uid));
  elsif p_item = 'dinamita' then
    raise exception 'La dinamita se usa al minar (casilla "Usar dinamita")';
  end if;
  raise exception 'Este objeto no se puede usar';
end $$;

create or replace function public.upgrade_backpack() returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := auth.uid(); s public.user_stats; cost int;
begin
  if uid is null then raise exception 'No autenticado'; end if;
  s := public._lock_stats(uid);
  if s.backpack_level >= 8 then raise exception 'Tu mochila ya está al máximo'; end if;
  cost := 150 * (s.backpack_level + 1) * (s.backpack_level + 1);
  perform public._adjust(uid, 'coins', -cost, 'backpack');
  update public.user_stats set backpack_level = backpack_level + 1 where user_id = uid;
  return jsonb_build_object('capacity', public._bag_cap(s.backpack_level + 1), 'balance', public._balance(uid));
end $$;

-- ============================== GOLEMS ===============================
create or replace function public.buy_golem() returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := auth.uid(); s public.user_stats;
  costs int[] := array[500,1500,4000,10000,25000];
  lvls int[]  := array[3,5,8,11,14];
begin
  if uid is null then raise exception 'No autenticado'; end if;
  s := public._lock_stats(uid);
  if s.golem_level >= 5 then raise exception 'Tu golem ya es nivel máximo'; end if;
  if s.level < lvls[s.golem_level + 1] then raise exception 'Necesitas nivel %', lvls[s.golem_level + 1]; end if;
  perform public._adjust(uid, 'coins', -costs[s.golem_level + 1], 'golem');
  update public.user_stats
     set golem_level = golem_level + 1,
         golem_claimed_at = case when golem_level = 0 then now() else golem_claimed_at end
   where user_id = uid;
  return jsonb_build_object('golem_level', s.golem_level + 1, 'balance', public._balance(uid));
end $$;

create or replace function public.claim_golem() returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := auth.uid(); s public.user_stats; hrs numeric; gain bigint;
begin
  if uid is null then raise exception 'No autenticado'; end if;
  s := public._lock_stats(uid);
  if s.golem_level = 0 then raise exception 'Aún no tienes un golem'; end if;
  hrs := least(extract(epoch from (now() - s.golem_claimed_at)) / 3600.0, 8 + 4 * s.golem_level);
  gain := floor(hrs * 15 * s.golem_level);
  if gain < 1 then raise exception 'Tu golem aún no ha recolectado nada'; end if;
  perform public._adjust(uid, 'coins', gain, 'golem:claim');
  update public.user_stats set golem_claimed_at = now() where user_id = uid;
  return jsonb_build_object('gain', gain, 'balance', public._balance(uid));
end $$;

-- ============================== MISIONES =============================
create or replace function public.get_quests() returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := auth.uid(); today date := (now() at time zone 'America/Guayaquil')::date;
  i int; reqs jsonb; val numeric;
  tl text[] := array['Minero Estrella','Pescador Nocturno','Contratista del Pueblo','Rey de las Cavernas'];
begin
  if uid is null then raise exception 'No autenticado'; end if;
  perform public._lock_stats(uid);
  if not exists (select 1 from public.quests where user_id = uid and quest_date = today) then
    for i in 1..3 loop
      select jsonb_object_agg(id, q), sum(sell_price * q) into reqs, val
        from (select id, sell_price, 2 + floor(random() * 4)::int as q
                from public.items
               where category in ('mineral','pez') and rarity in ('comun','raro') and sell_price > 0
               order by random() limit 2) x;
      insert into public.quests(user_id, quest_date, slot, requirements, reward_coins, reward_xp, reward_title)
      values (uid, today, i, reqs, floor(val * 1.8)::int + 30, 20 + i * 10,
              case when i = 3 then tl[1 + floor(random() * 4)::int] end);
    end loop;
  end if;
  return coalesce((select jsonb_agg(to_jsonb(q) order by q.slot)
                     from public.quests q where q.user_id = uid and q.quest_date = today), '[]'::jsonb);
end $$;

create or replace function public.claim_quest(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := auth.uid(); q public.quests; rec record;
begin
  if uid is null then raise exception 'No autenticado'; end if;
  perform public._lock_stats(uid);
  select * into q from public.quests where id = p_id and user_id = uid and claimed = false for update;
  if not found then raise exception 'Contrato no disponible'; end if;
  for rec in select key as k, value::int as v from jsonb_each_text(q.requirements) loop
    perform public._take_item(uid, rec.k, rec.v);
  end loop;
  perform public._adjust(uid, 'coins', q.reward_coins, 'quest');
  perform public._grant_xp(uid, q.reward_xp);
  if q.reward_title is not null then
    update public.user_stats set titles = array(select distinct unnest(titles || q.reward_title))
     where user_id = uid;
  end if;
  update public.quests set claimed = true where id = q.id;
  return jsonb_build_object('coins', q.reward_coins, 'xp', q.reward_xp, 'title', q.reward_title,
                            'balance', public._balance(uid));
end $$;

-- ============================== CASINO ===============================
-- Cara o Cruz: paga x1.96 (RTP 98%).
create or replace function public.bet_coinflip(p_amount int, p_currency text, p_choice text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := auth.uid(); res text; win boolean; payout bigint := 0;
begin
  if uid is null then raise exception 'No autenticado'; end if;
  if p_choice not in ('cara','cruz') then raise exception 'Elige cara o cruz'; end if;
  perform public._check_bet(p_amount, p_currency);
  perform public._lock_stats(uid);
  perform public._adjust(uid, p_currency, -p_amount, 'casino:coinflip');
  res := case when random() < 0.5 then 'cara' else 'cruz' end;
  win := (res = p_choice);
  if win then
    payout := floor(p_amount * 1.96);
    perform public._adjust(uid, p_currency, payout, 'casino:coinflip:win');
  end if;
  perform public._house_log(uid, 'coinflip', p_amount, p_currency, payout, jsonb_build_object('result', res));
  return jsonb_build_object('result', res, 'win', win, 'payout', payout, 'balance', public._balance(uid));
end $$;

-- Ruleta de 15 casillas: 0 = verde (x14), 1-7 rojo (x2), 8-14 negro (x2). RTP ~93.3%.
create or replace function public.bet_roulette(p_amount int, p_currency text, p_color text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := auth.uid(); slot int; col text; mult int := 0; payout bigint := 0;
begin
  if uid is null then raise exception 'No autenticado'; end if;
  if p_color not in ('rojo','negro','verde') then raise exception 'Color inválido'; end if;
  perform public._check_bet(p_amount, p_currency);
  perform public._lock_stats(uid);
  perform public._adjust(uid, p_currency, -p_amount, 'casino:roulette');
  slot := floor(random() * 15)::int;
  col := case when slot = 0 then 'verde' when slot <= 7 then 'rojo' else 'negro' end;
  if col = p_color then
    mult := case when col = 'verde' then 14 else 2 end;
    payout := p_amount::bigint * mult;
    perform public._adjust(uid, p_currency, payout, 'casino:roulette:win');
  end if;
  perform public._house_log(uid, 'roulette', p_amount, p_currency, payout,
                            jsonb_build_object('slot', slot, 'color', col));
  return jsonb_build_object('slot', slot, 'color', col, 'win', payout > 0,
                            'payout', payout, 'balance', public._balance(uid));
end $$;

-- Minas: multiplicador = producto de (25-i)/(25-m-i) * 0.97 (RTP 97%). Público para mostrarlo.
create or replace function public.mines_multiplier(p_mines int, p_k int) returns numeric
language plpgsql immutable as $$
declare v numeric := 1; i int;
begin
  if p_k < 1 or p_k > 25 - p_mines then return 0; end if;
  for i in 0..p_k - 1 loop v := v * (25 - i)::numeric / (25 - p_mines - i)::numeric; end loop;
  return floor(v * 0.97 * 100) / 100;
end $$;

create or replace function public.mines_start(p_amount int, p_currency text, p_mines int) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := auth.uid(); pos int[]; bid uuid;
begin
  if uid is null then raise exception 'No autenticado'; end if;
  if p_mines not in (1,3,5,8) then raise exception 'Cantidad de minas inválida'; end if;
  perform public._check_bet(p_amount, p_currency);
  perform public._lock_stats(uid);
  if exists (select 1 from public.active_bets where user_id = uid and game = 'mines' and status = 'active') then
    raise exception 'Ya tienes una partida de Minas abierta'; end if;
  perform public._adjust(uid, p_currency, -p_amount, 'casino:mines');
  select array_agg(t) into pos
    from (select t from generate_series(0, 24) t order by random() limit p_mines) q;
  insert into public.active_bets(user_id, game, amount, currency, mine_count, mines)
  values (uid, 'mines', p_amount, p_currency, p_mines, pos) returning id into bid;
  return jsonb_build_object('bet_id', bid, 'next_multiplier', public.mines_multiplier(p_mines, 1),
                            'balance', public._balance(uid));
end $$;

create or replace function public._mines_cash(b public.active_bets) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare k int := coalesce(array_length(b.revealed, 1), 0); mult numeric; payout bigint;
begin
  mult := public.mines_multiplier(b.mine_count, k);
  payout := floor(b.amount * mult);
  perform public._adjust(b.user_id, b.currency, payout, 'casino:mines:win');
  update public.active_bets set status = 'won' where id = b.id;
  perform public._house_log(b.user_id, 'mines', b.amount, b.currency, payout,
                            jsonb_build_object('mines', b.mine_count, 'revealed', k, 'mult', mult));
  return jsonb_build_object('status', 'won', 'multiplier', mult, 'payout', payout,
                            'mines', to_jsonb(b.mines), 'revealed', to_jsonb(b.revealed),
                            'balance', public._balance(b.user_id));
end $$;

create or replace function public.mines_reveal(p_bet uuid, p_tile int) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := auth.uid(); b public.active_bets; k int;
begin
  if uid is null then raise exception 'No autenticado'; end if;
  perform public._lock_stats(uid);
  select * into b from public.active_bets where id = p_bet and user_id = uid and status = 'active' for update;
  if not found then raise exception 'Partida no encontrada'; end if;
  if p_tile < 0 or p_tile > 24 then raise exception 'Casilla inválida'; end if;
  if p_tile = any (b.revealed) then raise exception 'Casilla ya descubierta'; end if;

  if p_tile = any (b.mines) then
    update public.active_bets set status = 'lost' where id = b.id;
    perform public._house_log(uid, 'mines', b.amount, b.currency, 0,
      jsonb_build_object('mines', b.mine_count, 'revealed', coalesce(array_length(b.revealed, 1), 0)));
    return jsonb_build_object('status', 'lost', 'hit', p_tile, 'mines', to_jsonb(b.mines),
                              'revealed', to_jsonb(b.revealed), 'balance', public._balance(uid));
  end if;

  update public.active_bets set revealed = array_append(revealed, p_tile) where id = b.id returning * into b;
  k := array_length(b.revealed, 1);
  if k = 25 - b.mine_count then return public._mines_cash(b); end if;   -- tablero limpio
  return jsonb_build_object('status', 'active', 'revealed', to_jsonb(b.revealed),
                            'multiplier', public.mines_multiplier(b.mine_count, k),
                            'next_multiplier', public.mines_multiplier(b.mine_count, k + 1));
end $$;

create or replace function public.mines_cashout(p_bet uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := auth.uid(); b public.active_bets;
begin
  if uid is null then raise exception 'No autenticado'; end if;
  perform public._lock_stats(uid);
  select * into b from public.active_bets where id = p_bet and user_id = uid and status = 'active' for update;
  if not found then raise exception 'Partida no encontrada'; end if;
  if coalesce(array_length(b.revealed, 1), 0) < 1 then raise exception 'Descubre al menos una casilla'; end if;
  return public._mines_cash(b);
end $$;

create or replace function public.mines_state() returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := auth.uid(); b public.active_bets; k int;
begin
  if uid is null then raise exception 'No autenticado'; end if;
  select * into b from public.active_bets where user_id = uid and game = 'mines' and status = 'active';
  if not found then return null; end if;
  k := coalesce(array_length(b.revealed, 1), 0);
  return jsonb_build_object('bet_id', b.id, 'amount', b.amount, 'currency', b.currency,
    'mine_count', b.mine_count, 'revealed', to_jsonb(b.revealed),
    'multiplier', public.mines_multiplier(b.mine_count, k),
    'next_multiplier', public.mines_multiplier(b.mine_count, k + 1));
end $$;

-- Tragamonedas "Gema Bonanza": 5x3, pagan >=6 iguales en cualquier lugar (pay-anywhere),
-- bombas multiplican la tirada ganadora, 3+ scatters = 8 giros gratis. Tope x500.
-- RTP simulado (800k tiradas): ~96%.  Hit rate ~27%.  Giros gratis ~2.1% de las tiradas.
create or replace function public._slot_spin() returns jsonb
language plpgsql volatile as $$
declare
  names text[]   := array['gold','dia','ruby','ame','eme','saf','scat','bomb'];
  w numeric[]    := array[5,7,10,13,16,18,3,2.2];
  base numeric[] := array[9.5,6,2.8,1.9,1.2,0.7];
  bw numeric[]   := array[50,25,12,6,3,1.2,0.4];
  bv int[]       := array[2,3,5,10,25,50,100];
  cells text[] := '{}'; counts int[] := array[0,0,0,0,0,0,0,0];
  bombs int[] := '{}'; bsum int := 0; win numeric := 0; idx int; i int; b int;
begin
  for i in 1..15 loop
    idx := public._rand_w(w);
    cells := cells || names[idx];
    counts[idx] := counts[idx] + 1;
    if idx = 8 then b := bv[public._rand_w(bw)]; bombs := bombs || b; bsum := bsum + b; end if;
  end loop;
  for i in 1..6 loop
    if counts[i] >= 6 then win := win + base[i] * (1 + (counts[i] - 6) * 0.6); end if;
  end loop;
  if win > 0 and bsum > 0 then win := win * bsum; end if;
  return jsonb_build_object('cells', to_jsonb(cells), 'bombs', to_jsonb(bombs),
                            'scatters', counts[7], 'mult', win);
end $$;

create or replace function public.bet_slots(p_amount int, p_currency text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := auth.uid(); sp jsonb; fs jsonb := '[]'; f jsonb; total numeric; payout bigint; i int;
begin
  if uid is null then raise exception 'No autenticado'; end if;
  perform public._check_bet(p_amount, p_currency);
  perform public._lock_stats(uid);
  perform public._adjust(uid, p_currency, -p_amount, 'casino:slots');
  sp := public._slot_spin();
  total := (sp->>'mult')::numeric;
  if (sp->>'scatters')::int >= 3 then
    for i in 1..8 loop
      f := public._slot_spin();
      fs := fs || f;
      total := total + (f->>'mult')::numeric;
    end loop;
  end if;
  total := least(total, 500);
  payout := floor(p_amount * total);
  if payout > 0 then perform public._adjust(uid, p_currency, payout, 'casino:slots:win'); end if;
  perform public._house_log(uid, 'slots', p_amount, p_currency, payout,
                            jsonb_build_object('mult', total, 'free', jsonb_array_length(fs) > 0));
  return jsonb_build_object('spin', sp, 'free_spins', fs, 'total_mult', total,
                            'payout', payout, 'balance', public._balance(uid));
end $$;

-- ============================== DUELOS ===============================
create or replace function public.duel_create(p_opponent uuid, p_amount int, p_currency text) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := auth.uid(); did uuid;
begin
  if uid is null then raise exception 'No autenticado'; end if;
  if p_opponent = uid then raise exception 'No puedes retarte a ti mismo'; end if;
  if not exists (select 1 from public.profiles where id = p_opponent) then raise exception 'Jugador no existe'; end if;
  perform public._check_bet(p_amount, p_currency);
  perform public._lock_stats(uid);
  perform public._ensure_stats(p_opponent);
  perform public._adjust(uid, p_currency, -p_amount, 'duel:escrow');
  insert into public.duels(challenger_id, opponent_id, amount, currency)
  values (uid, p_opponent, p_amount, p_currency) returning id into did;
  return did;
end $$;

-- Acepta, cobra a ambos y decide con moneda al aire. El pozo paga con 5% de comisión.
create or replace function public.duel_accept(p_duel uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := auth.uid(); d public.duels; winner uuid; pot bigint; prize bigint;
begin
  if uid is null then raise exception 'No autenticado'; end if;
  select * into d from public.duels where id = p_duel and status = 'pending' for update;
  if not found then raise exception 'Duelo no disponible'; end if;
  if d.opponent_id <> uid then raise exception 'Este duelo no es para ti'; end if;
  perform 1 from public.user_stats where user_id in (d.challenger_id, d.opponent_id)
   order by user_id for update;                       -- orden fijo: sin deadlocks
  perform public._adjust(uid, d.currency, -d.amount, 'duel:escrow');
  winner := case when random() < 0.5 then d.challenger_id else d.opponent_id end;
  pot := d.amount::bigint * 2;
  prize := floor(pot * 0.95);
  perform public._adjust(winner, d.currency, prize, 'duel:win');
  update public.duels set status = 'resolved', winner_id = winner, resolved_at = now() where id = d.id;
  perform public._house_log(winner, 'duel', d.amount, d.currency, prize,
                            jsonb_build_object('vs', case when winner = uid then d.challenger_id else uid end));
  return jsonb_build_object('winner', winner, 'prize', prize, 'balance', public._balance(uid));
end $$;

create or replace function public.duel_cancel(p_duel uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := auth.uid(); d public.duels;
begin
  if uid is null then raise exception 'No autenticado'; end if;
  select * into d from public.duels where id = p_duel and status = 'pending' for update;
  if not found then raise exception 'Duelo no disponible'; end if;
  if uid not in (d.challenger_id, d.opponent_id) then raise exception 'No participas en este duelo'; end if;
  perform public._lock_stats(d.challenger_id);
  perform public._adjust(d.challenger_id, d.currency, d.amount, 'duel:refund');
  update public.duels
     set status = case when uid = d.challenger_id then 'cancelled' else 'declined' end,
         resolved_at = now()
   where id = d.id;
end $$;

-- ============================ PERMISOS ===============================
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig, p.proname
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and (left(p.proname, 1) = '_' or p.proname = any (array[
         'ensure_stats','mine','fish_cast','fish_reel','craft','equip_tool','sell_item',
         'sell_all_common','buy_item','use_item','upgrade_backpack','buy_golem','claim_golem',
         'get_quests','claim_quest','bet_coinflip','bet_roulette','mines_multiplier','mines_start',
         'mines_reveal','mines_cashout','mines_state','bet_slots','duel_create','duel_accept','duel_cancel']))
  loop
    execute format('revoke all on function %s from public, anon, authenticated', r.sig);
    if left(r.proname, 1) <> '_' then
      execute format('grant execute on function %s to authenticated', r.sig);
    end if;
  end loop;
end $$;

-- ============================ REALTIME ===============================
do $$ begin
  begin alter publication supabase_realtime add table public.user_stats; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.duels;      exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.casino_history; exception when duplicate_object then null; end;
end $$;

-- ============================== DATOS ================================
insert into public.items (id, name, emoji, category, rarity, sell_price, buy_price, description) values
 ('carbon','Carbón','⚫','mineral','comun',2,null,'Combustible básico.'),
 ('piedra','Piedra','🪨','mineral','comun',1,null,'Sirve para el pico de piedra.'),
 ('cobre','Cobre','🟤','mineral','comun',4,null,'Metal blando.'),
 ('hierro','Hierro','⛓️','mineral','comun',7,null,'Se funde en lingotes.'),
 ('plata','Plata','🥈','mineral','raro',18,null,'Brilla en la oscuridad.'),
 ('fosil','Fósil','🦴','mineral','raro',25,null,'Restos de una era antigua.'),
 ('oro','Oro','🪙','mineral','raro',35,null,'El favorito de los panas.'),
 ('obsidiana','Obsidiana','◼️','mineral','epico',60,null,'Vidrio volcánico.'),
 ('rubi','Rubí','🔴','mineral','epico',90,null,'Late como un corazón.'),
 ('diamante','Diamante','💎','mineral','epico',150,null,'Duro de verdad.'),
 ('materia_oscura','Materia Oscura','🌑','mineral','legendario',400,null,'Absorbe la luz.'),
 ('reliquia','Reliquia Antigua','🏺','mineral','legendario',600,null,'Susurra en idiomas muertos.'),
 ('corazon_cristal','Corazón de Cristal','💠','mineral','mitico',2500,null,'Dicen que no existe.'),
 ('madera','Madera','🪵','material','comun',3,6,'Mangos y mástiles.'),
 ('lingote_hierro','Lingote de Hierro','🔩','material','raro',40,null,'Hierro refinado.'),
 ('lingote_oro','Lingote de Oro','🟨','material','epico',130,null,'Oro refinado.'),
 ('alga','Alga','🌿','material','comun',2,null,'Útil para cebos y cañas.'),
 ('botella','Botella con Mensaje','🍾','material','raro',22,null,'¿Quién la tiró?'),
 ('sardina','Sardina','🐟','pez','comun',3,null,null),
 ('carpa','Carpa','🐠','pez','comun',5,null,null),
 ('bagre','Bagre','🐡','pez','comun',6,null,null),
 ('trucha','Trucha','🐟','pez','raro',18,null,null),
 ('salmon','Salmón','🍣','pez','raro',22,null,null),
 ('pez_dorado','Pez Dorado','✨','pez','epico',85,null,'Concede deseos (mentira).'),
 ('pulpo','Pulpo','🐙','pez','epico',110,null,null),
 ('tiburon','Tiburón','🦈','pez','legendario',350,null,null),
 ('leviatan','Cría de Leviatán','🐉','pez','mitico',1800,null,'Esto no es un pez.'),
 ('dinamita','Dinamita','🧨','consumible','raro',15,40,'Mina 5 veces de un golpe.'),
 ('pocion_suerte','Poción de Suerte','🧪','consumible','epico',40,null,'Suerte x1.5 por 10 min.'),
 ('cebo_avanzado','Cebo Avanzado','🪱','consumible','raro',8,null,'3 lanzamientos con ventaja.'),
 ('cofre','Cofre Hundido','🧰','consumible','epico',60,null,'Ábrelo: monedas y un mineral.')
on conflict (id) do nothing;

insert into public.tools (id, kind, tier, name, emoji, cooldown_s, luck) values
 ('pick_wood','pickaxe',1,'Pico de Madera','⛏️',30,1),
 ('pick_stone','pickaxe',2,'Pico de Piedra','⛏️',25,1.05),
 ('pick_iron','pickaxe',3,'Pico de Hierro','⛏️',20,1.1),
 ('pick_gold','pickaxe',4,'Pico de Oro','⛏️',15,1.2),
 ('pick_diamond','pickaxe',5,'Pico de Diamante','⛏️',12,1.35),
 ('pick_dark','pickaxe',6,'Pico de Materia Oscura','⛏️',8,1.6),
 ('rod_wood','rod',1,'Caña de Madera','🎣',30,1),
 ('rod_iron','rod',2,'Caña de Hierro','🎣',24,1.1),
 ('rod_gold','rod',3,'Caña de Oro','🎣',18,1.25),
 ('rod_crystal','rod',4,'Caña de Cristal','🎣',13,1.45),
 ('rod_abyss','rod',5,'Caña del Abismo','🎣',9,1.7)
on conflict (id) do nothing;

insert into public.zones (id, kind, name, emoji, min_level, min_tier, description, loot) values
 ('mine_1','mine','Mina de Piedra','🪨',1,1,'Carbón, piedra y cobre.',
  '[{"i":"carbon","w":45,"min":1,"max":3},{"i":"piedra","w":35,"min":1,"max":3},{"i":"cobre","w":20,"min":1,"max":2}]'),
 ('mine_3','mine','Caverna de Hierro','⛓️',3,2,'Hierro, plata y fósiles.',
  '[{"i":"hierro","w":40,"min":1,"max":3},{"i":"carbon","w":15,"min":1,"max":2},{"i":"plata","w":22,"min":1,"max":2},{"i":"fosil","w":15,"min":1,"max":1},{"i":"cobre","w":8,"min":1,"max":2}]'),
 ('mine_6','mine','Fosa Volcánica','🌋',6,3,'Oro, obsidiana y rubíes.',
  '[{"i":"oro","w":38,"min":1,"max":2},{"i":"hierro","w":20,"min":1,"max":3},{"i":"obsidiana","w":20,"min":1,"max":1},{"i":"rubi","w":12,"min":1,"max":1},{"i":"plata","w":10,"min":1,"max":2}]'),
 ('mine_10','mine','Abismo de Cristal','💠',10,4,'Diamantes, materia oscura y reliquias.',
  '[{"i":"diamante","w":35,"min":1,"max":2},{"i":"rubi","w":22,"min":1,"max":2},{"i":"oro","w":15,"min":1,"max":3},{"i":"materia_oscura","w":14,"min":1,"max":1},{"i":"reliquia","w":8,"min":1,"max":1},{"i":"corazon_cristal","w":0.8,"min":1,"max":1}]'),
 ('fish_1','water','Charca del Pantano','🐸',1,1,'Peces comunes y algas.',
  '[{"i":"sardina","w":35,"min":1,"max":2},{"i":"carpa","w":30,"min":1,"max":2},{"i":"bagre","w":15,"min":1,"max":1},{"i":"alga","w":15,"min":1,"max":3},{"i":"botella","w":5,"min":1,"max":1}]'),
 ('fish_3','water','Río Rápido','🏞️',3,2,'Truchas y salmones.',
  '[{"i":"trucha","w":30,"min":1,"max":2},{"i":"salmon","w":22,"min":1,"max":1},{"i":"carpa","w":20,"min":1,"max":2},{"i":"alga","w":15,"min":1,"max":3},{"i":"botella","w":8,"min":1,"max":1},{"i":"cofre","w":5,"min":1,"max":1}]'),
 ('fish_6','water','Océano Profundo','🌊',6,3,'Peces dorados, pulpos y algo con dientes.',
  '[{"i":"salmon","w":25,"min":1,"max":2},{"i":"pez_dorado","w":18,"min":1,"max":1},{"i":"pulpo","w":14,"min":1,"max":1},{"i":"alga","w":20,"min":1,"max":3},{"i":"botella","w":10,"min":1,"max":1},{"i":"cofre","w":8,"min":1,"max":1},{"i":"tiburon","w":4,"min":1,"max":1}]'),
 ('fish_10','water','Abismo Marino','🦑',10,4,'Lo que no debería existir.',
  '[{"i":"pulpo","w":25,"min":1,"max":2},{"i":"tiburon","w":20,"min":1,"max":1},{"i":"pez_dorado","w":15,"min":1,"max":2},{"i":"cofre","w":18,"min":1,"max":1},{"i":"alga","w":15,"min":1,"max":3},{"i":"leviatan","w":1.2,"min":1,"max":1}]')
on conflict (id) do nothing;

insert into public.recipes (id, name, emoji, kind, result_id, result_qty, ingredients, base_tool, coin_cost, min_level) values
 ('smelt_iron','Fundir Hierro','🔥','item','lingote_hierro',1,'{"hierro":3,"carbon":1}',null,0,1),
 ('smelt_gold','Fundir Oro','🔥','item','lingote_oro',1,'{"oro":3,"carbon":1}',null,0,4),
 ('pick_stone','Pico de Piedra','⛏️','tool','pick_stone',1,'{"piedra":10,"madera":5}','pick_wood',0,1),
 ('pick_iron','Pico de Hierro','⛏️','tool','pick_iron',1,'{"lingote_hierro":10,"madera":5}','pick_stone',0,3),
 ('pick_gold','Pico de Oro','⛏️','tool','pick_gold',1,'{"lingote_oro":8,"madera":5}','pick_iron',0,6),
 ('pick_diamond','Pico de Diamante','⛏️','tool','pick_diamond',1,'{"diamante":6,"lingote_oro":5,"madera":5}','pick_gold',0,9),
 ('pick_dark','Pico de Materia Oscura','⛏️','tool','pick_dark',1,'{"materia_oscura":5,"diamante":3}','pick_diamond',0,12),
 ('rod_iron','Caña de Hierro','🎣','tool','rod_iron',1,'{"lingote_hierro":6,"alga":5}','rod_wood',0,3),
 ('rod_gold','Caña de Oro','🎣','tool','rod_gold',1,'{"lingote_oro":6,"alga":8}','rod_iron',0,6),
 ('rod_crystal','Caña de Cristal','🎣','tool','rod_crystal',1,'{"rubi":4,"diamante":3,"alga":10}','rod_gold',0,9),
 ('rod_abyss','Caña del Abismo','🎣','tool','rod_abyss',1,'{"materia_oscura":4,"reliquia":2,"alga":15}','rod_crystal',0,12),
 ('dinamita','Dinamita','🧨','item','dinamita',1,'{"carbon":3,"cobre":2}',null,20,2),
 ('pocion_suerte','Poción de Suerte','🧪','item','pocion_suerte',1,'{"alga":4,"plata":1}',null,0,3),
 ('cebo_avanzado','Cebo Avanzado','🪱','item','cebo_avanzado',3,'{"alga":2,"sardina":1}',null,0,1)
on conflict (id) do nothing;
