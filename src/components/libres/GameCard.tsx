'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ExternalGame } from '@/lib/libres/types';
import { Star, Play, Eye } from 'lucide-react';

interface GameCardProps {
  game: ExternalGame;
  isFavorite: boolean;
  onToggleFavorite: (slug: string) => void;
}

export function GameCard({ game, isFavorite, onToggleFavorite }: GameCardProps) {
  const categoryColors: Record<string, string> = {
    puzzles: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    arcade: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
    mesa: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    casual: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  };

  const badgeClass = categoryColors[game.category] || 'bg-white/10 text-white/80 border-white/20';

  return (
    <div className="group relative flex flex-col bg-white/[0.03] hover:bg-white/[0.06] backdrop-blur-xl border border-white/10 hover:border-[#ff4d7a]/50 rounded-[20px] overflow-hidden transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_12px_32px_rgba(255,77,122,0.2)]">
      {/* Portada 16:10 */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-black/40">
        <Image
          src={game.cover_url}
          alt={game.title}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          unoptimized={game.cover_url.endsWith('.svg')}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#14070f] via-transparent to-black/30 pointer-events-none" />

        {/* Badge de categoría */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5 z-10">
          <span
            className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border backdrop-blur-md ${badgeClass}`}
          >
            {game.category}
          </span>
          {game.is_featured && (
            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 text-black shadow-md">
              HOT
            </span>
          )}
        </div>

        {/* Botón Favorito */}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleFavorite(game.slug);
          }}
          className="absolute top-3 right-3 z-20 w-8 h-8 rounded-full bg-black/50 hover:bg-black/80 backdrop-blur-md border border-white/10 flex items-center justify-center transition-all cursor-pointer group-hover:scale-110"
          title={isFavorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}
        >
          <Star
            className={`w-4 h-4 transition-colors ${
              isFavorite
                ? 'fill-yellow-400 text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.6)]'
                : 'text-white/60 hover:text-white'
            }`}
          />
        </button>

        {/* Hover Overlay con Botón de Jugar */}
        <Link
          href={`/arcade/libres/${game.slug}`}
          className="absolute inset-0 z-10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/40 backdrop-blur-[2px]"
        >
          <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-[#ff4d7a] to-[#e8365d] text-white flex items-center justify-center shadow-[0_0_20px_rgba(255,77,122,0.8)] transform scale-90 group-hover:scale-100 transition-transform">
            <Play className="w-5 h-5 fill-white ml-0.5" />
          </div>
        </Link>
      </div>

      {/* Info del juego */}
      <div className="flex flex-col flex-1 p-4 justify-between gap-2">
        <div>
          <div className="flex items-center justify-between gap-2">
            <Link
              href={`/arcade/libres/${game.slug}`}
              className="text-base font-bold text-[#f5eef2] hover:text-[#ff8aa6] transition-colors truncate"
            >
              {game.title}
            </Link>
            <div className="flex items-center gap-1 text-[11px] text-[#b7a3ad] shrink-0 font-medium">
              <Eye className="w-3.5 h-3.5 opacity-70" />
              <span>{game.plays_count}</span>
            </div>
          </div>
          <p className="text-xs text-[#b7a3ad] line-clamp-2 mt-1 leading-relaxed">
            {game.description}
          </p>
        </div>

        {/* Footer con autor y botón */}
        <div className="pt-2 border-t border-white/5 flex items-center justify-between mt-auto">
          <span className="text-[10px] text-white/40 uppercase tracking-wider font-semibold truncate max-w-[140px]">
            {game.author}
          </span>
          <Link
            href={`/arcade/libres/${game.slug}`}
            className="text-xs font-bold text-[#ff4d7a] hover:text-[#ff8aa6] transition-colors flex items-center gap-1"
          >
            <span>Jugar</span>
            <span className="text-[10px]">→</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
