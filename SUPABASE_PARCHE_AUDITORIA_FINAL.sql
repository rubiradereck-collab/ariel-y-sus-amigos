-- ==============================================================================
-- ARIEL Y SUS AMIGOS - PARCHE MAESTRO DE SEGURIDAD Y NUEVO JUEGO (SUPABASE SQL)
-- ==============================================================================
-- Ejecuta este script COMPLETO en el SQL Editor de tu Dashboard de Supabase.
-- Resuelve al 100% todos los puntos señalados por la auditoría de Claude:
-- 1. Cierra helpers privados (_wallet_credit, _wallet_debit, _bj_settle, etc.)
-- 2. Asegura que futuras funciones no se expongan por defecto en PostgREST
-- 3. Implementa RNG criptográfico (_secure_int) sin sesgo de módulo
-- 4. Índice único y función de recuperación para Blackjack (bj_current)
-- 5. Recompensas de economía blindadas contra condiciones de carrera (FOR UPDATE)
-- 6. Esquema y RPCs completas para el nuevo juego multijugador: "¿Quién dijo qué?"
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. CERRAR PRIVILEGIOS POR DEFECTO Y REVOCAR HELPERS PRIVADOS (prefijo _)
-- ------------------------------------------------------------------------------

-- Configurar que funciones futuras NO se expongan automáticamente a PostgREST
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;

-- Revocar acceso a TODOS los helpers privados que inician con '_'
DO $$ 
DECLARE 
  f regprocedure; 
BEGIN
  FOR f IN 
    SELECT p.oid::regprocedure 
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace 
      AND p.proname LIKE '\_%' 
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated;', f);
  END LOOP;
END $$;

-- Blindaje explícito en los helpers de billetera y trofeos
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = '_wallet_debit') THEN
    REVOKE EXECUTE ON FUNCTION public._wallet_debit(UUID, BIGINT) FROM PUBLIC, anon, authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'grant_trophy') THEN
    REVOKE EXECUTE ON FUNCTION public.grant_trophy(UUID, TEXT) FROM PUBLIC, anon, authenticated;
  END IF;
END $$;

-- Hardening de _wallet_credit con validación de importes positivos y existencia de billetera
CREATE OR REPLACE FUNCTION public._wallet_credit(p_uid uuid, p_amt bigint) 
RETURNS bigint
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public, auth, pg_temp 
AS $$
DECLARE 
  bal bigint;
BEGIN
  IF p_amt <= 0 THEN 
    RAISE EXCEPTION 'invalid_amount'; 
  END IF;
  UPDATE public.user_stats 
  SET coins = coins + p_amt 
  WHERE user_id = p_uid 
  RETURNING coins INTO bal;
  IF NOT FOUND THEN 
    RAISE EXCEPTION 'wallet_not_found'; 
  END IF;
  RETURN bal;
END $$;

REVOKE EXECUTE ON FUNCTION public._wallet_credit(UUID, BIGINT) FROM PUBLIC, anon, authenticated;

-- Red de seguridad: Restricción para impedir saldos negativos a nivel de base de datos
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_stats') THEN
    BEGIN
      ALTER TABLE public.user_stats ADD CONSTRAINT coins_nonneg CHECK (coins >= 0) NOT VALID;
      ALTER TABLE public.user_stats VALIDATE CONSTRAINT coins_nonneg;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 2. RNG CRIPTOGRÁFICO PURO (_secure_int con rejection sampling)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._secure_int(n int) 
RETURNS int
LANGUAGE plpgsql 
VOLATILE 
SET search_path = public, pg_temp 
AS $$
DECLARE 
  b bytea; 
  x bigint; 
  lim bigint;
BEGIN
  IF n < 1 THEN 
    RAISE EXCEPTION 'bad_n'; 
  END IF;
  lim := (4294967296 / n) * n;
  LOOP
    b := uuid_send(gen_random_uuid()); -- Bytes criptográficamente aleatorios
    x := (get_byte(b,0)::bigint << 24) | (get_byte(b,1)::bigint << 16)
       | (get_byte(b,2)::bigint << 8)  |  get_byte(b,3);
    IF x < lim THEN 
      RETURN (x % n)::int; 
    END IF;
  END LOOP;
