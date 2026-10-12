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
import { MainLayout } from '@/components/layout/MainLayout';
import { GameFrame } from './GameFrame';
import { GameCard } from './GameCard';
import { ArrowLeft, Sparkles, ChevronRight, Gamepad2 } from 'lucide-react';

interface GamePlayerViewProps {
  slug: string;
}

export function GamePlayerView({ slug }: GamePlayerViewProps) {
  const [game, setGame] = useState<ExternalGame | null>(null);
  const [allGames, setAllGames] = useState<ExternalGame[]>([]);
  const [favoriteSlugs, setFavoriteSlugs] = useState<string[]>([]);
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
    <MainLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col gap-6">
        {/* Breadcrumb PS5 Navigation */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-400">
          <div className="flex items-center gap-2">
            <Link href="/arcade" className="hover:text-white transition-colors flex items-center gap-1.5 font-bold">
              <Gamepad2 className="w-3.5 h-3.5 text-cyan-400" />
              <span>Arcade</span>
            </Link>
            <ChevronRight className="w-3.5 h-3.5 opacity-50" />
            <Link href="/arcade/libres" className="hover:text-white transition-colors font-bold">
              Juegos Libres
            </Link>
            <ChevronRight className="w-3.5 h-3.5 opacity-50" />
            <span className="text-white font-extrabold truncate max-w-[200px] sm:max-w-xs">
              {game ? game.title : slug}
            </span>
          </div>

          <Link
            href="/arcade/libres"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 border border-white/10 text-zinc-300 hover:text-white transition-colors text-xs font-bold"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Volver a Minijuegos</span>
          </Link>
        </div>

        {loading ? (
          <div className="h-[600px] rounded-[24px] bg-zinc-900/40 border border-white/10 animate-pulse flex flex-col items-center justify-center gap-3">
            <Gamepad2 className="w-10 h-10 text-cyan-400/50 animate-bounce" />
            <span className="text-zinc-400 text-sm font-semibold">Cargando minijuego...</span>
          </div>
        ) : !game ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 bg-zinc-900/30 border border-white/10 rounded-[24px] text-center">
            <h3 className="text-xl font-bold text-white mb-2">Juego no encontrado</h3>
            <p className="text-xs text-zinc-400 max-w-sm mb-6">
              El minijuego &ldquo;{slug}&rdquo; no existe o ha sido deshabilitado.
            </p>
            <Link
              href="/arcade/libres"
              className="px-5 py-2.5 rounded-full bg-white text-black font-bold text-xs flex items-center gap-2 hover:bg-zinc-200 transition-colors"
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
            <div className="flex flex-col gap-4 mt-6">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
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
      </div>
    </MainLayout>
  );
}
