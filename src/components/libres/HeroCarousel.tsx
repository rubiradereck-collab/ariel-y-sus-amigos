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
      className="relative w-full rounded-[24px] overflow-hidden border border-white/10 bg-black/40 shadow-2xl backdrop-blur-md group"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Contenedor de Imagen de Fondo */}
      <div className="relative h-[260px] sm:h-[340px] md:h-[400px] w-full overflow-hidden">
        <Image
          src={current.cover_url}
          alt={current.title}
          fill
          priority
          sizes="(max-width: 1200px) 100vw, 1200px"
          className="object-cover transition-transform duration-700 group-hover:scale-105"
          unoptimized={current.cover_url.endsWith('.svg')}
        />

        {/* Gradientes de superposición */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#14070f] via-[#14070f]/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#14070f] via-[#14070f]/40 to-transparent" />

        {/* Contenido flotante */}
        <div className="absolute inset-0 p-6 sm:p-10 flex flex-col justify-end max-w-2xl z-10">
          <div className="flex items-center gap-2 mb-2 sm:mb-3">
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-gradient-to-r from-[#ff4d7a] to-[#a855f7] text-white shadow-[0_0_12px_rgba(255,77,122,0.5)]">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Juego Destacado</span>
            </span>
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-white/10 text-white/80 border border-white/10 backdrop-blur-md uppercase">
              {current.category}
            </span>
          </div>

          <h2 className="text-2xl sm:text-4xl md:text-5xl font-black text-white tracking-tight leading-tight mb-2 drop-shadow-md">
            {current.title}
          </h2>

          <p className="text-xs sm:text-sm text-[#f5eef2]/80 line-clamp-2 max-w-xl mb-4 sm:mb-6 leading-relaxed">
            {current.description}
          </p>

          <div className="flex items-center gap-4">
            <Link
              href={`/arcade/libres/${current.slug}`}
              className="inline-flex items-center gap-2.5 px-6 py-3 rounded-full text-sm font-extrabold uppercase tracking-wider text-white bg-gradient-to-r from-[#ff4d7a] to-[#e8365d] hover:brightness-110 shadow-[0_0_25px_rgba(255,77,122,0.6)] hover:shadow-[0_0_35px_rgba(255,77,122,0.9)] hover:scale-105 active:scale-95 transition-all cursor-pointer"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>Jugar Ahora</span>
            </Link>

            <span className="text-xs text-white/60 font-semibold hidden sm:inline">
              👁️ {current.plays_count} partidas jugadas
            </span>
          </div>
        </div>

        {/* Flechas de navegación */}
        {featured.length > 1 && (
          <>
            <button
              onClick={handlePrev}
              className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/40 hover:bg-black/70 backdrop-blur-md border border-white/10 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer hover:scale-110"
              title="Anterior"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={handleNext}
              className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/40 hover:bg-black/70 backdrop-blur-md border border-white/10 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer hover:scale-110"
              title="Siguiente"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}

        {/* Indicadores de puntos */}
        {featured.length > 1 && (
          <div className="absolute bottom-4 right-6 z-20 flex items-center gap-2">
            {featured.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`h-2 rounded-full transition-all cursor-pointer ${
                  currentIndex === idx
                    ? 'w-6 bg-[#ff4d7a] shadow-[0_0_8px_#ff4d7a]'
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
