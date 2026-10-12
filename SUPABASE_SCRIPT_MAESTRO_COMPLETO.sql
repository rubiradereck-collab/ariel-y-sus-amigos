-- =====================================================================
-- ARIEL Y SUS AMIGOS (Y JOEL) · SCRIPT MAESTRO UNIFICADO DE SUPABASE
-- =====================================================================
-- Ejecuta este script COMPLETO de una sola vez en el SQL Editor de Supabase.
-- Es 100% IDEMPOTENTE (se puede correr varias veces sin error).
--
-- Contenido unificado:
--   1. Endurecimiento de seguridad RLS (sin escalada admin, sin suplantación)
--   2. Economía unificada (user_stats, coins, xp_total, level, economy_ledger)
--   3. Catálogo de Tienda (12 artículos oficiales + buy_shop_item atómica + equip_item)
--   4. Minijuegos de Casino (Plinko con 8 filas + Crash con retiros y multiplicador)
--   5. Storage del Muro (bucket 'muro-media' con políticas de subida pública y segura)
--   6. Muro Multimedia (carrusel de múltiples imágenes y videos en posts.media)
--   7. Jukebox del Grupo (cola compartida music_queue, sincronización y votos skip)
--   8. Estadísticas del Grupo (/stats con streak diario, hora punta y rankings)
--   9. Publicación completa en Supabase Realtime
-- =====================================================================

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


-- =====================================================================
-- PARTE 2: ACTUALIZACIONES DE MURO, CRASH, MÚSICA Y DASHBOARD STATS
-- =====================================================================

-- =====================================================================
-- ARIEL Y SUS AMIGOS (Y JOEL) · supabase_update.sql
-- Idempotente. Ejecutar DESPUÉS de economia_v2.sql.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. MURO: varios archivos por publicación (carrusel)
--    media = [{"url": "...", "type": "image" | "video"}, ...]
--    media_url / media_type se siguen llenando con el primer archivo (compatibilidad).
-- ---------------------------------------------------------------------
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS media jsonb NOT NULL DEFAULT '[]'::jsonb
  CHECK (jsonb_typeof(media) = 'array');

-- ---------------------------------------------------------------------
-- 2. CRASH: crash_poll ahora devuelve la apuesta (para reanudar rondas)
-- ---------------------------------------------------------------------
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
  RETURN jsonb_build_object(
    'status', 'running',
    'multiplier', v_mult,
    'bet', v_round.bet,
    'elapsed', extract(epoch FROM (clock_timestamp() - v_round.started_at))
  );
END $$;

-- ---------------------------------------------------------------------
-- 3. JUKEBOX DEL GRUPO (cola compartida + votación para saltar)
--    Todos escuchan la misma canción a la vez: el servidor guarda cuándo empezó.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.music_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  added_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  url text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('youtube', 'audio')),
  video_id text,
  thumb text,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'playing', 'done')),
  started_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_music_queue_status ON public.music_queue (status, created_at);
-- Garantía a nivel de base de datos: nunca hay dos canciones "playing".
CREATE UNIQUE INDEX IF NOT EXISTS music_one_playing ON public.music_queue ((true)) WHERE status = 'playing';

CREATE TABLE IF NOT EXISTS public.music_skip_votes (
  queue_id uuid NOT NULL REFERENCES public.music_queue(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (queue_id, user_id)
);

ALTER TABLE public.music_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.music_skip_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cola lectura" ON public.music_queue;
DROP POLICY IF EXISTS "votos lectura" ON public.music_skip_votes;
CREATE POLICY "cola lectura" ON public.music_queue FOR SELECT TO authenticated USING (true);
CREATE POLICY "votos lectura" ON public.music_skip_votes FOR SELECT TO authenticated USING (true);
REVOKE INSERT, UPDATE, DELETE ON public.music_queue, public.music_skip_votes FROM authenticated, anon;

-- Estado completo de la cola + hora del servidor (para sincronizar el segundo exacto).
CREATE OR REPLACE FUNCTION public.music_state()
RETURNS jsonb LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT jsonb_build_object(
    'server_now', (extract(epoch FROM clock_timestamp()) * 1000)::bigint,
    'items', coalesce((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', q.id,
          'title', q.title,
          'url', q.url,
          'kind', q.kind,
          'video_id', q.video_id,
          'thumb', q.thumb,
          'added_by', q.added_by,
          'added_name', coalesce(p.nickname, p.username),
          'status', q.status,
          'started_at_ms', (extract(epoch FROM q.started_at) * 1000)::bigint,
          'votes', (SELECT count(*) FROM public.music_skip_votes v WHERE v.queue_id = q.id),
          'my_vote', EXISTS (SELECT 1 FROM public.music_skip_votes v WHERE v.queue_id = q.id AND v.user_id = auth.uid())
        )
        ORDER BY CASE q.status WHEN 'playing' THEN 0 ELSE 1 END, q.created_at
      )
      FROM public.music_queue q
      LEFT JOIN public.profiles p ON p.id = q.added_by
      WHERE q.status IN ('playing', 'queued')
    ), '[]'::jsonb)
  );
$$;

CREATE OR REPLACE FUNCTION public.music_add(
  p_title text, p_url text, p_kind text, p_video_id text, p_thumb text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_has_playing boolean;
  v_pending int;
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_kind NOT IN ('youtube', 'audio') THEN RAISE EXCEPTION 'invalid_kind'; END IF;
  IF p_url IS NULL OR p_url !~* '^https://' OR length(p_url) > 500 THEN RAISE EXCEPTION 'invalid_url'; END IF;
  IF p_kind = 'youtube' AND (p_video_id IS NULL OR p_video_id !~ '^[A-Za-z0-9_-]{11}$') THEN
    RAISE EXCEPTION 'invalid_video';
  END IF;
  IF p_thumb IS NOT NULL AND (p_thumb !~* '^https://' OR length(p_thumb) > 300) THEN p_thumb := NULL; END IF;

  SELECT count(*) INTO v_pending FROM public.music_queue WHERE added_by = v_uid AND status = 'queued';
  IF v_pending >= 5 THEN RAISE EXCEPTION 'queue_limit'; END IF;

  PERFORM pg_advisory_xact_lock(hashtext('music_queue'));
  SELECT EXISTS (SELECT 1 FROM public.music_queue WHERE status = 'playing') INTO v_has_playing;

  INSERT INTO public.music_queue (added_by, title, url, kind, video_id, thumb, status, started_at)
  VALUES (
    v_uid,
    left(coalesce(nullif(trim(p_title), ''), 'Sin título'), 120),
    p_url, p_kind, p_video_id, p_thumb,
    CASE WHEN v_has_playing THEN 'queued' ELSE 'playing' END,
    CASE WHEN v_has_playing THEN NULL ELSE clock_timestamp() END
  ) RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'id', v_id);
