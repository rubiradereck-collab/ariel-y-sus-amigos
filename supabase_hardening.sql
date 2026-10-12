-- ==============================================================================
-- ARIEL Y SUS AMIGOS - SUPABASE HARDENING & SECURITY HOTFIX (V2)
-- ==============================================================================
-- Este script corrige las vulnerabilidades detectadas en la auditoría técnica:
-- 1. Suplantación de identidad (author_id / sender_id / user_id = auth.uid())
-- 2. Prevención de escalada de privilegios a admin en profiles
-- 3. Revocación de INSERT/UPDATE/DELETE directo en tablas sensibles:
--    (user_stats, casino_log, user_achievements, game_scores, arcade_leaderboard)
-- 4. Revocación de ejecución pública en grant_trophy (solo servidor/triggers)
-- 5. RPC segura submit_game_score para prevenir scores falsificados desde consola
-- 6. Soporte para canales privados en messages
-- 7. Índices de alto rendimiento para posts, messages, comments y reactions
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. CORRECCIÓN EN PROFILES (Prevenir auto-escalada a admin)
-- ------------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own_safe" ON public.profiles;

-- Solo puede modificar su propio perfil y no puede cambiar su role
CREATE POLICY "profiles_update_own_safe" ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (
    id = (SELECT auth.uid()) 
    AND role = (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid()))
  );

-- ------------------------------------------------------------------------------
-- 2. CORRECCIÓN EN POSTS, COMMENTS, REACTIONS (Prevenir suplantación)
-- ------------------------------------------------------------------------------
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "posts_insert" ON public.posts;
DROP POLICY IF EXISTS "Authenticated users can create posts" ON public.posts;
DROP POLICY IF EXISTS "posts_insert_safe" ON public.posts;

CREATE POLICY "posts_insert_safe" ON public.posts
  FOR INSERT
  TO authenticated
  WITH CHECK (author_id = (SELECT auth.uid()));

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "comments_insert" ON public.comments;
DROP POLICY IF EXISTS "Authenticated users can create comments" ON public.comments;
DROP POLICY IF EXISTS "comments_insert_safe" ON public.comments;

CREATE POLICY "comments_insert_safe" ON public.comments
  FOR INSERT
  TO authenticated
  WITH CHECK (author_id = (SELECT auth.uid()));

ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reactions_insert" ON public.reactions;
DROP POLICY IF EXISTS "Authenticated users can create reactions" ON public.reactions;
DROP POLICY IF EXISTS "reactions_insert_safe" ON public.reactions;

CREATE POLICY "reactions_insert_safe" ON public.reactions
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

-- ------------------------------------------------------------------------------
-- 3. CORRECCIÓN EN MESSAGES (Prevenir suplantación y respetar canales privados)
-- ------------------------------------------------------------------------------
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "messages_insert" ON public.messages;
DROP POLICY IF EXISTS "Authenticated users can create messages" ON public.messages;
DROP POLICY IF EXISTS "messages_insert_safe" ON public.messages;

CREATE POLICY "messages_insert_safe" ON public.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (sender_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "messages_select" ON public.messages;
DROP POLICY IF EXISTS "Anyone authenticated can view messages" ON public.messages;
DROP POLICY IF EXISTS "messages_select_safe" ON public.messages;

CREATE POLICY "messages_select_safe" ON public.messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.channels c
      WHERE c.id = messages.channel_id
      AND (
        c.is_private = false 
        OR (c.is_private = true AND (
          messages.sender_id = (SELECT auth.uid())
          OR EXISTS (
            SELECT 1 FROM public.profiles p 
            WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'
          )
        ))
      )
    )
  );

