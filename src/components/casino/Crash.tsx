'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { Coins, Loader2 } from 'lucide-react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { MAX_BET, MIN_BET, rpcError, sfx } from './shared'

// Debe coincidir con crash_mult() en economia_v2.sql: m(t) = e^(0.1·t)
const GROWTH = 0.1
const POLL_MS = 300
const VB_W = 600
const VB_H = 300
const PAD = 24

type Phase = 'idle' | 'running' | 'cashed' | 'busted'

interface StartRes {
  ok: true
  round_id: string
  balance: number
}
interface CashoutRes {
  ok: boolean
  busted?: boolean
  crash_point?: number
  multiplier?: number
  payout?: number
  balance?: number
}
interface PollRes {
  status: 'idle' | 'running' | 'busted'
  multiplier?: number
  elapsed?: number
  crash_point?: number
  bet?: number
}

const multAt = (t: number) => Math.floor(Math.exp(GROWTH * t) * 100) / 100

function multColor(m: number, phase: Phase): string {
  if (phase === 'busted') return '#ef4444'
  if (phase === 'cashed') return '#22c55e'
  if (m >= 10) return '#f472b6'
  if (m >= 3) return '#facc15'
  if (m >= 2) return '#4ade80'
  return '#ffffff'
}

interface Props {
  supabase: SupabaseClient
  coins: number
}

