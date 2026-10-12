-- ==============================================================================
-- ARIEL Y SUS AMIGOS - SUPABASE HARDENING & SECURITY HOTFIX
-- ==============================================================================
-- Este script corrige las vulnerabilidades detectadas en la auditoría:
-- 1. Suplantación de identidad (author_id / sender_id / user_id = auth.uid())
-- 2. Prevención de escalada de privilegios a admin en profiles
-- 3. Restricción en user_achievements y game_scores
-- 4. Soporte para canales privados en messages
-- 5. Índices de alto rendimiento para posts, messages, comments y reactions
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. CORRECCIÓN EN PROFILES (Prevenir auto-escalada a admin)
-- ------------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- Política segura: Solo puede modificar su propio perfil y no puede cambiar su role
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

CREATE POLICY "posts_insert_safe" ON public.posts
  FOR INSERT
  TO authenticated
  WITH CHECK (author_id = (SELECT auth.uid()));

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "comments_insert" ON public.comments;
DROP POLICY IF EXISTS "Authenticated users can create comments" ON public.comments;

CREATE POLICY "comments_insert_safe" ON public.comments
  FOR INSERT
  TO authenticated
  WITH CHECK (author_id = (SELECT auth.uid()));

ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reactions_insert" ON public.reactions;
DROP POLICY IF EXISTS "Authenticated users can create reactions" ON public.reactions;

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

CREATE POLICY "messages_insert_safe" ON public.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (sender_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "messages_select" ON public.messages;
DROP POLICY IF EXISTS "Anyone authenticated can view messages" ON public.messages;

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
    EXECUTE 'CREATE POLICY "memories_insert_safe" ON public.memories FOR INSERT TO authenticated WITH CHECK (author_id = (SELECT auth.uid()));';
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 5. BLINDAJE DE SCORES Y LOGROS (Solo servidor / función segura)
-- ------------------------------------------------------------------------------
ALTER TABLE public.game_scores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "game_scores_insert" ON public.game_scores;
DROP POLICY IF EXISTS "Users can insert own game scores" ON public.game_scores;

-- Un usuario solo puede registrar su propio score
CREATE POLICY "game_scores_insert_safe" ON public.game_scores
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_achievements_insert" ON public.user_achievements;

-- Los logros solo deben desbloquearse mediante funciones seguras o validar user_id
CREATE POLICY "user_achievements_insert_safe" ON public.user_achievements
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

-- ------------------------------------------------------------------------------
-- 6. ÍNDICES DE ALTO RENDIMIENTO (Módulo de Rendimiento)
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_messages_channel_created ON public.messages(channel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON public.posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_post_created ON public.comments(post_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_reactions_post_id ON public.reactions(post_id);
CREATE INDEX IF NOT EXISTS idx_game_scores_game_score ON public.game_scores(game_id, score DESC);
CREATE INDEX IF NOT EXISTS idx_user_stats_level_xp ON public.user_stats(level DESC, xp DESC);

-- Notificar finalización
COMMENT ON TABLE public.profiles IS 'Perfiles protegidos contra auto-escalada de rol.';
