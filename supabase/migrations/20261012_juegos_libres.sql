-- =====================================================================
-- MIGRACIÓN: JUEGOS LIBRES (/arcade/libres)
-- =====================================================================

create table if not exists public.external_games (
  slug text primary key,
  title text not null,
  description text,
  provider text not null check (provider in ('selfhosted','own','itch')),
  embed_url text not null check (embed_url ~ '^(https://|/games/)'),
  cover text,
  icon text,
  category text not null default 'casual',
  tags text[] not null default '{}',
  license text not null,
  author text,
  source_url text,
  trusted_storage boolean not null default false,
  featured boolean not null default false,
  active boolean not null default true,
  created_at timestamptz default now()
);

alter table public.external_games enable row level security;

do $$ begin
  create policy "ext_games_read" on public.external_games
    for select to authenticated using (active);
exception when duplicate_object then null; end $$;

create table if not exists public.game_favorites (
  user_id uuid references auth.users(id) on delete cascade,
  game_slug text not null,
  created_at timestamptz default now(),
  primary key (user_id, game_slug)
);

alter table public.game_favorites enable row level security;

do $$ begin
  create policy "fav_own_all" on public.game_favorites
    for all to authenticated
    using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;

create table if not exists public.game_plays (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  game_slug text not null,
  played_at timestamptz not null default now()
);

create index if not exists game_plays_slug_idx on public.game_plays(game_slug);
alter table public.game_plays enable row level security;

do $$ begin
  create policy "plays_ins_own" on public.game_plays
    for insert to authenticated with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "plays_read" on public.game_plays
    for select to authenticated using (true);
exception when duplicate_object then null; end $$;

-- SEED INSERTS: CATÁLOGO DE JUEGOS LIBRES
insert into public.external_games (
  slug, title, description, provider, embed_url, cover, icon, category, tags, license, author, source_url, trusted_storage, featured, active
) values
(
  '2048',
  '2048 Clásico',
  'Desliza los bloques numerados, suma potencias de 2 y alcanza el legendario bloque 2048.',
  'selfhosted',
  '/games/2048/index.html',
  '/games/2048/cover.webp',
  '/games/2048/icon.webp',
  'puzzle',
  array['numeros', 'estrategia', 'clasico'],
  'MIT',
  'Gabriele Cirulli / Open Source Community',
  'https://github.com/gabrielecirulli/2048',
  true,
  true,
  true
),
(
  'buscaminas',
  'Buscaminas Arcade',
  'Descubre casillas seguras, deduce dónde se ocultan las cargas explosivas y limpia todo el cuadrante.',
  'selfhosted',
  '/games/buscaminas/index.html',
  '/games/buscaminas/cover.webp',
  '/games/buscaminas/icon.webp',
  'puzzle',
  array['minas', 'logica', 'retro'],
  'MIT',
  'Comunidad Ariel y sus Amigos',
  'https://github.com/rubiradereck-collab/ariel-y-sus-amigos',
  true,
  true,
  true
),
(
  'pong-neon',
  'Pong Neón Cyberpunk',
  'El duelo clásico de paletas renacido con estela de partículas neón y una IA reactiva con física fluida.',
  'selfhosted',
  '/games/pong-neon/index.html',
  '/games/pong-neon/cover.webp',
  '/games/pong-neon/icon.webp',
  'arcade',
  array['retro', 'paletas', 'arcade', 'vs-cpu'],
  'MIT',
  'Comunidad Ariel y sus Amigos',
  'https://github.com/rubiradereck-collab/ariel-y-sus-amigos',
  true,
  true,
  true
),
(
  'memorama',
  'Memorama Cósmico',
  'Pon a prueba tu agilidad mental encontrando los pares de cartas espaciales en el menor tiempo.',
  'selfhosted',
  '/games/memorama/index.html',
  '/games/memorama/cover.webp',
  '/games/memorama/icon.webp',
  'casual',
  array['memoria', 'cartas', 'parejas'],
  'MIT',
  'Comunidad Ariel y sus Amigos',
  'https://github.com/rubiradereck-collab/ariel-y-sus-amigos',
  true,
  false,
  true
),
(
  'breakout',
  'Destructor de Bloques',
  'Rebota la esfera de plasma con tu plataforma y pulveriza todos los muros de cristales luminosos.',
  'selfhosted',
  '/games/breakout/index.html',
  '/games/breakout/cover.webp',
  '/games/breakout/icon.webp',
  'arcade',
  array['bloques', 'pelota', 'retro', 'arcade'],
  'MIT',
  'Comunidad Ariel y sus Amigos',
  'https://github.com/rubiradereck-collab/ariel-y-sus-amigos',
  true,
  true,
  true
),
(
  'conecta4',
  'Conecta 4 Neón',
  'Modo para 2 jugadores en el mismo dispositivo o contra la máquina. Conecta 4 fichas en línea recta.',
  'selfhosted',
  '/games/conecta4/index.html',
  '/games/conecta4/cover.webp',
  '/games/conecta4/icon.webp',
  'mesa',
  array['conecta4', 'estrategia', '2-jugadores'],
  'MIT',
  'Comunidad Ariel y sus Amigos',
  'https://github.com/rubiradereck-collab/ariel-y-sus-amigos',
  true,
  false,
  true
),
(
  'sudoku',
  'Sudoku Maestro',
  'El legendario desafío numérico japonés con generador procedural y verificador de errores en vivo.',
  'selfhosted',
  '/games/sudoku/index.html',
  '/games/sudoku/cover.webp',
  '/games/sudoku/icon.webp',
  'puzzle',
  array['numeros', 'mente', 'logica'],
  'MIT',
  'Comunidad Ariel y sus Amigos',
  'https://github.com/rubiradereck-collab/ariel-y-sus-amigos',
  true,
  false,
  true
),
(
  'laberinto-neon',
  'Laberinto Neón',
  'Guía tu orbe de luz a través de complejos corredores procedurales hasta encontrar el vórtice de salida.',
  'own',
  '/games/laberinto-neon/index.html',
  '/games/laberinto-neon/cover.webp',
  '/games/laberinto-neon/icon.webp',
  'casual',
  array['laberinto', 'exploracion', 'casual'],
  'MIT',
  'Equipo Ariel y sus Amigos',
  'https://github.com/rubiradereck-collab/ariel-y-sus-amigos',
  true,
  true,
  true
)
on conflict (slug) do update set
  title = excluded.title,
  description = excluded.description,
  embed_url = excluded.embed_url,
  category = excluded.category,
  tags = excluded.tags,
  featured = excluded.featured,
  active = excluded.active;