END $$;

REVOKE EXECUTE ON FUNCTION public._secure_int(int) FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------------------------
-- 3. BLACKJACK: PREVENCIÓN DE CARRERAS Y RECUPERACIÓN DE MANO (bj_current)
-- ------------------------------------------------------------------------------
-- Índice único: Máximo 1 partida activa por usuario (evita carreras en bj_start)
CREATE UNIQUE INDEX IF NOT EXISTS bj_one_active ON public.bj_games (user_id) WHERE status = 'playing';

-- Helpers de Blackjack honestamente marcados como STABLE (no immutable)
CREATE OR REPLACE FUNCTION public._bj_total(h int[]) 
RETURNS int
LANGUAGE plpgsql 
STABLE 
AS $$
DECLARE t int := 0; aces int := 0; c int; r int;
BEGIN
  FOREACH c IN ARRAY h LOOP
    r := c % 13;
    IF r = 0 THEN aces := aces+1; t := t+11;
    ELSIF r >= 9 THEN t := t+10;
    ELSE t := t + r + 1; END IF;
  END LOOP;
  WHILE t > 21 AND aces > 0 LOOP t := t-10; aces := aces-1; END LOOP;
  RETURN t;
END $$;

CREATE OR REPLACE FUNCTION public._bj_view(g public.bj_games, bal bigint) 
RETURNS jsonb
LANGUAGE sql 
STABLE 
AS $$
  SELECT jsonb_build_object(
    'id',g.id,'status',g.status,'bet',g.bet,'doubled',g.doubled,
    'player',to_jsonb(g.player),'player_total',_bj_total(g.player),
    'dealer', case when g.status='finished' then to_jsonb(g.dealer) else to_jsonb(g.dealer[1:1]) end,
    'dealer_total', case when g.status='finished' then _bj_total(g.dealer) end,
    'dealer_hidden', g.status <> 'finished',
    'result',g.result,'payout',g.payout,'balance',bal) $$;

REVOKE EXECUTE ON FUNCTION public._bj_total(int[]) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._bj_view(public.bj_games, bigint) FROM PUBLIC, anon, authenticated;

-- RPC para recuperar la partida activa si el usuario recarga la página
CREATE OR REPLACE FUNCTION public.bj_current() 
RETURNS jsonb
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public, auth, pg_temp 
AS $$
DECLARE 
  uid uuid := auth.uid(); 
  g public.bj_games;
BEGIN
  IF uid IS NULL THEN 
    RAISE EXCEPTION 'not_authenticated'; 
  END IF;

  SELECT * INTO g 
  FROM public.bj_games 
  WHERE user_id = uid AND status = 'playing';

  IF NOT FOUND THEN 
    RETURN null; 
  END IF;

  RETURN public._bj_view(g, (SELECT coins FROM public.user_stats WHERE user_id = uid));
END $$;

REVOKE EXECUTE ON FUNCTION public.bj_current() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bj_current() TO authenticated;

-- ------------------------------------------------------------------------------
-- 4. ECONOMÍA Y FAUCET ATÓMICO (Bloqueo estricto con FOR UPDATE)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_daily_allowance() 
RETURNS jsonb
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public, auth, pg_temp 
AS $$
DECLARE 
  v_uid uuid := auth.uid(); 
  v_r public.user_coin_rewards;
  v_streak int := 1;
  v_reward_coins int;
  v_reward_xp int := 40;
  v_new_coins bigint;
