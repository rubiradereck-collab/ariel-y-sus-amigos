'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { Coins, Loader2 } from 'lucide-react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { MAX_BET, MIN_BET, rpcError, sfx } from './shared'

type Risk = 'low' | 'medium' | 'high'

// Debe coincidir EXACTAMENTE con las tablas de plinko_drop() en economia_v2.sql
const MULTS: Record<Risk, number[]> = {
  low: [5.6, 2.1, 1, 1, 0.5, 1, 1, 2.1, 5.6],
  medium: [13, 3, 1.2, 0.7, 0.4, 0.7, 1.2, 3, 13],
  high: [29, 4, 1.4, 0.3, 0.2, 0.3, 1.4, 4, 29],
}

const RISKS: { id: Risk; label: string; hint: string }[] = [
  { id: 'low', label: 'Bajo', hint: '0.5x – 5.6x' },
  { id: 'medium', label: 'Medio', hint: '0.4x – 13x' },
  { id: 'high', label: 'Alto', hint: '0.2x – 29x' },
]

const ROWS = 8
const W = 400
const SP = 40
const TOP = 36
const ROW_H = 32
const BIN_Y = TOP + ROWS * ROW_H + 8
const H = BIN_Y + 44
const FLIGHT_SECONDS = 2.6

const pinY = (r: number) => TOP + r * ROW_H
const ballX = (r: number, rights: number) => W / 2 + ((2 * rights - r) * SP) / 2

interface PlinkoRes {
  ok: true
  path: number[]
  bin: number
  multiplier: number
  payout: number
  balance: number
}

interface Flight {
  id: number
  xs: number[]
  ys: number[]
  times: number[]
}

function buildFlight(path: number[]): Flight {
  const xs: number[] = [W / 2]
  const ys: number[] = [6]
  const w: number[] = []

  xs.push(ballX(0, 0))
  ys.push(pinY(0) - 9)
  w.push(0.8)

  let rights = 0
  for (let r = 0; r < ROWS; r++) {
    const x0 = ballX(r, rights)
    const y0 = pinY(r) - 9
    rights += path[r]
    const x1 = ballX(r + 1, rights)
    const y1 = pinY(r + 1) - 9
    const weight = 1 - 0.05 * r // la bola acelera conforme cae
    for (let s = 1; s <= 4; s++) {
      const t = s / 4
      xs.push(x0 + (x1 - x0) * t)
      ys.push(y0 + (y1 - y0) * t - 14 * 4 * t * (1 - t))
      w.push(weight / 4)
    }
  }

  xs.push(ballX(ROWS, rights))
  ys.push(BIN_Y + 14)
  w.push(0.6)

  const total = w.reduce((a, b) => a + b, 0)
  const times: number[] = [0]
  let acc = 0
  w.forEach((x) => {
    acc += x
    times.push(acc / total)
  })
  times[times.length - 1] = 1

  return { id: Date.now(), xs, ys, times }
}

function binColor(m: number): string {
  if (m >= 10) return '#ef4444'
  if (m >= 3) return '#f97316'
  if (m >= 1.5) return '#eab308'
  if (m >= 1) return '#22c55e'
  return '#3f3f46'
}

interface Props {
  supabase: SupabaseClient
  coins: number
}

