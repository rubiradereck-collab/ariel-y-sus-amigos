'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ExternalGame } from '@/lib/libres/types';
import { Play, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';

interface HeroCarouselProps {
  games: ExternalGame[];
}

export function HeroCarousel({ games }: HeroCarouselProps) {
  const featured = games.filter((g) => g.is_featured).length > 0
    ? games.filter((g) => g.is_featured)
    : games.slice(0, 3);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (featured.length <= 1 || isPaused) return;

    timerRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % featured.length);
    }, 6000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [featured.length, isPaused]);

  if (featured.length === 0) return null;

  const current = featured[currentIndex];

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev === 0 ? featured.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % featured.length);
  };

  return (
    <div
      className="relative w-full rounded-3xl overflow-hidden border border-white/15 bg-zinc-950/80 shadow-2xl group"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="relative h-[250px] sm:h-[300px] md:h-[340px] w-full overflow-hidden">
        <Image
          src={current.cover_url}
          alt={current.title}
          fill
          priority
          sizes="(max-width: 1200px) 100vw, 1200px"
          className="object-cover transition-transform duration-700 group-hover:scale-105"
          unoptimized
        />

        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/40 to-transparent" />

        <div className="absolute inset-0 p-6 sm:p-10 flex flex-col justify-end max-w-2xl z-10">
          <div className="flex items-center gap-2 mb-2 sm:mb-3">
            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-white/20 text-white backdrop-blur-md">
              <Sparkles className="w-3 h-3 text-cyan-400" />
              <span>Destacado</span>
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 uppercase">
              {current.category}
            </span>
          </div>

          <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight uppercase leading-tight mb-2">
            {current.title}
          </h2>

          <p className="text-xs sm:text-sm text-zinc-300 line-clamp-2 max-w-xl mb-4 sm:mb-5 leading-relaxed">
            {current.description}
          </p>

          <div className="flex items-center gap-4">
            <Link
              href={`/arcade/libres/${current.slug}`}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-xs font-black uppercase tracking-wider text-black bg-white hover:bg-zinc-200 shadow-xl hover:scale-105 active:scale-95 transition-all cursor-pointer"
            >
              <Play className="w-4 h-4 fill-black" />
              <span>Jugar Ahora</span>
            </Link>

            <span className="text-xs text-zinc-400 font-semibold hidden sm:inline">
              👁️ {current.plays_count} partidas jugadas
            </span>
          </div>
        </div>

        {/* Flechas de navegación */}
        {featured.length > 1 && (
          <>
            <button
              onClick={handlePrev}
              className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-black/60 hover:bg-black/90 border border-white/10 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              title="Anterior"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={handleNext}
              className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-black/60 hover:bg-black/90 border border-white/10 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              title="Siguiente"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}

        {/* Indicadores de puntos */}
        {featured.length > 1 && (
          <div className="absolute bottom-4 right-6 z-20 flex items-center gap-1.5">
            {featured.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`h-1.5 rounded-full transition-all cursor-pointer ${
                  currentIndex === idx
                    ? 'w-6 bg-white shadow-sm'
                    : 'w-2 bg-white/30 hover:bg-white/60'
                }`}
                title={`Ir al juego ${idx + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
