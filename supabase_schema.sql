-- Habilitar extensión pgcrypto para generar UUIDs y encriptación
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- TABLA: Perfiles de usuario (Integrantes)
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    nickname TEXT,
    avatar_url TEXT,
    bio TEXT,
    role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'member')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    last_seen TIMESTAMP WITH TIME ZONE
);

-- TABLA: Publicaciones (Muro)
CREATE TABLE public.posts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    author_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    content TEXT,
    media_url TEXT,
    media_type TEXT CHECK (media_type IN ('image', 'video', 'document')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE
);

-- TABLA: Comentarios en Publicaciones
CREATE TABLE public.comments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
    author_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- TABLA: Reacciones en Publicaciones
CREATE TABLE public.reactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    emoji TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(post_id, user_id, emoji)
);

-- TABLA: Canales de Chat
CREATE TABLE public.channels (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    is_private BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- TABLA: Mensajes de Chat
CREATE TABLE public.messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    channel_id UUID REFERENCES public.channels(id) ON DELETE CASCADE NOT NULL,
    sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    content TEXT,
    media_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- TABLA: Museo de Memes / Frases fuera de contexto
CREATE TABLE public.memories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    author_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    type TEXT CHECK (type IN ('meme', 'quote', 'event')),
    title TEXT NOT NULL,
    content TEXT,
    media_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Insertar canales por defecto
INSERT INTO public.channels (name, description) VALUES 
('general', 'El caos principal'),
('memes', 'Museo de arte contemporáneo (memes)'),
('gaming', 'Para coordinar partidas');

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;

-- Políticas de Seguridad (RLS) muy permisivas para los 6 miembros, pero protegidas del exterior.
-- (Cualquiera autenticado puede leer y escribir)
CREATE POLICY "Usuarios autenticados pueden ver perfiles" ON public.profiles FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Usuarios pueden actualizar su propio perfil" ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Lectura posts" ON public.posts FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Crear posts" ON public.posts FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Actualizar propios posts" ON public.posts FOR UPDATE USING (auth.uid() = author_id);
CREATE POLICY "Borrar propios posts" ON public.posts FOR DELETE USING (auth.uid() = author_id);

CREATE POLICY "Lectura comentarios" ON public.comments FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Crear comentarios" ON public.comments FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Lectura reacciones" ON public.reactions FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Crear reacciones" ON public.reactions FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Borrar reacciones" ON public.reactions FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Lectura canales" ON public.channels FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Lectura mensajes" ON public.messages FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enviar mensajes" ON public.messages FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Lectura memories" ON public.memories FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Crear memories" ON public.memories FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Función para insertar automáticamente un perfil cuando se crea un usuario en auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, username, nickname)
  VALUES (new.id, split_part(new.email, '@', 1), split_part(new.email, '@', 1));
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para nuevo usuario
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
