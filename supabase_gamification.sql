-- TABLA: Colección de Logros Disponibles
CREATE TABLE public.achievements (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    icon TEXT NOT NULL,
    category TEXT NOT NULL,
    xp_reward INTEGER DEFAULT 100
);

-- TABLA: Logros desbloqueados por los usuarios
CREATE TABLE public.user_achievements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    achievement_id TEXT REFERENCES public.achievements(id) ON DELETE CASCADE NOT NULL,
    unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, achievement_id)
);

-- TABLA: Puntuaciones de Minijuegos (Trivias, etc.)
CREATE TABLE public.game_scores (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    game_type TEXT NOT NULL, -- 'trivia', 'quotes', 'roulette'
    score INTEGER NOT NULL,
    played_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_scores ENABLE ROW LEVEL SECURITY;

-- Políticas de Seguridad
CREATE POLICY "Lectura logros" ON public.achievements FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Lectura logros usuarios" ON public.user_achievements FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Crear logros usuarios" ON public.user_achievements FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Lectura scores" ON public.game_scores FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Crear scores" ON public.game_scores FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Insertar algunos logros básicos
INSERT INTO public.achievements (id, title, description, icon, category, xp_reward) VALUES 
('first_blood', 'Primera Sangre', 'Envía tu primer mensaje en el chat.', '⚔️', 'Social', 50),
('meme_lord', 'Señor de los Memes', 'Sube un meme al museo.', '🖼️', 'Coleccionista', 100),
('wall_breaker', 'Rompe Muros', 'Publica en el muro general.', '🧱', 'Social', 50),
('trivia_master', 'Cerebro Galáctico', 'Gana tu primera partida de Trivia.', '🧠', 'Competitivo', 200)
ON CONFLICT (id) DO NOTHING;
