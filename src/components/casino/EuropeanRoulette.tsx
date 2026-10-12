'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { Coins, RotateCcw, Sparkles } from 'lucide-react'
import { SupabaseClient } from '@supabase/supabase-js'
import { RouletteBet, RouletteResult } from '@/types/entrega3'
import { ROULETTE_ORDER, RED_NUMBERS } from '@/lib/casino/constants'

interface EuropeanRouletteProps {
  supabase: SupabaseClient
  coins: number
  onBalanceChange?: () => void
}

const CHIP_VALUES = [10, 25, 50, 100, 250]

export function EuropeanRoulette({ supabase, coins, onBalanceChange }: EuropeanRouletteProps) {
  const [selectedChip, setSelectedChip] = useState<number>(25)
  const [bets, setBets] = useState<RouletteBet[]>([])
  const [spinning, setSpinning] = useState<boolean>(false)
  const [wheelRotation, setWheelRotation] = useState<number>(0)
  const [lastResult, setLastResult] = useState<RouletteResult | null>(null)

  const totalBet = bets.reduce((sum, b) => sum + b.amount, 0)

  const addBet = (newBet: RouletteBet) => {
    if (spinning) return
    if (totalBet + newBet.amount > coins) {
      toast.error('Saldo insuficiente para añadir esta apuesta')
      return
    }
    if (bets.length >= 20) {
      toast.error('Máximo 20 apuestas por giro')
      return
    }

    setBets((prev) => {
      // Si ya existe la misma apuesta, acumular el monto
      const idx = prev.findIndex((b) => {
        if (b.type !== newBet.type) return false
        if (b.type === 'dozen' && newBet.type === 'dozen') return b.n === newBet.n
        if (b.type === 'straight' && newBet.type === 'straight') return b.n === newBet.n
        return true
      })
      if (idx >= 0) {
        const copy = [...prev]
        copy[idx] = { ...copy[idx], amount: copy[idx].amount + newBet.amount }
        return copy
      }
      return [...prev, newBet]
    })
  }

  const clearBets = () => {
    if (spinning) return
    setBets([])
  }

  const handleSpin = async () => {
    if (bets.length === 0) {
      toast.info('Coloca al menos una ficha en el tapete')
      return
    }
    if (totalBet > coins) {
      toast.error('Saldo insuficiente')
      return
    }
    if (spinning) return

    setSpinning(true)
    setLastResult(null)

    try {
      const { data, error } = await supabase.rpc('roulette_spin', { p_bets: bets })
      if (error) {
        toast.error(`Error: ${error.message}`)
        setSpinning(false)
        return
      }

      const res = data as RouletteResult
      const winNumber = res.number
      const idx = ROULETTE_ORDER.indexOf(winNumber)
      const degreesPerSlot = 360 / 37
      // 5 vueltas completas + alineación con la casilla ganadora
      const targetRotation = wheelRotation + 360 * 5 + (360 - idx * degreesPerSlot)
      setWheelRotation(targetRotation)

      setTimeout(() => {
        setSpinning(false)
        setLastResult(res)
        onBalanceChange?.()
        setBets([])

        if (res.payout > 0) {
          toast.success(
            `🎉 ¡Salió el ${winNumber} (${RED_NUMBERS.has(winNumber) ? 'Rojo' : winNumber === 0 ? 'Verde' : 'Negro'})! Cobraste ${res.payout.toLocaleString()} monedas`
          )
        } else {
          toast.info(
            `Salió el ${winNumber} (${RED_NUMBERS.has(winNumber) ? 'Rojo' : winNumber === 0 ? 'Verde' : 'Negro'}). ¡Suerte en el próximo giro!`
          )
        }
      }, 5000)
    } catch {
      setSpinning(false)
      toast.error('Error al realizar el giro')
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Rueda y Centro de la Ruleta */}
      <div className="relative flex flex-col items-center justify-center overflow-hidden rounded-3xl border-4 border-amber-600/40 bg-gradient-to-b from-emerald-950 via-zinc-950 to-black p-6 shadow-2xl">
        <div className="relative mb-6 flex h-60 w-60 items-center justify-center sm:h-72 sm:w-72">
          {/* Rueda giratoria */}
          <div
            style={{
              transform: `rotate(${wheelRotation}deg)`,
              transition: spinning ? 'transform 5s cubic-bezier(0.12, 0.6, 0.1, 1)' : 'none',
            }}
            className="absolute inset-0 rounded-full border-8 border-amber-700/80 bg-zinc-900 shadow-2xl"
          >
            {/* Casillas representadas visualmente */}
            {ROULETTE_ORDER.map((num, i) => {
              const angle = i * (360 / 37)
              const isRed = RED_NUMBERS.has(num)
              const isGreen = num === 0
              return (
                <div
                  key={num}
                  style={{ transform: `rotate(${angle}deg)` }}
                  className="absolute left-1/2 top-0 -ml-2.5 h-1/2 origin-bottom text-center"
                >
                  <span
                    className={`inline-block text-[9px] font-black sm:text-[11px] ${
                      isGreen ? 'text-emerald-400' : isRed ? 'text-red-400' : 'text-zinc-200'
                    }`}
                  >
                    {num}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Marcador / Flecha de selección */}
          <div className="absolute -top-3 left-1/2 z-20 -ml-3 h-0 w-0 border-x-8 border-t-[14px] border-x-transparent border-t-yellow-400 drop-shadow-md" />

          {/* Centro de la rueda */}
          <div className="relative z-10 flex h-20 w-20 flex-col items-center justify-center rounded-full border-4 border-amber-500/80 bg-zinc-900 shadow-inner sm:h-24 sm:w-24">
            {lastResult !== null ? (
              <div className="text-center">
                <span
                  className={`text-2xl font-black sm:text-3xl ${
                    lastResult.number === 0
                      ? 'text-emerald-400'
                      : RED_NUMBERS.has(lastResult.number)
                        ? 'text-red-400'
                        : 'text-zinc-200'
                  }`}
                >
                  {lastResult.number}
                </span>
              </div>
            ) : (
              <Sparkles className="h-6 w-6 text-amber-400" />
            )}
          </div>
        </div>

        {/* Banner de Ganancia */}
        <AnimatePresence>
          {lastResult && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="relative z-20 my-2 text-center"
            >
              <div
                className={`inline-block rounded-2xl border-2 px-6 py-2.5 shadow-xl ${
                  lastResult.payout > 0
                    ? 'border-yellow-400 bg-yellow-500/20 text-yellow-200'
                    : 'border-white/10 bg-black/60 text-zinc-300'
                }`}
              >
                <div className="text-lg font-black uppercase tracking-wider sm:text-xl">
                  {lastResult.payout > 0
                    ? `🎉 ¡GANASTE +${lastResult.payout.toLocaleString()} MONEDAS!`
                    : `Salió el número ${lastResult.number}`}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Tapete de Apuestas */}
      <div className="rounded-3xl border border-white/10 bg-zinc-900/90 p-5 shadow-xl backdrop-blur-md">
        {/* Selector de Valor de Ficha */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Ficha seleccionada:</span>
            <span className="rounded-full bg-yellow-500/20 px-3 py-0.5 text-xs font-black text-yellow-300">
              {selectedChip}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {CHIP_VALUES.map((val) => (
              <button
                key={val}
                onClick={() => setSelectedChip(val)}
                className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-black transition ${
                  selectedChip === val
                    ? 'border-yellow-400 bg-yellow-500/20 text-yellow-300'
                    : 'border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10'
                }`}
              >
                {val}
              </button>
            ))}
          </div>
        </div>

        {/* Tablero: Casilla 0 y Números 1..36 */}
        <div className="grid grid-cols-12 gap-1.5 text-center text-xs font-black">
          {/* 0 Verde */}
          <button
            onClick={() => addBet({ type: 'straight', n: 0, amount: selectedChip })}
            className="col-span-12 cursor-pointer rounded-lg border border-emerald-500/40 bg-emerald-700/40 py-2 text-emerald-200 transition hover:bg-emerald-600/60"
          >
            0 (Verde • 35:1)
          </button>

          {/* 1 al 36 */}
          {Array.from({ length: 36 }, (_, i) => i + 1).map((num) => {
            const isRed = RED_NUMBERS.has(num)
            const count = bets.filter((b) => b.type === 'straight' && b.n === num).reduce((s, b) => s + b.amount, 0)
            return (
              <button
                key={num}
                onClick={() => addBet({ type: 'straight', n: num, amount: selectedChip })}
                className={`relative col-span-1 cursor-pointer rounded-lg border py-2.5 transition ${
                  isRed
                    ? 'border-red-600/40 bg-red-700/40 text-red-100 hover:bg-red-600/60'
                    : 'border-zinc-700 bg-zinc-800 text-zinc-100 hover:bg-zinc-700'
                }`}
              >
                {num}
                {count > 0 && (
                  <span className="absolute -right-1 -top-1 rounded-full bg-yellow-400 px-1 text-[9px] font-black text-black">
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Apuestas Externas (Docenas) */}
        <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs font-black">
          {[
            { label: '1ª Docena (1-12)', n: 1 as const },
            { label: '2ª Docena (13-24)', n: 2 as const },
            { label: '3ª Docena (25-36)', n: 3 as const },
          ].map((d) => (
            <button
              key={d.n}
              onClick={() => addBet({ type: 'dozen', n: d.n, amount: selectedChip })}
              className="cursor-pointer rounded-xl border border-white/10 bg-white/5 py-2 text-zinc-200 transition hover:bg-white/10"
            >
              {d.label} (2:1)
            </button>
          ))}
        </div>

        {/* Apuestas Sencillas (Rojo/Negro, Par/Impar) */}
        <div className="mt-2 grid grid-cols-4 gap-2 text-center text-xs font-black">
          <button
            onClick={() => addBet({ type: 'red', amount: selectedChip })}
            className="cursor-pointer rounded-xl border border-red-500/40 bg-red-600/40 py-2.5 text-red-200 transition hover:bg-red-600/60"
          >
            ROJO (1:1)
          </button>
          <button
            onClick={() => addBet({ type: 'black', amount: selectedChip })}
            className="cursor-pointer rounded-xl border border-zinc-600 bg-zinc-800 py-2.5 text-zinc-200 transition hover:bg-zinc-700"
          >
            NEGRO (1:1)
          </button>
          <button
            onClick={() => addBet({ type: 'even', amount: selectedChip })}
            className="cursor-pointer rounded-xl border border-white/10 bg-white/5 py-2.5 text-zinc-200 transition hover:bg-white/10"
          >
            PAR (1:1)
          </button>
          <button
            onClick={() => addBet({ type: 'odd', amount: selectedChip })}
            className="cursor-pointer rounded-xl border border-white/10 bg-white/5 py-2.5 text-zinc-200 transition hover:bg-white/10"
          >
            IMPAR (1:1)
          </button>
        </div>

        {/* Resumen y Botón de Girar */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <Coins className="h-4 w-4 text-yellow-400" />
              <span className="text-xs text-zinc-400">Total apostado:</span>
              <span className="text-sm font-black text-yellow-300">{totalBet.toLocaleString()}</span>
            </div>
            <button
              onClick={clearBets}
              disabled={spinning || bets.length === 0}
              className="flex cursor-pointer items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1 text-xs font-bold text-zinc-400 transition hover:bg-white/5 disabled:opacity-30"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Limpiar
            </button>
          </div>

          <button
            onClick={handleSpin}
            disabled={spinning || bets.length === 0}
            className="cursor-pointer rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 px-8 py-3 text-sm font-black uppercase tracking-wider text-black shadow-xl shadow-amber-500/20 transition hover:from-amber-400 hover:to-yellow-400 disabled:opacity-50"
          >
            {spinning ? 'Girando ruleta…' : 'Girar Ruleta'}
          </button>
        </div>
      </div>
    </div>
  )
}