END $$;

-- Idempotente: todos los clientes la llaman cuando termina la canción; solo avanza una vez.
CREATE OR REPLACE FUNCTION public.music_advance(p_expected uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('music_queue'));

  UPDATE public.music_queue SET status = 'done' WHERE id = p_expected AND status = 'playing';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', true, 'advanced', false);
  END IF;

  UPDATE public.music_queue SET status = 'playing', started_at = clock_timestamp()
   WHERE id = (SELECT id FROM public.music_queue WHERE status = 'queued' ORDER BY created_at LIMIT 1);

  RETURN jsonb_build_object('ok', true, 'advanced', true);
END $$;

-- Saltar: 3 votos (mayoría de 6) o lo pide quien agregó la canción.
CREATE OR REPLACE FUNCTION public.music_vote_skip(p_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_q public.music_queue%ROWTYPE;
  v_votes int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO v_q FROM public.music_queue WHERE id = p_id AND status IN ('playing', 'queued');
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;

  INSERT INTO public.music_skip_votes (queue_id, user_id) VALUES (p_id, v_uid) ON CONFLICT DO NOTHING;
  SELECT count(*) INTO v_votes FROM public.music_skip_votes WHERE queue_id = p_id;

  IF v_votes >= 3 OR v_q.added_by = v_uid THEN
    IF v_q.status = 'playing' THEN
      PERFORM public.music_advance(p_id);
    ELSE
      UPDATE public.music_queue SET status = 'done' WHERE id = p_id;
    END IF;
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'votes', v_votes);
  END IF;
  RETURN jsonb_build_object('ok', true, 'skipped', false, 'votes', v_votes);
END $$;

