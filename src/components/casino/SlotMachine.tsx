'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { Coins, Sparkles } from 'lucide-react'
import { SupabaseClient } from '@supabase/supabase-js'
import { SlotSymbol, SlotResult } from '@/types/entrega3'
import { SLOT_EMOJIS, SLOT_LABELS, SLOT_PAYTABLE } from '@/lib/casino/constants'

interface SlotMachineProps {
  supabase: SupabaseClient
  coins: number
  onBalanceChange?: () => void
}

const CHIP_VALUES = [10, 25, 50, 100, 250, 500]

export function SlotMachine({ supabase, coins, onBalanceChange }: SlotMachineProps) {
  const [bet, setBet] = useState<number>(50)
  const [spinning, setSpinning] = useState<boolean>(false)
  const [reels, setReels] = useState<SlotSymbol[]>(['seven', 'diamond', 'seven'])
  const [lastResult, setLastResult] = useState<SlotResult | null>(null)

  const handleSpin = async () => {
    if (bet > coins) {
      toast.error('Saldo insuficiente')
      return
    }
    if (spinning) return

    setSpinning(true)
    setLastResult(null)

    // Animación visual de rodillos girando aleatoriamente
    const syms: SlotSymbol[] = ['cherry', 'lemon', 'bell', 'star', 'diamond', 'seven']
    const interval = setInterval(() => {
      setReels([
        syms[Math.floor(Math.random() * syms.length)],
        syms[Math.floor(Math.random() * syms.length)],
        syms[Math.floor(Math.random() * syms.length)],
      ])
    }, 70)

    try {
      const { data, error } = await supabase.rpc('slots_spin', { p_bet: bet })

      setTimeout(() => {
        clearInterval(interval)
        setSpinning(false)

        if (error) {
          toast.error(`Error: ${error.message}`)
          return
        }

        const res = data as SlotResult
        setReels(res.reels)
        setLastResult(res)
        onBalanceChange?.()

        if (res.multiplier > 0) {
          toast.success(`🎉 ¡PREMIO! Multiplicador x${res.multiplier} → +${res.payout.toLocaleString()} monedas`)
        } else {
          toast.info('Sin premio. ¡Sigue probando!')
        }
      }, 1200)
    } catch {
      clearInterval(interval)
      setSpinning(false)
      toast.error('Error al girar los rodillos')
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Máquina Tragaperras */}
      <div className="relative overflow-hidden rounded-3xl border-4 border-amber-500/40 bg-gradient-to-b from-purple-950 via-zinc-950 to-black p-6 shadow-2xl sm:p-8">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-fuchsia-500/10 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-amber-500/10 blur-3xl" />

        {/* Encabezado Neón */}
        <div className="relative z-10 mb-6 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-black/50 px-5 py-1 text-xs font-black uppercase tracking-widest text-amber-300">
            <Sparkles className="h-4 w-4 text-amber-400" />
            Tragaperras Bonanza • RTP 91%
          </div>
        </div>

        {/* Rodillos */}
        <div className="relative z-10 my-6 flex items-center justify-center gap-3 sm:gap-6">
          {reels.map((sym, idx) => (
            <motion.div
              key={idx}
              animate={spinning ? { y: [-10, 10, -10] } : { y: 0 }}
              transition={{ repeat: Infinity, duration: 0.15 }}
              className="flex h-32 w-24 flex-col items-center justify-center rounded-2xl border-2 border-amber-400/50 bg-gradient-to-b from-zinc-800 to-zinc-900 shadow-inner sm:h-44 sm:w-36"
            >
              <span className="text-4xl sm:text-6xl">{SLOT_EMOJIS[sym]}</span>
              <span className="mt-2 text-[10px] font-black uppercase tracking-wider text-zinc-400 sm:text-xs">
                {SLOT_LABELS[sym]}
              </span>
            </motion.div>
          ))}
        </div>

        {/* Banner de Ganancia */}
        <AnimatePresence>
          {lastResult && lastResult.multiplier > 0 && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="relative z-20 my-4 text-center"
            >
              <div className="inline-block rounded-2xl border-2 border-yellow-400 bg-yellow-500/20 px-8 py-3 text-yellow-200 shadow-xl shadow-yellow-500/10">
                <div className="text-2xl font-black uppercase tracking-wider sm:text-3xl">
                  ✨ MULTIPLICADOR X{lastResult.multiplier} ✨
                </div>
                <div className="text-sm font-bold text-yellow-300">
                  +{lastResult.payout.toLocaleString()} monedas
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tabla de Premios Resumida */}
        <div className="relative z-10 mt-6 grid grid-cols-3 gap-2 rounded-xl border border-white/5 bg-black/40 p-3 text-center sm:grid-cols-6">
          {(Object.keys(SLOT_PAYTABLE) as SlotSymbol[]).map((s) => (
            <div key={s} className="flex flex-col items-center">
              <span className="text-xl">{SLOT_EMOJIS[s]}</span>
              <span className="text-[10px] font-black text-amber-300">x{SLOT_PAYTABLE[s]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Controles de Apuesta */}
      <div className="rounded-2xl border border-white/10 bg-zinc-900/80 p-5 backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-yellow-400" />
            <span className="text-sm font-bold text-zinc-300">Apuesta por giro:</span>
            <span className="text-lg font-black text-yellow-300">{bet.toLocaleString()}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {CHIP_VALUES.map((val) => (
              <button
                key={val}
                onClick={() => setBet(val)}
                disabled={spinning}
                className={`cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-black transition ${
                  bet === val
                    ? 'border-amber-400 bg-amber-500/20 text-amber-300'
                    : 'border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10'
                }`}
              >
                {val}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <input
            type="range"
            min="10"
            max={Math.min(1000, Math.max(10, coins))}
            step="10"
            value={bet}
            onChange={(e) => setBet(Number(e.target.value))}
            disabled={spinning}
            className="h-2 flex-1 cursor-pointer appearance-none rounded-lg bg-zinc-700 accent-amber-500"
          />
          <button
            onClick={handleSpin}
            disabled={spinning || coins < 10}
            className="cursor-pointer rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 px-8 py-3.5 text-base font-black uppercase tracking-wider text-black shadow-xl shadow-amber-500/20 transition hover:from-amber-400 hover:to-yellow-400 disabled:opacity-50"
          >
            {spinning ? 'Girando…' : 'Girar Rodillos'}
          </button>
        </div>
      </div>
    </div>
  )
}
