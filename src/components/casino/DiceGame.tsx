'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Dices, ShieldCheck, ChevronUp, ChevronDown, Sparkles, Coins } from 'lucide-react'
import { toast } from 'sonner'
import type { SupabaseClient } from '@supabase/supabase-js'

export function DiceGame({
  supabase,
  coins,
  onBalanceChange,
}: {
  supabase: SupabaseClient
  coins: number
  onBalanceChange?: () => void
}) {
  const [bet, setBet] = useState<number>(20)
  const [target, setTarget] = useState<number>(50)
  const [mode, setMode] = useState<'over' | 'under'>('over')
  const [rolling, setRolling] = useState<boolean>(false)
  const [lastRoll, setLastRoll] = useState<number | null>(null)
  const [lastWin, setLastWin] = useState<boolean | null>(null)
  const [lastPayout, setLastPayout] = useState<number | null>(null)
  const [provablyFair, setProvablyFair] = useState<{ seed?: string; hash?: string } | null>(null)

  // Cálculos en tiempo real
  const winChance = mode === 'over' ? 100 - target : target
  const multiplier = Number((99.0 / (mode === 'over' ? 100 - target : target)).toFixed(2))
  const profitOnWin = Math.floor(bet * multiplier) - bet

  const playRollSound = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const osc = ctx.createOscillator()
      const g = ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(400, ctx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.1)
      g.gain.setValueAtTime(0.1, ctx.currentTime)
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1)
      osc.connect(g)
      g.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.1)
    } catch {}
  }

  const handleRoll = async () => {
    if (rolling) return
    if (bet <= 0 || bet > coins) {
      toast.error('Saldo insuficiente para esta apuesta.')
      return
    }

    setRolling(true)
    playRollSound()

    try {
      const { data, error } = await supabase.rpc('casino_dice_roll', {
        p_bet: bet,
        p_target: target,
        p_mode: mode,
      })

      if (error) throw error
      if (!data?.success) {
        toast.error(data?.message || 'Error en la tirada')
        setRolling(false)
        return
      }

      // Animación de números rodantes
      let counter = 0
      const interval = setInterval(() => {
        setLastRoll(Math.floor(Math.random() * 100) + 1)
        counter++
        if (counter > 8) {
          clearInterval(interval)
          setLastRoll(data.roll)
          setLastWin(data.win)
          setLastPayout(data.payout)
          setProvablyFair({ seed: data.server_seed, hash: data.hash })
          setRolling(false)

          if (data.win) {
            toast.success(`🎉 ¡Ganaste +${data.payout} 🪙! (Tirada: ${data.roll})`)
          } else {
            toast.error(`Perdiste ${bet} 🪙 (Tirada: ${data.roll})`)
          }

          onBalanceChange?.()
        }
      }, 60)
    } catch (e: any) {
      toast.error(e?.message || 'Error al conectar con la banca')
      setRolling(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl rounded-3xl border border-[rgba(212,175,55,0.25)] bg-[#0e0e11] p-5 sm:p-7 shadow-2xl text-white">
      {/* Cabecera */}
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="rounded-2xl bg-gradient-to-tr from-[#d4af37] to-amber-200 p-2 text-black shadow-md">
            <Dices className="h-6 w-6 font-black" />
          </div>
          <div>
            <h3 className="text-lg font-black tracking-wide text-[#d4af37]">DICE CLANDESTINO</h3>
            <p className="text-xs text-zinc-400">Ajusta tu probabilidad y lanza el dado 1–100</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 rounded-full border border-yellow-500/30 bg-black/60 px-3 py-1 text-xs font-black text-yellow-300">
          <Coins className="h-3.5 w-3.5 text-yellow-500" />
          <span>{coins.toLocaleString()} 🪙</span>
        </div>
      </div>

      {/* Pantalla Central de Resultado */}
      <div className="my-6 flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-[#161619] p-6 text-center">
        <span className="text-xs font-black uppercase tracking-widest text-zinc-400">
          Resultado del Dado
        </span>

        <div
          className={`my-3 text-6xl sm:text-7xl font-black font-mono transition-colors ${
            lastWin === true
              ? 'text-emerald-400 drop-shadow-[0_0_20px_rgba(52,211,153,0.6)]'
              : lastWin === false
              ? 'text-red-400 drop-shadow-[0_0_20px_rgba(248,113,113,0.6)]'
              : 'text-zinc-200'
          }`}
        >
          {lastRoll !== null ? lastRoll : '50'}
        </div>

        <div className="flex items-center gap-2 text-xs font-bold text-zinc-400">
          <span>Condición:</span>
          <span className="rounded-md bg-black/50 px-2 py-0.5 text-white">
            {mode === 'over' ? `Mayor que ${target}` : `Menor que ${target}`}
          </span>
          {lastWin !== null && (
            <span
              className={`rounded-md px-2 py-0.5 font-black uppercase ${
                lastWin ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'
              }`}
            >
              {lastWin ? `+${lastPayout} 🪙` : 'Derrota'}
            </span>
          )}
        </div>
      </div>

      {/* Selector de Modo (Over / Under) y Slider */}
      <div className="space-y-4 rounded-2xl border border-white/5 bg-[#161619]/60 p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black uppercase tracking-wider text-zinc-300">
            Regla de Victoria
          </span>
          <div className="flex rounded-xl border border-white/10 bg-black/40 p-0.5">
            <button
              onClick={() => setMode('over')}
              className={`cursor-pointer rounded-lg px-3 py-1 text-xs font-black transition ${
                mode === 'over'
                  ? 'bg-[#d4af37] text-black shadow'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Tirar Sobre ({target})
            </button>
            <button
              onClick={() => setMode('under')}
              className={`cursor-pointer rounded-lg px-3 py-1 text-xs font-black transition ${
                mode === 'under'
                  ? 'bg-[#d4af37] text-black shadow'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Tirar Bajo ({target})
            </button>
          </div>
        </div>

        {/* Slider de Umbral */}
        <div>
          <input
            type="range"
            min={2}
            max={98}
            value={target}
            disabled={rolling}
            onChange={(e) => setTarget(Number(e.target.value))}
            className="w-full accent-[#d4af37] cursor-pointer"
          />
          <div className="flex justify-between text-[11px] font-mono text-zinc-500">
            <span>2</span>
            <span>25</span>
            <span className="text-yellow-400 font-bold">50</span>
            <span>75</span>
            <span>98</span>
          </div>
        </div>

        {/* Estadísticas de la Jugada */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl border border-white/10 bg-black/40 p-2.5">
            <span className="block text-[10px] uppercase font-bold text-zinc-400">Probabilidad</span>
            <span className="text-base sm:text-lg font-black text-cyan-300">{winChance}%</span>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/40 p-2.5">
            <span className="block text-[10px] uppercase font-bold text-zinc-400">Multiplicador</span>
            <span className="text-base sm:text-lg font-black text-[#d4af37]">x{multiplier}</span>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/40 p-2.5">
            <span className="block text-[10px] uppercase font-bold text-zinc-400">Ganancia Neta</span>
            <span className="text-base sm:text-lg font-black text-emerald-300">+{profitOnWin} 🪙</span>
          </div>
        </div>
      </div>

      {/* Controles de Apuesta */}
      <div className="mt-5 space-y-3">
        <div className="flex items-center justify-between text-xs font-bold text-zinc-400">
          <span>Cantidad a Apostar:</span>
          <span className="text-white font-mono">{bet} 🪙</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {[10, 25, 50, 100, 250].map((amt) => (
            <button
              key={amt}
              onClick={() => setBet(amt)}
              disabled={rolling}
              className={`cursor-pointer rounded-xl border px-3 py-1.5 text-xs font-bold transition active:scale-95 ${
                bet === amt
                  ? 'border-[#d4af37] bg-[#d4af37]/20 text-[#d4af37]'
                  : 'border-white/10 bg-black/40 text-zinc-400 hover:text-white'
              }`}
            >
              {amt} 🪙
            </button>
          ))}
          <button
            onClick={() => setBet((b) => Math.max(5, Math.floor(b / 2)))}
            disabled={rolling}
            className="cursor-pointer rounded-xl border border-white/10 bg-black/40 px-2.5 py-1.5 text-xs font-bold text-zinc-400 hover:text-white"
          >
            ½
          </button>
          <button
            onClick={() => setBet((b) => Math.min(coins, b * 2))}
            disabled={rolling}
            className="cursor-pointer rounded-xl border border-white/10 bg-black/40 px-2.5 py-1.5 text-xs font-bold text-zinc-400 hover:text-white"
          >
            2X
          </button>
          <button
            onClick={() => setBet(coins)}
            disabled={rolling}
            className="cursor-pointer rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-2.5 py-1.5 text-xs font-bold text-yellow-300 hover:bg-yellow-500/20"
          >
            MAX
          </button>
        </div>

        {/* Botón Tirar Dado */}
        <button
          onClick={handleRoll}
          disabled={rolling || coins < bet || bet <= 0}
          className="w-full cursor-pointer rounded-2xl bg-gradient-to-r from-[#d4af37] via-amber-400 to-[#d4af37] py-4 text-sm font-black uppercase text-black shadow-lg shadow-yellow-500/25 transition hover:brightness-110 active:scale-95 disabled:opacity-50"
        >
          {rolling ? 'Lanzando Dado...' : `🎲 ¡TIRAR DADO (${bet} 🪙)!`}
        </button>
      </div>

      {/* Sección Provably Fair */}
      {provablyFair && (
        <div className="mt-5 rounded-xl border border-white/10 bg-black/50 p-3 text-left space-y-1">
          <div className="flex items-center gap-1.5 text-[11px] font-black text-emerald-400">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Provably Fair Verificado (SHA-256)</span>
          </div>
          <p className="truncate font-mono text-[10px] text-zinc-400">
            Hash: {provablyFair.hash}
          </p>
          <p className="truncate font-mono text-[10px] text-zinc-500">
            Seed: {provablyFair.seed}
          </p>
        </div>
      )}
    </div>
  )
}