BEGIN
  IF v_uid IS NULL THEN 
    RETURN jsonb_build_object('success', false, 'message', 'not_authenticated'); 
  END IF;

  -- Bloquear la fila del usuario para evitar doble cobro simultáneo
  v_r := public._get_or_create_coin_rewards(v_uid);

  IF v_r.last_daily_claim IS NOT NULL AND v_r.last_daily_claim > (NOW() - INTERVAL '20 hours') THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'cooldown',
      'remaining_seconds', greatest(0, extract(epoch from ((v_r.last_daily_claim + interval '20 hours') - now()))::int),
      'message', 'Ya reclamaste tu sueldo diario. Vuelve en unas horas.'
    );
  END IF;

  IF v_r.last_daily_claim IS NOT NULL AND v_r.last_daily_claim > (NOW() - INTERVAL '48 hours') THEN
    v_streak := LEAST(7, v_r.daily_streak + 1);
  ELSE
    v_streak := 1;
  END IF;

  v_reward_coins := 150 + (v_streak * 25);

  -- Actualizar racha y timestamp
  UPDATE public.user_coin_rewards
  SET last_daily_claim = NOW(),
      daily_streak = v_streak
  WHERE user_id = v_uid;

  -- Abonar saldo bajo candado en user_stats
  UPDATE public.user_stats
  SET coins = coins + v_reward_coins,
      xp = xp + v_reward_xp,
      lifetime_xp = lifetime_xp + v_reward_xp,
      level = FLOOR(SQRT((lifetime_xp + v_reward_xp) / 25.0))::int + 1,
      updated_at = NOW()
  WHERE user_id = v_uid
  RETURNING coins INTO v_new_coins;

  RETURN jsonb_build_object(
    'success', true,
    'coins_awarded', v_reward_coins,
    'xp_awarded', v_reward_xp,
    'streak', v_streak,
    'new_coins', v_new_coins,
    'message', '¡Has recibido ' || v_reward_coins || ' 🪙 y ' || v_reward_xp || ' XP!'
  );
END $$;

CREATE OR REPLACE FUNCTION public.claim_bankruptcy_aid() 
RETURNS jsonb
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public, auth, pg_temp 
AS $$
DECLARE 
  v_uid uuid := auth.uid(); 
  v_r public.user_coin_rewards;
  v_coins bigint;
  v_new_coins bigint;
BEGIN
  IF v_uid IS NULL THEN 
    RETURN jsonb_build_object('success', false, 'message', 'not_authenticated'); 
  END IF;

  -- 1. Bloqueo FOR UPDATE sobre el saldo
  SELECT coins INTO v_coins 
  FROM public.user_stats 
  WHERE user_id = v_uid 
  FOR UPDATE;

  IF v_coins IS NULL THEN v_coins := 0; END IF;

  IF v_coins >= 20 THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'not_broke',
      'message', 'Aún tienes ' || v_coins || ' 🪙. Solo puedes pedir auxilio con menos de 20 🪙.'
    );
  END IF;

  -- 2. Bloqueo FOR UPDATE sobre el registro de recompensas
  v_r := public._get_or_create_coin_rewards(v_uid);

  IF v_r.last_bankruptcy_claim IS NOT NULL AND v_r.last_bankruptcy_claim > (NOW() - INTERVAL '1 hour') THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'cooldown',
      'remaining_seconds', greatest(0, extract(epoch from ((v_r.last_bankruptcy_claim + interval '1 hour') - now()))::int),
      'message', 'El prestamista está ocupado. Vuelve en unos minutos.'
    );
  END IF;

  UPDATE public.user_coin_rewards
  SET last_bankruptcy_claim = NOW()
  WHERE user_id = v_uid;

  UPDATE public.user_stats
  SET coins = coins + 50,
      updated_at = NOW()
  WHERE user_id = v_uid
  RETURNING coins INTO v_new_coins;

  RETURN jsonb_build_object(
    'success', true,
    'coins_awarded', 50,
    'new_coins', v_new_coins,
    'message', 'El fondo de rescate clandestino te ha entregado 50 🪙.'
  );
END $$;

REVOKE EXECUTE ON FUNCTION public.claim_daily_allowance() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.claim_daily_allowance() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.claim_bankruptcy_aid() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.claim_bankruptcy_aid() TO authenticated;

-- ------------------------------------------------------------------------------
-- 5. NUEVO JUEGO MULTIJUGADOR: «¿QUIÉN DIJO QUÉ?» (MEMORIES & QUOTES)
-- ------------------------------------------------------------------------------

-- Tabla de autoría real (protegida: inaccesible por el cliente)
CREATE TABLE IF NOT EXISTS public.quote_answers (
  memory_id uuid PRIMARY KEY REFERENCES public.memories(id) ON DELETE CASCADE,
  said_by   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE
);
ALTER TABLE public.quote_answers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.quote_answers FROM PUBLIC, anon, authenticated;

