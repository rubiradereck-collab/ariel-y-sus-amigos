-- =====================================================================
-- ENTREGA_3.sql  (ejecutar completo en Supabase SQL Editor)
-- =====================================================================
create extension if not exists pgcrypto;
alter table public.user_stats add column if not exists xp bigint not null default 0;

-- ---------- 0. HELPERS ------------------------------------------------
create or replace function public._secure_int(n int) returns int
language plpgsql volatile as $$
begin
  return floor(random() * n)::int;
end $$;

create or replace function public._wallet_debit(p_uid uuid, p_amt bigint) returns bigint
language plpgsql security definer set search_path=public as $$
declare bal bigint;
begin
  if p_amt <= 0 then raise exception 'invalid_amount'; end if;
  update user_stats set coins = coins - p_amt
   where user_id = p_uid and coins >= p_amt returning coins into bal;
  if not found then raise exception 'insufficient_funds'; end if;
  return bal;
end $$;

create or replace function public._wallet_credit(p_uid uuid, p_amt bigint) returns bigint
language plpgsql security definer set search_path=public as $$
declare bal bigint;
begin
  update user_stats set coins = coins + p_amt where user_id = p_uid returning coins into bal;
  return bal;
end $$;

create or replace function public.server_time() returns double precision
language sql stable as $$ select extract(epoch from clock_timestamp())*1000 $$;

create table if not exists public.casino_log(
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  game text not null, bet bigint not null, payout bigint not null,
  detail jsonb, created_at timestamptz not null default now());
alter table public.casino_log enable row level security;
drop policy if exists "log_select_own" on public.casino_log;
create policy "log_select_own" on public.casino_log for select to authenticated using (user_id = auth.uid());
-- sin policy de INSERT/UPDATE: solo las RPC escriben

-- ---------- 1. SLOTS --------------------------------------------------
-- Pesos (por rodillo, suma 100): cherry30 lemon25 bell20 star12 diamond8 seven5
-- 3 iguales: x5/x8/x15/x40/x100/x250 · exactamente 2 cherries: x2  → RTP ≈ 91%
create or replace function public.slots_spin(p_bet bigint) returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  uid uuid := auth.uid();
  syms text[] := array['cherry','lemon','bell','star','diamond','seven'];
  w int[] := array[30,25,20,12,8,5];
  mult jsonb := '{"cherry":5,"lemon":8,"bell":15,"star":40,"diamond":100,"seven":250}';
  reels text[] := '{}'; i int; j int; r int; acc int; cherries int; m int := 0; pay bigint; bal bigint;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if p_bet < 10 or p_bet > 1000 then raise exception 'invalid_amount'; end if;
  perform _wallet_debit(uid, p_bet);
  for i in 1..3 loop
    r := _secure_int(100); acc := 0;
    for j in 1..6 loop
      acc := acc + w[j];
      if r < acc then reels := reels || syms[j]; exit; end if;
    end loop;
  end loop;
  if reels[1]=reels[2] and reels[2]=reels[3] then
    m := (mult->>reels[1])::int;
  else
    select count(*) into cherries from unnest(reels) x where x='cherry';
    if cherries = 2 then m := 2; end if;
  end if;
  pay := p_bet * m;
  if pay > 0 then bal := _wallet_credit(uid, pay);
  else select coins into bal from user_stats where user_id = uid; end if;
  insert into casino_log(user_id,game,bet,payout,detail)
    values (uid,'slots',p_bet,pay,jsonb_build_object('reels',reels,'mult',m));
  return jsonb_build_object('reels',to_jsonb(reels),'multiplier',m,'payout',pay,'balance',bal);
end $$;

