export type GameCategory = 'todos' | 'puzzles' | 'arcade' | 'mesa' | 'casual' | 'favoritos';

export type SourceType = 'propio' | 'gdevelop' | 'open_source' | 'tercero';

export type ScreenOrientation = 'landscape' | 'portrait' | 'any';

export interface ExternalGame {
  id: string;
  slug: string;
  title: string;
  category: 'puzzles' | 'arcade' | 'mesa' | 'casual';
  description: string;
  cover_url: string;
  embed_url: string;
  source_type: SourceType;
  license: string;
  author: string;
  is_featured: boolean;
  active: boolean;
  plays_count: number;
  orientation: ScreenOrientation;
  trusted_storage: boolean;
  created_at: string;
  updated_at?: string;
}

export interface GamePlay {
  id: string;
  user_id: string;
  game_slug: string;
  played_at: string;
}

export interface GameFavorite {
  user_id: string;
  game_slug: string;
  created_at: string;
}

export interface OnlineUserPresence {
  user_id: string;
  username: string;
  avatar_url?: string;
  status?: string;
  online_at?: string;
}
