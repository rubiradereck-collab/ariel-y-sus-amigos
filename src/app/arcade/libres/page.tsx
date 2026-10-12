'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { ExternalGame, GameCategory } from '@/lib/libres/types';
import {
  fetchExternalGames,
  fetchUserFavorites,
  fetchUserRecentPlays,
  toggleFavorite,
} from '@/lib/libres/queries';
import { createClient } from '@/lib/supabase/client';
import { Sidebar } from '@/components/libres/Sidebar';
import { TopBar } from '@/components/libres/TopBar';
import { HeroCarousel } from '@/components/libres/HeroCarousel';
import { LibraryPanel } from '@/components/libres/LibraryPanel';
import { CategoryChips } from '@/components/libres/CategoryChips';
import { GameGrid } from '@/components/libres/GameGrid';

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
      // Optimista para invitados
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

  // Cálculo de conteos por categoría
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

  // Filtrado de juegos
  const filteredGames = useMemo(() => {
    return games.filter((game) => {
      // Filtro por categoría
      if (currentCategory === 'favoritos') {
        if (!favoriteSlugs.includes(game.slug)) return false;
      } else if (currentCategory !== 'todos') {
        if (game.category !== currentCategory) return false;
      }

      // Filtro por búsqueda
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
    <div className="min-h-screen bg-gradient-to-b from-[#14070f] via-[#1b0816] to-[#0a030b] text-[#f5eef2] p-3 sm:p-6 lg:p-8">
      <div className="max-w-[1700px] mx-auto flex flex-col lg:flex-row gap-6">
        {/* Sidebar Gamer a la izquierda */}
        <Sidebar />

        {/* Contenido Principal */}
        <main className="flex-1 flex flex-col gap-6 min-w-0">
          {/* TopBar con buscador y perfil */}
          <TopBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />

          {/* Hero Section y Biblioteca (Layout inspirado en referencia) */}
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
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg sm:text-xl font-extrabold text-white tracking-wide">
                  Colección de Minijuegos
                </h3>
                <p className="text-xs text-[#b7a3ad]">
                  Juegos instantáneos en HTML5 para jugar en tu navegador.
                </p>
              </div>
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
                  className="h-64 rounded-[20px] bg-white/5 border border-white/5"
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
        </main>
      </div>
    </div>
  );
}
