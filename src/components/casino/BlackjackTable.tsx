'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { Coins, RotateCcw } from 'lucide-react'
import { SupabaseClient } from '@supabase/supabase-js'
import { BjState } from '@/types/entrega3'
import { PlayingCard } from './PlayingCard'

interface BlackjackTableProps {
  supabase: SupabaseClient
  coins: number
  onBalanceChange?: () => void
}

const CHIP_VALUES = [10, 25, 50, 100, 250, 500]

export function BlackjackTable({ supabase, coins, onBalanceChange }: BlackjackTableProps) {
  const [bet, setBet] = useState<number>(50)
  const [game, setGame] = useState<BjState | null>(null)
  const [loading, setLoading] = useState<boolean>(false)

  // Reanudar partida activa al montar
  const checkCurrentGame = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('bj_current')
      if (!error && data && data.status === 'playing') {
        setGame(data as BjState)
      }
    } catch {
      // Ignorar
    }
  }, [supabase])

  useEffect(() => {
    void checkCurrentGame()
  }, [checkCurrentGame])

  const handleStart = async () => {
    if (bet > coins) {
      toast.error('Saldo insuficiente para esta apuesta')
      return
    }
    setLoading(true)
    try {
      const { data, error } = await supabase.rpc('bj_start', { p_bet: bet })
      if (error) {
        if (error.message.includes('game_in_progress')) {
          await checkCurrentGame()
          toast.info('Se reanudó tu partida en curso')
        } else if (error.message.includes('insufficient_funds')) {
          toast.error('Saldo insuficiente')
        } else {
          toast.error(`Error: ${error.message}`)
        }
        return
      }
      const st = data as BjState
      setGame(st)
      onBalanceChange?.()

      if (st.status === 'finished') {
        handleEndToast(st)
      }
    } catch {
      toast.error('Error al iniciar partida')
    } finally {
      setLoading(false)
    }
  }

  const handleAction = async (action: 'hit' | 'stand' | 'double') => {
    if (loading || !game || game.status !== 'playing') return
    setLoading(true)
    try {
      const { data, error } = await supabase.rpc('bj_action', { p_action: action })
      if (error) {
        toast.error(`Error: ${error.message}`)
        return
      }
      const st = data as BjState
      setGame(st)
      onBalanceChange?.()

      if (st.status === 'finished') {
        handleEndToast(st)
      }
    } catch {
      toast.error('Error en la jugada')
    } finally {
      setLoading(false)
    }
  }

  const handleEndToast = (st: BjState) => {
    if (st.result === 'blackjack') {
      toast.success(`🎉 ¡BLACKJACK NATURAL! Ganaste ${st.payout.toLocaleString()} monedas (+150%)`)
    } else if (st.result === 'win') {
      toast.success(`🎉 ¡Ganaste! Cobraste ${st.payout.toLocaleString()} monedas`)
    } else if (st.result === 'push') {
      toast.info(`Empate. Se devolvieron tus ${st.bet.toLocaleString()} monedas`)
    } else {
      toast.error('La casa gana. ¡Suerte en la próxima ronda!')
    }
  }

  const isPlaying = game && game.status === 'playing'
  const canDouble = isPlaying && game.player.length === 2 && coins >= game.bet

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Mesa de Blackjack */}
      <div className="relative overflow-hidden rounded-3xl border-4 border-emerald-900/60 bg-gradient-to-b from-emerald-900 via-emerald-950 to-zinc-950 p-6 shadow-2xl">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,0.15)_0%,transparent_70%)]" />

        {/* Letrero Blackjack paga 3 a 2 */}
        <div className="relative z-10 mb-6 text-center">
          <div className="inline-block rounded-full border border-yellow-500/30 bg-black/40 px-6 py-1.5 shadow-inner">
            <span className="text-xs font-black tracking-widest text-yellow-300/90 sm:text-sm">
              BLACKJACK PAGA 3 A 2 • LA BANCA SE PLANTA EN 17
            </span>
          </div>
        </div>

        {/* Zona del Crupier */}
        <div className="relative z-10 mb-8 flex flex-col items-center">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">Crupier</span>
            {game && game.dealer_total !== null && (
              <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-black text-emerald-200">
                {game.dealer_total}
              </span>
            )}
          </div>
          <div className="flex min-h-[8rem] flex-wrap items-center justify-center gap-3">
            {game ? (
              <>
                {game.dealer.map((c, i) => (
                  <PlayingCard key={i} card={c} delay={i * 0.15} />
                ))}
                {game.dealer_hidden && <PlayingCard hidden />}
              </>
            ) : (
              <div className="flex h-28 w-20 items-center justify-center rounded-xl border border-dashed border-emerald-500/30 text-emerald-400/40 sm:h-32 sm:w-24">
                Banca
              </div>
            )}
          </div>
        </div>

        {/* Banners de Resultado */}
        <AnimatePresence>
          {game && game.status === 'finished' && game.result && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="relative z-20 my-4 text-center"
            >
              <div
                className={`inline-block rounded-2xl border-2 px-6 py-2.5 shadow-xl ${
                  game.result === 'win' || game.result === 'blackjack'
                    ? 'border-yellow-400 bg-yellow-500/20 text-yellow-200'
                    : game.result === 'push'
                      ? 'border-blue-400 bg-blue-500/20 text-blue-200'
                      : 'border-red-500 bg-red-500/20 text-red-200'
                }`}
              >
                <div className="text-xl font-black uppercase tracking-wider sm:text-2xl">
                  {game.result === 'blackjack'
                    ? '🏆 ¡BLACKJACK!'
                    : game.result === 'win'
                      ? '✨ ¡VICTORIA!'
                      : game.result === 'push'
                        ? '🤝 EMPATE'
                        : '💀 DERROTA'}
                </div>
                <div className="text-xs font-bold opacity-80">
                  {game.payout > 0
                    ? `Premio: +${game.payout.toLocaleString()} monedas`
                    : `Perdiste ${game.bet.toLocaleString()} monedas`}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Zona del Jugador */}
        <div className="relative z-10 flex flex-col items-center">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">Tus cartas</span>
            {game && (
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-black ${
                  game.player_total > 21
                    ? 'bg-red-500/30 text-red-300'
                    : game.player_total === 21
                      ? 'bg-yellow-500/30 text-yellow-300'
                      : 'bg-emerald-500/20 text-emerald-200'
                }`}
              >
                {game.player_total} {game.player_total > 21 && '(Te pasaste)'}
              </span>
            )}
          </div>
          <div className="flex min-h-[8rem] flex-wrap items-center justify-center gap-3">
            {game ? (
              game.player.map((c, i) => <PlayingCard key={i} card={c} delay={i * 0.15} />)
            ) : (
              <div className="flex h-28 w-20 items-center justify-center rounded-xl border border-dashed border-emerald-500/30 text-emerald-400/40 sm:h-32 sm:w-24">
                Jugador
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Controles de Apuesta o Jugada */}
      <div className="rounded-2xl border border-white/10 bg-zinc-900/80 p-5 backdrop-blur-md">
        {isPlaying ? (
          /* Botones de acción durante la partida */
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => void handleAction('hit')}
              disabled={loading}
              className="flex-1 cursor-pointer rounded-xl bg-emerald-600 px-6 py-3.5 text-base font-black uppercase tracking-wider text-white shadow-lg transition hover:bg-emerald-500 disabled:opacity-50"
            >
              Pedir Carta (Hit)
            </button>
            <button
              onClick={() => void handleAction('stand')}
              disabled={loading}
              className="flex-1 cursor-pointer rounded-xl bg-red-600 px-6 py-3.5 text-base font-black uppercase tracking-wider text-white shadow-lg transition hover:bg-red-500 disabled:opacity-50"
            >
              Plantarse (Stand)
            </button>
            <button
              onClick={() => void handleAction('double')}
              disabled={loading || !canDouble}
              className="cursor-pointer rounded-xl bg-yellow-600 px-6 py-3.5 text-base font-black uppercase tracking-wider text-white shadow-lg transition hover:bg-yellow-500 disabled:cursor-not-allowed disabled:opacity-30"
              title={!canDouble ? 'Solo disponible en la mano inicial con saldo suficiente' : 'Duplica apuesta y pide 1 sola carta'}
            >
              Doblar (Double)
            </button>
          </div>
        ) : (
          /* Selector de apuesta para nueva partida */
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Coins className="h-5 w-5 text-yellow-400" />
                <span className="text-sm font-bold text-zinc-300">Apuesta actual:</span>
                <span className="text-lg font-black text-yellow-300">{bet.toLocaleString()}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {CHIP_VALUES.map((val) => (
                  <button
                    key={val}
                    onClick={() => setBet(val)}
                    className={`cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-black transition ${
                      bet === val
                        ? 'border-yellow-400 bg-yellow-500/20 text-yellow-300'
                        : 'border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10'
                    }`}
                  >
                    +{val}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="range"
                min="10"
                max={Math.min(5000, Math.max(10, coins))}
                step="10"
                value={bet}
                onChange={(e) => setBet(Number(e.target.value))}
                className="h-2 flex-1 cursor-pointer appearance-none rounded-lg bg-zinc-700 accent-emerald-500"
              />
              <button
                onClick={handleStart}
                disabled={loading || coins < 10}
                className="cursor-pointer rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-8 py-3.5 text-base font-black uppercase tracking-wider text-white shadow-xl shadow-emerald-500/20 transition hover:from-emerald-400 hover:to-teal-400 disabled:opacity-50"
              >
                {loading ? 'Repartiendo…' : 'Repartir Cartas'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
