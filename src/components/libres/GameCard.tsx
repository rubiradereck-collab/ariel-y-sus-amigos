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
  return (
    <div className="group relative flex flex-col bg-zinc-900/50 hover:bg-zinc-900/90 border border-white/10 hover:border-white/30 rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_32px_rgba(0,0,0,0.6)]">
      {/* Portada 16:10 */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-black/60">
        <Image
          src={game.cover_url}
          alt={game.title}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          unoptimized
        />
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-black/30 pointer-events-none" />

        {/* Badge de categoría */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5 z-10">
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border border-white/15 bg-black/70 backdrop-blur-md text-zinc-200">
            {game.category}
          </span>
          {game.is_featured && (
            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-white/20 text-white backdrop-blur-md">
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
          className="absolute top-3 right-3 z-20 w-8 h-8 rounded-full bg-black/60 hover:bg-black/90 border border-white/10 flex items-center justify-center transition-all cursor-pointer group-hover:scale-105"
          title={isFavorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}
        >
          <Star
            className={`w-3.5 h-3.5 transition-colors ${
              isFavorite
                ? 'fill-yellow-400 text-yellow-400 drop-shadow-[0_0_6px_rgba(250,204,21,0.5)]'
                : 'text-white/60 hover:text-white'
            }`}
          />
        </button>

        {/* Hover Overlay con Botón de Jugar */}
        <Link
          href={`/arcade/libres/${game.slug}`}
          className="absolute inset-0 z-10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/40 backdrop-blur-[2px]"
        >
          <div className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center shadow-xl transform scale-90 group-hover:scale-100 transition-transform">
            <Play className="w-5 h-5 fill-black ml-0.5" />
          </div>
        </Link>
      </div>

      {/* Info del juego */}
      <div className="flex flex-col flex-1 p-4 justify-between gap-2.5">
        <div>
          <div className="flex items-center justify-between gap-2">
            <Link
              href={`/arcade/libres/${game.slug}`}
              className="text-sm font-bold text-white hover:text-cyan-400 transition-colors truncate"
            >
              {game.title}
            </Link>
            <div className="flex items-center gap-1 text-[11px] text-zinc-400 shrink-0 font-medium">
              <Eye className="w-3 h-3 opacity-70" />
              <span>{game.plays_count}</span>
            </div>
          </div>
          <p className="text-xs text-zinc-400 line-clamp-2 mt-1 leading-relaxed">
            {game.description}
          </p>
        </div>

        {/* Footer con autor y botón */}
        <div className="pt-2.5 border-t border-white/5 flex items-center justify-between mt-auto">
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold truncate max-w-[140px]">
            {game.author}
          </span>
          <Link
            href={`/arcade/libres/${game.slug}`}
            className="text-xs font-bold text-white group-hover:text-cyan-400 transition-colors flex items-center gap-1"
          >
            <span>Jugar</span>
            <span className="text-[10px]">→</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
