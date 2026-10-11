-- ==========================================================
-- SCRIPT DE AUDITORÍA Y SEGURIDAD: ARIEL Y SUS AMIGOS
-- Aplica correcciones de RLS, Prevención de Suplantación,
-- Funciones RPC Server-Side para XP y Tienda, y Realtime
-- ==========================================================

-- 1. PREVENCIÓN DE SUPLANTACIÓN DE IDENTIDAD (RLS INSERT)
-- Enforce que cada usuario SOLO pueda insertar registros a su propio nombre

DROP POLICY IF EXISTS "Enviar mensajes" ON public.messages;
CREATE POLICY "Enviar mensajes" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid());

DROP POLICY IF EXISTS "Crear posts" ON public.posts;
CREATE POLICY "Crear posts" ON public.posts
  FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid());

DROP POLICY IF EXISTS "Crear comentarios" ON public.comments;
CREATE POLICY "Crear comentarios" ON public.comments
  FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid());

DROP POLICY IF EXISTS "Crear memories" ON public.memories;
CREATE POLICY "Crear memories" ON public.memories
  FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid());

DROP POLICY IF EXISTS "Crear reacciones" ON public.reactions;
CREATE POLICY "Crear reacciones" ON public.reactions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Gamificación y Scores (si existen las tablas)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'game_scores') THEN
    DROP POLICY IF EXISTS "Insertar game_scores" ON public.game_scores;
    CREATE POLICY "Insertar game_scores" ON public.game_scores
      FOR INSERT TO authenticated
      WITH CHECK (user_id = auth.uid());
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_achievements') THEN
    DROP POLICY IF EXISTS "Insertar user_achievements" ON public.user_achievements;
    CREATE POLICY "Insertar user_achievements" ON public.user_achievements
      FOR INSERT TO authenticated
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- 2. POLÍTICAS DE BORRADO (Permitir a cada uno borrar su propio contenido)
DROP POLICY IF EXISTS "Borrar propios mensajes" ON public.messages;
CREATE POLICY "Borrar propios mensajes" ON public.messages
  FOR DELETE TO authenticated
  USING (sender_id = auth.uid());

DROP POLICY IF EXISTS "Borrar propios memories" ON public.memories;
CREATE POLICY "Borrar propios memories" ON public.memories
  FOR DELETE TO authenticated
  USING (author_id = auth.uid());

DROP POLICY IF EXISTS "Borrar propios comentarios" ON public.comments;
CREATE POLICY "Borrar propios comentarios" ON public.comments
  FOR DELETE TO authenticated
  USING (author_id = auth.uid());

-- 3. ASEGURAR COLUMNA XP Y DAILY STREAK EN PROFILES
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS xp INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_daily_reward TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS streak_count INTEGER DEFAULT 0;

