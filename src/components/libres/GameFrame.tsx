'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { ExternalGame } from '@/lib/libres/types';
import { recordGamePlay, toggleFavorite } from '@/lib/libres/queries';
import { createClient } from '@/lib/supabase/client';
import {
  ArrowLeft,
  Maximize2,
  Minimize2,
  RotateCcw,
  Star,
  ShieldCheck,
  Eye,
  Info,
} from 'lucide-react';

interface GameFrameProps {
  game: ExternalGame;
  initialFavorite: boolean;
}

export function GameFrame({ game, initialFavorite }: GameFrameProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isFav, setIsFav] = useState(initialFavorite);
  const [iframeKey, setIframeKey] = useState(0);
  const [userId, setUserId] = useState<string | undefined>();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function initUser() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        recordGamePlay(user.id, game.slug);
      } else {
        recordGamePlay(undefined, game.slug);
      }
    }
    initUser();
  }, [game.slug]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const handleToggleFullscreen = async () => {
    if (!containerRef.current) return;
    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.warn('Error fullscreen:', err);
    }
  };

  const handleReload = () => {
    setIframeKey((k) => k + 1);
  };

  const handleToggleFav = async () => {
    if (!userId) return;
    const nextState = !isFav;
    setIsFav(nextState);
    await toggleFavorite(userId, game.slug, !nextState);
  };

  // Sandbox seguro
  const sandboxDirectives = [
    'allow-scripts',
    'allow-pointer-lock',
    'allow-fullscreen',
    'allow-popups',
    ...(game.trusted_storage ? ['allow-same-origin'] : []),
  ].join(' ');

  return (
    <div className="flex flex-col gap-5 w-full">
      {/* Barra superior de controles */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white/[0.04] backdrop-blur-xl border border-white/10 rounded-[20px] p-4 shadow-xl">
        {/* Volver */}
        <div className="flex items-center gap-3">
          <Link
            href="/arcade/libres"
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-xs font-bold text-[#b7a3ad] hover:text-white border border-white/5 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Volver a Juegos Libres</span>
          </Link>
          <div className="hidden sm:block h-4 w-[1px] bg-white/10" />
          <h2 className="text-sm sm:text-base font-extrabold text-white truncate max-w-[200px] sm:max-w-md">
            {game.title}
          </h2>
        </div>

        {/* Acciones de la barra */}
        <div className="flex items-center gap-2">
          {userId && (
            <button
              onClick={handleToggleFav}
              className={`p-2 rounded-xl border transition-all cursor-pointer ${
                isFav
                  ? 'bg-yellow-500/20 border-yellow-500/40 text-yellow-400'
                  : 'bg-white/[0.05] hover:bg-white/[0.1] border-white/10 text-[#b7a3ad] hover:text-white'
              }`}
              title={isFav ? 'Quitar de favoritos' : 'Añadir a favoritos'}
            >
              <Star className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
            </button>
          )}

          <button
            onClick={handleReload}
            className="p-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-[#b7a3ad] hover:text-white transition-all cursor-pointer"
            title="Reiniciar juego"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            onClick={handleToggleFullscreen}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#ff4d7a] to-[#e8365d] text-white text-xs font-bold shadow-[0_0_15px_rgba(255,77,122,0.4)] hover:brightness-110 transition-all cursor-pointer"
            title="Pantalla completa"
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="w-4 h-4" />
                <span className="hidden sm:inline">Salir</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-4 h-4" />
                <span className="hidden sm:inline">Pantalla Completa</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Contenedor Iframe del Juego */}
      <div
        ref={containerRef}
        className={`relative w-full rounded-[24px] overflow-hidden border border-white/10 bg-[#0d030c] shadow-2xl flex items-center justify-center ${
          isFullscreen
            ? 'h-screen w-screen rounded-none border-none'
            : 'h-[620px] max-h-[80vh]'
        }`}
      >
        <iframe
          key={iframeKey}
          src={game.embed_url}
          title={game.title}
          sandbox={sandboxDirectives}
          allow="fullscreen; autoplay"
          className="w-full h-full border-0 bg-transparent"
        />
      </div>

      {/* Metadatos y Licencias */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Info y descripción */}
        <div className="md:col-span-2 p-5 bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-[20px] flex flex-col gap-3">
          <div className="flex items-center gap-2 text-white font-bold text-sm">
            <Info className="w-4 h-4 text-[#ff4d7a]" />
            <span>Sobre este juego</span>
          </div>
          <p className="text-xs sm:text-sm text-[#b7a3ad] leading-relaxed">
            {game.description}
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2 text-xs text-[#b7a3ad]">
            <span className="flex items-center gap-1 bg-white/5 px-2.5 py-1 rounded-lg border border-white/5">
              <span>Categoría:</span>
              <strong className="text-white capitalize">{game.category}</strong>
            </span>
            <span className="flex items-center gap-1 bg-white/5 px-2.5 py-1 rounded-lg border border-white/5">
              <Eye className="w-3.5 h-3.5 text-[#38bdf8]" />
              <span>Partidas:</span>
              <strong className="text-white">{game.plays_count}</strong>
            </span>
            <span className="flex items-center gap-1 bg-white/5 px-2.5 py-1 rounded-lg border border-white/5">
              <span>Orientación:</span>
              <strong className="text-white capitalize">{game.orientation}</strong>
            </span>
          </div>
        </div>

        {/* Autoría y Sandbox Legal */}
        <div className="p-5 bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-[20px] flex flex-col justify-between gap-3">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
              <ShieldCheck className="w-4 h-4" />
              <span>Licencia Verificada</span>
            </div>
            <div className="text-xs text-[#b7a3ad] space-y-1">
              <p>
                Autor: <span className="text-white font-medium">{game.author}</span>
              </p>
              <p>
                Licencia: <span className="text-white font-mono">{game.license}</span>
              </p>
              <p>
                Tipo: <span className="text-white capitalize">{game.source_type}</span>
              </p>
            </div>
          </div>

          <div className="pt-3 border-t border-white/5 text-[11px] text-white/40 leading-tight">
            Iframe aislado con sandbox estricto. Sin tracking comercial ni consumo de recursos en segundo plano.
          </div>
        </div>
      </div>
    </div>
  );
}
