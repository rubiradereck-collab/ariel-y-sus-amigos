'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Swords, Users, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { MainLayout } from '@/components/layout/MainLayout'
import { createClient } from '@/lib/supabase/client'
import { TttBoard } from '@/components/arcade/TttBoard'
import { TttGame } from '@/types/entrega3'

export default function TicTacToePvPGamePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-400">
          Cargando partida...
        </div>
      }
    >
      <TicTacToePvPContent />
    </Suspense>
  )
}

function TicTacToePvPContent() {
  const params = useParams()
  const gameId = (params?.id as string) || ''
  const router = useRouter()

  const [supabase] = useState(() => createClient())
  const [userId, setUserId] = useState<string | null>(null)
  const [game, setGame] = useState<TttGame | null>(null)
  const [moving, setMoving] = useState<boolean>(false)

  // Obtener usuario actual
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id || null)
    })
  }, [supabase])

  // Cargar estado de la partida
  const fetchGame = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('ttt_games')
        .select('*')
        .eq('id', gameId)
        .single()
      if (!error && data) {
        setGame(data as TttGame)
      }
    } catch {
      // Ignorar
    }
  }, [supabase, gameId])

  useEffect(() => {
    void fetchGame()

    // Suscribirse a cambios Realtime en esta partida
    const channel = supabase
      .channel(`ttt-${gameId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ttt_games',
          filter: `id=eq.${gameId}`,
        },
        (payload) => {
          if (payload.new) {
            setGame(payload.new as TttGame)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, gameId, fetchGame])

  const handleCellClick = async (cellIndex: number) => {
    if (moving || !game || game.status !== 'playing') return
    if (game.turn_user !== userId) {
      toast.info('Es el turno de tu oponente')
      return
    }

    setMoving(true)
    try {
      // p_pos es 1..9 en la función de base de datos
      const { data, error } = await supabase.rpc('ttt_move', {
        p_id: gameId,
        p_pos: cellIndex + 1,
      })
      if (error) {
        toast.error(`Movimiento inválido: ${error.message}`)
      } else if (data) {
        setGame(data as TttGame)
      }
    } catch {
      toast.error('Error al realizar jugada')
    } finally {
      setMoving(false)
    }
  }

  const isHost = userId && game && game.host_id === userId
  const isGuest = userId && game && game.guest_id === userId
  const mySymbol = isHost ? 'X' : isGuest ? 'O' : undefined
  const isMyTurn = game && game.turn_user === userId && game.status === 'playing'

  return (
    <MainLayout>
      <div className="min-h-[calc(100vh-6rem)] bg-[radial-gradient(ellipse_at_top,#4338ca_0%,#09090b_60%)] px-4 py-6 text-white sm:px-6">
        <div className="mx-auto max-w-xl space-y-6">
          <div className="flex items-center justify-between">
            <Link
              href="/arcade/tictactoe"
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-zinc-300 transition hover:bg-white/10"
            >
              <ArrowLeft className="h-4 w-4" /> Volver al Lobby
            </Link>
          </div>

          <div className="text-center">
            <h1 className="text-3xl font-black uppercase tracking-wider text-cyan-400 drop-shadow sm:text-4xl">
              PARTIDA 1V1 EN TIEMPO REAL
            </h1>
            <p className="mt-1 text-xs text-zinc-400">ID: {gameId.slice(0, 8)}</p>
          </div>

          {game && (
            <div className="rounded-3xl border border-white/10 bg-zinc-900/80 p-6 shadow-2xl backdrop-blur-md">
              {/* Estado de la Partida */}
              {game.status === 'waiting' && (
                <div className="py-8 text-center space-y-3">
                  <div className="mx-auto flex h-12 w-12 animate-pulse items-center justify-center rounded-2xl bg-fuchsia-500/20 text-fuchsia-300">
                    <Users className="h-6 w-6" />
                  </div>
                  <h2 className="text-lg font-black text-fuchsia-300">Esperando a tu oponente…</h2>
                  <p className="text-xs text-zinc-400">
                    Comparte el enlace de esta sala con tu amigo para que se una.
                  </p>
                </div>
              )}

              {game.status === 'playing' && (
                <div className="mb-6 flex items-center justify-between rounded-2xl border border-white/10 bg-black/40 p-3.5">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-fuchsia-500/20 text-xs font-black text-fuchsia-400">
                      X
                    </span>
                    <span className="text-xs font-bold text-zinc-300">
                      {isHost ? 'Tú (Host)' : 'Rival (Host)'}
                    </span>
                  </div>

                  <div className="rounded-full bg-cyan-500/20 px-3 py-1 text-xs font-black text-cyan-200">
                    {isMyTurn ? '👉 Tu Turno' : '⏳ Turno del Rival'}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-zinc-300">
                      {isGuest ? 'Tú (Rival)' : 'Rival'}
                    </span>
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/20 text-xs font-black text-cyan-400">
                      O
                    </span>
                  </div>
                </div>
              )}

              {game.status === 'finished' && (
                <div className="mb-6 rounded-2xl border-2 border-yellow-500/40 bg-yellow-500/10 p-4 text-center">
                  <h3 className="text-xl font-black uppercase text-yellow-300">
                    {game.is_draw
                      ? '🤝 ¡EMPATE / TABLAS!'
                      : game.winner === userId
                        ? '🎉 ¡VICTORIA!'
                        : '💀 DERROTA'}
                  </h3>
                  <div className="mt-3">
                    <Link
                      href="/arcade/tictactoe"
                      className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-4 py-2 text-xs font-bold text-zinc-200 hover:bg-white/20"
                    >
                      <RotateCcw className="h-4 w-4" /> Volver al Lobby
                    </Link>
                  </div>
                </div>
              )}

              {/* Tablero */}
              <TttBoard
                board={game.board}
                onCellClick={handleCellClick}
                disabled={game.status !== 'playing' || !isMyTurn || moving}
                mySymbol={mySymbol}
              />
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  )
}