-- ---------- 2. RULETA EUROPEA ----------------------------------------
-- p_bets: [{"type":"red|black|even|odd","amount":50},
--          {"type":"dozen","n":1..3,"amount":50},
--          {"type":"straight","n":0..36,"amount":10}]
-- Multiplicador = retorno total (apuesta incluida): 1:1→2, 2:1→3, 35:1→36
create or replace function public.roulette_spin(p_bets jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  uid uuid := auth.uid(); b jsonb; amt bigint; t text; n int; m int;
  total bigint := 0; pay bigint := 0; win int; bal bigint;
  reds int[] := array[1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if jsonb_typeof(p_bets) <> 'array' or jsonb_array_length(p_bets) not between 1 and 20
    then raise exception 'invalid_bets'; end if;
  for b in select * from jsonb_array_elements(p_bets) loop
    amt := (b->>'amount')::bigint;
    if amt is null or amt < 10 or amt > 5000 then raise exception 'invalid_amount'; end if;
    total := total + amt;
  end loop;
  perform _wallet_debit(uid, total);
  win := _secure_int(37);
  for b in select * from jsonb_array_elements(p_bets) loop
    amt := (b->>'amount')::bigint; t := b->>'type'; m := 0;
    if t = 'red' then if win = any(reds) then m := 2; end if;
    elsif t = 'black' then if win <> 0 and not (win = any(reds)) then m := 2; end if;
    elsif t = 'even' then if win <> 0 and win % 2 = 0 then m := 2; end if;
    elsif t = 'odd' then if win % 2 = 1 then m := 2; end if;
    elsif t = 'dozen' then
      n := (b->>'n')::int; if n not between 1 and 3 then raise exception 'invalid_bets'; end if;
      if win between (n-1)*12+1 and n*12 then m := 3; end if;
    elsif t = 'straight' then
      n := (b->>'n')::int; if n not between 0 and 36 then raise exception 'invalid_bets'; end if;
      if win = n then m := 36; end if;
    else raise exception 'invalid_bets'; end if;
    pay := pay + amt * m;
  end loop;
  if pay > 0 then bal := _wallet_credit(uid, pay);
  else select coins into bal from user_stats where user_id = uid; end if;
  insert into casino_log(user_id,game,bet,payout,detail)
    values (uid,'roulette',total,pay,jsonb_build_object('number',win,'bets',p_bets));
  return jsonb_build_object('number',win,'total_bet',total,'payout',pay,'balance',bal);
end $$;

-- ---------- 3. BLACKJACK ---------------------------------------------
-- Carta c∈0..51: rank=c%13 (0=A,1=2,…,9=10,10=J,11=Q,12=K), suit=c/13
create table if not exists public.bj_games(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  bet bigint not null, deck int[] not null, player int[] not null, dealer int[] not null,
  status text not null default 'playing' check (status in ('playing','finished')),
  doubled boolean not null default false,
  result text, payout bigint not null default 0,
  created_at timestamptz not null default now());
create unique index if not exists bj_one_active on public.bj_games(user_id) where status='playing';
alter table public.bj_games enable row level security;
-- SIN policies: el cliente jamás lee deck ni la carta oculta; todo vía RPC

create or replace function public._bj_total(h int[]) returns int
language plpgsql immutable as $$
declare t int := 0; aces int := 0; c int; r int;
begin
  foreach c in array h loop
    r := c % 13;
    if r = 0 then aces := aces+1; t := t+11;
    elsif r >= 9 then t := t+10;
    else t := t + r + 1; end if;
  end loop;
  while t > 21 and aces > 0 loop t := t-10; aces := aces-1; end loop;
  return t;
end $$;

create or replace function public._bj_view(g public.bj_games, bal bigint) returns jsonb
language sql immutable as $$
  select jsonb_build_object(
    'id',g.id,'status',g.status,'bet',g.bet,'doubled',g.doubled,
    'player',to_jsonb(g.player),'player_total',_bj_total(g.player),
    'dealer', case when g.status='finished' then to_jsonb(g.dealer) else to_jsonb(g.dealer[1:1]) end,
    'dealer_total', case when g.status='finished' then _bj_total(g.dealer) end,
    'dealer_hidden', g.status <> 'finished',
    'result',g.result,'payout',g.payout,'balance',bal) $$;

create or replace function public._bj_settle(p_id uuid) returns public.bj_games
language plpgsql security definer set search_path=public as $$
declare g bj_games; pt int; dt int; res text; pay bigint; pn boolean; dn boolean;
begin
  select * into g from bj_games where id = p_id for update;
  pt := _bj_total(g.player);
  pn := array_length(g.player,1) = 2 and pt = 21;
  dn := array_length(g.dealer,1) = 2 and _bj_total(g.dealer) = 21;
  if pt <= 21 and not pn and not dn then
    while _bj_total(g.dealer) < 17 loop            -- banca se planta en 17+
      g.dealer := g.dealer || g.deck[1];
      g.deck := g.deck[2:array_length(g.deck,1)];
    end loop;
  end if;
  dt := _bj_total(g.dealer);
  if    pt > 21           then res:='lose';      pay:=0;
  elsif pn and dn         then res:='push';      pay:=g.bet;
  elsif pn                then res:='blackjack'; pay:=g.bet + (g.bet*3)/2;   -- 3:2
  elsif dn                then res:='lose';      pay:=0;
  elsif dt > 21 or pt>dt  then res:='win';       pay:=g.bet*2;               -- 1:1
  elsif pt = dt           then res:='push';      pay:=g.bet;
  else                         res:='lose';      pay:=0; end if;
  update bj_games set dealer=g.dealer, deck=g.deck, status='finished', result=res, payout=pay
   where id=g.id returning * into g;
  if pay > 0 then perform _wallet_credit(g.user_id, pay); end if;
  insert into casino_log(user_id,game,bet,payout,detail)
    values (g.user_id,'blackjack',g.bet,pay,
            jsonb_build_object('result',res,'player',g.player,'dealer',g.dealer));
  return g;
end $$;

create or replace function public.bj_start(p_bet bigint) returns jsonb
language plpgsql security definer set search_path=public as $$
declare uid uuid := auth.uid(); deck int[]; p int[]; d int[]; g bj_games;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if p_bet < 10 or p_bet > 5000 then raise exception 'invalid_amount'; end if;
  if exists (select 1 from bj_games where user_id=uid and status='playing')
    then raise exception 'game_in_progress'; end if;
  perform _wallet_debit(uid, p_bet);
  select array_agg(x order by gen_random_uuid()) into deck from generate_series(0,51) x;
  p := array[deck[1], deck[3]];  d := array[deck[2], deck[4]];   -- d[1]=visible, d[2]=oculta
  insert into bj_games(user_id,bet,deck,player,dealer)
    values (uid,p_bet,deck[5:52],p,d) returning * into g;
  if _bj_total(p) = 21 or _bj_total(d) = 21 then g := _bj_settle(g.id); end if;  -- peek
  return _bj_view(g, (select coins from user_stats where user_id=uid));
end $$;

create or replace function public.bj_action(p_action text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare uid uuid := auth.uid(); g bj_games;
begin
  select * into g from bj_games where user_id=uid and status='playing' for update;
  if not found then raise exception 'no_active_game'; end if;
  if p_action = 'hit' then
    update bj_games set player = player || deck[1], deck = deck[2:array_length(deck,1)]
     where id=g.id returning * into g;
    if _bj_total(g.player) >= 21 then g := _bj_settle(g.id); end if;
  elsif p_action = 'stand' then
    g := _bj_settle(g.id);
  elsif p_action = 'double' then
    if array_length(g.player,1) <> 2 then raise exception 'double_not_allowed'; end if;
    perform _wallet_debit(uid, g.bet);
    update bj_games set bet=bet*2, doubled=true,
           player = player || deck[1], deck = deck[2:array_length(deck,1)]
     where id=g.id returning * into g;
    g := _bj_settle(g.id);
  else raise exception 'invalid_action'; end if;
  return _bj_view(g, (select coins from user_stats where user_id=uid));
end $$;

create or replace function public.bj_current() returns jsonb
language sql security definer set search_path=public stable as $$
  select _bj_view(g, (select coins from user_stats where user_id=auth.uid()))
  from bj_games g where g.user_id=auth.uid() and g.status='playing' $$;

-- ---------- 4. ARCADE: SNAKE -----------------------------------------
create table if not exists public.arcade_scores(
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  game text not null check (game in ('snake')),
  score int not null check (score >= 0), duration_ms int not null,
  created_at timestamptz not null default now());
create index if not exists arcade_scores_game_score_idx on public.arcade_scores(game, score desc);
create table if not exists public.arcade_rewards(
  user_id uuid references auth.users(id) on delete cascade,
  day date not null default current_date,
  coins int not null default 0, xp int not null default 0,
  primary key (user_id, day));
alter table public.arcade_scores enable row level security;
alter table public.arcade_rewards enable row level security;
drop policy if exists "scores_read" on public.arcade_scores;
create policy "scores_read" on public.arcade_scores for select to authenticated using (true);
drop policy if exists "rewards_own" on public.arcade_rewards;
create policy "rewards_own" on public.arcade_rewards for select to authenticated using (user_id = auth.uid());

create or replace view public.arcade_leaderboard with (security_invoker = true) as
  select s.game, s.user_id, p.username, p.avatar_url, max(s.score) as best, max(s.created_at) as last_play
  from public.arcade_scores s left join public.profiles p on p.id = s.user_id
  group by s.game, s.user_id, p.username, p.avatar_url;

-- Anti-trampa heurística: mínimo 120 ms por punto. Tope diario de recompensa: 200 monedas.
create or replace function public.arcade_submit_score(p_game text, p_score int, p_duration_ms int)
returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid := auth.uid(); got int; cap int := 200; used int; coins_r int; xp_r int; bal bigint;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if p_game <> 'snake' or p_score < 0 or p_score > 2000 or p_duration_ms < p_score*120
     or p_duration_ms > 3600000 then raise exception 'invalid_score'; end if;
  insert into arcade_scores(user_id,game,score,duration_ms) values (uid,p_game,p_score,p_duration_ms);
  insert into arcade_rewards(user_id) values (uid) on conflict do nothing;
  select coins into used from arcade_rewards where user_id=uid and day=current_date for update;
  coins_r := greatest(0, least(p_score/2, cap - coalesce(used, 0)));
  xp_r := p_score;
  update arcade_rewards set coins=coins+coins_r, xp=xp+xp_r where user_id=uid and day=current_date;
  update user_stats set coins=coins+coins_r, xp=xp+xp_r where user_id=uid returning coins into bal;
  return jsonb_build_object('coins',coins_r,'xp',xp_r,'balance',bal,'daily_left',cap-coalesce(used,0)-coins_r);
end $$;

-- ---------- 5. TIC-TAC-TOE (PvP realtime) ----------------------------
create table if not exists public.ttt_games(
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references auth.users(id) on delete cascade,   -- juega X
  guest_id uuid references auth.users(id) on delete cascade,           -- juega O
  board text not null default '---------' check (char_length(board)=9),
  turn_user uuid, status text not null default 'waiting'
    check (status in ('waiting','playing','finished')),
  winner uuid, is_draw boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
alter table public.ttt_games enable row level security;
drop policy if exists "ttt_read" on public.ttt_games;
create policy "ttt_read" on public.ttt_games for select to authenticated
  using (status='waiting' or host_id=auth.uid() or guest_id=auth.uid());
-- escritura solo vía RPC

create or replace function public._ttt_winner(b text) returns text
language plpgsql immutable as $$
declare l int[][] := array[[1,2,3],[4,5,6],[7,8,9],[1,4,7],[2,5,8],[3,6,9],[1,5,9],[3,5,7]]; i int;
begin
  for i in 1..8 loop
    if substr(b,l[i][1],1) <> '-' and substr(b,l[i][1],1)=substr(b,l[i][2],1)
       and substr(b,l[i][2],1)=substr(b,l[i][3],1) then return substr(b,l[i][1],1); end if;
  end loop;
  if position('-' in b)=0 then return 'D'; end if;
  return null;
end $$;

create or replace function public.ttt_create() returns uuid
language plpgsql security definer set search_path=public as $$
declare uid uuid := auth.uid(); gid uuid;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  delete from ttt_games where host_id=uid and status='waiting';
  insert into ttt_games(host_id,turn_user) values (uid,uid) returning id into gid;
  return gid;
end $$;

create or replace function public.ttt_join(p_id uuid) returns ttt_games
language plpgsql security definer set search_path=public as $$
declare g ttt_games;
begin
  update ttt_games set guest_id=auth.uid(), status='playing', updated_at=now()
   where id=p_id and status='waiting' and host_id<>auth.uid() returning * into g;
  if not found then raise exception 'cannot_join'; end if;
  return g;
end $$;

create or replace function public.ttt_move(p_id uuid, p_pos int) returns ttt_games
language plpgsql security definer set search_path=public as $$
declare uid uuid := auth.uid(); g ttt_games; sym text; w text;
begin
  select * into g from ttt_games where id=p_id for update;
  if not found or g.status <> 'playing' then raise exception 'not_playing'; end if;
  if g.turn_user <> uid then raise exception 'not_your_turn'; end if;
  if p_pos not between 1 and 9 or substr(g.board,p_pos,1) <> '-' then raise exception 'invalid_move'; end if;
  sym := case when uid = g.host_id then 'X' else 'O' end;
  g.board := overlay(g.board placing sym from p_pos for 1);
  w := _ttt_winner(g.board);
  update ttt_games set board=g.board, updated_at=now(),
    status = case when w is null then 'playing' else 'finished' end,
    is_draw = (w = 'D'),
    winner = case when w in ('X','O') then uid end,
    turn_user = case when w is null then (case when uid=host_id then guest_id else host_id end) end
  where id=p_id returning * into g;
  return g;
end $$;

-- ---------- 6. WATCHPARTY --------------------------------------------
create table if not exists public.wp_rooms(
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  is_general boolean not null default false,
  host_id uuid references auth.users(id) on delete set null,
  control text not null default 'everyone' check (control in ('everyone','host')),
  created_at timestamptz not null default now());
create table if not exists public.wp_state(
  room_id uuid primary key references public.wp_rooms(id) on delete cascade,
  video_type text check (video_type in ('file','hls','youtube')),
  video_url text, is_playing boolean not null default false,
  position_sec double precision not null default 0,   -- posición en el instante updated_at
  updated_at timestamptz not null default now(),
  updated_by uuid, rev bigint not null default 0);
create table if not exists public.wp_messages(
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.wp_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 500),
  created_at timestamptz not null default now());
create index if not exists wp_messages_room_created_idx on public.wp_messages(room_id, created_at);
alter table public.wp_rooms enable row level security;
alter table public.wp_state enable row level security;
alter table public.wp_messages enable row level security;

drop policy if exists "wp_rooms_read" on public.wp_rooms;
create policy "wp_rooms_read" on public.wp_rooms for select to authenticated using (true);
drop policy if exists "wp_rooms_ins" on public.wp_rooms;
create policy "wp_rooms_ins" on public.wp_rooms for insert to authenticated
  with check (host_id = auth.uid() and is_general = false);
drop policy if exists "wp_state_read" on public.wp_state;
create policy "wp_state_read" on public.wp_state for select to authenticated using (true);
drop policy if exists "wp_msg_read" on public.wp_messages;
create policy "wp_msg_read" on public.wp_messages for select to authenticated using (true);
drop policy if exists "wp_msg_ins" on public.wp_messages;
create policy "wp_msg_ins" on public.wp_messages for insert to authenticated with check (user_id = auth.uid());

create or replace function public._wp_state_init() returns trigger
language plpgsql security definer set search_path=public as $$
begin insert into wp_state(room_id) values (new.id) on conflict do nothing; return new; end $$;
drop trigger if exists wp_rooms_init on public.wp_rooms;
create trigger wp_rooms_init after insert on public.wp_rooms for each row execute function public._wp_state_init();

insert into public.wp_rooms(id,name,is_general) values
  ('00000000-0000-0000-0000-000000000001','Sala general',true) on conflict do nothing;
insert into public.wp_state(room_id) values ('00000000-0000-0000-0000-000000000001') on conflict do nothing;

-- Bucket watchparty para archivos de video compartidos
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('watchparty', 'watchparty', true, 52428800,
   array['video/mp4','video/webm','video/ogg'])
on conflict (id) do nothing;

drop policy if exists "watchparty_select" on storage.objects;
create policy "watchparty_select" on storage.objects for select to public using (bucket_id = 'watchparty');
drop policy if exists "watchparty_insert" on storage.objects;
create policy "watchparty_insert" on storage.objects for insert to authenticated with check (bucket_id = 'watchparty');

-- p_action: play | pause | seek | load
create or replace function public.wp_control(
  p_room uuid, p_action text, p_position double precision default null,
  p_type text default null, p_url text default null) returns wp_state
language plpgsql security definer set search_path=public as $$
declare r wp_rooms; s wp_state;
begin
  select * into r from wp_rooms where id=p_room;
  if not found then raise exception 'room_not_found'; end if;
  if r.control='host' and r.host_id is distinct from auth.uid() then raise exception 'host_only'; end if;
  if p_action = 'load' then
    if p_type not in ('file','hls','youtube') or p_url !~ '^https?://' then raise exception 'invalid_video'; end if;
    update wp_state set video_type=p_type, video_url=p_url, is_playing=false, position_sec=0,
           updated_at=now(), updated_by=auth.uid(), rev=rev+1 where room_id=p_room returning * into s;
  elsif p_action in ('play','pause','seek') then
    update wp_state set
      is_playing = case p_action when 'play' then true when 'pause' then false else is_playing end,
      position_sec = coalesce(p_position, position_sec),
      updated_at=now(), updated_by=auth.uid(), rev=rev+1 where room_id=p_room returning * into s;
  else raise exception 'invalid_action'; end if;
  return s;
end $$;

-- ---------- 7. CHAT ---------------------------------------------------
do $$
begin
  alter table public.messages add column if not exists reply_to uuid references public.messages(id) on delete set null;
exception when others then null;
end $$;
do $$
begin
  alter table public.chat_messages add column if not exists reply_to uuid references public.chat_messages(id) on delete set null;
exception when others then null;
end $$;

create table if not exists public.message_reactions(
  message_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null check (char_length(emoji) <= 8),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji));
alter table public.message_reactions enable row level security;
drop policy if exists "react_read" on public.message_reactions;
create policy "react_read" on public.message_reactions for select to authenticated using (true);
drop policy if exists "react_ins" on public.message_reactions;
create policy "react_ins"  on public.message_reactions for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "react_del" on public.message_reactions;
create policy "react_del"  on public.message_reactions for delete to authenticated using (user_id = auth.uid());

-- ---------- 8. REALTIME + PERMISOS -----------------------------------
do $$
begin
  alter publication supabase_realtime add table public.ttt_games;
exception when others then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.wp_state;
exception when others then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.wp_messages;
exception when others then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.message_reactions;
exception when others then null;
end $$;

revoke all on function public._secure_int(int), public._wallet_debit(uuid,bigint),
  public._wallet_credit(uuid,bigint), public._bj_settle(uuid) from public, anon, authenticated;
revoke all on function public.slots_spin(bigint), public.roulette_spin(jsonb), public.bj_start(bigint),
  public.bj_action(text), public.bj_current(), public.arcade_submit_score(text,int,int),
  public.ttt_create(), public.ttt_join(uuid), public.ttt_move(uuid,int),
  public.wp_control(uuid,text,double precision,text,text) from public, anon;
grant execute on function public.slots_spin(bigint), public.roulette_spin(jsonb), public.bj_start(bigint),
  public.bj_action(text), public.bj_current(), public.arcade_submit_score(text,int,int),
  public.ttt_create(), public.ttt_join(uuid), public.ttt_move(uuid,int),
  public.wp_control(uuid,text,double precision,text,text), public.server_time() to authenticated;
