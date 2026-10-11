-- =====================================================================
-- ARIEL Y SUS AMIGOS (Y JOEL) · economia_v2.sql
-- Idempotente: se puede ejecutar varias veces en el SQL Editor de Supabase.
-- Ejecutar DESPUÉS de supabase_schema.sql y supabase_gamification.sql.
--
-- NOTA: si ya tienes una tabla public.user_stats creada por
-- supabase_rpg_schema.sql (que NO está en el repo de GitHub), este script
-- solo AÑADE las columnas que falten. Revisa el bloque "MIGRACIÓN LEGACY".
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. ENDURECIMIENTO DE SEGURIDAD (RLS)
-- ---------------------------------------------------------------------

-- 0.1 profiles: un usuario NO puede cambiarse el rol a 'admin'.
DROP POLICY IF EXISTS "Usuarios pueden actualizar su propio perfil" ON public.profiles;
CREATE POLICY "Usuarios pueden actualizar su propio perfil" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

REVOKE UPDATE ON public.profiles FROM authenticated, anon;
GRANT UPDATE (nickname, avatar_url, bio, last_seen) ON public.profiles TO authenticated;

-- 0.2 Impedir suplantación: el autor/remitente debe ser auth.uid().
DROP POLICY IF EXISTS "Crear posts" ON public.posts;
CREATE POLICY "Crear posts" ON public.posts
  FOR INSERT TO authenticated WITH CHECK (author_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Actualizar propios posts" ON public.posts;
CREATE POLICY "Actualizar propios posts" ON public.posts
  FOR UPDATE TO authenticated
  USING (author_id = (SELECT auth.uid()))
  WITH CHECK (author_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Crear comentarios" ON public.comments;
CREATE POLICY "Crear comentarios" ON public.comments
  FOR INSERT TO authenticated WITH CHECK (author_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "Borrar propios comentarios" ON public.comments;
CREATE POLICY "Borrar propios comentarios" ON public.comments
  FOR DELETE TO authenticated USING (author_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Crear reacciones" ON public.reactions;
CREATE POLICY "Crear reacciones" ON public.reactions
  FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Enviar mensajes" ON public.messages;
CREATE POLICY "Enviar mensajes" ON public.messages
  FOR INSERT TO authenticated WITH CHECK (sender_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "Borrar propios mensajes" ON public.messages;
CREATE POLICY "Borrar propios mensajes" ON public.messages
  FOR DELETE TO authenticated USING (sender_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Crear memories" ON public.memories;
CREATE POLICY "Crear memories" ON public.memories
  FOR INSERT TO authenticated WITH CHECK (author_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "Borrar propias memories" ON public.memories;
CREATE POLICY "Borrar propias memories" ON public.memories
  FOR DELETE TO authenticated USING (author_id = (SELECT auth.uid()));

-- 0.3 Logros y scores: ya NO se escriben desde el cliente (eran falsificables).
DROP POLICY IF EXISTS "Crear logros usuarios" ON public.user_achievements;
DROP POLICY IF EXISTS "Crear scores" ON public.game_scores;
REVOKE INSERT, UPDATE, DELETE ON public.user_achievements, public.game_scores FROM authenticated, anon;

-- 0.4 Trigger de alta de usuario: search_path fijo + sin colisión de username.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_base text := coalesce(nullif(split_part(new.email, '@', 1), ''), 'user');
  v_name text := v_base;
BEGIN
  IF EXISTS (SELECT 1 FROM public.profiles WHERE username = v_name) THEN
    v_name := v_base || '_' || substr(new.id::text, 1, 4);
  END IF;
  INSERT INTO public.profiles (id, username, nickname) VALUES (new.id, v_name, v_base);
  INSERT INTO public.user_stats (user_id) VALUES (new.id) ON CONFLICT DO NOTHING;
  RETURN new;
END $$;

-- 0.5 Índices que faltaban
CREATE INDEX IF NOT EXISTS idx_messages_channel_created ON public.messages (channel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_post_created    ON public.comments (post_id, created_at);
CREATE INDEX IF NOT EXISTS idx_reactions_post           ON public.reactions (post_id);
CREATE INDEX IF NOT EXISTS idx_posts_created            ON public.posts (created_at DESC);

-- ---------------------------------------------------------------------
-- 1. ECONOMÍA UNIFICADA
--    coins    = moneda que se gasta (tienda, apuestas)
--    xp_total = progreso permanente (NUNCA se gasta) -> define el nivel
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_stats (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  coins bigint NOT NULL DEFAULT 500 CHECK (coins >= 0),
  xp_total bigint NOT NULL DEFAULT 0 CHECK (xp_total >= 0),
  level int NOT NULL DEFAULT 1,
  xp_boost_until timestamptz,
  xp_boost_mult numeric(3,1) NOT NULL DEFAULT 1,
  total_wagered bigint NOT NULL DEFAULT 0,
  biggest_win bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Por si user_stats ya existía con otras columnas:
ALTER TABLE public.user_stats ADD COLUMN IF NOT EXISTS coins bigint NOT NULL DEFAULT 500 CHECK (coins >= 0);
ALTER TABLE public.user_stats ADD COLUMN IF NOT EXISTS xp_total bigint NOT NULL DEFAULT 0 CHECK (xp_total >= 0);
ALTER TABLE public.user_stats ADD COLUMN IF NOT EXISTS level int NOT NULL DEFAULT 1;
ALTER TABLE public.user_stats ADD COLUMN IF NOT EXISTS xp_boost_until timestamptz;
ALTER TABLE public.user_stats ADD COLUMN IF NOT EXISTS xp_boost_mult numeric(3,1) NOT NULL DEFAULT 1;
ALTER TABLE public.user_stats ADD COLUMN IF NOT EXISTS total_wagered bigint NOT NULL DEFAULT 0;
ALTER TABLE public.user_stats ADD COLUMN IF NOT EXISTS biggest_win bigint NOT NULL DEFAULT 0;
ALTER TABLE public.user_stats ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- MIGRACIÓN LEGACY (descomenta SOLO si existe la columna xp_balance y quieres convertirla):
-- UPDATE public.user_stats SET coins = coins + xp_balance WHERE xp_balance > 0;

CREATE TABLE IF NOT EXISTS public.economy_ledger (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  delta bigint NOT NULL,
  reason text NOT NULL,
  ref text,
  balance_after bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ledger_user_created ON public.economy_ledger (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.game_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  game text NOT NULL,
  bet bigint NOT NULL,
  payout bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_game_history_user ON public.game_history (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_game_history_payout ON public.game_history (payout DESC);

CREATE TABLE IF NOT EXISTS public.shop_items (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text,
  category text NOT NULL CHECK (category IN ('title','name_color','cosmetic','boost','role')),
  price int NOT NULL CHECK (price > 0),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.user_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  item_id text NOT NULL REFERENCES public.shop_items(id),
  equipped boolean NOT NULL DEFAULT false,
  acquired_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, item_id)
);

CREATE TABLE IF NOT EXISTS public.crash_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  bet bigint NOT NULL,
  crash_point numeric NOT NULL,
  started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','cashed','busted')),
  cashout_mult numeric,
  payout bigint
);
CREATE UNIQUE INDEX IF NOT EXISTS crash_one_running ON public.crash_rounds (user_id) WHERE status = 'running';

-- RLS: lectura para autenticados; ESCRITURA SOLO vía RPC.
ALTER TABLE public.user_stats     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.economy_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_history   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crash_rounds   ENABLE ROW LEVEL SECURITY;  -- sin políticas: el crash_point queda oculto

DROP POLICY IF EXISTS "stats lectura"     ON public.user_stats;
DROP POLICY IF EXISTS "ledger propio"     ON public.economy_ledger;
DROP POLICY IF EXISTS "historial lectura" ON public.game_history;
DROP POLICY IF EXISTS "tienda lectura"    ON public.shop_items;
DROP POLICY IF EXISTS "inventario lectura" ON public.user_inventory;
CREATE POLICY "stats lectura"      ON public.user_stats     FOR SELECT TO authenticated USING (true);
CREATE POLICY "ledger propio"      ON public.economy_ledger FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY "historial lectura"  ON public.game_history   FOR SELECT TO authenticated USING (true);
CREATE POLICY "tienda lectura"     ON public.shop_items     FOR SELECT TO authenticated USING (true);
CREATE POLICY "inventario lectura" ON public.user_inventory FOR SELECT TO authenticated USING (true);

REVOKE INSERT, UPDATE, DELETE ON public.user_stats, public.economy_ledger, public.game_history,
  public.shop_items, public.user_inventory FROM authenticated, anon;
REVOKE ALL ON public.crash_rounds FROM authenticated, anon;

-- Backfill: una fila de stats por cada perfil existente
INSERT INTO public.user_stats (user_id) SELECT id FROM public.profiles ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------
-- 2. FUNCIONES INTERNAS (no invocables desde el cliente)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.secure_rand() RETURNS double precision
LANGUAGE sql VOLATILE AS $$
  -- 48 bits aleatorios de gen_random_uuid() (se evita el nibble de versión, pos. 13)
  SELECT (('x' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))::bit(48)::bigint)
         / 281474976710656::double precision;
$$;

CREATE OR REPLACE FUNCTION public.level_for(p_xp bigint) RETURNS int
LANGUAGE sql IMMUTABLE AS $$
  SELECT floor(sqrt(p_xp / 100.0))::int + 1;
$$;

CREATE OR REPLACE FUNCTION public.ensure_user_stats(p_user uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.user_stats (user_id) VALUES (p_user) ON CONFLICT DO NOTHING;
$$;

-- Único punto por el que cambia el saldo: bloquea la fila, valida y deja rastro.
CREATE OR REPLACE FUNCTION public.economy_apply(p_user uuid, p_delta bigint, p_reason text, p_ref text DEFAULT NULL)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_balance bigint;
BEGIN
  SELECT coins INTO v_balance FROM public.user_stats WHERE user_id = p_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'no_stats'; END IF;
  IF v_balance + p_delta < 0 THEN RAISE EXCEPTION 'insufficient_funds'; END IF;
  UPDATE public.user_stats SET coins = coins + p_delta, updated_at = now()
   WHERE user_id = p_user RETURNING coins INTO v_balance;
  INSERT INTO public.economy_ledger (user_id, delta, reason, ref, balance_after)
  VALUES (p_user, p_delta, p_reason, p_ref, v_balance);
  RETURN v_balance;
END $$;

-- Registra la jugada, actualiza estadísticas y da XP (con multiplicador si hay boost).
CREATE OR REPLACE FUNCTION public.record_game(p_user uuid, p_game text, p_bet bigint, p_payout bigint)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_mult numeric; v_gain bigint;
BEGIN
  INSERT INTO public.game_history (user_id, game, bet, payout) VALUES (p_user, p_game, p_bet, p_payout);
  SELECT CASE WHEN xp_boost_until > now() THEN xp_boost_mult ELSE 1 END
    INTO v_mult FROM public.user_stats WHERE user_id = p_user;
  v_gain := greatest(1, floor(p_bet / 20.0 * v_mult))::bigint;
  UPDATE public.user_stats SET
    total_wagered = total_wagered + p_bet,
    biggest_win = greatest(biggest_win, p_payout),
    xp_total = xp_total + v_gain,
    level = public.level_for(xp_total + v_gain),
    updated_at = now()
  WHERE user_id = p_user;
END $$;

REVOKE ALL ON FUNCTION public.economy_apply(uuid, bigint, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_game(uuid, text, bigint, bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ensure_user_stats(uuid) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. TIENDA ATÓMICA
-- ---------------------------------------------------------------------
-- p_price se acepta por compatibilidad, pero NUNCA se confía en él: si no coincide
-- con el precio de la base de datos, se rechaza ('price_changed').
CREATE OR REPLACE FUNCTION public.buy_shop_item(p_item_id text, p_price int DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_item public.shop_items%ROWTYPE;
  v_balance bigint;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO v_item FROM public.shop_items WHERE id = p_item_id AND active;
  IF NOT FOUND THEN RAISE EXCEPTION 'item_not_found'; END IF;
  IF p_price IS NOT NULL AND p_price <> v_item.price THEN RAISE EXCEPTION 'price_changed'; END IF;

  PERFORM public.ensure_user_stats(v_uid);
  PERFORM 1 FROM public.user_stats WHERE user_id = v_uid FOR UPDATE;   -- serializa compras simultáneas

  IF v_item.category <> 'boost' AND EXISTS (
    SELECT 1 FROM public.user_inventory WHERE user_id = v_uid AND item_id = v_item.id
  ) THEN RAISE EXCEPTION 'already_owned'; END IF;

  v_balance := public.economy_apply(v_uid, -v_item.price, 'shop:' || v_item.id, v_item.id);

  IF v_item.category = 'boost' THEN
    UPDATE public.user_stats SET
      xp_boost_until = greatest(coalesce(xp_boost_until, now()), now())
                       + make_interval(mins => (v_item.payload->>'minutes')::int),
      xp_boost_mult = (v_item.payload->>'mult')::numeric
    WHERE user_id = v_uid;
  ELSE
    INSERT INTO public.user_inventory (user_id, item_id) VALUES (v_uid, v_item.id);
  END IF;

  RETURN jsonb_build_object('ok', true, 'balance', v_balance, 'item_id', v_item.id);
END $$;

CREATE OR REPLACE FUNCTION public.equip_item(p_item_id text, p_equip boolean DEFAULT true)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_cat text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT s.category INTO v_cat FROM public.user_inventory i
    JOIN public.shop_items s ON s.id = i.item_id
   WHERE i.user_id = v_uid AND i.item_id = p_item_id;
  IF v_cat IS NULL THEN RAISE EXCEPTION 'not_owned'; END IF;
  IF p_equip THEN
    UPDATE public.user_inventory i SET equipped = false
      FROM public.shop_items s
     WHERE s.id = i.item_id AND i.user_id = v_uid AND s.category = v_cat;
  END IF;
  UPDATE public.user_inventory SET equipped = p_equip WHERE user_id = v_uid AND item_id = p_item_id;
  RETURN jsonb_build_object('ok', true);
END $$;

INSERT INTO public.shop_items (id, name, description, category, price, payload) VALUES
  ('title_apostador',  'Título: El Apostador 🎰',      'Aparece junto a tu nombre en el chat',        'title',      300, '{"text":"El Apostador 🎰"}'),
  ('title_minero',     'Título: Minero Supremo ⛏️',    'Para los que viven en la cueva',              'title',      300, '{"text":"Minero Supremo ⛏️"}'),
  ('title_cinefilo',   'Título: Cinéfilo 🍿',          'Nunca se pierde una función',                 'title',      300, '{"text":"Cinéfilo 🍿"}'),
  ('color_oro',        'Nombre dorado',                'Tu nombre brilla en dorado',                  'name_color', 800, '{"color":"#FFD700"}'),
  ('color_neon',       'Nombre verde neón',            'Imposible no verte en el chat',               'name_color', 800, '{"color":"#39FF14"}'),
  ('color_ps_blue',    'Nombre azul PlayStation',      'El azul de siempre',                          'name_color', 600, '{"color":"#0070D1"}'),
  ('cosm_marco_ps',    'Marco de perfil PlayStation',  'Marco con los símbolos △ ○ ✕ □',              'cosmetic',  1200, '{"frame":"ps"}'),
  ('cosm_aura_fuego',  'Aura de fuego 🔥',             'Tu avatar arde (cosmético)',                  'cosmetic',  1500, '{"aura":"fire"}'),
  ('boost_xp_x2_30',   'XP x2 (30 min)',               'Duplica la XP que ganas durante 30 minutos',  'boost',      500, '{"mult":2,"minutes":30}'),
  ('boost_xp_x3_15',   'XP x3 (15 min)',               'Triple XP durante 15 minutos',                'boost',      700, '{"mult":3,"minutes":15}'),
  ('role_parentesis',  'Rol: El del paréntesis',       'Rol cómico oficial del grupo',                'role',      1000, '{"role":"El del paréntesis"}'),
  ('role_cajero',      'Rol: Banquero del grupo 💰',   'Rol cómico: el que siempre presta',           'role',      1000, '{"role":"Banquero del grupo"}')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, description = EXCLUDED.description, category = EXCLUDED.category,
  price = EXCLUDED.price, payload = EXCLUDED.payload;

-- ---------------------------------------------------------------------
-- 4. LOGROS (se verifican en servidor, ya no se pueden reclamar a mano)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_achievements()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); r record; v_new jsonb := '[]'::jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  PERFORM public.ensure_user_stats(v_uid);
  FOR r IN
    SELECT a.id, a.xp_reward FROM public.achievements a
     WHERE NOT EXISTS (SELECT 1 FROM public.user_achievements ua WHERE ua.user_id = v_uid AND ua.achievement_id = a.id)
       AND CASE a.id
             WHEN 'first_blood'  THEN EXISTS (SELECT 1 FROM public.messages WHERE sender_id = v_uid)
             WHEN 'wall_breaker' THEN EXISTS (SELECT 1 FROM public.posts WHERE author_id = v_uid)
             WHEN 'meme_lord'    THEN EXISTS (SELECT 1 FROM public.memories WHERE author_id = v_uid AND type = 'meme')
             ELSE false   -- trivia_master y otros: añadir su condición aquí
           END
  LOOP
    INSERT INTO public.user_achievements (user_id, achievement_id) VALUES (v_uid, r.id) ON CONFLICT DO NOTHING;
    IF FOUND THEN
      PERFORM public.economy_apply(v_uid, r.xp_reward, 'achievement:' || r.id, r.id);
      UPDATE public.user_stats
         SET xp_total = xp_total + r.xp_reward, level = public.level_for(xp_total + r.xp_reward)
       WHERE user_id = v_uid;
      v_new := v_new || jsonb_build_array(r.id);
    END IF;
  END LOOP;
  RETURN jsonb_build_object('unlocked', v_new);
END $$;

-- ---------------------------------------------------------------------
-- 5. PLINKO (8 filas, RTP ≈ 96.7–96.9 %). La trayectoria la decide el servidor;
--    el cliente solo anima la bola siguiendo "path".
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.plinko_drop(p_bet int, p_risk text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_tbl numeric[];
  v_path int[] := '{}';
  v_bin int := 0; v_dir int;
  v_mult numeric; v_payout bigint; v_balance bigint;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_bet IS NULL OR p_bet < 10 OR p_bet > 100000 THEN RAISE EXCEPTION 'invalid_bet'; END IF;

  v_tbl := CASE p_risk
    WHEN 'low'    THEN ARRAY[5.6, 2.1, 1.0, 1.0, 0.5, 1.0, 1.0, 2.1, 5.6]
    WHEN 'medium' THEN ARRAY[13, 3, 1.2, 0.7, 0.4, 0.7, 1.2, 3, 13]
    WHEN 'high'   THEN ARRAY[29, 4, 1.4, 0.3, 0.2, 0.3, 1.4, 4, 29]
    ELSE NULL END;
  IF v_tbl IS NULL THEN RAISE EXCEPTION 'invalid_risk'; END IF;

  PERFORM public.ensure_user_stats(v_uid);
  v_balance := public.economy_apply(v_uid, -p_bet, 'plinko:bet', p_risk);

  FOR i IN 1..8 LOOP
    v_dir := CASE WHEN public.secure_rand() < 0.5 THEN 0 ELSE 1 END;
    v_path := v_path || v_dir;
    v_bin := v_bin + v_dir;
  END LOOP;

  v_mult := v_tbl[v_bin + 1];
  v_payout := floor(p_bet * v_mult)::bigint;
  IF v_payout > 0 THEN
    v_balance := public.economy_apply(v_uid, v_payout, 'plinko:win', p_risk);
  END IF;
  PERFORM public.record_game(v_uid, 'plinko', p_bet, v_payout);

  RETURN jsonb_build_object('ok', true, 'path', to_jsonb(v_path), 'bin', v_bin,
                            'multiplier', v_mult, 'payout', v_payout, 'balance', v_balance);
END $$;

-- ---------------------------------------------------------------------
-- 6. CRASH «To the Moon» (RTP ≈ 97 %). El punto de explosión se decide al
--    empezar y NUNCA llega al cliente hasta que ya explotó.
--    Multiplicador en función del tiempo: m(t) = e^(0.1·t), t en segundos.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.crash_mult(p_started timestamptz) RETURNS numeric
LANGUAGE sql STABLE AS $$
  SELECT floor(exp(0.1 * extract(epoch FROM (clock_timestamp() - p_started))) * 100) / 100;
$$;

CREATE OR REPLACE FUNCTION public.crash_start(p_bet int)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_round public.crash_rounds%ROWTYPE;
  v_crash numeric; v_balance bigint; v_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_bet IS NULL OR p_bet < 10 OR p_bet > 100000 THEN RAISE EXCEPTION 'invalid_bet'; END IF;
  PERFORM public.ensure_user_stats(v_uid);
  PERFORM 1 FROM public.user_stats WHERE user_id = v_uid FOR UPDATE;

  SELECT * INTO v_round FROM public.crash_rounds WHERE user_id = v_uid AND status = 'running';
  IF FOUND THEN
    IF public.crash_mult(v_round.started_at) >= v_round.crash_point THEN
      UPDATE public.crash_rounds SET status = 'busted' WHERE id = v_round.id;
      PERFORM public.record_game(v_uid, 'crash', v_round.bet, 0);
    ELSE
      RAISE EXCEPTION 'round_in_progress';
    END IF;
  END IF;

  v_crash := least(1000.00, greatest(1.00, floor((0.97 / (1 - public.secure_rand())) * 100) / 100));
  v_balance := public.economy_apply(v_uid, -p_bet, 'crash:bet', NULL);
  INSERT INTO public.crash_rounds (user_id, bet, crash_point)
  VALUES (v_uid, p_bet, v_crash) RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'round_id', v_id, 'balance', v_balance,
                            'server_now', extract(epoch FROM clock_timestamp()));
END $$;

CREATE OR REPLACE FUNCTION public.crash_cashout()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_round public.crash_rounds%ROWTYPE;
  v_mult numeric; v_payout bigint; v_balance bigint;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  PERFORM 1 FROM public.user_stats WHERE user_id = v_uid FOR UPDATE;
  SELECT * INTO v_round FROM public.crash_rounds WHERE user_id = v_uid AND status = 'running';
  IF NOT FOUND THEN RAISE EXCEPTION 'no_active_round'; END IF;

  v_mult := public.crash_mult(v_round.started_at);
  IF v_mult >= v_round.crash_point THEN
    UPDATE public.crash_rounds SET status = 'busted' WHERE id = v_round.id;
    PERFORM public.record_game(v_uid, 'crash', v_round.bet, 0);
    RETURN jsonb_build_object('ok', false, 'busted', true, 'crash_point', v_round.crash_point);
  END IF;

  v_payout := floor(v_round.bet * v_mult)::bigint;
  v_balance := public.economy_apply(v_uid, v_payout, 'crash:win', v_round.id::text);
  UPDATE public.crash_rounds SET status = 'cashed', cashout_mult = v_mult, payout = v_payout WHERE id = v_round.id;
  PERFORM public.record_game(v_uid, 'crash', v_round.bet, v_payout);

  RETURN jsonb_build_object('ok', true, 'multiplier', v_mult, 'payout', v_payout, 'balance', v_balance);
END $$;

-- El cliente la consulta (~cada 300-500 ms) para saber si el cohete ya explotó.
CREATE OR REPLACE FUNCTION public.crash_poll()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_round public.crash_rounds%ROWTYPE;
  v_mult numeric;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  PERFORM 1 FROM public.user_stats WHERE user_id = v_uid FOR UPDATE;
  SELECT * INTO v_round FROM public.crash_rounds WHERE user_id = v_uid AND status = 'running';
  IF NOT FOUND THEN RETURN jsonb_build_object('status', 'idle'); END IF;

  v_mult := public.crash_mult(v_round.started_at);
  IF v_mult >= v_round.crash_point THEN
    UPDATE public.crash_rounds SET status = 'busted' WHERE id = v_round.id;
    PERFORM public.record_game(v_uid, 'crash', v_round.bet, 0);
    RETURN jsonb_build_object('status', 'busted', 'crash_point', v_round.crash_point);
  END IF;
  RETURN jsonb_build_object('status', 'running', 'multiplier', v_mult,
    'elapsed', extract(epoch FROM (clock_timestamp() - v_round.started_at)));
END $$;

-- ---------------------------------------------------------------------
-- 7. PERMISOS DE EJECUCIÓN: solo usuarios autenticados llaman a las RPC públicas
-- ---------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.buy_shop_item(text, int) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.equip_item(text, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.check_achievements() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.plinko_drop(int, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.crash_start(int) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.crash_cashout() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.crash_poll() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.buy_shop_item(text, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.equip_item(text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_achievements() TO authenticated;
GRANT EXECUTE ON FUNCTION public.plinko_drop(int, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.crash_start(int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.crash_cashout() TO authenticated;
GRANT EXECUTE ON FUNCTION public.crash_poll() TO authenticated;

-- ---------------------------------------------------------------------
-- 8. REALTIME: publicar las tablas que el cliente escucha
-- ---------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['user_stats', 'messages', 'posts', 'comments', 'reactions', 'user_inventory'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- 9. STORAGE: bucket muro-media (lectura pública, subida solo a tu carpeta {uid}/...)
-- ---------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('muro-media', 'muro-media', true, 52428800,
        ARRAY['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "muro-media lectura publica"  ON storage.objects;
DROP POLICY IF EXISTS "muro-media subida propia"    ON storage.objects;
DROP POLICY IF EXISTS "muro-media borrado propio"   ON storage.objects;

CREATE POLICY "muro-media lectura publica" ON storage.objects
  FOR SELECT USING (bucket_id = 'muro-media');

CREATE POLICY "muro-media subida propia" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'muro-media' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

CREATE POLICY "muro-media borrado propio" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'muro-media' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
