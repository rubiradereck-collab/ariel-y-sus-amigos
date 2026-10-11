'use client'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { rpc, type Currency } from '@/lib/rpg'
import { sfx } from '@/lib/sfx'
import { BetControls, Card, NeonButton, fmt, useBusy } from '@/components/rpg/ui'
import { sleep, type CasinoProps } from './types'

interface Res { result: 'cara' | 'cruz'; win: boolean; payout: number }

export default function Coinflip({ stats, notify }: CasinoProps) {
  const [amount, setAmount] = useState(50)
  const [currency, setCurrency] = useState<Currency>('coins')
  const [choice, setChoice] = useState<'cara' | 'cruz'>('cara')
  const [rot, setRot] = useState(0)
  const [res, setRes] = useState<Res | null>(null)
  const { busy, run } = useBusy(notify)

  const flip = () => run(async () => {
    setRes(null); sfx.whoosh()
    const r = await rpc<Res>('bet_coinflip', { p_amount: amount, p_currency: currency, p_choice: choice })
    setRot(prev => (Math.ceil(prev / 360) + 5) * 360 + (r.result === 'cara' ? 0 : 180))
    sfx.spin(1500)
    await sleep(1800)
    setRes(r)
    if (r.win) { sfx.coin(); sfx.win() } else sfx.lose()
  })

  const face = 'absolute inset-0 flex items-center justify-center rounded-full border-4 text-2xl font-black [backface-visibility:hidden]'
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="space-y-4">
        <h3 className="text-lg font-black text-fuchsia-300">🪙 Cara o Cruz Caótico</h3>
        <BetControls amount={amount} setAmount={setAmount} currency={currency} setCurrency={setCurrency} stats={stats} disabled={busy} />
        <div className="flex gap-2">
          {(['cara', 'cruz'] as const).map(c => (
            <button key={c} disabled={busy} onClick={() => setChoice(c)}
              className={`flex-1 rounded-xl border py-3 font-black uppercase ${choice === c ? 'border-amber-400 bg-amber-400/20 text-amber-200' : 'border-white/10 text-zinc-400'}`}>{c}</button>
          ))}
        </div>
        <NeonButton onClick={flip} disabled={busy} variant="amber" className="w-full">Lanzar x1.96</NeonButton>
        <p className="text-[11px] text-zinc-500">50% / 50% real, decidido en el servidor. Paga x1.96 (RTP 98%).</p>
      </Card>
      <Card glow="amber" className="flex flex-col items-center justify-center gap-4 py-8">
        <div style={{ perspective: 800 }}>
          <motion.div className="relative h-36 w-36" style={{ transformStyle: 'preserve-3d' }}
            animate={{ rotateY: rot }} transition={{ duration: 1.7, ease: [0.2, 0.8, 0.2, 1] }}>
            <div className={`${face} border-amber-300 bg-gradient-to-br from-amber-300 to-amber-600 text-amber-950`}>CARA</div>
            <div className={`${face} border-zinc-300 bg-gradient-to-br from-zinc-300 to-zinc-600 text-zinc-900 [transform:rotateY(180deg)]`}>CRUZ</div>
          </motion.div>
        </div>
        <div className="h-8 text-center text-lg font-black">
          {res && (res.win ? <span className="text-emerald-300">¡Salió {res.result}! +{fmt(res.payout)}</span>
                           : <span className="text-red-400">Salió {res.result}… perdiste</span>)}
        </div>
      </Card>
    </div>
  )
}