-- Tabla de rondas
CREATE TABLE IF NOT EXISTS public.quote_rounds (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_id  uuid NOT NULL REFERENCES public.memories(id) ON DELETE CASCADE,
  quote      text NOT NULL,
  status     text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
  opened_by  uuid NOT NULL REFERENCES public.profiles(id),
  opened_at  timestamptz NOT NULL DEFAULT now(),
  closes_at  timestamptz NOT NULL,
  answer_id  uuid REFERENCES public.profiles(id) -- Oculto hasta que se resuelve
);
CREATE UNIQUE INDEX IF NOT EXISTS one_open_round ON public.quote_rounds ((true)) WHERE status = 'open';

-- Tabla de votos
CREATE TABLE IF NOT EXISTS public.quote_votes (
  round_id   uuid NOT NULL REFERENCES public.quote_rounds(id) ON DELETE CASCADE,
  voter_id   uuid NOT NULL REFERENCES public.profiles(id),
  guess_id   uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (round_id, voter_id) -- Imposible votar dos veces
);

ALTER TABLE public.quote_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_votes  ENABLE ROW LEVEL SECURITY;

REVOKE INSERT, UPDATE, DELETE ON public.quote_rounds, public.quote_votes FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS rounds_read ON public.quote_rounds;
CREATE POLICY rounds_read ON public.quote_rounds 
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS votes_read ON public.quote_votes;
CREATE POLICY votes_read ON public.quote_votes 
  FOR SELECT TO authenticated USING (
    voter_id = (SELECT auth.uid())
    OR EXISTS (SELECT 1 FROM public.quote_rounds r WHERE r.id = round_id AND r.status = 'resolved')
  );

-- Habilitar Realtime para las rondas
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'quote_rounds'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.quote_rounds;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- RPC: Subir una frase con su autor real
CREATE OR REPLACE FUNCTION public.add_quote(p_content text, p_said_by uuid) 
RETURNS uuid
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public, auth, pg_temp 
AS $$
DECLARE 
  uid uuid := auth.uid(); 
  mid uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF LENGTH(TRIM(p_content)) NOT BETWEEN 3 AND 280 THEN RAISE EXCEPTION 'bad_length'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_said_by) THEN RAISE EXCEPTION 'bad_speaker'; END IF;

  INSERT INTO public.memories (author_id, type, title, content)
  VALUES (uid, 'quote', LEFT(p_content, 60), p_content) 
  RETURNING id INTO mid;

  INSERT INTO public.quote_answers (memory_id, said_by) VALUES (mid, p_said_by);
  RETURN mid;
END $$;

-- Helper privado para resolver ronda y premiar
CREATE OR REPLACE FUNCTION public._qr_resolve(p_round uuid) 
RETURNS void
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public, auth, pg_temp 
AS $$
DECLARE 
  r public.quote_rounds; 
  v_speaker uuid; 
  v record; 
  v_hits int := 0;
BEGIN
  SELECT * INTO r FROM public.quote_rounds WHERE id = p_round FOR UPDATE;
  IF NOT FOUND OR r.status <> 'open' THEN RETURN; END IF;

  SELECT said_by INTO v_speaker FROM public.quote_answers WHERE memory_id = r.memory_id;

  UPDATE public.quote_rounds 
  SET status = 'resolved', answer_id = v_speaker 
  WHERE id = p_round;

  FOR v IN SELECT voter_id FROM public.quote_votes WHERE round_id = p_round AND guess_id = v_speaker LOOP
    PERFORM public._wallet_credit(v.voter_id, 50);
    v_hits := v_hits + 1;
  END LOOP;

  -- Si nadie acertó, el autor de la frase cobra por haber engañado al grupo
  IF v_hits = 0 AND EXISTS (SELECT 1 FROM public.quote_votes WHERE round_id = p_round) THEN
    PERFORM public._wallet_credit(v_speaker, 100);
  END IF;
END $$;

REVOKE EXECUTE ON FUNCTION public._qr_resolve(uuid) FROM PUBLIC, anon, authenticated;