-- 4. RPC SERVER-SIDE: COMPRA SEGURA EN LA TIENDA CON BLOQUEO (FOR UPDATE)
CREATE OR REPLACE FUNCTION public.buy_shop_item(p_item_id TEXT, p_price INT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_xp INT;
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  -- Bloqueo atómico de fila para prevenir compras dobles
  SELECT xp INTO v_current_xp 
  FROM public.profiles 
  WHERE id = v_user_id 
  FOR UPDATE;

  IF v_current_xp IS NULL OR v_current_xp < p_price THEN
    RETURN jsonb_build_object('success', false, 'message', 'XP insuficiente para esta compra');
  END IF;

  -- Descontar XP
  UPDATE public.profiles 
  SET xp = xp - p_price 
  WHERE id = v_user_id;

  RETURN jsonb_build_object(
    'success', true, 
    'message', 'Compra exitosa', 
    'new_xp', (v_current_xp - p_price),
    'item_id', p_item_id
  );
END;
$$;

-- 5. RPC SERVER-SIDE: COMANDOS RPG Y XP SEGURO (Evita hackeo desde consola)
CREATE OR REPLACE FUNCTION public.execute_rpg_action(p_command TEXT, p_channel_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_user_nickname TEXT;
  v_luck FLOAT := random();
  v_xp_gained INT := 0;
  v_response_text TEXT := '';
  v_action TEXT := lower(p_command);
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  SELECT coalesce(nickname, 'Alguien') INTO v_user_nickname 
  FROM public.profiles 
  WHERE id = v_user_id;

  IF v_action = '/minar' THEN
    IF v_luck > 0.9 THEN
      v_response_text := '¡INCREÍBLE! Has encontrado un DIAMANTE ENORME. (+500 XP)';
      v_xp_gained := 500;
    ELSIF v_luck > 0.5 THEN
      v_response_text := 'Encontraste algo de hierro y oro. Nada mal. (+100 XP)';
      v_xp_gained := 100;
    ELSE
      v_response_text := 'Solo encontraste piedra y carbón... Sigue intentándolo. (+15 XP)';
      v_xp_gained := 15;
    END IF;
  ELSIF v_action = '/pescar' THEN
    IF v_luck > 0.9 THEN
      v_response_text := '¡MAMÁ! ¡HAS PESCADO UN TIBURÓN LEGENDARIO! (+500 XP)';
      v_xp_gained := 500;
    ELSIF v_luck > 0.4 THEN
      v_response_text := 'Atrapaste un salmón decente. Servirá para la cena. (+50 XP)';
      v_xp_gained := 50;
    ELSE
      v_response_text := 'Pescaste... ¿una bota vieja? Qué asco. (+5 XP)';
      v_xp_gained := 5;
    END IF;
  ELSIF v_action = '/punch' THEN
    v_response_text := 'le dio un buen puñetazo en la cara a alguien 🥊💥';
  ELSIF v_action = '/kiss' THEN
    v_response_text := 'ha besado apasionadamente a alguien del chat ❤️';
  ELSIF v_action = '/kill' THEN
    v_response_text := 'ha enviado al lobby a alguien del servidor ☠️⚰️';
  ELSIF v_action = '/ship' THEN
    v_response_text := 'El medidor de amor dice que la compatibilidad es del ' || floor(random() * 100)::text || '% 💘';
  ELSE
    v_response_text := 'usó una acción misteriosa.';
  END IF;

  -- Insertar mensaje como sistema en el canal
  INSERT INTO public.messages(channel_id, sender_id, content)
  VALUES (p_channel_id, v_user_id, '[SISTEMA RPG] ' || v_user_nickname || ' ' || v_response_text);

  -- Sumar XP si hubo recompensa
  IF v_xp_gained > 0 THEN
    UPDATE public.profiles 
    SET xp = coalesce(xp, 0) + v_xp_gained 
    WHERE id = v_user_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true, 
    'action', v_action, 
    'xp_gained', v_xp_gained, 
    'text', v_response_text
  );
END;
$$;

-- 6. RECOMPENSA DIARIA (RULETA / STREAK DIARIO)
CREATE OR REPLACE FUNCTION public.claim_daily_reward()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_last_claim TIMESTAMPTZ;
  v_reward INT := 100;
  v_streak INT := 1;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  SELECT last_daily_reward, coalesce(streak_count, 0) 
  INTO v_last_claim, v_streak 
  FROM public.profiles 
  WHERE id = v_user_id;

  -- Verificar si ya reclamó hoy (últimas 20 horas)
  IF v_last_claim IS NOT NULL AND v_last_claim > (now() - interval '20 hours') THEN
    RETURN jsonb_build_object('success', false, 'message', 'Ya reclamaste tu recompensa diaria de hoy. Vuelve más tarde.');
  END IF;

  -- Calcular racha
  IF v_last_claim IS NOT NULL AND v_last_claim > (now() - interval '48 hours') THEN
    v_streak := v_streak + 1;
  ELSE
    v_streak := 1;
  END IF;

  -- Bono por racha: 100 XP base + (racha * 25 XP)
  v_reward := 100 + (v_streak * 25);

  UPDATE public.profiles 
  SET 
    xp = coalesce(xp, 0) + v_reward,
    last_daily_reward = now(),
    streak_count = v_streak
  WHERE id = v_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'reward', v_reward,
    'streak', v_streak,
    'message', '¡Has ganado ' || v_reward || ' XP con tu racha de ' || v_streak || ' días!'
  );
END;
$$;

-- 7. HABILITAR PUBLICACIÓN SUPABASE REALTIME
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
EXCEPTION WHEN OTHERS THEN
  -- Ignora si ya está agregada
  NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.posts;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;
