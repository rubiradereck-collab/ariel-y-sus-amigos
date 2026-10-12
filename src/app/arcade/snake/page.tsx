'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, Trophy, Medal, Sparkles } from 'lucide-react';
import { ArcadeLayout } from '@/components/arcade/ArcadeLayout';
import { createClient } from '@/lib/supabase/client';
import { SnakeGame } from '@/components/arcade/SnakeGame';
import { ArcadeLeaderboardEntry } from '@/types/entrega3';

export default function SnakePage() {
  const [supabase] = useState(() => createClient());
  const [leaderboard, setLeaderboard] = useState<ArcadeLeaderboardEntry[]>([]);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('arcade_leaderboard')
        .select('*')
        .eq('game', 'snake')
        .order('best', { ascending: false })
        .limit(10);
      if (!error && data) {
        setLeaderboard(data as ArcadeLeaderboardEntry[]);
      }
    } catch {
      // Ignorar
    }
  }, [supabase]);

  useEffect(() => {
    void fetchLeaderboard();
  }, [fetchLeaderboard]);

  return (
    <ArcadeLayout>
      <div className="flex flex-col gap-6 w-full">
        {/* Barra de cabecera con navegación */}
        <div className="flex items-center justify-between bg-zinc-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-xl">
          <Link
            href="/arcade"
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-xs font-bold text-zinc-300 hover:text-white border border-white/10 transition-all"
          >
            <ArrowLeft className="h-4 w-4" /> Volver al Arcade
          </Link>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold uppercase bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Gana Monedas & XP</span>
            </span>
          </div>
        </div>

        {/* Título y descripción */}
        <div className="text-center py-2">
          <h1 className="text-3xl sm:text-5xl font-black uppercase tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 drop-shadow-[0_0_20px_rgba(52,211,153,0.4)]">
            LA CULEBRITA (SNAKE)
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-zinc-400">
            Usa las flechas, WASD o desliza el dedo en móvil. Bate el récord del grupo para subir de rango.
          </p>
        </div>

        {/* Tablero y Leaderboard en columnas */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          <div className="lg:col-span-2 bg-zinc-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-4 sm:p-6 shadow-2xl">
            <SnakeGame supabase={supabase} onScoreSubmitted={fetchLeaderboard} />
          </div>

          {/* Tabla de Récords Gamer */}
          <div className="rounded-2xl border border-white/10 bg-zinc-900/50 backdrop-blur-xl p-5 shadow-2xl">
            <div className="mb-4 flex items-center gap-2 border-b border-white/10 pb-3">
              <Trophy className="h-5 w-5 text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]" />
              <h2 className="text-sm sm:text-base font-black uppercase tracking-wider text-white">
                Mejores Puntuaciones
              </h2>
            </div>

            {leaderboard.length === 0 ? (
              <p className="text-center text-xs text-zinc-400 py-8">
                Aún no hay puntuaciones registradas en esta temporada.
              </p>
            ) : (
              <div className="space-y-2">
                {leaderboard.map((entry, idx) => (
                  <div
                    key={entry.user_id}
                    className="flex items-center justify-between rounded-xl border border-white/5 bg-zinc-800/50 hover:bg-zinc-800/80 p-3 text-xs transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-5 w-5 items-center justify-center font-black text-zinc-400">
                        {idx === 0 ? (
                          <Medal className="h-4 w-4 text-yellow-400" />
                        ) : idx === 1 ? (
                          <Medal className="h-4 w-4 text-zinc-300" />
                        ) : idx === 2 ? (
                          <Medal className="h-4 w-4 text-amber-600" />
                        ) : (
                          idx + 1
                        )}
                      </span>
                      <span className="font-bold text-white">{entry.username || 'Anónimo'}</span>
                    </div>
                    <span className="font-black text-emerald-400 drop-shadow-[0_0_6px_rgba(52,211,153,0.4)]">
                      {entry.best} pts
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </ArcadeLayout>
  );
}