REVOKE ALL ON FUNCTION public.music_add(text, text, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.music_advance(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.music_vote_skip(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.music_state() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.music_add(text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.music_advance(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.music_vote_skip(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.music_state() TO authenticated;

-- ---------------------------------------------------------------------
-- 4. ESTADÍSTICAS DEL GRUPO (/stats)
--    Zona horaria fija: America/Guayaquil. Cámbiala aquí si el grupo está en otra.
--    La actividad cuenta mensajes, publicaciones y jugadas de Plinko/Crash (game_history).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.stats_overview()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_users jsonb;
  v_hourly jsonb;
  v_today date := (now() AT TIME ZONE 'America/Guayaquil')::date;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  WITH act AS (
    SELECT sender_id AS uid, created_at FROM public.messages
    UNION ALL SELECT author_id, created_at FROM public.posts
    UNION ALL SELECT user_id, created_at FROM public.game_history
  ),
  dd AS (
    SELECT DISTINCT uid, (created_at AT TIME ZONE 'America/Guayaquil')::date AS d FROM act
  ),
  isl AS (
    SELECT uid, d, d - (row_number() OVER (PARTITION BY uid ORDER BY d))::int AS grp FROM dd
  ),
  runs AS (
    SELECT uid, count(*)::int AS len, max(d) AS last_d FROM isl GROUP BY uid, grp
  ),
  streak AS (
    SELECT uid,
           coalesce(max(len) FILTER (WHERE last_d >= v_today - 1), 0) AS cur,
           max(len) AS best
      FROM runs GROUP BY uid
  )
  SELECT coalesce(jsonb_agg(
           jsonb_build_object(
             'user_id', s.user_id,
             'nickname', coalesce(p.nickname, p.username),
             'avatar_url', p.avatar_url,
             'coins', s.coins,
             'xp_total', s.xp_total,
             'level', s.level,
             'total_wagered', s.total_wagered,
             'biggest_win', s.biggest_win,
             'messages', (SELECT count(*) FROM public.messages m WHERE m.sender_id = s.user_id),
             'posts', (SELECT count(*) FROM public.posts po WHERE po.author_id = s.user_id),
             'games', (SELECT count(*) FROM public.game_history g WHERE g.user_id = s.user_id),
             'current_streak', coalesce(st.cur, 0),
             'best_streak', coalesce(st.best, 0)
           ) ORDER BY s.xp_total DESC
         ), '[]'::jsonb)
    INTO v_users
    FROM public.user_stats s
    JOIN public.profiles p ON p.id = s.user_id
    LEFT JOIN streak st ON st.uid = s.user_id;

  SELECT jsonb_agg(coalesce(c.n, 0) ORDER BY h.h)
    INTO v_hourly
    FROM generate_series(0, 23) AS h(h)
    LEFT JOIN (
      SELECT extract(hour FROM created_at AT TIME ZONE 'America/Guayaquil')::int AS hr, count(*) AS n
        FROM (
          SELECT created_at FROM public.messages
          UNION ALL SELECT created_at FROM public.posts
          UNION ALL SELECT created_at FROM public.game_history
        ) a
       GROUP BY 1
    ) c ON c.hr = h.h;

  RETURN jsonb_build_object('users', v_users, 'hourly', v_hourly);
END $$;

REVOKE ALL ON FUNCTION public.stats_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.stats_overview() TO authenticated;

-- ---------------------------------------------------------------------
-- 5. REALTIME para la cola de música
-- ---------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['music_queue', 'music_skip_votes'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;


-- =====================================================================
-- PARTE 3: AVENTURA & RECOLECCIÓN (EXPANSIÓN RPG Y CORRECCIÓN DE FÓRMULA DE NIVEL)
-- =====================================================================
-- =====================================================================
-- ARIEL Y SUS AMIGOS (Y JOEL) · supabase_aventura.sql
-- Idempotente. Ejecutar DESPUÉS de supabase_rpg_schema.sql, economia_v2.sql y supabase_update.sql.
--
-- SUPUESTOS (no vi el cuerpo de tus funciones mine / fish_cast / fish_reel):
--  * Estas RPCs nuevas (adv_*) NO tocan ni reemplazan las tuyas. Comparten tablas y cooldowns
--    (mine_ready_at, fish_ready_at), así que conviven sin problema.
--  * Capacidad de mochila = 30 + 20 * backpack_level (la misma fórmula de rpg.ts). Es un tope
--    "suave": se comprueba antes de la acción; una acción puede pasarse por unos pocos objetos.
--  * XP por objeto según rareza: común 2 · raro 6 · épico 15 · legendario 40 · mítico 100.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. CORRECCIÓN: unificar XP/nivel con el sistema RPG
--    Fuente de verdad: lifetime_xp. Nivel = floor(sqrt(lifetime_xp / 25)) + 1.
--    xp_total (de economia_v2) pasa a ser un espejo de lifetime_xp.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.level_for(p_xp bigint) RETURNS int
LANGUAGE sql IMMUTABLE AS $$
  SELECT floor(sqrt(p_xp / 25.0))::int + 1;
$$;

CREATE OR REPLACE FUNCTION public.user_stats_sync() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.xp_total := NEW.lifetime_xp;
  NEW.level := public.level_for(NEW.lifetime_xp);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_user_stats_sync ON public.user_stats;
CREATE TRIGGER trg_user_stats_sync
  BEFORE INSERT OR UPDATE ON public.user_stats
  FOR EACH ROW EXECUTE FUNCTION public.user_stats_sync();

-- Re-sincroniza a todos los jugadores existentes (el UPDATE dispara el trigger)
UPDATE public.user_stats SET lifetime_xp = lifetime_xp;

-- coins nunca negativo (el esquema RPG original no tenía este CHECK)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_stats_coins_nonneg') THEN
    ALTER TABLE public.user_stats ADD CONSTRAINT user_stats_coins_nonneg CHECK (coins >= 0);
  END IF;
END $$;

-- record_game: ahora suma a xp y lifetime_xp (el trigger recalcula el nivel)
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
    xp = xp + v_gain,
    lifetime_xp = lifetime_xp + v_gain,
    updated_at = now()
  WHERE user_id = p_user;
END $$;

-- check_achievements: igual que antes, pero la XP va a xp y lifetime_xp
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
             ELSE false
           END
  LOOP
    INSERT INTO public.user_achievements (user_id, achievement_id) VALUES (v_uid, r.id) ON CONFLICT DO NOTHING;
    IF FOUND THEN
      PERFORM public.economy_apply(v_uid, r.xp_reward, 'achievement:' || r.id, r.id);
      UPDATE public.user_stats
         SET xp = xp + r.xp_reward, lifetime_xp = lifetime_xp + r.xp_reward
       WHERE user_id = v_uid;
      v_new := v_new || jsonb_build_array(r.id);
    END IF;
  END LOOP;
  RETURN jsonb_build_object('unlocked', v_new);
END $$;

-- ---------------------------------------------------------------------
-- 1. OBJETOS NUEVOS (si ya existen con el mismo id, se respetan los tuyos)
-- ---------------------------------------------------------------------
INSERT INTO public.items (id, name, emoji, category, rarity, sell_price, buy_price, description) VALUES
  ('dinamita',           'Dinamita',           '🧨', 'consumible', 'comun',  5,   40,  'Detona 3 bloques de golpe y puede revelar geodas raras.'),
  ('antorcha',           'Antorcha',           '🔦', 'consumible', 'comun',  5,   60,  'Ilumina la veta profunda: mucha más probabilidad de minerales épicos o mejores.'),
  ('pocion_suerte',      'Poción de Suerte',   '🧪', 'consumible', 'raro',   20,  150, 'Durante 30 segundos duplica los minerales que obtienes.'),
  ('geoda',              'Geoda',              '🔮', 'mineral',    'epico',  120, NULL,'Una roca hueca llena de cristales brillantes.'),
  ('carnada_brillante',  'Carnada Brillante',  '✨', 'consumible', 'raro',   15,  80,  'Atrae peces raros: el doble de probabilidad de capturas especiales.'),
  ('carnada_legendaria', 'Carnada Legendaria', '🌟', 'consumible', 'epico',  60,  400, 'Los peces legendarios no pueden resistirse. Mucho más probable un pez épico o mejor.')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------
-- 2. FUNCIONES INTERNAS
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.adv_give(p_uid uuid, p_item text, p_qty int) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_qty <= 0 THEN RETURN; END IF;
  INSERT INTO public.inventory (user_id, item_id, qty) VALUES (p_uid, p_item, p_qty)
  ON CONFLICT (user_id, item_id) DO UPDATE SET qty = public.inventory.qty + EXCLUDED.qty;
END $$;

-- Consume 1 unidad. inventory.qty tiene CHECK (qty > 0): si queda en 0 se borra la fila.
CREATE OR REPLACE FUNCTION public.adv_consume(p_uid uuid, p_item text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.inventory WHERE user_id = p_uid AND item_id = p_item AND qty = 1;
  IF FOUND THEN RETURN; END IF;
  UPDATE public.inventory SET qty = qty - 1 WHERE user_id = p_uid AND item_id = p_item AND qty > 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'no_item:%', p_item; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.adv_xp_for(p_rarity text) RETURNS int
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_rarity WHEN 'comun' THEN 2 WHEN 'raro' THEN 6 WHEN 'epico' THEN 15 WHEN 'legendario' THEN 40 ELSE 100 END;
$$;

-- Sorteo ponderado sobre zones.loot = [{i, w, min, max}, ...].
-- p_rare_mult multiplica el peso de los raros; p_epic_mult el de épicos, legendarios y míticos.
CREATE OR REPLACE FUNCTION public.adv_roll_loot(p_loot jsonb, p_rare_mult numeric, p_epic_mult numeric)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SET search_path = public AS $$
DECLARE
  r record;
  v_x double precision := public.secure_rand();
BEGIN
  WITH entries AS (
    SELECT e->>'i' AS item, (e->>'w')::numeric AS w, (e->>'min')::int AS mn, (e->>'max')::int AS mx, it.rarity
      FROM jsonb_array_elements(coalesce(p_loot, '[]'::jsonb)) e
      JOIN public.items it ON it.id = e->>'i'
  ), adj AS (
    SELECT item, mn, mx,
           w * CASE rarity WHEN 'comun' THEN 1 WHEN 'raro' THEN p_rare_mult ELSE p_epic_mult END AS wt
      FROM entries
  ), cum AS (
    SELECT item, mn, mx, sum(wt) OVER (ORDER BY item) AS acc, sum(wt) OVER () AS tot FROM adj
  )
  SELECT item, mn, mx INTO r FROM cum WHERE acc >= v_x * tot ORDER BY acc LIMIT 1;

  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN jsonb_build_object('item', r.item, 'qty', r.mn + floor(public.secure_rand() * (r.mx - r.mn + 1))::int);
END $$;

-- ---------------------------------------------------------------------
-- 3. MINERÍA: picar normal, 💥 dinamita y 🔦 antorcha
--    dinamita: 3 sorteos de golpe + 15 % de geoda. Consume 1 dinamita.
--    antorcha: x4 el peso de épicos/legendarios/míticos en esta acción. Consume 1 antorcha.
--    poción activa (luck_until): duplica la cantidad de los minerales obtenidos.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.adv_mine(p_zone text, p_dynamite boolean DEFAULT false, p_torch boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_st public.user_stats%ROWTYPE;
  v_zone public.zones%ROWTYPE;
  v_tool public.tools%ROWTYPE;
  v_rolls int := 1;
  v_loot jsonb := '[]'::jsonb;
  v_roll jsonb;
  v_item text; v_qty int; v_rar text; v_cat text;
  v_xp bigint := 0;
  v_event text := NULL;
  v_bonus bigint := 0;
  v_r double precision;
  v_cd int; v_used bigint; v_double boolean; v_geode boolean := false; v_i int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  PERFORM public.ensure_user_stats(v_uid);
  SELECT * INTO v_st FROM public.user_stats WHERE user_id = v_uid FOR UPDATE;

  SELECT * INTO v_zone FROM public.zones WHERE id = p_zone AND kind = 'mine';
  IF NOT FOUND THEN RAISE EXCEPTION 'zone_not_found'; END IF;
  IF v_st.level < v_zone.min_level THEN RAISE EXCEPTION 'level_too_low'; END IF;

  SELECT t.* INTO v_tool FROM public.user_tools ut JOIN public.tools t ON t.id = ut.tool_id
   WHERE ut.user_id = v_uid AND ut.equipped AND t.kind = 'pickaxe' LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'no_pickaxe'; END IF;
  IF v_tool.tier < v_zone.min_tier THEN RAISE EXCEPTION 'pickaxe_too_weak'; END IF;
  IF v_st.mine_ready_at > clock_timestamp() THEN RAISE EXCEPTION 'cooldown'; END IF;

  SELECT coalesce(sum(qty), 0) INTO v_used FROM public.inventory WHERE user_id = v_uid;
  IF v_used >= 30 + 20 * v_st.backpack_level THEN RAISE EXCEPTION 'bag_full'; END IF;

  IF p_dynamite THEN PERFORM public.adv_consume(v_uid, 'dinamita'); v_rolls := 3; END IF;
  IF p_torch THEN PERFORM public.adv_consume(v_uid, 'antorcha'); END IF;

  v_double := v_st.luck_until IS NOT NULL AND v_st.luck_until > clock_timestamp();

  FOR v_i IN 1..v_rolls LOOP
    v_roll := public.adv_roll_loot(
      v_zone.loot,
      v_tool.luck,
      v_tool.luck * CASE WHEN p_torch THEN 4 ELSE 1 END
    );
    CONTINUE WHEN v_roll IS NULL;
    v_item := v_roll->>'item';
    SELECT rarity, category INTO v_rar, v_cat FROM public.items WHERE id = v_item;
    v_qty := (v_roll->>'qty')::int * CASE WHEN v_double AND v_cat = 'mineral' THEN 2 ELSE 1 END;
    PERFORM public.adv_give(v_uid, v_item, v_qty);
    v_loot := v_loot || jsonb_build_array(jsonb_build_object('item', v_item, 'qty', v_qty));
    v_xp := v_xp + public.adv_xp_for(v_rar);
  END LOOP;

  IF p_dynamite AND public.secure_rand() < 0.15 THEN
    v_geode := true;
    PERFORM public.adv_give(v_uid, 'geoda', 1);
    v_loot := v_loot || jsonb_build_array(jsonb_build_object('item', 'geoda', 'qty', 1));
    v_xp := v_xp + public.adv_xp_for('epico');
  END IF;

  v_r := public.secure_rand();
  IF v_r < 0.04 THEN
    v_event := 'cofre';
    v_bonus := (50 + floor(public.secure_rand() * 150)::int) * v_tool.tier;
    PERFORM public.economy_apply(v_uid, v_bonus, 'mine:chest', p_zone);
  ELSIF v_r < 0.08 THEN
    v_event := 'derrumbe';
  END IF;

  v_cd := v_tool.cooldown_s + CASE WHEN v_event = 'derrumbe' THEN 20 ELSE 0 END;

  UPDATE public.user_stats SET
    mine_ready_at = clock_timestamp() + make_interval(secs => v_cd),
    stones_mined = stones_mined + v_rolls,
    treasures_found = treasures_found + CASE WHEN v_event = 'cofre' THEN 1 ELSE 0 END,
    xp = xp + v_xp,
    lifetime_xp = lifetime_xp + v_xp,
    updated_at = now()
  WHERE user_id = v_uid;

  RETURN jsonb_build_object(
    'loot', v_loot, 'event', v_event, 'bonus', v_bonus, 'xp', v_xp,
    'cooldown', v_cd, 'geode', v_geode, 'doubled', v_double
  );
END $$;

-- 🧪 Poción de Suerte: +30 s de duplicado de minerales (se acumulan al beber varias)
CREATE OR REPLACE FUNCTION public.adv_use_potion()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_until timestamptz;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  PERFORM public.ensure_user_stats(v_uid);
  PERFORM 1 FROM public.user_stats WHERE user_id = v_uid FOR UPDATE;
  PERFORM public.adv_consume(v_uid, 'pocion_suerte');
  UPDATE public.user_stats
     SET luck_until = greatest(coalesce(luck_until, clock_timestamp()), clock_timestamp()) + interval '30 seconds'
   WHERE user_id = v_uid
  RETURNING luck_until INTO v_until;
  RETURN jsonb_build_object('ok', true, 'luck_until', v_until);
END $$;

-- ---------------------------------------------------------------------
-- 4. PESCA CON TENSIÓN (3 pasos: lanzar -> picar -> pelear)
--    El pez se decide al lanzar y se guarda en el servidor (el cliente solo ve la dificultad).
--    El servidor valida los tiempos de picada y que la pelea dure lo que debe.
--    LIMITACIÓN: la puntuación del minijuego de tensión la calcula el cliente; el servidor
--    solo limita lo que puede ganar con ella (escapa si < 0.35, bonus si >= 0.85).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.adv_fish_sessions (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  zone_id text NOT NULL,
  bait text NOT NULL,
  item text NOT NULL,
  qty int NOT NULL,
  rarity text NOT NULL,
  bite_at timestamptz NOT NULL,
  window_ms int NOT NULL,
  fight_ms int NOT NULL,
  hooked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.adv_fish_sessions ENABLE ROW LEVEL SECURITY;  -- sin políticas: solo vía RPC
REVOKE ALL ON public.adv_fish_sessions FROM authenticated, anon;

CREATE OR REPLACE FUNCTION public.adv_fish_cast(p_zone text, p_bait text DEFAULT 'lombriz')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_st public.user_stats%ROWTYPE;
  v_zone public.zones%ROWTYPE;
  v_rod public.tools%ROWTYPE;
  v_roll jsonb; v_rar text; v_diff int;
  v_rare numeric; v_epic numeric;
  v_bite int; v_window int := 1500; v_fight int; v_used bigint;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  PERFORM public.ensure_user_stats(v_uid);
  SELECT * INTO v_st FROM public.user_stats WHERE user_id = v_uid FOR UPDATE;

  SELECT * INTO v_zone FROM public.zones WHERE id = p_zone AND kind = 'water';
  IF NOT FOUND THEN RAISE EXCEPTION 'zone_not_found'; END IF;
  IF v_st.level < v_zone.min_level THEN RAISE EXCEPTION 'level_too_low'; END IF;

  SELECT t.* INTO v_rod FROM public.user_tools ut JOIN public.tools t ON t.id = ut.tool_id
   WHERE ut.user_id = v_uid AND ut.equipped AND t.kind = 'rod' LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'no_rod'; END IF;
  IF v_rod.tier < v_zone.min_tier THEN RAISE EXCEPTION 'rod_too_weak'; END IF;
  IF v_st.fish_ready_at > clock_timestamp() THEN RAISE EXCEPTION 'cooldown'; END IF;

  SELECT coalesce(sum(qty), 0) INTO v_used FROM public.inventory WHERE user_id = v_uid;
  IF v_used >= 30 + 20 * v_st.backpack_level THEN RAISE EXCEPTION 'bag_full'; END IF;

  CASE p_bait
    WHEN 'lombriz' THEN
      v_rare := 1; v_epic := 1;
    WHEN 'carnada_brillante' THEN
      PERFORM public.adv_consume(v_uid, 'carnada_brillante'); v_rare := 2; v_epic := 2;
    WHEN 'carnada_legendaria' THEN
      PERFORM public.adv_consume(v_uid, 'carnada_legendaria'); v_rare := 3; v_epic := 5;
    ELSE
      RAISE EXCEPTION 'invalid_bait';
  END CASE;

  v_roll := public.adv_roll_loot(v_zone.loot, v_rare * v_rod.luck, v_epic * v_rod.luck);
  IF v_roll IS NULL THEN RAISE EXCEPTION 'empty_zone'; END IF;
  SELECT rarity INTO v_rar FROM public.items WHERE id = v_roll->>'item';

  v_diff := CASE v_rar WHEN 'comun' THEN 1 WHEN 'raro' THEN 2 WHEN 'epico' THEN 3 WHEN 'legendario' THEN 4 ELSE 5 END;
  v_fight := 2000 + v_diff * 900;
  v_bite := greatest(1500, 2000 + floor(public.secure_rand() * 5000)::int - v_rod.tier * 200);

  INSERT INTO public.adv_fish_sessions (user_id, zone_id, bait, item, qty, rarity, bite_at, window_ms, fight_ms, hooked_at, created_at)
  VALUES (v_uid, p_zone, p_bait, v_roll->>'item', (v_roll->>'qty')::int, v_rar,
          clock_timestamp() + make_interval(secs => v_bite / 1000.0), v_window, v_fight, NULL, now())
  ON CONFLICT (user_id) DO UPDATE SET
    zone_id = EXCLUDED.zone_id, bait = EXCLUDED.bait, item = EXCLUDED.item, qty = EXCLUDED.qty,
    rarity = EXCLUDED.rarity, bite_at = EXCLUDED.bite_at, window_ms = EXCLUDED.window_ms,
    fight_ms = EXCLUDED.fight_ms, hooked_at = NULL, created_at = now();

  -- Bloqueo provisional hasta que termine la pesca (se reemplaza por el cooldown real al resolver)
  UPDATE public.user_stats
     SET fish_ready_at = clock_timestamp() + make_interval(secs => (v_bite + v_window + v_fight) / 1000.0 + 10)
   WHERE user_id = v_uid;

  RETURN jsonb_build_object('bite_in_ms', v_bite, 'window_ms', v_window, 'fight_ms', v_fight,
                            'difficulty', v_diff, 'bait', p_bait);
END $$;

CREATE OR REPLACE FUNCTION public.adv_fish_hook()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  s public.adv_fish_sessions%ROWTYPE;
  v_now timestamptz := clock_timestamp();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO s FROM public.adv_fish_sessions WHERE user_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'no_session'; END IF;
  IF s.hooked_at IS NOT NULL THEN RAISE EXCEPTION 'already_hooked'; END IF;

  IF v_now < s.bite_at - interval '150 milliseconds' THEN
    DELETE FROM public.adv_fish_sessions WHERE user_id = v_uid;
    UPDATE public.user_stats SET fish_ready_at = clock_timestamp() + interval '8 seconds' WHERE user_id = v_uid;
    RETURN jsonb_build_object('ok', false, 'reason', 'early');
  END IF;

  IF v_now > s.bite_at + make_interval(secs => (s.window_ms / 1000.0 + 0.4)::double precision) THEN
    DELETE FROM public.adv_fish_sessions WHERE user_id = v_uid;
    UPDATE public.user_stats SET fish_ready_at = clock_timestamp() + interval '8 seconds' WHERE user_id = v_uid;
    RETURN jsonb_build_object('ok', false, 'reason', 'late');
  END IF;

  UPDATE public.adv_fish_sessions SET hooked_at = v_now WHERE user_id = v_uid;
  RETURN jsonb_build_object('ok', true, 'fight_ms', s.fight_ms);
END $$;

CREATE OR REPLACE FUNCTION public.adv_fish_reel(p_score numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  s public.adv_fish_sessions%ROWTYPE;
  v_rod public.tools%ROWTYPE;
  v_cd int := 25;
  v_perfect boolean; v_qty int; v_xp bigint;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_score IS NULL OR p_score < 0 OR p_score > 1 THEN RAISE EXCEPTION 'invalid_score'; END IF;

  SELECT * INTO s FROM public.adv_fish_sessions WHERE user_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'no_session'; END IF;
  IF s.hooked_at IS NULL THEN RAISE EXCEPTION 'not_hooked'; END IF;
  IF clock_timestamp() < s.hooked_at + make_interval(secs => (s.fight_ms * 0.85 / 1000.0)::double precision) THEN
    RAISE EXCEPTION 'too_soon';
  END IF;

  SELECT t.* INTO v_rod FROM public.user_tools ut JOIN public.tools t ON t.id = ut.tool_id
   WHERE ut.user_id = v_uid AND ut.equipped AND t.kind = 'rod' LIMIT 1;
  IF FOUND THEN v_cd := v_rod.cooldown_s; END IF;

  DELETE FROM public.adv_fish_sessions WHERE user_id = v_uid;

  IF p_score < 0.35 THEN
    UPDATE public.user_stats SET fish_ready_at = clock_timestamp() + make_interval(secs => v_cd / 2.0)
     WHERE user_id = v_uid;
    RETURN jsonb_build_object('ok', false, 'reason', 'escaped');
  END IF;

  v_perfect := p_score >= 0.85;
  v_qty := s.qty + CASE WHEN v_perfect AND s.rarity IN ('comun', 'raro') THEN 1 ELSE 0 END;
  v_xp := floor(public.adv_xp_for(s.rarity) * CASE WHEN v_perfect THEN 1.5 ELSE 1 END)::bigint;

  PERFORM public.adv_give(v_uid, s.item, v_qty);
  UPDATE public.user_stats SET
    fish_caught = fish_caught + 1,
    xp = xp + v_xp,
    lifetime_xp = lifetime_xp + v_xp,
    fish_ready_at = clock_timestamp() + make_interval(secs => v_cd),
    updated_at = now()
  WHERE user_id = v_uid;

  RETURN jsonb_build_object('ok', true, 'item', s.item, 'qty', v_qty, 'xp', v_xp,
                            'perfect', v_perfect, 'rarity', s.rarity);
END $$;

-- ---------------------------------------------------------------------
-- 5. PERMISOS
-- ---------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.adv_give(uuid, text, int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.adv_consume(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.adv_roll_loot(jsonb, numeric, numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.user_stats_sync() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.adv_mine(text, boolean, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.adv_use_potion() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.adv_fish_cast(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.adv_fish_hook() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.adv_fish_reel(numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.adv_mine(text, boolean, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.adv_use_potion() TO authenticated;
GRANT EXECUTE ON FUNCTION public.adv_fish_cast(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.adv_fish_hook() TO authenticated;
GRANT EXECUTE ON FUNCTION public.adv_fish_reel(numeric) TO authenticated;


-- =====================================================================
-- ENTREGA 1 · FIXES  (idempotente, ejecutar completo en el SQL Editor)
--   1. Tienda: corrige el mojibake de shop_items (UTF-8 correcto)
--   2. Perfil: permisos de columnas que usa /settings (bio, description)
--   3. Likes persistentes de la Galería (memory_likes + Realtime)
--   4. Storage: buckets avatars, memes y cine-videos con RLS por carpeta {uid}/
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. TIENDA · reparar textos (UPDATE por id, sin tocar precios ni inventario)
-- ---------------------------------------------------------------------
UPDATE public.shop_items AS s SET
  name = v.name, description = v.description, payload = v.payload::jsonb
FROM (VALUES
  ('title_apostador', 'Título: El Apostador 🎰',    'Aparece junto a tu nombre en el chat',       '{"text":"El Apostador 🎰"}'),
  ('title_minero',    'Título: Minero Supremo ⛏️',  'Para los que viven en la cueva',             '{"text":"Minero Supremo ⛏️"}'),
  ('title_cinefilo',  'Título: Cinéfilo 🍿',        'Nunca se pierde una función',                '{"text":"Cinéfilo 🍿"}'),
  ('color_oro',       'Nombre dorado',              'Tu nombre brilla en dorado',                 '{"color":"#FFD700"}'),
  ('color_neon',      'Nombre verde neón',          'Imposible no verte en el chat',              '{"color":"#39FF14"}'),
  ('color_ps_blue',   'Nombre azul PlayStation',    'El azul de siempre',                         '{"color":"#0070D1"}'),
  ('cosm_marco_ps',   'Marco de perfil PlayStation','Marco con los símbolos △ ○ ✕ □',            '{"frame":"ps"}'),
  ('cosm_aura_fuego', 'Aura de fuego 🔥',           'Tu avatar arde (cosmético)',                 '{"aura":"fire"}'),
  ('boost_xp_x2_30',  'XP x2 (30 min)',             'Duplica la XP que ganas durante 30 minutos', '{"mult":2,"minutes":30}'),
  ('boost_xp_x3_15',  'XP x3 (15 min)',             'Triple XP durante 15 minutos',               '{"mult":3,"minutes":15}'),
  ('role_parentesis', 'Rol: El del paréntesis',     'Rol cómico oficial del grupo',               '{"role":"El del paréntesis"}'),
  ('role_cajero',     'Rol: Banquero del grupo 💰', 'Rol cómico: el que siempre presta',          '{"role":"Banquero del grupo"}')
) AS v(id, name, description, payload)
WHERE s.id = v.id;

-- Verificación: no debe quedar ningún texto con "Ã", "â" o "ð"
-- SELECT id, name FROM public.shop_items WHERE name ~ '[ÃâðÂ]' OR description ~ '[ÃâðÂ]';

-- ---------------------------------------------------------------------
-- 2. PERFIL · /settings guarda "description" y "username", pero solo estaba
--    permitido actualizar (nickname, avatar_url, bio, last_seen) -> fallaba.
--    Se añade description y se mantiene username BLOQUEADO (es identidad).
-- ---------------------------------------------------------------------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS description text;
GRANT UPDATE (nickname, avatar_url, bio, description, last_seen) ON public.profiles TO authenticated;

-- ---------------------------------------------------------------------
-- 3. LIKES DE GALERÍA
--    memory_key es TEXT a propósito: sirve para memorias de la BD (uuid::text)
--    y para las fotos predeterminadas de /public/images (clave "def_1", ...).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.memory_likes (
  memory_key text NOT NULL CHECK (char_length(memory_key) BETWEEN 1 AND 200),
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (memory_key, user_id)
);
CREATE INDEX IF NOT EXISTS idx_memory_likes_user ON public.memory_likes (user_id);

ALTER TABLE public.memory_likes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "likes lectura"  ON public.memory_likes;
DROP POLICY IF EXISTS "likes crear"    ON public.memory_likes;
DROP POLICY IF EXISTS "likes borrar"   ON public.memory_likes;
CREATE POLICY "likes lectura" ON public.memory_likes FOR SELECT TO authenticated USING (true);
CREATE POLICY "likes crear"   ON public.memory_likes FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "likes borrar"  ON public.memory_likes FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));
GRANT SELECT, INSERT, DELETE ON public.memory_likes TO authenticated;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.memory_likes;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------
-- 4. STORAGE  (lectura pública; escribir solo dentro de tu carpeta {uid}/)
-- ---------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES
  ('avatars',    'avatars',    true, 5242880,
     ARRAY['image/jpeg','image/png','image/webp','image/gif']),
  ('memes',      'memes',      true, 10485760,
     ARRAY['image/jpeg','image/png','image/webp','image/gif']),
  -- 50 MB = tope del plan gratuito de Supabase. Súbelo en Dashboard > Storage > Settings si tienes plan Pro.
  ('cine-videos','cine-videos',true, 52428800,
     ARRAY['video/mp4','video/webm'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DO $$
DECLARE b text;
BEGIN
  FOREACH b IN ARRAY ARRAY['avatars','memes','cine-videos'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', b || ' lectura');
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', b || ' subida');
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', b || ' actualizar');
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', b || ' borrado');
    EXECUTE format('CREATE POLICY %I ON storage.objects FOR SELECT USING (bucket_id = %L)',
                   b || ' lectura', b);
    EXECUTE format($f$CREATE POLICY %I ON storage.objects FOR INSERT TO authenticated
                      WITH CHECK (bucket_id = %L AND (storage.foldername(name))[1] = (SELECT auth.uid())::text)$f$,
                   b || ' subida', b);
    EXECUTE format($f$CREATE POLICY %I ON storage.objects FOR UPDATE TO authenticated
                      USING (bucket_id = %L AND (storage.foldername(name))[1] = (SELECT auth.uid())::text)$f$,
                   b || ' actualizar', b);
    EXECUTE format($f$CREATE POLICY %I ON storage.objects FOR DELETE TO authenticated
                      USING (bucket_id = %L AND (storage.foldername(name))[1] = (SELECT auth.uid())::text)$f$,
                   b || ' borrado', b);
  END LOOP;
END $$;

-- =====================================================================
-- PARTE 4: ENTREGA 2 (MURO NO LEÍDOS/IMPORTANTES + MÚSICA COLA JUSTA Y PLAYLISTS)
-- =====================================================================
-- =====================================================================
-- ENTREGA 2 · MURO (no leídos, importantes, prefs) + MÚSICA (playlists, cola justa)
-- Idempotente. Ejecutar COMPLETO en el SQL Editor, DESPUÉS de ENTREGA_1_FIXES.sql.
-- Guardar/pegar como UTF-8.
-- =====================================================================

-- ---------------------------------------------------------------------
-- A. MURO · "no leídos desde tu última visita"
--    Tabla privada: el cliente NO la toca directo, solo vía RPC.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.wall_reads (
  user_id      uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.wall_reads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.wall_reads FROM authenticated, anon;

-- Devuelve {count, last_seen_at, first_visit}. En la 1ª visita count = 0 (no inundar con todo el historial).
CREATE OR REPLACE FUNCTION public.wall_unread()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_seen timestamptz; v_count int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT last_seen_at INTO v_seen FROM public.wall_reads WHERE user_id = v_uid;
  IF v_seen IS NULL THEN
    RETURN jsonb_build_object('count', 0, 'last_seen_at', NULL, 'first_visit', true);
  END IF;
  SELECT count(*) INTO v_count FROM public.posts WHERE created_at > v_seen AND author_id <> v_uid;
  RETURN jsonb_build_object('count', v_count, 'last_seen_at', v_seen, 'first_visit', false);
END $$;

CREATE OR REPLACE FUNCTION public.wall_mark_seen()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  INSERT INTO public.wall_reads (user_id, last_seen_at) VALUES (auth.uid(), now())
  ON CONFLICT (user_id) DO UPDATE SET last_seen_at = now();
END $$;

REVOKE ALL ON FUNCTION public.wall_unread(), public.wall_mark_seen() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wall_unread(), public.wall_mark_seen() TO authenticated;

-- ---------------------------------------------------------------------
-- B. MURO · publicaciones "importantes" (para el correo) + preferencias
-- ---------------------------------------------------------------------
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS is_important boolean NOT NULL DEFAULT false;

-- Anti-spam: máx. 3 posts importantes por autor cada 24 h; el 4º se publica como normal (sin error).
CREATE OR REPLACE FUNCTION public.posts_limit_important()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.is_important AND (
       SELECT count(*) FROM public.posts
        WHERE author_id = NEW.author_id AND is_important AND created_at > now() - interval '24 hours'
     ) >= 3 THEN
    NEW.is_important := false;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_posts_limit_important ON public.posts;
CREATE TRIGGER trg_posts_limit_important BEFORE INSERT ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.posts_limit_important();

CREATE TABLE IF NOT EXISTS public.notification_prefs (
  user_id         uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  email_important boolean NOT NULL DEFAULT true,
  updated_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.notification_prefs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "prefs propias lectura" ON public.notification_prefs;
DROP POLICY IF EXISTS "prefs propias alta"    ON public.notification_prefs;
DROP POLICY IF EXISTS "prefs propias cambio"  ON public.notification_prefs;
CREATE POLICY "prefs propias lectura" ON public.notification_prefs FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY "prefs propias alta"    ON public.notification_prefs FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "prefs propias cambio"  ON public.notification_prefs FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
GRANT SELECT, INSERT, UPDATE ON public.notification_prefs TO authenticated;

-- ---------------------------------------------------------------------
-- C. MÚSICA · cola con orden JUSTO (round-robin por usuario)
--    Con importación de playlists, una persona podría monopolizar la cola.
--    Orden: 1ª canción de cada usuario, luego 2ª de cada uno...; entre usuarios,
--    primero quien lleva más tiempo sin sonar.
-- ---------------------------------------------------------------------
ALTER TABLE public.music_queue DROP CONSTRAINT IF EXISTS music_queue_kind_check;
ALTER TABLE public.music_queue
  ADD CONSTRAINT music_queue_kind_check CHECK (kind IN ('youtube', 'audio', 'soundcloud'));

CREATE OR REPLACE VIEW public.music_queue_ranked WITH (security_invoker = true) AS
SELECT q.id, q.added_by, q.created_at,
       row_number() OVER (PARTITION BY q.added_by ORDER BY q.created_at) AS rn,
       (SELECT max(d.started_at) FROM public.music_queue d
         WHERE d.added_by = q.added_by AND d.status IN ('playing', 'done')) AS last_played
  FROM public.music_queue q
 WHERE q.status = 'queued';
GRANT SELECT ON public.music_queue_ranked TO authenticated;

-- Misma firma y mismo JSON que antes, solo cambia el ORDER BY.
CREATE OR REPLACE FUNCTION public.music_state()
RETURNS jsonb LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT jsonb_build_object(
    'server_now', (extract(epoch FROM clock_timestamp()) * 1000)::bigint,
    'items', coalesce((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', q.id, 'title', q.title, 'url', q.url, 'kind', q.kind,
          'video_id', q.video_id, 'thumb', q.thumb, 'added_by', q.added_by,
          'added_name', coalesce(p.nickname, p.username), 'status', q.status,
          'started_at_ms', (extract(epoch FROM q.started_at) * 1000)::bigint,
          'votes', (SELECT count(*) FROM public.music_skip_votes v WHERE v.queue_id = q.id),
          'my_vote', EXISTS (SELECT 1 FROM public.music_skip_votes v WHERE v.queue_id = q.id AND v.user_id = auth.uid())
        )
        ORDER BY CASE q.status WHEN 'playing' THEN 0 ELSE 1 END,
                 r.rn, r.last_played NULLS FIRST, q.created_at
      )
      FROM public.music_queue q
      LEFT JOIN public.music_queue_ranked r ON r.id = q.id
      LEFT JOIN public.profiles p ON p.id = q.added_by
      WHERE q.status IN ('playing', 'queued')
    ), '[]'::jsonb)
  );
$$;

CREATE OR REPLACE FUNCTION public.music_advance(p_expected uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('music_queue'));

  UPDATE public.music_queue SET status = 'done' WHERE id = p_expected AND status = 'playing';
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', true, 'advanced', false); END IF;

  UPDATE public.music_queue SET status = 'playing', started_at = clock_timestamp()
   WHERE id = (SELECT id FROM public.music_queue_ranked
                ORDER BY rn, last_played NULLS FIRST, created_at LIMIT 1);
  RETURN jsonb_build_object('ok', true, 'advanced', true);
END $$;

-- ---------------------------------------------------------------------
-- D. MÚSICA · alta MASIVA (playlists de YouTube) y borrado propio
--    Máx. 50 canciones por llamada y 50 en cola por usuario.
--    Las canciones inválidas se omiten (no abortan la importación).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.music_add_many(p_items jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_n int; v_pending int; v_has_playing boolean; v_base timestamptz;
  v_item jsonb; v_ord int := 0; v_added int := 0; v_skipped int := 0;
  v_kind text; v_url text; v_vid text; v_thumb text; v_title text; v_id uuid;
  v_ids uuid[] := '{}';
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN RAISE EXCEPTION 'invalid_items'; END IF;
  v_n := jsonb_array_length(p_items);
  IF v_n = 0 OR v_n > 50 THEN RAISE EXCEPTION 'invalid_items'; END IF;

  PERFORM pg_advisory_xact_lock(hashtext('music_queue'));
  SELECT count(*) INTO v_pending FROM public.music_queue WHERE added_by = v_uid AND status = 'queued';
  IF v_pending + v_n > 50 THEN RAISE EXCEPTION 'queue_limit'; END IF;
  SELECT EXISTS (SELECT 1 FROM public.music_queue WHERE status = 'playing') INTO v_has_playing;
  v_base := clock_timestamp();

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_ord   := v_ord + 1;
    v_kind  := v_item->>'kind';
    v_url   := v_item->>'url';
    v_vid   := v_item->>'video_id';
    v_thumb := v_item->>'thumb';
    v_title := left(coalesce(nullif(trim(v_item->>'title'), ''), 'Sin título'), 120);

    IF v_kind NOT IN ('youtube', 'audio', 'soundcloud')
       OR v_url IS NULL OR v_url !~* '^https://' OR length(v_url) > 500
       OR (v_kind = 'youtube' AND (v_vid IS NULL OR v_vid !~ '^[A-Za-z0-9_-]{11}$')) THEN
      v_skipped := v_skipped + 1; CONTINUE;
    END IF;
    IF v_thumb IS NOT NULL AND (v_thumb !~* '^https://' OR length(v_thumb) > 300) THEN v_thumb := NULL; END IF;

    -- created_at escalonado 1 ms: now() es igual dentro de una transacción y rompería el orden de la playlist
    INSERT INTO public.music_queue (added_by, title, url, kind, video_id, thumb, status, started_at, created_at)
    VALUES (v_uid, v_title, v_url, v_kind, v_vid, v_thumb,
            CASE WHEN v_has_playing THEN 'queued' ELSE 'playing' END,
            CASE WHEN v_has_playing THEN NULL ELSE clock_timestamp() END,
            v_base + v_ord * interval '1 millisecond')
    RETURNING id INTO v_id;

    v_has_playing := true;
    v_added := v_added + 1;
    v_ids := v_ids || v_id;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'added', v_added, 'skipped', v_skipped, 'ids', to_jsonb(v_ids));
END $$;

-- music_add (1 canción) pasa a delegar en music_add_many; el límite sube de 5 a 50.
CREATE OR REPLACE FUNCTION public.music_add(
  p_title text, p_url text, p_kind text, p_video_id text, p_thumb text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_kind NOT IN ('youtube', 'audio', 'soundcloud') THEN RAISE EXCEPTION 'invalid_kind'; END IF;
  IF p_url IS NULL OR p_url !~* '^https://' OR length(p_url) > 500 THEN RAISE EXCEPTION 'invalid_url'; END IF;
  IF p_kind = 'youtube' AND (p_video_id IS NULL OR p_video_id !~ '^[A-Za-z0-9_-]{11}$') THEN
    RAISE EXCEPTION 'invalid_video';
  END IF;
  r := public.music_add_many(jsonb_build_array(jsonb_build_object(
         'title', p_title, 'url', p_url, 'kind', p_kind, 'video_id', p_video_id, 'thumb', p_thumb)));
  RETURN jsonb_build_object('ok', true, 'id', r->'ids'->>0);
END $$;

-- Quitar MIS canciones en cola (deshacer / limpiar una playlist importada por error).
CREATE OR REPLACE FUNCTION public.music_remove(p_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rows int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  UPDATE public.music_queue SET status = 'done'
   WHERE id = p_id AND added_by = auth.uid() AND status = 'queued';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'removed', v_rows = 1);
END $$;

CREATE OR REPLACE FUNCTION public.music_clear_mine()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rows int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  UPDATE public.music_queue SET status = 'done' WHERE added_by = auth.uid() AND status = 'queued';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'removed', v_rows);
END $$;

REVOKE ALL ON FUNCTION public.music_add_many(jsonb), public.music_remove(uuid), public.music_clear_mine()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.music_add_many(jsonb), public.music_remove(uuid), public.music_clear_mine(),
  public.music_add(text, text, text, text, text), public.music_advance(uuid), public.music_state()
  TO authenticated;

-- ---------------------------------------------------------------------
-- E. STORAGE · bucket opcional "music-tracks" (botón "Compartir al Jukebox"
--    sube un mp3 local y lo encola como kind='audio'). Mismo patrón {uid}/archivo.
--    OJO: el plan gratis de Supabase tiene 1 GB de Storage en total.
-- ---------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES
  ('music-tracks', 'music-tracks', true, 20971520,
   ARRAY['audio/mpeg','audio/mp3','audio/wav','audio/x-wav','audio/mp4','audio/aac','audio/ogg'])
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

DO $$
DECLARE b text := 'music-tracks';
BEGIN
  EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', b || ' lectura');
  EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', b || ' subida');
  EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', b || ' borrado');
  EXECUTE format('CREATE POLICY %I ON storage.objects FOR SELECT USING (bucket_id = %L)', b || ' lectura', b);
  EXECUTE format($f$CREATE POLICY %I ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = %L AND (storage.foldername(name))[1] = (SELECT auth.uid())::text)$f$, b || ' subida', b);
  EXECUTE format($f$CREATE POLICY %I ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = %L AND (storage.foldername(name))[1] = (SELECT auth.uid())::text)$f$, b || ' borrado', b);
END $$;
