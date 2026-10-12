-- ==============================================================================
-- SISTEMA DE TROFEOS PS5 (PS5 Trophy System)
-- ==============================================================================
-- Grados: Bronce, Plata, Oro, Platino.
-- Al desbloquear un trofeo se emite un evento Realtime para mostrar el pop-up PS5.
-- ==============================================================================

-- 1. Tabla de Definición de Trofeos
CREATE TABLE IF NOT EXISTS public.achievements (
  id TEXT PRIMARY KEY,                       -- e.g. 'first_win', 'high_roller', 'platinum_master'
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'arcade',   -- 'casino', 'arcade', 'social', 'platino'
  grade TEXT NOT NULL CHECK (grade IN ('bronze', 'silver', 'gold', 'platinum')),
  icon_url TEXT,
  xp_reward INTEGER NOT NULL DEFAULT 50,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabla de Trofeos Desbloqueados por Usuario
CREATE TABLE IF NOT EXISTS public.user_achievements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMPTZ DEFAULT NOW(),
  notified BOOLEAN DEFAULT FALSE,
  UNIQUE(user_id, achievement_id)
);

-- Habilitar RLS
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "achievements_read_all" ON public.achievements;
CREATE POLICY "achievements_read_all" ON public.achievements
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "user_achievements_read_all" ON public.user_achievements;
CREATE POLICY "user_achievements_read_all" ON public.user_achievements
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "user_achievements_insert_safe" ON public.user_achievements;
CREATE POLICY "user_achievements_insert_safe" ON public.user_achievements
  FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));

-- 3. Función segura para otorgar trofeo y sumar XP automáticamente
CREATE OR REPLACE FUNCTION public.grant_trophy(
  p_user_id UUID,
  p_achievement_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_ach RECORD;
  v_already_unlocked BOOLEAN;
BEGIN
  -- Validar que el logro exista
  SELECT * INTO v_ach FROM public.achievements WHERE id = p_achievement_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Logro inexistente');
  END IF;

  -- Comprobar si ya lo tiene
  SELECT EXISTS(
    SELECT 1 FROM public.user_achievements 
    WHERE user_id = p_user_id AND achievement_id = p_achievement_id
  ) INTO v_already_unlocked;

  IF v_already_unlocked THEN
    RETURN jsonb_build_object('success', false, 'message', 'Ya desbloqueado');
  END IF;

  -- Insertar trofeo
  INSERT INTO public.user_achievements (user_id, achievement_id, unlocked_at)
  VALUES (p_user_id, p_achievement_id, NOW());

  -- Recompensar con XP en user_stats si existe la tabla
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_stats') THEN
    UPDATE public.user_stats
    SET xp = xp + v_ach.xp_reward,
        updated_at = NOW()
    WHERE user_id = p_user_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'achievement', jsonb_build_object(
      'id', v_ach.id,
      'title', v_ach.title,
      'description', v_ach.description,
      'grade', v_ach.grade,
      'xp_reward', v_ach.xp_reward
    )
  );
END;
$$;

-- 4. Semilla de Trofeos PS5 Temáticos
INSERT INTO public.achievements (id, title, description, category, grade, xp_reward)
VALUES
  ('welcome_ps5', 'Bienvenido a la Consola', 'Inicia sesión en la plataforma por primera vez.', 'social', 'bronze', 25),
  ('first_bet', 'Primer Golpe de Suerte', 'Realiza tu primera apuesta en el Casino.', 'casino', 'bronze', 50),
  ('snake_master', 'Rey Serpiente', 'Consigue más de 100 puntos en Snake.', 'arcade', 'silver', 100),
  ('high_roller', 'Magnate de la Banca', 'Gana más de 1,000 monedas en una sola jugada de casino.', 'casino', 'gold', 250),
  ('social_butterfly', 'Voz del Clan', 'Envía 50 mensajes en el chat de la comunidad.', 'social', 'silver', 75),
  ('watchparty_host', 'Director de Cine', 'Crea o participa en una Watch Party de YouTube.', 'social', 'bronze', 50),
  ('night_owl', 'Búho Nocturno', 'Juega entre las 2:00 AM y las 5:00 AM.', 'arcade', 'bronze', 50),
  ('joel_survivor', 'Superviviente del Caos', 'Sobrevive a una partida completa con Joel en línea.', 'arcade', 'gold', 300),
  ('platinum_club', 'Platino Ariel & Amigos', 'Desbloquea todos los trofeos principales de la plataforma.', 'platino', 'platinum', 1000)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  grade = EXCLUDED.grade,
  xp_reward = EXCLUDED.xp_reward;
