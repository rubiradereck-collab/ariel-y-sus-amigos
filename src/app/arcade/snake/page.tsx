'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Trophy, Medal } from 'lucide-react'
import { MainLayout } from '@/components/layout/MainLayout'
import { createClient } from '@/lib/supabase/client'
import { SnakeGame } from '@/components/arcade/SnakeGame'
import { ArcadeLeaderboardEntry } from '@/types/entrega3'

export default function SnakePage() {
  const [supabase] = useState(() => createClient())
  const [leaderboard, setLeaderboard] = useState<ArcadeLeaderboardEntry[]>([])

  const fetchLeaderboard = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('arcade_leaderboard')
        .select('*')
        .eq('game', 'snake')
        .order('best', { ascending: false })
        .limit(10)
      if (!error && data) {
        setLeaderboard(data as ArcadeLeaderboardEntry[])
      }
    } catch {
      // Ignorar
    }
  }, [supabase])

  useEffect(() => {
    void fetchLeaderboard()
  }, [fetchLeaderboard])

  return (
    <MainLayout>
      <div className="min-h-[calc(100vh-6rem)] bg-[radial-gradient(ellipse_at_top,#064e3b_0%,#09090b_60%)] px-4 py-6 text-white sm:px-6">
        <div className="mx-auto max-w-5xl space-y-6">
          <div className="flex items-center justify-between">
            <Link
              href="/arcade"
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-zinc-300 transition hover:bg-white/10"
            >
              <ArrowLeft className="h-4 w-4" /> Volver al Arcade
            </Link>
          </div>

          <div className="text-center">
            <h1 className="text-4xl font-black uppercase tracking-wider text-emerald-400 drop-shadow sm:text-5xl">
              LA CULEBRITA (SNAKE)
            </h1>
            <p className="mt-1 text-xs text-emerald-200/70 sm:text-sm">
              Usa las flechas o WASD (o desliza el dedo en móvil). Gana monedas y XP por cada punto.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <SnakeGame supabase={supabase} onScoreSubmitted={fetchLeaderboard} />
            </div>

            {/* Tabla de Récords */}
            <div className="rounded-3xl border border-white/10 bg-zinc-900/80 p-5 backdrop-blur-md">
              <div className="mb-4 flex items-center gap-2 border-b border-white/10 pb-3">
                <Trophy className="h-5 w-5 text-yellow-400" />
                <h2 className="text-base font-black uppercase tracking-wider text-zinc-200">
                  Mejores Puntuaciones
                </h2>
              </div>

              {leaderboard.length === 0 ? (
                <p className="text-center text-xs text-zinc-500 py-6">Aún no hay puntuaciones registradas.</p>
              ) : (
                <div className="space-y-2">
                  {leaderboard.map((entry, idx) => (
                    <div
                      key={entry.user_id}
                      className="flex items-center justify-between rounded-xl border border-white/5 bg-white/5 p-2.5 text-xs"
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
                        <span className="font-bold text-zinc-200">{entry.username || 'Anónimo'}</span>
                      </div>
                      <span className="font-black text-yellow-300">{entry.best} pts</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  )
}
