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
