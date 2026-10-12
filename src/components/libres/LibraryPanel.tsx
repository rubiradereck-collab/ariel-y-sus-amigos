'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ExternalGame } from '@/lib/libres/types';
import { Bookmark, Clock, Play, Star } from 'lucide-react';

interface LibraryPanelProps {
  allGames: ExternalGame[];
  favoriteSlugs: string[];
  recentSlugs: string[];
}

export function LibraryPanel({
  allGames,
  favoriteSlugs,
  recentSlugs,
}: LibraryPanelProps) {
  const [activeTab, setActiveTab] = useState<'favoritos' | 'recientes'>('favoritos');

  const gamesMap = new Map(allGames.map((g) => [g.slug, g]));

  const favoriteGames = favoriteSlugs
    .map((slug) => gamesMap.get(slug))
    .filter((g): g is ExternalGame => !!g);

  const recentGames = recentSlugs
    .map((slug) => gamesMap.get(slug))
    .filter((g): g is ExternalGame => !!g);

  const currentList = activeTab === 'favoritos' ? favoriteGames : recentGames;

  return (
    <div className="flex flex-col bg-zinc-900/50 border border-white/10 rounded-2xl p-4 sm:p-5 h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-3.5">
        <div className="flex items-center gap-2">
          <Bookmark className="w-4 h-4 text-cyan-400" />
          <h3 className="font-extrabold text-sm text-white tracking-wide uppercase">
            Mi Biblioteca
          </h3>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-black/40 rounded-xl border border-white/5 mb-3">
        <button
          onClick={() => setActiveTab('favoritos')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'favoritos'
              ? 'bg-white text-black shadow-sm'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Star className="w-3.5 h-3.5 fill-current" />
          <span>Favoritos ({favoriteGames.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('recientes')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'recientes'
              ? 'bg-white text-black shadow-sm'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Recientes ({recentGames.length})</span>
        </button>
      </div>

      {/* Lista de minijuegos */}
      <div className="flex flex-col gap-2 overflow-y-auto max-h-[320px] pr-1">
        {currentList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center px-2">
            <p className="text-xs text-zinc-500">
              {activeTab === 'favoritos'
                ? 'No tienes juegos favoritos. Toca la estrella en cualquier tarjeta para agregarlo.'
                : 'Aún no has jugado recientemente. ¡Empieza una partida!'}
            </p>
          </div>
        ) : (
          currentList.map((game) => (
            <Link
              key={game.slug}
              href={`/arcade/libres/${game.slug}`}
              className="group flex items-center justify-between gap-3 p-2 rounded-xl bg-zinc-900/60 hover:bg-zinc-800 border border-white/5 hover:border-white/15 transition-all"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="relative w-11 h-8 rounded-lg overflow-hidden shrink-0 bg-black/60 border border-white/10">
                  <Image
                    src={game.cover_url}
                    alt={game.title}
                    fill
                    sizes="44px"
                    className="object-cover group-hover:scale-105 transition-transform"
                    unoptimized
                  />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-zinc-200 group-hover:text-white truncate">
                    {game.title}
                  </h4>
                  <span className="text-[10px] text-zinc-500 uppercase font-semibold">
                    {game.category}
                  </span>
                </div>
              </div>

              <div className="w-7 h-7 rounded-full bg-white/10 group-hover:bg-white text-white group-hover:text-black flex items-center justify-center shrink-0 transition-colors">
                <Play className="w-3 h-3 fill-current ml-0.5" />
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
