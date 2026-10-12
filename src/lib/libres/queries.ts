import { createClient } from '@/lib/supabase/client';
import { ExternalGame, GameFavorite, GamePlay } from './types';

export const DEFAULT_GAMES: ExternalGame[] = [
  {
    id: 'def-2048',
    slug: '2048',
    title: '2048 Neón',
    category: 'puzzles',
    description: 'Desliza y fusiona los bloques brillantes hasta alcanzar el legendario 2048.',
    cover_url: '/games/2048-cover.svg',
    embed_url: '/games/2048/index.html',
    source_type: 'open_source',
    license: 'MIT',
    author: 'Gabriele Cirulli / Adaptación',
    is_featured: true,
    active: true,
    plays_count: 320,
    orientation: 'any',
    trusted_storage: false,
    created_at: '2026-10-12T00:00:00Z',
  },
  {
    id: 'def-buscaminas',
    slug: 'buscaminas',
    title: 'Buscaminas Neón',
    category: 'puzzles',
    description: 'Encuentra todas las minas cuánticas con banderas neón y lógica pura.',
    cover_url: '/games/buscaminas-cover.svg',
    embed_url: '/games/buscaminas/index.html',
    source_type: 'propio',
    license: 'MIT',
    author: 'Ariel y sus amigos',
    is_featured: false,
    active: true,
    plays_count: 145,
    orientation: 'any',
    trusted_storage: false,
    created_at: '2026-10-12T00:00:00Z',
  },
  {
    id: 'def-pong-neon',
    slug: 'pong-neon',
    title: 'Pong Neón',
    category: 'arcade',
    description: 'El clásico duelo de tenis de mesa arcade con estela lumínica y sintetizador retro.',
    cover_url: '/games/pong-neon-cover.svg',
    embed_url: '/games/pong-neon/index.html',
    source_type: 'propio',
    license: 'MIT',
    author: 'Ariel y sus amigos',
    is_featured: true,
    active: true,
    plays_count: 480,
    orientation: 'any',
    trusted_storage: false,
    created_at: '2026-10-12T00:00:00Z',
  },
  {
    id: 'def-memorama',
    slug: 'memorama',
    title: 'Memorama Cuántico',
    category: 'casual',
    description: 'Empareja los hologramas en 3D en el menor número de movimientos.',
    cover_url: '/games/memorama-cover.svg',
    embed_url: '/games/memorama/index.html',
    source_type: 'propio',
    license: 'MIT',
    author: 'Ariel y sus amigos',
    is_featured: false,
    active: true,
    plays_count: 98,
    orientation: 'any',
    trusted_storage: false,
    created_at: '2026-10-12T00:00:00Z',
  },
  {
    id: 'def-breakout',
    slug: 'breakout',
    title: 'Rompeladrillos Neón',
    category: 'arcade',
    description: 'Destruye las barreras de cristal láser con tu pala orbital.',
    cover_url: '/games/breakout-cover.svg',
    embed_url: '/games/breakout/index.html',
    source_type: 'propio',
    license: 'MIT',
    author: 'Ariel y sus amigos',
    is_featured: true,
    active: true,
    plays_count: 512,
    orientation: 'any',
    trusted_storage: false,
    created_at: '2026-10-12T00:00:00Z',
  },
  {
    id: 'def-conecta4',
    slug: 'conecta4',
    title: 'Conecta 4 Neón',
    category: 'mesa',
    description: 'Alinea 4 fichas láser en fila vertical, horizontal o diagonal contra la IA.',
    cover_url: '/games/conecta4-cover.svg',
    embed_url: '/games/conecta4/index.html',
    source_type: 'propio',
    license: 'MIT',
    author: 'Ariel y sus amigos',
    is_featured: false,
    active: true,
    plays_count: 230,
    orientation: 'any',
    trusted_storage: false,
    created_at: '2026-10-12T00:00:00Z',
  },
  {
    id: 'def-sudoku',
    slug: 'sudoku',
    title: 'Sudoku Neón',
    category: 'puzzles',
    description: 'El desafío mental definitivo de 9x9 con interfaz táctil y teclado numérico.',
    cover_url: '/games/sudoku-cover.svg',
    embed_url: '/games/sudoku/index.html',
    source_type: 'propio',
    license: 'MIT',
    author: 'Ariel y sus amigos',
    is_featured: false,
    active: true,
    plays_count: 184,
    orientation: 'any',
    trusted_storage: false,
    created_at: '2026-10-12T00:00:00Z',
  },
  {
    id: 'def-laberinto-neon',
    slug: 'laberinto-neon',
    title: 'Laberinto Neón',
    category: 'puzzles',
    description: 'Laberintos infinitos generados proceduralmente con algoritmo DFS y D-Pad táctil.',
    cover_url: '/games/laberinto-neon-cover.svg',
    embed_url: '/games/laberinto-neon/index.html',
    source_type: 'propio',
    license: 'MIT',
    author: 'Ariel y sus amigos',
    is_featured: true,
    active: true,
    plays_count: 670,
    orientation: 'any',
    trusted_storage: false,
    created_at: '2026-10-12T00:00:00Z',
  },
];

