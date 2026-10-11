'use client'
import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { rpc, type Currency } from '@/lib/rpg'
import { sfx } from '@/lib/sfx'
import Confetti from '@/components/rpg/Confetti'
import { BetControls, Card, NeonButton, fmt, useBusy } from '@/components/rpg/ui'
import type { CasinoProps } from './types'

interface Game { bet_id: string; amount: number; currency: Currency; mine_count: number; revealed: number[]; multiplier: number; next_multiplier: number }
interface End { status: 'won' | 'lost'; mines: number[]; revealed: number[]; hit?: number; payout?: number; multiplier?: number }

export default function Mines({ stats, notify }: CasinoProps) {
  const [amount, setAmount] = useState(50)
  const [currency, setCurrency] = useState<Currency>('coins')
  const [mineCount, setMineCount] = useState(3)
  const [game, setGame] = useState<Game | null>(null)
  const [end, setEnd] = useState<End | null>(null)
  const [shake, setShake] = useState(0)
  const [confetti, setConfetti] = useState(0)
  const { busy, run } = useBusy(notify)

  // Reanuda una partida abierta si recargas la página (las minas siguen ocultas en el servidor).
  useEffect(() => { rpc<Game | null>('mines_state').then((g: Game | null) => g && setGame(g)).catch(() => {}) }, [])

  const start = () => run(async () => {
    const r = await rpc<{ bet_id: string; next_multiplier: number }>('mines_start', { p_amount: amount, p_currency: currency, p_mines: mineCount })
    setEnd(null); sfx.coin()
    setGame({ bet_id: r.bet_id, amount, currency, mine_count: mineCount, revealed: [], multiplier: 1, next_multiplier: r.next_multiplier })
  })

  const finish = useCallback((e: End) => { setEnd(e); setGame(null) }, [])

  const reveal = (tile: number) => run(async () => {
    if (!game) return
    const r = await rpc<any>('mines_reveal', { p_bet: game.bet_id, p_tile: tile })
    if (r.status === 'lost') {
      sfx.boom(); setShake(s => s + 1); finish({ status: 'lost', mines: r.mines, revealed: r.revealed, hit: tile })
    } else if (r.status === 'won') {   // tablero completado: cobro automático
      sfx.bigWin(); setConfetti(c => c + 1); finish({ status: 'won', mines: r.mines, revealed: r.revealed, payout: r.payout, multiplier: r.multiplier })
    } else {
      sfx.coin()
      setGame(g => g && { ...g, revealed: r.revealed, multiplier: r.multiplier, next_multiplier: r.next_multiplier })
    }
  })

  const cashout = () => run(async () => {
    if (!game) return
    const r = await rpc<any>('mines_cashout', { p_bet: game.bet_id })
    sfx.win(); sfx.coin(); setConfetti(c => c + 1)
    finish({ status: 'won', mines: r.mines, revealed: r.revealed, payout: r.payout, multiplier: r.multiplier })
  })

  const shown = game ? game.revealed : end?.revealed ?? []
  const potential = game ? Math.floor(game.amount * game.multiplier) : 0

  return (
    <div className="grid gap-4 md:grid-cols-[320px_1fr]">
      {confetti > 0 && <Confetti key={confetti} />}
      <Card className="space-y-4">
        <h3 className="text-lg font-black text-fuchsia-300">💎 Minas</h3>
        <BetControls amount={amount} setAmount={setAmount} currency={currency} setCurrency={setCurrency} stats={stats} disabled={busy || !!game} />
        <div>
          <p className="mb-1 text-xs text-zinc-400">Minas ocultas</p>
          <div className="grid grid-cols-4 gap-2">
            {[1, 3, 5, 8].map(n => (
              <button key={n} disabled={!!game || busy} onClick={() => setMineCount(n)}
                className={`rounded-lg border py-2 font-black ${mineCount === n ? 'border-red-400 bg-red-500/20 text-red-200' : 'border-white/10 text-zinc-400'}`}>{n}</button>
            ))}
          </div>
        </div>
        {!game
          ? <NeonButton onClick={start} disabled={busy} className="w-full">Empezar partida</NeonButton>
          : <NeonButton onClick={cashout} disabled={busy || game.revealed.length === 0} variant="green" className="w-full">
              Retirar {fmt(potential)} ({game.multiplier.toFixed(2)}×)
            </NeonButton>}
        {game && <p className="text-xs text-zinc-400">Siguiente diamante: <b className="text-cyan-300">{game.next_multiplier.toFixed(2)}×</b></p>}
        {end && (
          <p className={`text-sm font-black ${end.status === 'won' ? 'text-emerald-300' : 'text-red-400'}`}>
            {end.status === 'won' ? `¡Retiraste ${fmt(end.payout ?? 0)} (${end.multiplier?.toFixed(2)}×)!` : '💥 Pisaste una mina. Perdiste la apuesta.'}
          </p>
        )}
        <p className="text-[11px] text-zinc-500">Multiplicador = Π (25−i)/(25−minas−i) × 0.97. Las minas se sortean en el servidor al empezar y no se envían a tu navegador hasta que termina la partida.</p>
      </Card>

      <motion.div key={shake} animate={shake ? { x: [0, -14, 14, -10, 10, -4, 0] } : {}} transition={{ duration: 0.5 }}>
        <Card glow="red" className="mx-auto max-w-[520px]">
          <div className="grid grid-cols-5 gap-2">
            {Array.from({ length: 25 }, (_, t) => {
              const isRev = shown.includes(t)
              const isMine = !!end && end.mines.includes(t)
              const isHit = end?.hit === t
              return (
                <motion.button key={t} disabled={!game || busy || isRev}
                  whileHover={game && !isRev ? { scale: 1.08 } : {}} whileTap={{ scale: 0.9 }}
                  onClick={() => reveal(t)}
                  className={`relative aspect-square rounded-xl border text-2xl sm:text-3xl transition-colors
                    ${isHit ? 'border-red-500 bg-red-600/50' : isRev ? 'border-cyan-400/60 bg-cyan-500/20' : isMine ? 'border-red-500/40 bg-red-900/30' : 'border-fuchsia-500/30 bg-zinc-900 hover:border-fuchsia-400'}`}>
                  <AnimatePresence>
                    {(isRev || isMine) && (
                      <motion.span key="c" initial={{ scale: 0, rotate: -90 }} animate={{ scale: isHit ? [0, 1.8, 1.2] : 1, rotate: 0 }}
                        className="absolute inset-0 flex items-center justify-center">
                        {isHit ? '💥' : isRev ? '💎' : '💣'}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.button>
              )
            })}
          </div>
        </Card>
      </motion.div>
    </div>
  )
}
