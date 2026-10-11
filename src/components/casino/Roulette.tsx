'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { rpc, supabase, type Currency } from '@/lib/rpg'
import { sfx } from '@/lib/sfx'
import { BetControls, Card, NeonButton, fmt, useBusy } from '@/components/rpg/ui'
import { sleep, type CasinoProps } from './types'

type Color = 'rojo' | 'negro' | 'verde'
const HEX: Record<Color, string> = { rojo: '#dc2626', negro: '#18181b', verde: '#10b981' }
// Disposición visual de la rueda (la probabilidad real es 7 rojo / 7 negro / 1 verde).
const LAYOUT: Color[] = ['verde', ...Array.from({ length: 14 }, (_, i) => (i % 2 === 0 ? 'rojo' : 'negro') as Color)]
const SEG = 360 / LAYOUT.length

export default function Roulette({ stats, notify }: CasinoProps) {
  const [amount, setAmount] = useState(50)
  const [currency, setCurrency] = useState<Currency>('coins')
  const [rot, setRot] = useState(0)
  const [last, setLast] = useState<{ color: Color; win: boolean; payout: number } | null>(null)
  const [history, setHistory] = useState<Color[]>([])
  const { busy, run } = useBusy(notify)

  const gradient = useMemo(() =>
    `conic-gradient(${LAYOUT.map((c, i) => `${HEX[c]} ${i * SEG}deg ${(i + 1) * SEG}deg`).join(',')})`, [])

  const loadHistory = useCallback(async () => {
    const { data } = await supabase().from('casino_history').select('detail')
      .eq('game', 'roulette').order('created_at', { ascending: false }).limit(14)
    setHistory((data ?? []).map((r: any) => (r.detail as { color: Color }).color))
  }, [])
  useEffect(() => { void loadHistory() }, [loadHistory])

  const spin = (color: Color) => run(async () => {
    setLast(null)
    const r = await rpc<{ color: Color; win: boolean; payout: number }>('bet_roulette',
      { p_amount: amount, p_currency: currency, p_color: color })
    const options = LAYOUT.map((c, i) => (c === r.color ? i : -1)).filter(i => i >= 0)
    const pos = options[Math.floor(Math.random() * options.length)]
    const center = pos * SEG + SEG / 2 + (Math.random() - 0.5) * SEG * 0.6
    setRot(prev => (Math.floor(prev / 360) + 6) * 360 + (360 - center))
    sfx.whoosh(); sfx.spin(4000)
    await sleep(4300)
    setLast(r); void loadHistory()
    if (!r.win) sfx.lose()
    else if (r.color === 'verde') sfx.bigWin()
    else sfx.win()
  })

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="space-y-4">
        <h3 className="text-lg font-black text-fuchsia-300">🎡 Ruleta Neón</h3>
        <BetControls amount={amount} setAmount={setAmount} currency={currency} setCurrency={setCurrency} stats={stats} disabled={busy} />
        <div className="grid grid-cols-3 gap-2">
          <NeonButton variant="red" disabled={busy} onClick={() => spin('rojo')}>Rojo x2</NeonButton>
          <NeonButton variant="ghost" disabled={busy} onClick={() => spin('negro')}>Negro x2</NeonButton>
          <NeonButton variant="green" disabled={busy} onClick={() => spin('verde')}>Verde x14</NeonButton>
        </div>
        <p className="text-[11px] text-zinc-500">15 casillas: 7 rojo (46.7%), 7 negro (46.7%), 1 verde (6.7%). RTP ≈ 93.3%.</p>
        <div>
          <p className="mb-1 text-xs text-zinc-400">Últimos resultados (todos los panas)</p>
          <div className="flex flex-wrap gap-1">
            {history.map((c, i) => <span key={i} className="h-5 w-5 rounded-full border border-white/20" style={{ background: HEX[c] }} />)}
          </div>
        </div>
      </Card>
      <Card glow="cyan" className="flex flex-col items-center gap-4 py-6">
        <div className="relative h-64 w-64">
          <div className="absolute left-1/2 top-[-10px] z-10 h-0 w-0 -translate-x-1/2 border-x-[10px] border-t-[18px] border-x-transparent border-t-amber-300 drop-shadow-[0_0_8px_#fcd34d]" />
          <motion.div className="h-full w-full rounded-full border-4 border-cyan-300 shadow-[0_0_30px_#22d3ee80]"
            style={{ background: gradient }} animate={{ rotate: rot }} transition={{ duration: 4, ease: [0.12, 0.7, 0.1, 1] }} />
          <div className="absolute inset-[34%] rounded-full border-2 border-cyan-300/60 bg-zinc-950" />
        </div>
        <div className="h-8 text-lg font-black">
          {last && (last.win ? <span className="text-emerald-300">¡{last.color.toUpperCase()}! +{fmt(last.payout)}</span>
                             : <span className="text-red-400">Cayó {last.color}… suerte la próxima</span>)}
        </div>
      </Card>
    </div>
  )
}