export async function fetchExternalGames(): Promise<ExternalGame[]> {
  const supabase = createClient();
  try {
    const { data, error } = await supabase
      .from('external_games')
      .select('*')
      .eq('active', true)
      .order('is_featured', { ascending: false })
      .order('plays_count', { ascending: false });

    if (error || !data || data.length === 0) {
      return DEFAULT_GAMES;
    }
    return data as ExternalGame[];
  } catch (err) {
    console.warn('Fallback a DEFAULT_GAMES debido a:', err);
    return DEFAULT_GAMES;
  }
}

export async function fetchGameBySlug(slug: string): Promise<ExternalGame | null> {
  const supabase = createClient();
  try {
    const { data, error } = await supabase
      .from('external_games')
      .select('*')
      .eq('slug', slug)
      .eq('active', true)
      .single();

    if (error || !data) {
      const fallback = DEFAULT_GAMES.find((g) => g.slug === slug);
      return fallback || null;
    }
    return data as ExternalGame;
  } catch {
    return DEFAULT_GAMES.find((g) => g.slug === slug) || null;
  }
}

export async function fetchUserFavorites(userId?: string): Promise<string[]> {
  if (!userId) return [];
  const supabase = createClient();
  try {
    const { data, error } = await supabase
      .from('game_favorites')
      .select('game_slug')
      .eq('user_id', userId);

    if (error || !data) return [];
    return data.map((d: { game_slug: string }) => d.game_slug);
  } catch {
    return [];
  }
}

export async function fetchUserRecentPlays(userId?: string): Promise<string[]> {
  if (!userId) return [];
  const supabase = createClient();
  try {
    const { data, error } = await supabase
      .from('game_plays')
      .select('game_slug')
      .eq('user_id', userId)
      .order('played_at', { ascending: false })
      .limit(10);

    if (error || !data) return [];
    // Unicos conservando orden
    const seen = new Set<string>();
    const res: string[] = [];
    data.forEach((d: { game_slug: string }) => {
      if (!seen.has(d.game_slug)) {
        seen.add(d.game_slug);
        res.push(d.game_slug);
      }
    });
    return res;
  } catch {
    return [];
  }
}

export async function toggleFavorite(userId: string, gameSlug: string, isFav: boolean): Promise<boolean> {
  const supabase = createClient();
  try {
    if (isFav) {
      await supabase
        .from('game_favorites')
        .delete()
        .eq('user_id', userId)
        .eq('game_slug', gameSlug);
      return false;
    } else {
      await supabase
        .from('game_favorites')
        .insert({ user_id: userId, game_slug: gameSlug });
      return true;
    }
  } catch (err) {
    console.error('Error toggling favorite:', err);
    return isFav;
  }
}

export async function recordGamePlay(userId?: string, gameSlug?: string): Promise<void> {
  if (!gameSlug) return;
  const supabase = createClient();
  try {
    if (userId) {
      await supabase.from('game_plays').insert({
        user_id: userId,
        game_slug: gameSlug,
      });
    }
    // Increment plays_count en external_games si existe función RPC o actualización directa
    await supabase.rpc('increment_game_plays', { g_slug: gameSlug });
  } catch {
    // Silencioso
  }
}