export default function Plinko({ supabase, coins }: Props) {
  const [bet, setBet] = useState<string>('100')
  const [risk, setRisk] = useState<Risk>('medium')
  const [flight, setFlight] = useState<Flight | null>(null)
  const [busy, setBusy] = useState<boolean>(false)
  const [hit, setHit] = useState<number | null>(null)
  const [history, setHistory] = useState<number[]>([])
  const [frozen, setFrozen] = useState<number | null>(null)

  const busyRef = useRef(false)
  const resultRef = useRef<PlinkoRes | null>(null)
  const betRef = useRef(0)
  const timers = useRef<number[]>([])

  const shownCoins = frozen ?? coins
  const mults = MULTS[risk]

  useEffect(() => {
    const t = timers.current
    return () => t.forEach((id) => window.clearTimeout(id))
  }, [])

  const land = () => {
    const res = resultRef.current
    if (!res) return
    resultRef.current = null
    setFlight(null)
    setHit(res.bin)
    setHistory((h) => [res.multiplier, ...h].slice(0, 12))
    setFrozen(res.balance)

    const net = res.payout - betRef.current
    if (res.multiplier >= 5) {
      sfx.bigWin()
      toast.success(`¡${res.multiplier}x! Ganaste ${res.payout.toLocaleString()} monedas`)
    } else if (net > 0) {
      sfx.win()
      toast.success(`${res.multiplier}x · +${net.toLocaleString()}`)
    } else if (net === 0) {
      sfx.click()
      toast(`${res.multiplier}x · recuperas tu apuesta`)
    } else {
      sfx.lose()
      toast(`${res.multiplier}x · ${net.toLocaleString()}`)
    }

    timers.current.push(
      window.setTimeout(() => {
        setFrozen(null)
        setHit(null)
      }, 1400)
    )
    setBusy(false)
    busyRef.current = false
  }

  const drop = async () => {
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
    setBusy(true)
    setHit(null)
    sfx.click()

    const { data, error } = await supabase.rpc('plinko_drop', { p_bet: amount, p_risk: risk })
    if (error) {
      toast.error(rpcError(error.message))
      setBusy(false)
      busyRef.current = false
      return
    }

    const res = data as PlinkoRes
    resultRef.current = res
    betRef.current = amount
    setFrozen(coins - amount) // el saldo final se revela al caer la bola

    const f = buildFlight(res.path)
    setFlight(f)
    for (let r = 0; r < ROWS; r++) {
      const idx = 5 + 4 * r
      timers.current.push(window.setTimeout(() => sfx.tick(), f.times[idx] * FLIGHT_SECONDS * 1000))
    }
  }

  const setQuick = (kind: 'half' | 'double' | 'min' | 'max') => {
    const n = Math.floor(Number(bet)) || MIN_BET
    if (kind === 'half') setBet(String(Math.max(MIN_BET, Math.floor(n / 2))))
    if (kind === 'double') setBet(String(Math.min(MAX_BET, n * 2)))
    if (kind === 'min') setBet(String(MIN_BET))
    if (kind === 'max') setBet(String(Math.max(MIN_BET, Math.min(MAX_BET, coins))))
  }

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_300px]">
      <div className="rounded-3xl border border-white/10 bg-black/50 p-3 backdrop-blur">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full select-none" role="img" aria-label="Tablero de Plinko">
          {Array.from({ length: ROWS }).map((_, r) =>
            Array.from({ length: r + 1 }).map((__, j) => (
              <circle
                key={`${r}-${j}`}
                cx={W / 2 + ((2 * j - r) * SP) / 2}
                cy={pinY(r)}
                r={3.2}
                fill="#e4e4e7"
                opacity={0.75}
              />
            ))
          )}

          {mults.map((m, b) => {
            const cx = ballX(ROWS, b)
            const active = hit === b
            return (
              <g key={b}>
                <rect
                  x={cx - 17}
                  y={BIN_Y}
                  width={34}
                  height={26}
                  rx={6}
                  fill={binColor(m)}
                  opacity={active ? 1 : 0.55}
                  stroke={active ? '#fff' : 'none'}
                  strokeWidth={2}
                />
                <text
                  x={cx}
                  y={BIN_Y + 17}
                  textAnchor="middle"
                  fontSize={10}
                  fontWeight={800}
                  fill="#fff"
                >
                  {m}x
                </text>
              </g>
            )
          })}

          {flight && (
            <motion.circle
              key={flight.id}
              r={6.5}
              fill="#fbbf24"
              stroke="#fff"
              strokeWidth={1.5}
              style={{ filter: 'drop-shadow(0 0 6px #fbbf24)' }}
              initial={{ cx: flight.xs[0], cy: flight.ys[0] }}
              animate={{ cx: flight.xs, cy: flight.ys }}
              transition={{ duration: FLIGHT_SECONDS, ease: 'linear', times: flight.times }}
              onAnimationComplete={land}
            />
          )}
        </svg>

        {history.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {history.map((m, i) => (
              <span
                key={i}
                className="rounded-full px-2.5 py-0.5 text-[11px] font-black text-white"
                style={{ background: binColor(m) }}
              >
                {m}x
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4 rounded-3xl border border-white/10 bg-black/50 p-5 backdrop-blur">
        <div className="flex items-center justify-between rounded-2xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3">
          <span className="text-xs font-black uppercase tracking-widest text-yellow-200/70">Monedas</span>
          <span className="flex items-center gap-2 text-xl font-black text-white">
            <Coins className="h-5 w-5 text-yellow-500" /> {shownCoins.toLocaleString()}
          </span>
        </div>

        <div>
          <label className="mb-1 block text-xs font-black uppercase tracking-widest text-zinc-400">Apuesta</label>
          <input
            type="number"
            inputMode="numeric"
            min={MIN_BET}
            max={MAX_BET}
            value={bet}
            onChange={(e) => setBet(e.target.value)}
            disabled={busy}
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
                disabled={busy}
                className="rounded-lg border border-white/10 bg-white/5 py-1.5 text-xs font-black text-zinc-300 transition hover:bg-white/10 disabled:opacity-50"
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-black uppercase tracking-widest text-zinc-400">Riesgo</label>
          <div className="grid grid-cols-3 gap-2">
            {RISKS.map((r) => (
              <button
                key={r.id}
                onClick={() => setRisk(r.id)}
                disabled={busy}
                className={`rounded-xl border px-2 py-2 text-center transition disabled:opacity-50 ${
                  risk === r.id
                    ? 'border-fuchsia-400 bg-fuchsia-500/20 text-fuchsia-100'
                    : 'border-white/10 text-zinc-400 hover:border-white/30'
                }`}
              >
                <span className="block text-sm font-black">{r.label}</span>
                <span className="block text-[10px] font-semibold opacity-70">{r.hint}</span>
              </button>
            ))}
          </div>
        </div>

        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={drop}
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-500 to-purple-600 py-4 text-lg font-black uppercase tracking-wider text-white shadow-[0_0_24px_rgba(217,70,239,0.4)] transition disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : '🔻'} {busy ? 'Cayendo...' : 'Soltar bola'}
        </motion.button>

        <p className="text-center text-[11px] font-medium text-zinc-500">
          El resultado lo decide el servidor antes de que la bola caiga. RTP ≈ 96.7–96.9 %.
        </p>
      </div>
    </div>
  )
}
