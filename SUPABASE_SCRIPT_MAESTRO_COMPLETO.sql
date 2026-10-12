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
-- ARIEL Y SUS AMIGOS (Y JOEL) Â· economia_v2.sql
-- Idempotente: se puede ejecutar varias veces en el SQL Editor de Supabase.
-- Ejecutar DESPUÃ‰S de supabase_schema.sql y supabase_gamification.sql.
--
-- NOTA: si ya tienes una tabla public.user_stats creada por
-- supabase_rpg_schema.sql (que NO estÃ¡ en el repo de GitHub), este script
-- solo AÃ‘ADE las columnas que falten. Revisa el bloque "MIGRACIÃ“N LEGACY".
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

-- 0.2 Impedir suplantaciÃ³n: el autor/remitente debe ser auth.uid().
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

-- 0.4 Trigger de alta de usuario: search_path fijo + sin colisiÃ³n de username.
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

-- 0.5 Ãndices que faltaban
CREATE INDEX IF NOT EXISTS idx_messages_channel_created ON public.messages (channel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_post_created    ON public.comments (post_id, created_at);
CREATE INDEX IF NOT EXISTS idx_reactions_post           ON public.reactions (post_id);
CREATE INDEX IF NOT EXISTS idx_posts_created            ON public.posts (created_at DESC);

-- ---------------------------------------------------------------------
-- 1. ECONOMÃA UNIFICADA
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

-- Por si user_stats ya existÃ­a con otras columnas:
ALTER TABLE public.user_stats ADD COLUMN IF NOT EXISTS coins bigint NOT NULL DEFAULT 500 CHECK (coins >= 0);
ALTER TABLE public.user_stats ADD COLUMN IF NOT EXISTS xp_total bigint NOT NULL DEFAULT 0 CHECK (xp_total >= 0);
ALTER TABLE public.user_stats ADD COLUMN IF NOT EXISTS level int NOT NULL DEFAULT 1;
ALTER TABLE public.user_stats ADD COLUMN IF NOT EXISTS xp_boost_until timestamptz;
ALTER TABLE public.user_stats ADD COLUMN IF NOT EXISTS xp_boost_mult numeric(3,1) NOT NULL DEFAULT 1;
ALTER TABLE public.user_stats ADD COLUMN IF NOT EXISTS total_wagered bigint NOT NULL DEFAULT 0;
ALTER TABLE public.user_stats ADD COLUMN IF NOT EXISTS biggest_win bigint NOT NULL DEFAULT 0;
ALTER TABLE public.user_stats ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- MIGRACIÃ“N LEGACY (descomenta SOLO si existe la columna xp_balance y quieres convertirla):
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

-- RLS: lectura para autenticados; ESCRITURA SOLO vÃ­a RPC.
ALTER TABLE public.user_stats     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.economy_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_history   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crash_rounds   ENABLE ROW LEVEL SECURITY;  -- sin polÃ­ticas: el crash_point queda oculto

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
  -- 48 bits aleatorios de gen_random_uuid() (se evita el nibble de versiÃ³n, pos. 13)
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

-- Ãšnico punto por el que cambia el saldo: bloquea la fila, valida y deja rastro.
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

-- Registra la jugada, actualiza estadÃ­sticas y da XP (con multiplicador si hay boost).
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
-- 3. TIENDA ATÃ“MICA
-- ---------------------------------------------------------------------
-- p_price se acepta por compatibilidad, pero NUNCA se confÃ­a en Ã©l: si no coincide
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
  PERFORM 1 FROM public.user_stats WHERE user_id = v_uid FOR UPDATE;   -- serializa compras simultÃ¡neas

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
  ('title_apostador',  'TÃ­tulo: El Apostador ðŸŽ°',      'Aparece junto a tu nombre en el chat',        'title',      300, '{"text":"El Apostador ðŸŽ°"}'),
  ('title_minero',     'TÃ­tulo: Minero Supremo â›ï¸',    'Para los que viven en la cueva',              'title',      300, '{"text":"Minero Supremo â›ï¸"}'),
  ('title_cinefilo',   'TÃ­tulo: CinÃ©filo ðŸ¿',          'Nunca se pierde una funciÃ³n',                 'title',      300, '{"text":"CinÃ©filo ðŸ¿"}'),
  ('color_oro',        'Nombre dorado',                'Tu nombre brilla en dorado',                  'name_color', 800, '{"color":"#FFD700"}'),
  ('color_neon',       'Nombre verde neÃ³n',            'Imposible no verte en el chat',               'name_color', 800, '{"color":"#39FF14"}'),
  ('color_ps_blue',    'Nombre azul PlayStation',      'El azul de siempre',                          'name_color', 600, '{"color":"#0070D1"}'),
  ('cosm_marco_ps',    'Marco de perfil PlayStation',  'Marco con los sÃ­mbolos â–³ â—‹ âœ• â–¡',              'cosmetic',  1200, '{"frame":"ps"}'),
  ('cosm_aura_fuego',  'Aura de fuego ðŸ”¥',             'Tu avatar arde (cosmÃ©tico)',                  'cosmetic',  1500, '{"aura":"fire"}'),
  ('boost_xp_x2_30',   'XP x2 (30 min)',               'Duplica la XP que ganas durante 30 minutos',  'boost',      500, '{"mult":2,"minutes":30}'),
  ('boost_xp_x3_15',   'XP x3 (15 min)',               'Triple XP durante 15 minutos',                'boost',      700, '{"mult":3,"minutes":15}'),
  ('role_parentesis',  'Rol: El del parÃ©ntesis',       'Rol cÃ³mico oficial del grupo',                'role',      1000, '{"role":"El del parÃ©ntesis"}'),
  ('role_cajero',      'Rol: Banquero del grupo ðŸ’°',   'Rol cÃ³mico: el que siempre presta',           'role',      1000, '{"role":"Banquero del grupo"}')
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
             ELSE false   -- trivia_master y otros: aÃ±adir su condiciÃ³n aquÃ­
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
-- 5. PLINKO (8 filas, RTP â‰ˆ 96.7â€“96.9 %). La trayectoria la decide el servidor;
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
-- 6. CRASH Â«To the MoonÂ» (RTP â‰ˆ 97 %). El punto de explosiÃ³n se decide al
--    empezar y NUNCA llega al cliente hasta que ya explotÃ³.
--    Multiplicador en funciÃ³n del tiempo: m(t) = e^(0.1Â·t), t en segundos.
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

-- El cliente la consulta (~cada 300-500 ms) para saber si el cohete ya explotÃ³.
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
-- 7. PERMISOS DE EJECUCIÃ“N: solo usuarios autenticados llaman a las RPC pÃºblicas
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
-- 9. STORAGE: bucket muro-media (lectura pÃºblica, subida solo a tu carpeta {uid}/...)
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
-- ARIEL Y SUS AMIGOS (Y JOEL) Â· supabase_update.sql
-- Idempotente. Ejecutar DESPUÃ‰S de economia_v2.sql.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. MURO: varios archivos por publicaciÃ³n (carrusel)
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
-- 3. JUKEBOX DEL GRUPO (cola compartida + votaciÃ³n para saltar)
--    Todos escuchan la misma canciÃ³n a la vez: el servidor guarda cuÃ¡ndo empezÃ³.
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
-- GarantÃ­a a nivel de base de datos: nunca hay dos canciones "playing".
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
    left(coalesce(nullif(trim(p_title), ''), 'Sin tÃ­tulo'), 120),
    p_url, p_kind, p_video_id, p_thumb,
    CASE WHEN v_has_playing THEN 'queued' ELSE 'playing' END,
    CASE WHEN v_has_playing THEN NULL ELSE clock_timestamp() END
  ) RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'id', v_id);
END $$;

-- Idempotente: todos los clientes la llaman cuando termina la canciÃ³n; solo avanza una vez.
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

-- Saltar: 3 votos (mayorÃ­a de 6) o lo pide quien agregÃ³ la canciÃ³n.
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
-- 4. ESTADÃSTICAS DEL GRUPO (/stats)
--    Zona horaria fija: America/Guayaquil. CÃ¡mbiala aquÃ­ si el grupo estÃ¡ en otra.
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
-- 5. REALTIME para la cola de mÃºsica
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

