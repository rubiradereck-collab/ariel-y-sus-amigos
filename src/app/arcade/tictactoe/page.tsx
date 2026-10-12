'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Bot, Users, Plus, Swords, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { MainLayout } from '@/components/layout/MainLayout'
import { createClient } from '@/lib/supabase/client'
import { TttBoard } from '@/components/arcade/TttBoard'
import { checkWinner, getBestMove } from '@/lib/arcade/minimax'
import { TttGame } from '@/types/entrega3'

export default function TicTacToeLobbyPage() {
  const router = useRouter()
  const [supabase] = useState(() => createClient())
  const [mode, setMode] = useState<'cpu' | 'pvp'>('cpu')
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('hard')

  // Estado del juego vs CPU
  const [cpuBoard, setCpuBoard] = useState<string>('---------')
  const [cpuTurn, setCpuTurn] = useState<'X' | 'O'>('X') // El jugador siempre es X
  const [cpuWinner, setCpuWinner] = useState<'X' | 'O' | 'D' | null>(null)

  // Estado del lobby PvP
  const [waitingGames, setWaitingGames] = useState<TttGame[]>([])
  const [creating, setCreating] = useState<boolean>(false)

  // Manejo de jugada vs CPU
  const handleCpuMove = (pos: number) => {
    if (cpuWinner || cpuTurn !== 'X') return
    const arr = cpuBoard.split('')
    if (arr[pos] !== '-') return

    arr[pos] = 'X'
    const newBoard = arr.join('')
    setCpuBoard(newBoard)

    const w = checkWinner(arr)
    if (w) {
      setCpuWinner(w)
      if (w === 'X') toast.success('🎉 ¡Le ganaste a la máquina!')
      else if (w === 'D') toast.info('Empate (Tablas)')
      return
    }

    // Turno de la CPU
    setCpuTurn('O')
    setTimeout(() => {
      const bestPos = getBestMove(arr, 'O', difficulty)
      if (bestPos >= 0) {
        arr[bestPos] = 'O'
        const botBoard = arr.join('')
        setCpuBoard(botBoard)
        const botWin = checkWinner(arr)
        if (botWin) {
          setCpuWinner(botWin)
          if (botWin === 'O') toast.error('La CPU ganó esta ronda.')
          else if (botWin === 'D') toast.info('Empate (Tablas)')
        } else {
          setCpuTurn('X')
        }
      }
    }, 400)
  }

  const resetCpuGame = () => {
    setCpuBoard('---------')
    setCpuTurn('X')
    setCpuWinner(null)
  }

  // Cargar salas PvP en espera
  const fetchWaitingGames = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('ttt_games')
        .select('*')
        .eq('status', 'waiting')
        .order('created_at', { ascending: false })
      if (!error && data) {
        setWaitingGames(data as TttGame[])
      }
    } catch {
      // Ignorar
    }
  }, [supabase])

  useEffect(() => {
    if (mode !== 'pvp') return
    void fetchWaitingGames()

    const channel = supabase
      .channel('ttt-lobby')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ttt_games' },
        () => void fetchWaitingGames()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [mode, supabase, fetchWaitingGames])

  const handleCreatePvp = async () => {
    setCreating(true)
    try {
      const { data, error } = await supabase.rpc('ttt_create')
      if (error) {
        toast.error(`Error al crear sala: ${error.message}`)
        return
      }
      toast.success('Sala creada. Esperando oponente…')
      router.push(`/arcade/tictactoe/${data}`)
    } catch {
      toast.error('Error al crear sala PvP')
    } finally {
      setCreating(false)
    }
  }

  const handleJoinPvp = async (gameId: string) => {
    try {
      const { error } = await supabase.rpc('ttt_join', { p_id: gameId })
      if (error) {
        toast.error(`No pudiste unirte: ${error.message}`)
        return
      }
      toast.success('¡Te uniste a la partida!')
      router.push(`/arcade/tictactoe/${gameId}`)
    } catch {
      toast.error('Error al unirse a la partida')
    }
  }

  return (
    <MainLayout>
      <div className="min-h-[calc(100vh-6rem)] bg-[radial-gradient(ellipse_at_top,#312e81_0%,#09090b_60%)] px-4 py-6 text-white sm:px-6">
        <div className="mx-auto max-w-4xl space-y-6">
          <div className="flex items-center justify-between">
            <Link
              href="/arcade"
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-zinc-300 transition hover:bg-white/10"
            >
              <ArrowLeft className="h-4 w-4" /> Volver al Arcade
            </Link>
          </div>

          <div className="text-center">
            <h1 className="text-4xl font-black uppercase tracking-wider text-cyan-400 drop-shadow sm:text-5xl">
              TRES EN RAYA (TIC-TAC-TOE)
            </h1>
            <p className="mt-1 text-xs text-cyan-200/70 sm:text-sm">
              Juega al instante contra la IA o reta a un amigo en tiempo real con Supabase.
            </p>
          </div>

          {/* Selector de Modo */}
          <div className="flex justify-center gap-3">
            <button
              onClick={() => setMode('cpu')}
              className={`flex cursor-pointer items-center gap-2 rounded-xl border px-6 py-2.5 text-sm font-black transition ${
                mode === 'cpu'
                  ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200 shadow-lg shadow-cyan-500/20'
                  : 'border-white/10 bg-white/5 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Bot className="h-4 w-4" /> Modo vs CPU
            </button>
            <button
              onClick={() => setMode('pvp')}
              className={`flex cursor-pointer items-center gap-2 rounded-xl border px-6 py-2.5 text-sm font-black transition ${
                mode === 'pvp'
                  ? 'border-fuchsia-400 bg-fuchsia-500/20 text-fuchsia-200 shadow-lg shadow-fuchsia-500/20'
                  : 'border-white/10 bg-white/5 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Users className="h-4 w-4" /> Multijugador 1v1
            </button>
          </div>

          {/* MODO VS CPU */}
          {mode === 'cpu' && (
            <div className="mx-auto max-w-md rounded-3xl border border-white/10 bg-zinc-900/80 p-6 shadow-2xl backdrop-blur-md">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Dificultad:</span>
                <div className="flex gap-1.5">
                  {(['easy', 'medium', 'hard'] as const).map((lvl) => (
                    <button
                      key={lvl}
                      onClick={() => {
                        setDifficulty(lvl)
                        resetCpuGame()
                      }}
                      className={`cursor-pointer rounded-lg border px-2.5 py-1 text-xs font-black capitalize transition ${
                        difficulty === lvl
                          ? 'border-cyan-400 bg-cyan-500/20 text-cyan-300'
                          : 'border-white/10 bg-white/5 text-zinc-500 hover:bg-white/10'
                      }`}
                    >
                      {lvl === 'easy' ? 'Fácil' : lvl === 'medium' ? 'Media' : 'Imposible'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Indicador de Turno */}
              <div className="mb-4 text-center">
                <span className="text-xs font-bold text-zinc-400">
                  {cpuWinner
                    ? cpuWinner === 'D'
                      ? '¡Empate!'
                      : `Ganador: ${cpuWinner === 'X' ? 'Tú (X)' : 'CPU (O)'}`
                    : cpuTurn === 'X'
                      ? 'Tu turno (X)'
                      : 'Pensando CPU…'}
                </span>
              </div>

              <TttBoard
                board={cpuBoard}
                onCellClick={handleCpuMove}
                disabled={Boolean(cpuWinner) || cpuTurn !== 'X'}
              />

              <div className="mt-4 flex justify-center">
                <button
                  onClick={resetCpuGame}
                  className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-zinc-300 transition hover:bg-white/10"
                >
                  <RotateCcw className="h-4 w-4" /> Reiniciar Tablero
                </button>
              </div>
            </div>
          )}

          {/* MODO MULTIJUGADOR PVP */}
          {mode === 'pvp' && (
            <div className="mx-auto max-w-xl rounded-3xl border border-white/10 bg-zinc-900/80 p-6 shadow-2xl backdrop-blur-md">
              <div className="mb-6 flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <h2 className="text-lg font-black uppercase tracking-wider text-fuchsia-300">
                    Salas Disponibles
                  </h2>
                  <p className="text-xs text-zinc-400">Únete a una sala o crea la tuya para jugar 1v1</p>
                </div>

                <button
                  onClick={handleCreatePvp}
                  disabled={creating}
                  className="flex cursor-pointer items-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-pink-600 px-4 py-2 text-xs font-black uppercase tracking-wider text-white shadow-lg transition hover:from-fuchsia-500 hover:to-pink-500 disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" /> Crear Sala
                </button>
              </div>

              {waitingGames.length === 0 ? (
                <div className="py-12 text-center">
                  <Swords className="mx-auto mb-2 h-8 w-8 text-zinc-600" />
                  <p className="text-sm font-bold text-zinc-400">No hay salas esperando jugadores.</p>
                  <p className="mt-1 text-xs text-zinc-500">Crea una sala y dile a un amigo que se una.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {waitingGames.map((g) => (
                    <div
                      key={g.id}
                      className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-3.5 transition hover:border-fuchsia-500/30 hover:bg-white/10"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-fuchsia-500/20 text-fuchsia-300">
                          <Swords className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="text-xs font-black text-zinc-200">
                            Partida #{g.id.slice(0, 8)}
                          </div>
                          <div className="text-[10px] text-zinc-400">Esperando rival…</div>
                        </div>
                      </div>

                      <button
                        onClick={() => handleJoinPvp(g.id)}
                        className="cursor-pointer rounded-xl bg-fuchsia-600 px-4 py-1.5 text-xs font-black uppercase text-white shadow transition hover:bg-fuchsia-500"
                      >
                        Unirse
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  )
}