export default function Crash({ supabase, coins }: Props) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [bet, setBet] = useState<string>('100')
  const [auto, setAuto] = useState<string>('')
  const [roundBet, setRoundBet] = useState<number>(0)
  const [mult, setMult] = useState<number>(1)
  const [elapsed, setElapsed] = useState<number>(0)
  const [crashPoint, setCrashPoint] = useState<number | null>(null)
  const [payout, setPayout] = useState<number>(0)
  const [history, setHistory] = useState<number[]>([])
  const [working, setWorking] = useState<boolean>(false)

  const phaseRef = useRef<Phase>('idle')
  const startRef = useRef<number>(0) // performance.now() del inicio de la ronda (según el servidor)
  const rafRef = useRef<number | null>(null)
  const pollRef = useRef<number | null>(null)
  const busyRef = useRef(false)
  const autoFired = useRef(false)
  const autoRef = useRef<number>(0)
  const roundBetRef = useRef<number>(0)

  useEffect(() => {
    const n = Number(auto)
    autoRef.current = Number.isFinite(n) && n >= 1.01 ? n : 0
  }, [auto])

  const changePhase = (p: Phase) => {
    phaseRef.current = p
    setPhase(p)
  }

  const stopTimers = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    if (pollRef.current !== null) window.clearInterval(pollRef.current)
    rafRef.current = null
    pollRef.current = null
  }, [])

  const handleBust = useCallback(
    (point: number) => {
      stopTimers()
      setCrashPoint(point)
      setMult(point)
      setHistory((h) => [point, ...h].slice(0, 10))
      changePhase('busted')
      sfx.explode()
      toast.error(`💥 Explotó en ${point.toFixed(2)}x`)
    },
    [stopTimers]
  )

  const cashout = useCallback(async () => {
    if (busyRef.current || phaseRef.current !== 'running') return
    busyRef.current = true
    setWorking(true)
    const { data, error } = await supabase.rpc('crash_cashout')
    if (error) {
      toast.error(rpcError(error.message))
      if (error.message.includes('no_active_round')) {
        stopTimers()
        changePhase('idle')
      }
    } else {
      const res = data as CashoutRes
      if (res.ok && res.multiplier !== undefined && res.payout !== undefined) {
        stopTimers()
        setMult(res.multiplier)
        setPayout(res.payout)
        changePhase('cashed')
        if (res.multiplier >= 5) sfx.bigWin()
        else sfx.win()
        toast.success(`¡Retirado en ${res.multiplier.toFixed(2)}x! +${(res.payout - roundBetRef.current).toLocaleString()}`)
      } else if (res.busted && res.crash_point !== undefined) {
        handleBust(res.crash_point)
      }
    }
    setWorking(false)
    busyRef.current = false
  }, [supabase, stopTimers, handleBust])

  const startTimers = useCallback(() => {
    stopTimers()
    autoFired.current = false

    const tick = () => {
      if (phaseRef.current !== 'running') return
      const t = (performance.now() - startRef.current) / 1000
      const m = multAt(Math.max(0, t))
      setElapsed(t)
      setMult(m)
      if (autoRef.current > 0 && m >= autoRef.current && !autoFired.current) {
        autoFired.current = true
        void cashout()
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)

    pollRef.current = window.setInterval(async () => {
      const t0 = performance.now()
      const { data, error } = await supabase.rpc('crash_poll')
      if (error || phaseRef.current !== 'running') return
      const t1 = performance.now()
      const res = data as PollRes
      if (res.status === 'busted' && res.crash_point !== undefined) {
        handleBust(res.crash_point)
      } else if (res.status === 'running' && res.elapsed !== undefined) {
        startRef.current = t1 - res.elapsed * 1000 - (t1 - t0) / 2 // re-sincroniza con el servidor
      } else if (res.status === 'idle') {
        stopTimers()
        changePhase('idle')
      }
    }, POLL_MS)
  }, [supabase, cashout, handleBust, stopTimers])

  // Reanudar una ronda en curso si el usuario recargó o cambió de pestaña
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const t0 = performance.now()
      const { data, error } = await supabase.rpc('crash_poll')
      if (cancelled || error) return
      const t1 = performance.now()
      const res = data as PollRes
      if (res.status === 'running' && res.elapsed !== undefined) {
        startRef.current = t1 - res.elapsed * 1000 - (t1 - t0) / 2
        const b = res.bet ?? 0
        roundBetRef.current = b
        setRoundBet(b)
        changePhase('running')
        startTimers()
      }
    })()
    return () => {
      cancelled = true
      stopTimers()
    }
  }, [supabase, startTimers, stopTimers])

  const start = async () => {
    if (busyRef.current) return
    const amount = Math.floor(Number(bet))
    if (!Number.isFinite(amount) || amount < MIN_BET || amount > MAX_BET) {
      toast.error(`Apuesta inválida (mín. ${MIN_BET}, máx. ${MAX_BET.toLocaleString()}).`)
      return
    }
    if (amount > coins) {
      toast.error('No tienes monedas suficientes.')
      return
    }
    busyRef.current = true
    setWorking(true)
    sfx.click()

    const { data, error } = await supabase.rpc('crash_start', { p_bet: amount })
    const t1 = performance.now()
    if (error) {
      toast.error(rpcError(error.message))
    } else {
      void (data as StartRes)
      startRef.current = t1 // el servidor arrancó la ronda justo antes de responder
      roundBetRef.current = amount
      setRoundBet(amount)
      setMult(1)
      setElapsed(0)
      setCrashPoint(null)
      setPayout(0)
      changePhase('running')
      sfx.launch()
      startTimers()
    }
    setWorking(false)
    busyRef.current = false
  }

  const setQuick = (kind: 'half' | 'double' | 'min' | 'max') => {
    const n = Math.floor(Number(bet)) || MIN_BET
    if (kind === 'half') setBet(String(Math.max(MIN_BET, Math.floor(n / 2))))
    if (kind === 'double') setBet(String(Math.min(MAX_BET, n * 2)))
    if (kind === 'min') setBet(String(MIN_BET))
    if (kind === 'max') setBet(String(Math.max(MIN_BET, Math.min(MAX_BET, coins))))
  }

  // Curva del cohete (escala automática)
  const tMax = Math.max(elapsed, 6)
  const yMax = Math.max(2, mult * 1.15)
  const pts: string[] = []
  const N = 60
  let lastX = PAD
  let lastY = VB_H - PAD
  for (let i = 0; i <= N; i++) {
    const t = (elapsed * i) / N
    const m = Math.exp(GROWTH * t)
    const x = PAD + (t / tMax) * (VB_W - 2 * PAD)
    const y = VB_H - PAD - ((m - 1) / (yMax - 1)) * (VB_H - 2 * PAD)
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`)
    lastX = x
    lastY = y
  }

  const color = multColor(mult, phase)
  const running = phase === 'running'
  const potential = Math.floor(roundBet * mult)

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_300px]">
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-indigo-950 via-zinc-950 to-black p-3">
        {phase === 'busted' && (
          <motion.div
            className="pointer-events-none absolute inset-0 bg-red-600/30"
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.9 }}
          />
        )}

        <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="w-full select-none" role="img" aria-label="Gráfica del cohete">
          {Array.from({ length: 30 }).map((_, i) => (
            <circle
              key={i}
              cx={(i * 97) % VB_W}
              cy={(i * 53) % VB_H}
              r={(i % 3) * 0.5 + 0.6}
              fill="#fff"
              opacity={0.15 + (i % 5) * 0.08}
            />
          ))}
          <line x1={PAD} y1={VB_H - PAD} x2={VB_W - PAD} y2={VB_H - PAD} stroke="#ffffff22" />
          <line x1={PAD} y1={PAD} x2={PAD} y2={VB_H - PAD} stroke="#ffffff22" />

          {elapsed > 0 && (
            <polyline
              points={pts.join(' ')}
              fill="none"
              stroke={phase === 'busted' ? '#ef4444' : '#a78bfa'}
              strokeWidth={4}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ filter: `drop-shadow(0 0 6px ${phase === 'busted' ? '#ef4444' : '#a78bfa'})` }}
            />
          )}

          <text
            x={lastX}
            y={lastY}
            fontSize={30}
            textAnchor="middle"
            dominantBaseline="middle"
            transform={phase === 'busted' ? undefined : `rotate(-40 ${lastX} ${lastY})`}
          >
            {phase === 'busted' ? '💥' : '🚀'}
          </text>
        </svg>

        <div className="pointer-events-none absolute inset-x-0 top-6 flex flex-col items-center">
          <motion.span
            key={phase === 'busted' ? 'bust' : 'live'}
            initial={{ scale: phase === 'busted' ? 1.4 : 1 }}
            animate={{ scale: 1 }}
            className="text-6xl font-black tabular-nums drop-shadow-[0_0_18px_rgba(0,0,0,0.9)] sm:text-7xl"
            style={{ color }}
          >
            {mult.toFixed(2)}x
          </motion.span>
          <span className="mt-1 text-sm font-black uppercase tracking-widest" style={{ color }}>
            {phase === 'idle' && 'Listo para despegar'}
            {phase === 'running' && `Si te retiras ahora: ${potential.toLocaleString()}`}
            {phase === 'cashed' && `¡Cobraste ${payout.toLocaleString()}!`}
            {phase === 'busted' && `Explotó en ${crashPoint?.toFixed(2)}x`}
          </span>
        </div>

        {history.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1.5">
            {history.map((h, i) => (
              <span
                key={i}
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-black text-white ${
                  h >= 2 ? 'bg-emerald-600' : 'bg-red-600'
                }`}
              >
                {h.toFixed(2)}x
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4 rounded-3xl border border-white/10 bg-black/50 p-5 backdrop-blur">
        <div className="flex items-center justify-between rounded-2xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3">
          <span className="text-xs font-black uppercase tracking-widest text-yellow-200/70">Monedas</span>
          <span className="flex items-center gap-2 text-xl font-black text-white">
            <Coins className="h-5 w-5 text-yellow-500" /> {coins.toLocaleString()}
          </span>
        </div>

        <div>
          <label className="mb-1 block text-xs font-black uppercase tracking-widest text-zinc-400">Apuesta</label>
          <input
            type="number"
            inputMode="numeric"
            min={MIN_BET}
            max={MAX_BET}
            value={running ? roundBet : bet}
            onChange={(e) => setBet(e.target.value)}
            disabled={running || working}
            className="w-full rounded-xl border border-white/10 bg-zinc-900 p-3 text-lg font-bold text-white outline-none focus:border-fuchsia-400 disabled:opacity-50"
          />
          <div className="mt-2 grid grid-cols-4 gap-2">
            {(
              [
                ['min', 'Mín'],
                ['half', '½'],
                ['double', '2×'],
                ['max', 'Máx'],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setQuick(k)}
                disabled={running || working}
                className="rounded-lg border border-white/10 bg-white/5 py-1.5 text-xs font-black text-zinc-300 transition hover:bg-white/10 disabled:opacity-50"
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-black uppercase tracking-widest text-zinc-400">
            Retiro automático en (opcional)
          </label>
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            min={1.01}
            placeholder="ej. 2.00"
            value={auto}
            onChange={(e) => setAuto(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-zinc-900 p-3 font-bold text-white outline-none focus:border-fuchsia-400"
          />
        </div>

        {running ? (
          <motion.button
            animate={{ scale: [1, 1.03, 1] }}
            transition={{ repeat: Infinity, duration: 0.9 }}
            onClick={cashout}
            disabled={working}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 py-4 text-lg font-black uppercase tracking-wider text-white shadow-[0_0_24px_rgba(34,197,94,0.5)] disabled:opacity-70"
          >
            {working && <Loader2 className="h-5 w-5 animate-spin" />}
            Retirarse · {potential.toLocaleString()}
          </motion.button>
        ) : (
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={start}
            disabled={working}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-500 to-purple-600 py-4 text-lg font-black uppercase tracking-wider text-white shadow-[0_0_24px_rgba(217,70,239,0.4)] transition disabled:opacity-60"
          >
            {working ? <Loader2 className="h-5 w-5 animate-spin" /> : '🚀'} Despegar
          </motion.button>
        )}

        <p className="text-center text-[11px] font-medium text-zinc-500">
          El punto de explosión se decide al despegar y solo se revela cuando ya explotó. RTP ≈ 97 %. El retiro
          automático depende de tu conexión: con latencia alta puede llegar tarde.
        </p>
      </div>
    </div>
  )
}
