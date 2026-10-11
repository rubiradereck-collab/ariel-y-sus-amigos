'use client'
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { rpc, type Currency } from '@/lib/rpg'
import { sfx } from '@/lib/sfx'
import Confetti from '@/components/rpg/Confetti'
import { BetControls, Card, NeonButton, fmt, useBusy } from '@/components/rpg/ui'
import { sleep, type CasinoProps } from './types'

interface Spin { cells: string[]; bombs: number[]; scatters: number; mult: number }
interface Result { spin: Spin; free_spins: Spin[]; total_mult: number; payout: number }

const EMOJI: Record<string, string> = { gold: '🥇', dia: '💎', ruby: '🔴', ame: '🟣', eme: '🟢', saf: '🔵', scat: '⭐', bomb: '💣' }
const PAYERS = ['gold', 'dia', 'ruby', 'ame', 'eme', 'saf']
const PAY = [9.5, 6, 2.8, 1.9, 1.2, 0.7]
const RANDOM_POOL = ['gold', 'dia', 'ruby', 'ame', 'eme', 'saf', 'saf', 'eme', 'ame', 'scat', 'bomb']
const COLS = 5

export default function Slots({ stats, notify }: CasinoProps) {
  const [amount, setAmount] = useState(50)
  const [currency, setCurrency] = useState<Currency>('coins')
  const [grid, setGrid] = useState<string[]>(() => Array.from({ length: 15 }, (_, i) => PAYERS[i % 6]))
  const [bombVals, setBombVals] = useState<Record<number, number>>({})
  const [spinningCols, setSpinningCols] = useState<boolean[]>(Array(COLS).fill(false))
  const [banner, setBanner] = useState<string | null>(null)
  const [running, setRunning] = useState(0)        // total acumulado mostrado
  const [confetti, setConfetti] = useState(0)
  const [showTable, setShowTable] = useState(false)
  const { busy, run } = useBusy(notify)
  const timers = useRef<ReturnType<typeof setInterval>[]>([])
  const spinningRef = useRef<boolean[]>(Array(COLS).fill(false))
  useEffect(() => () => { timers.current.forEach(clearInterval) }, [])

  /** Anima los rodillos columna por columna hasta dejar el resultado final. */
  async function animate(spin: Spin) {
    const final = spin.cells
    const bombs: Record<number, number> = {}
    let k = 0
    final.forEach((c, i) => { if (c === 'bomb') bombs[i] = spin.bombs[k++] })
    setBombVals({}); setSpinningCols(Array(COLS).fill(true))
    const iv = setInterval(() => {
      sfx.reelTick()
      setGrid(g => g.map((c, i) => (spinningRef.current[i % COLS] ? RANDOM_POOL[Math.floor(Math.random() * RANDOM_POOL.length)] : c)))
    }, 80)
    timers.current.push(iv)
    spinningRef.current = Array(COLS).fill(true)
    for (let col = 0; col < COLS; col++) {
      await sleep(550 + col * 260)
      spinningRef.current[col] = false
      setSpinningCols(prev => prev.map((v, i) => (i === col ? false : v)))
      setGrid(g => g.map((c, i) => (i % COLS === col ? final[i] : c)))
      sfx.tick()
    }
    clearInterval(iv)
    setBombVals(bombs)
    if (Object.keys(bombs).length) sfx.boom()
  }

  const play = () => run(async () => {
    setBanner(null); setRunning(0)
    const r = await rpc<Result>('bet_slots', { p_amount: amount, p_currency: currency })
    let acc = r.spin.mult
    await animate(r.spin); setRunning(acc)
    if (r.free_spins.length) {
      setBanner('🎁 ¡GIROS GRATIS! x8'); sfx.bigWin()
      await sleep(1400)
      for (let i = 0; i < r.free_spins.length; i++) {
        setBanner(`🎁 Giro gratis ${i + 1}/8`)
        await animate(r.free_spins[i]); acc += r.free_spins[i].mult; setRunning(acc)
        await sleep(450)
      }
      setBanner(null)
    }
    if (r.payout > 0) {
      const big = r.total_mult >= 10
      setBanner(`${big ? '🔥 ¡GANANCIA ÉPICA! ' : '✅ '}+${fmt(r.payout)} (${r.total_mult.toFixed(2)}×)`)
      if (big) sfx.bigWin()
      else sfx.win()
      sfx.coin()
      if (r.total_mult >= 5) setConfetti(c => c + 1)
    } else { setBanner('Sin premio esta vez…'); sfx.lose() }
  })

  return (
    <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
      {confetti > 0 && <Confetti key={confetti} count={50} />}
      <Card className="space-y-4">
        <h3 className="text-lg font-black text-fuchsia-300">🎰 Gema Bonanza</h3>
        <BetControls amount={amount} setAmount={setAmount} currency={currency} setCurrency={setCurrency} stats={stats} disabled={busy} />
        <NeonButton onClick={play} disabled={busy} className="w-full py-3 text-base">{busy ? 'Girando…' : 'GIRAR'}</NeonButton>
        <button onClick={() => setShowTable(s => !s)} className="text-xs text-cyan-300 underline">Reglas y probabilidades</button>
        {showTable && (
          <div className="space-y-1 text-[11px] text-zinc-400">
            <p>Paga con <b>6+ símbolos iguales en cualquier posición</b> (se suma +60% por cada uno extra).</p>
            <p>{PAYERS.map((s, i) => `${EMOJI[s]} x${PAY[i]}`).join(' · ')} (× apuesta con 6 símbolos)</p>
            <p>💣 Bomba: multiplica la tirada ganadora (x2 hasta x100, se suman). ⭐ 3+ Scatter = 8 giros gratis. Tope x500.</p>
            <p>RTP medido en simulación de 800.000 tiradas ≈ 96%. Premio en ~27% de giros. Giros gratis en ~2.1%.</p>
          </div>
        )}
      </Card>

      <Card glow="amber" className="space-y-3">
        <div className="relative grid grid-cols-5 gap-2">
          {grid.map((s, i) => {
            const spinning = spinningCols[i % COLS]
            return (
              <motion.div key={i} animate={spinning ? { y: [0, -6, 0] } : { y: 0 }} transition={{ repeat: spinning ? Infinity : 0, duration: 0.18 }}
                className={`relative flex aspect-square items-center justify-center rounded-xl border text-3xl sm:text-5xl
                  ${s === 'bomb' && !spinning ? 'border-orange-400 bg-orange-500/20' : s === 'scat' && !spinning ? 'border-yellow-300 bg-yellow-400/20' : 'border-fuchsia-500/30 bg-zinc-900'}
                  ${spinning ? 'blur-[1.5px]' : ''}`}>
                {EMOJI[s]}
                {s === 'bomb' && !spinning && bombVals[i] && (
                  <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute -bottom-1 -right-1 rounded-md bg-orange-500 px-1 text-xs font-black text-black sm:text-sm">x{bombVals[i]}</motion.span>
                )}
              </motion.div>
            )
          })}
        </div>
        <div className="flex h-10 items-center justify-between">
          <AnimatePresence mode="wait">
            {banner && <motion.p key={banner} initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }} className="text-base font-black text-amber-300 sm:text-xl">{banner}</motion.p>}
          </AnimatePresence>
          {running > 0 && <span className="text-sm text-zinc-400">Acumulado: {running.toFixed(2)}×</span>}
        </div>
      </Card>
    </div>
  )
}
