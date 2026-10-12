'use client';

import React from 'react';
import { ExternalGame } from '@/lib/libres/types';
import { GameCard } from './GameCard';
import { Gamepad2 } from 'lucide-react';

interface GameGridProps {
  games: ExternalGame[];
  favoriteSlugs: string[];
  onToggleFavorite: (slug: string) => void;
}

export function GameGrid({ games, favoriteSlugs, onToggleFavorite }: GameGridProps) {
  if (games.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 bg-white/[0.02] border border-white/5 rounded-[20px] text-center">
        <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center text-[#ff4d7a] mb-4">
          <Gamepad2 className="w-8 h-8" />
        </div>
        <h3 className="text-base font-bold text-white mb-1">
          No se encontraron minijuegos
        </h3>
        <p className="text-xs text-[#b7a3ad] max-w-sm">
          Intenta con otro término de búsqueda o selecciona otra categoría en la barra superior.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
      {games.map((game) => (
        <GameCard
          key={game.slug}
          game={game}
          isFavorite={favoriteSlugs.includes(game.slug)}
          onToggleFavorite={onToggleFavorite}
        />
      ))}
    </div>
  );
}