-- RPC: Iniciar una nueva ronda
CREATE OR REPLACE FUNCTION public.qr_start_round() 
RETURNS uuid
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public, auth, pg_temp 
AS $$
DECLARE 
  uid uuid := auth.uid(); 
  m record; 
  rid uuid; 
  x uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  -- Cerrar rondas vencidas
  FOR x IN SELECT id FROM public.quote_rounds WHERE status='open' AND closes_at <= NOW() LOOP
    PERFORM public._qr_resolve(x);
  END LOOP;

  -- Tope de 10 rondas por hora para evitar inflar la economía
  IF (SELECT COUNT(*) FROM public.quote_rounds WHERE opened_at > NOW() - INTERVAL '1 hour') >= 10 THEN 
    RAISE EXCEPTION 'hourly_cap'; 
  END IF;

  -- Seleccionar una frase aleatoria
  SELECT mm.id, mm.content INTO m
  FROM public.memories mm 
  JOIN public.quote_answers a ON a.memory_id = mm.id
  WHERE mm.type = 'quote'
    AND mm.id NOT IN (SELECT memory_id FROM public.quote_rounds ORDER BY opened_at DESC LIMIT 20)
  ORDER BY random() 
  LIMIT 1;

  IF NOT FOUND THEN RAISE EXCEPTION 'no_quotes_available'; END IF;

  INSERT INTO public.quote_rounds (memory_id, quote, opened_by, closes_at)
  VALUES (m.id, m.content, uid, NOW() + INTERVAL '45 seconds') 
  RETURNING id INTO rid;

  RETURN rid;
EXCEPTION WHEN unique_violation THEN 
  RAISE EXCEPTION 'round_already_open';
END $$;

-- RPC: Emitir voto
CREATE OR REPLACE FUNCTION public.qr_vote(p_round uuid, p_guess uuid) 
RETURNS void
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public, auth, pg_temp 
AS $$
DECLARE 
  uid uuid := auth.uid(); 
  r public.quote_rounds;
  v_speaker uuid; 
  v_uploader uuid; 
  v_eligible int; 
  v_votes int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO r FROM public.quote_rounds WHERE id = p_round FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'round_not_found'; END IF;
  IF r.status <> 'open' OR NOW() >= r.closes_at THEN RAISE EXCEPTION 'round_closed'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_guess) THEN RAISE EXCEPTION 'invalid_guess'; END IF;

  SELECT a.said_by, m.author_id INTO v_speaker, v_uploader
  FROM public.quote_answers a 
  JOIN public.memories m ON m.id = a.memory_id
  WHERE a.memory_id = r.memory_id;

  -- El autor y quien la subió no pueden votar porque conocen la respuesta
  IF uid IN (v_speaker, v_uploader) THEN RAISE EXCEPTION 'not_eligible'; END IF;

  BEGIN
    INSERT INTO public.quote_votes (round_id, voter_id, guess_id) 
    VALUES (p_round, uid, p_guess);
  EXCEPTION WHEN unique_violation THEN 
    RAISE EXCEPTION 'already_voted';
  END;

  SELECT COUNT(*) INTO v_votes FROM public.quote_votes WHERE round_id = p_round;
  SELECT COUNT(*) INTO v_eligible FROM public.profiles p WHERE p.id NOT IN (v_speaker, v_uploader);
  
  -- Si todos los elegibles ya votaron, resolver de inmediato
  IF v_votes >= v_eligible THEN 
    PERFORM public._qr_resolve(p_round); 
  END IF;
END $$;

-- RPC: Cerrar por tiempo expirado
CREATE OR REPLACE FUNCTION public.qr_close_expired(p_round uuid) 
RETURNS void
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public, auth, pg_temp 
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF EXISTS (SELECT 1 FROM public.quote_rounds WHERE id = p_round AND status='open' AND closes_at <= NOW()) THEN 
    PERFORM public._qr_resolve(p_round); 
  END IF;
END $$;

-- Permisos RPC del juego
REVOKE EXECUTE ON FUNCTION public.add_quote(text,uuid), public.qr_start_round(),
  public.qr_vote(uuid,uuid), public.qr_close_expired(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.add_quote(text,uuid), public.qr_start_round(),
  public.qr_vote(uuid,uuid), public.qr_close_expired(uuid) TO authenticated;

COMMENT ON TABLE public.quote_rounds IS 'Rondas multijugador del minijuego Quién dijo qué blindadas contra dobles votos.';
