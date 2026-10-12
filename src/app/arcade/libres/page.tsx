'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { ExternalGame, GameCategory } from '@/lib/libres/types';
import {
  fetchExternalGames,
  fetchUserFavorites,
  fetchUserRecentPlays,
  toggleFavorite,
} from '@/lib/libres/queries';
import { createClient } from '@/lib/supabase/client';
import { MainLayout } from '@/components/layout/MainLayout';
import { HeroCarousel } from '@/components/libres/HeroCarousel';
import { LibraryPanel } from '@/components/libres/LibraryPanel';
import { CategoryChips } from '@/components/libres/CategoryChips';
import { GameGrid } from '@/components/libres/GameGrid';
import { ArrowLeft, Search, Sparkles } from 'lucide-react';

export default function JuegosLibresPage() {
  const [games, setGames] = useState<ExternalGame[]>([]);
  const [favoriteSlugs, setFavoriteSlugs] = useState<string[]>([]);
  const [recentSlugs, setRecentSlugs] = useState<string[]>([]);
  const [currentCategory, setCurrentCategory] = useState<GameCategory>('todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [userId, setUserId] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      const [loadedGames, favs, recents] = await Promise.all([
        fetchExternalGames(),
        fetchUserFavorites(user?.id),
        fetchUserRecentPlays(user?.id),
      ]);

      setGames(loadedGames);
      setFavoriteSlugs(favs);
      setRecentSlugs(recents);
      if (user) setUserId(user.id);
      setIsLoading(false);
    }

    loadData();
  }, []);

  const handleToggleFavorite = async (slug: string) => {
    if (!userId) {
      setFavoriteSlugs((prev) =>
        prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
      );
      return;
    }

    const isFav = favoriteSlugs.includes(slug);
    setFavoriteSlugs((prev) =>
      isFav ? prev.filter((s) => s !== slug) : [...prev, slug]
    );

    await toggleFavorite(userId, slug, isFav);
  };

  const categoryCounts = useMemo(() => {
    const counts: Record<GameCategory, number> = {
      todos: games.length,
      puzzles: 0,
      arcade: 0,
      mesa: 0,
      casual: 0,
      favoritos: favoriteSlugs.length,
    };

    games.forEach((g) => {
      if (counts[g.category] !== undefined) {
        counts[g.category]++;
      }
    });

    return counts;
  }, [games, favoriteSlugs]);

  const filteredGames = useMemo(() => {
    return games.filter((game) => {
      if (currentCategory === 'favoritos') {
        if (!favoriteSlugs.includes(game.slug)) return false;
      } else if (currentCategory !== 'todos') {
        if (game.category !== currentCategory) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = game.title.toLowerCase().includes(q);
        const matchesDesc = game.description.toLowerCase().includes(q);
        const matchesCategory = game.category.toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc && !matchesCategory) return false;
      }

      return true;
    });
  }, [games, currentCategory, favoriteSlugs, searchQuery]);

  return (
    <MainLayout>
      <div className="w-full min-h-screen px-4 sm:px-8 pt-6 pb-28 max-w-7xl mx-auto flex flex-col gap-8 text-white">
        
        {/* Cabecera con navegación y buscador */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-5">
          <div className="flex items-center gap-3">
            <Link
              href="/arcade"
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-xs font-bold text-zinc-300 hover:text-white border border-white/10 transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Volver a Arcade</span>
            </Link>
            <div className="h-4 w-[1px] bg-white/10 hidden sm:block" />
            <div>
              <h1 className="text-xl sm:text-2xl font-black uppercase text-white tracking-wide">
                Minijuegos Libres (Friv)
              </h1>
              <p className="text-xs text-zinc-400">8 títulos en HTML5 nativo sin descargas ni anuncios.</p>
            </div>
          </div>

          <div className="relative w-full md:w-72">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar minijuego..."
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-zinc-900 border border-white/10 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-400 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 hover:text-white"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Hero Section y Biblioteca */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-stretch">
          <div className="xl:col-span-2">
            <HeroCarousel games={games} />
          </div>
          <div className="xl:col-span-1">
            <LibraryPanel
              allGames={games}
              favoriteSlugs={favoriteSlugs}
              recentSlugs={recentSlugs}
            />
          </div>
        </div>

        {/* Filtros de Categoría */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <h2 className="text-base sm:text-lg font-black text-white uppercase tracking-wider">
              Explorar por Categoría
            </h2>
          </div>

          <CategoryChips
            currentCategory={currentCategory}
            onSelectCategory={setCurrentCategory}
            counts={categoryCounts}
          />
        </div>

        {/* Grid de Juegos */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 animate-pulse">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="h-64 rounded-2xl bg-zinc-900/60 border border-white/5"
              />
            ))}
          </div>
        ) : (
          <GameGrid
            games={filteredGames}
            favoriteSlugs={favoriteSlugs}
            onToggleFavorite={handleToggleFavorite}
          />
        )}
      </div>
    </MainLayout>
  );
}