-- ------------------------------------------------------------------------------
-- 4. CORRECCIÓN EN MEMORIES
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'memories') THEN
    EXECUTE 'ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;';
    EXECUTE 'DROP POLICY IF EXISTS "memories_insert" ON public.memories;';
    EXECUTE 'DROP POLICY IF EXISTS "memories_insert_safe" ON public.memories;';
    EXECUTE 'CREATE POLICY "memories_insert_safe" ON public.memories FOR INSERT TO authenticated WITH CHECK (author_id = (SELECT auth.uid()));';
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 5. REVOCACIÓN DE ESCRITURAS DIRECTAS EN TABLAS SENSIBLES
-- ------------------------------------------------------------------------------
-- Nadie en anon ni authenticated puede hacer INSERT, UPDATE o DELETE directo
-- en tablas financieras o de puntuaciones. Todas las modificaciones deben
-- hacerse mediante RPCs SECURITY DEFINER controladas en el servidor.
DO $$
BEGIN
  -- user_stats
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_stats') THEN
    REVOKE INSERT, UPDATE, DELETE ON public.user_stats FROM anon, authenticated;
    ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "user_stats_insert" ON public.user_stats;
    DROP POLICY IF EXISTS "user_stats_update" ON public.user_stats;
  END IF;

  -- casino_log
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'casino_log') THEN
    REVOKE INSERT, UPDATE, DELETE ON public.casino_log FROM anon, authenticated;
    ALTER TABLE public.casino_log ENABLE ROW LEVEL SECURITY;
  END IF;

  -- user_achievements
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_achievements') THEN
    REVOKE INSERT, UPDATE, DELETE ON public.user_achievements FROM anon, authenticated;
    ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "user_achievements_insert" ON public.user_achievements;
    DROP POLICY IF EXISTS "user_achievements_insert_safe" ON public.user_achievements;
  END IF;

  -- game_scores
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'game_scores') THEN
    REVOKE INSERT, UPDATE, DELETE ON public.game_scores FROM anon, authenticated;
    ALTER TABLE public.game_scores ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "game_scores_insert" ON public.game_scores;
    DROP POLICY IF EXISTS "game_scores_insert_safe" ON public.game_scores;
  END IF;

  -- arcade_leaderboard
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'arcade_leaderboard') THEN
    REVOKE INSERT, UPDATE, DELETE ON public.arcade_leaderboard FROM anon, authenticated;
    ALTER TABLE public.arcade_leaderboard ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 6. PROTECCIÓN DE TROFEOS: REVOCAR EJECUCIÓN PÚBLICA DE grant_trophy
-- ------------------------------------------------------------------------------
-- Solo el backend / triggers internos pueden llamar a grant_trophy
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'grant_trophy') THEN
    REVOKE EXECUTE ON FUNCTION public.grant_trophy(UUID, TEXT) FROM PUBLIC, anon, authenticated;
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 7. RPC SEGURA PARA ENVIAR PUNTUACIONES DE ARCADE (submit_game_score)
-- ------------------------------------------------------------------------------
-- Valida identidad con auth.uid(), límites de plausibilidad por juego y tiempo
CREATE OR REPLACE FUNCTION public.submit_game_score(
  p_game TEXT,
  p_score INT,
  p_duration_ms INT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_max_score INT;
  v_xp_gain INT := 10;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  -- Límites de plausibilidad por juego para evitar scores inflados en consola
  v_max_score := CASE
    WHEN p_game = 'snake' THEN 5000
    WHEN p_game = 'tictactoe' THEN 100
    WHEN p_game = '2048' THEN 131072
    WHEN p_game = 'buscaminas' THEN 9999
    ELSE 10000
  END;

  IF p_score < 0 OR p_score > v_max_score THEN
    RETURN jsonb_build_object('success', false, 'error', 'score_out_of_bounds');
  END IF;

  -- Si se proporciona duración, requerir un tiempo mínimo razonable
  IF p_duration_ms > 0 AND p_duration_ms < 2000 AND p_score > 50 THEN
    RETURN jsonb_build_object('success', false, 'error', 'duration_too_short');
  END IF;

  -- Insertar en game_scores
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'game_scores') THEN
    INSERT INTO public.game_scores(user_id, game_id, score, created_at)
    VALUES (v_uid, p_game, p_score, NOW());
  END IF;

  -- Recompensar XP moderada si existe user_stats
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_stats') THEN
    UPDATE public.user_stats
    SET xp = xp + v_xp_gain,
        lifetime_xp = lifetime_xp + v_xp_gain,
        updated_at = NOW()
    WHERE user_id = v_uid;
  END IF;

  -- Comprobar si desbloquea trofeo snake_master (score >= 100)
  IF p_game = 'snake' AND p_score >= 100 THEN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'grant_trophy') THEN
      PERFORM public.grant_trophy(v_uid, 'snake_master');
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'score', p_score,
    'xp_awarded', v_xp_gain
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_game_score(TEXT, INT, INT) TO authenticated;

-- ------------------------------------------------------------------------------
-- 8. ÍNDICES DE ALTO RENDIMIENTO
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_messages_channel_created ON public.messages(channel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON public.posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_post_created ON public.comments(post_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_reactions_post_id ON public.reactions(post_id);

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'game_scores') THEN
    CREATE INDEX IF NOT EXISTS idx_game_scores_game_score ON public.game_scores(game_id, score DESC);
  END IF;
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_stats') THEN
    CREATE INDEX IF NOT EXISTS idx_user_stats_level_xp ON public.user_stats(level DESC, xp DESC);
  END IF;
END $$;
