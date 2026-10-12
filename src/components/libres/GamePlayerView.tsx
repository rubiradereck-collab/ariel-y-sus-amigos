'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ExternalGame } from '@/lib/libres/types';
import {
  fetchGameBySlug,
  fetchExternalGames,
  fetchUserFavorites,
} from '@/lib/libres/queries';
import { createClient } from '@/lib/supabase/client';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { GameFrame } from './GameFrame';
import { GameCard } from './GameCard';
import { ArrowLeft, Sparkles } from 'lucide-react';

interface GamePlayerViewProps {
  slug: string;
}

export function GamePlayerView({ slug }: GamePlayerViewProps) {
  const [game, setGame] = useState<ExternalGame | null>(null);
  const [allGames, setAllGames] = useState<ExternalGame[]>([]);
  const [favoriteSlugs, setFavoriteSlugs] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      const [currentGame, gamesList, favs] = await Promise.all([
        fetchGameBySlug(slug),
        fetchExternalGames(),
        fetchUserFavorites(user?.id),
      ]);

      setGame(currentGame);
      setAllGames(gamesList);
      setFavoriteSlugs(favs);
      setLoading(false);
    }
    load();
  }, [slug]);

  const recommended = allGames
    .filter((g) => g.slug !== slug)
    .slice(0, 4);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#14070f] via-[#1b0816] to-[#0a030b] text-[#f5eef2] p-3 sm:p-6 lg:p-8">
      <div className="max-w-[1700px] mx-auto flex flex-col lg:flex-row gap-6">
        {/* Sidebar */}
        <Sidebar />

        {/* Contenido Principal */}
        <main className="flex-1 flex flex-col gap-6 min-w-0">
          <TopBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />

          {loading ? (
            <div className="h-[600px] rounded-[24px] bg-white/5 border border-white/10 animate-pulse flex items-center justify-center">
              <span className="text-[#b7a3ad] text-sm font-semibold">Cargando minijuego...</span>
            </div>
          ) : !game ? (
            <div className="flex flex-col items-center justify-center py-20 px-4 bg-white/[0.02] border border-white/5 rounded-[24px] text-center">
              <h3 className="text-xl font-bold text-white mb-2">Juego no encontrado</h3>
              <p className="text-xs text-[#b7a3ad] max-w-sm mb-6">
                El minijuego &ldquo;{slug}&rdquo; no existe o ha sido deshabilitado.
              </p>
              <Link
                href="/arcade/libres"
                className="px-5 py-2.5 rounded-full bg-[#ff4d7a] text-white font-bold text-xs flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Volver al Catálogo</span>
              </Link>
            </div>
          ) : (
            <>
              {/* Contenedor Iframe con controles */}
              <GameFrame
                game={game}
                initialFavorite={favoriteSlugs.includes(game.slug)}
              />

              {/* Recomendados */}
              <div className="flex flex-col gap-4 mt-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#ff4d7a]" />
                  <h3 className="text-base sm:text-lg font-extrabold text-white">
                    Más Minijuegos para Probar
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {recommended.map((g) => (
                    <GameCard
                      key={g.slug}
                      game={g}
                      isFavorite={favoriteSlugs.includes(g.slug)}
                      onToggleFavorite={() => {}}
                    />
                  ))}
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
