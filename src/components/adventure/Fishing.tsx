'use client'
import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { rpc, useNow, RARITY } from '@/lib/rpg'
import { sfx } from '@/lib/sfx'
import { Card, NeonButton, useBusy } from '@/components/rpg/ui'
import { CooldownBar, ItemChip, type AdvProps } from './shared'

type Phase = 'idle' | 'waiting' | 'bite'

export default function Fishing({ rpg, notify }: AdvProps) {
  const { stats, zones, myTools, tools } = rpg
  const now = useNow()
  const [zone, setZone] = useState('fish_1')
  const [phase, setPhase] = useState<Phase>('idle')
  const [last, setLast] = useState<{ ok: boolean; item?: string; qty?: number; xp?: number; reason?: string } | null>(null)
  const { busy, run } = useBusy(notify)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  useEffect(() => () => { timers.current.forEach(clearTimeout) }, [])

  const rod = tools[myTools.find((t: any) => t.equipped && tools[t.tool_id]?.kind === 'rod')?.tool_id ?? '']
  const waters = zones.filter((z: any) => z.kind === 'water')
  const ready = !!stats && new Date(stats.fish_ready_at).getTime() <= now

  // Lanzar: el servidor decide cuándo pica y la ventana válida; el cliente solo la muestra.
  const cast = () => run(async () => {
    setLast(null)
    const r = await rpc<{ bite_in_ms: number; window_ms: number }>('fish_cast', { p_zone: zone })
    sfx.whoosh(); setPhase('waiting')
    timers.current.push(setTimeout(() => { setPhase('bite'); sfx.bite() }, r.bite_in_ms))
    timers.current.push(setTimeout(() => setPhase(p => (p === 'bite' ? 'idle' : p)), r.bite_in_ms + r.window_ms + 400))
  })

  const reel = () => run(async () => {
    timers.current.forEach(clearTimeout); timers.current = []
    const r = await rpc<any>('fish_reel')
    setPhase('idle'); setLast(r)
    if (!r.ok) { sfx.lose(); notify(r.reason === 'early' ? 'Tiraste demasiado pronto 🙈' : 'Se escapó… muy lento 🐟💨', 'err') }
    else if (['epico', 'legendario', 'mitico'].includes(rpg.items[r.item]?.rarity ?? '')) sfx.bigWin()
    else sfx.win()
    await rpg.reload()
  })

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_340px]">
      <div className="grid gap-3 sm:grid-cols-2">
        {waters.map((z: any) => {
          const locked = !stats || stats.level < z.min_level
          const weak = !rod || rod.tier < z.min_tier
          return (
            <button key={z.id} disabled={locked || phase !== 'idle'} onClick={() => setZone(z.id)}
              className={`rounded-2xl border p-3 text-left transition ${zone === z.id ? 'border-cyan-400 bg-cyan-500/10 shadow-[0_0_18px_#22d3ee50]' : 'border-white/10 bg-zinc-950/60'} ${locked ? 'opacity-40' : ''}`}>
              <div className="text-2xl">{z.emoji} <span className="text-base font-black">{z.name}</span></div>
              <p className="text-xs text-zinc-400">{z.description}</p>
              <p className="mt-1 text-[11px] text-amber-300">{locked ? `🔒 Nivel ${z.min_level}` : weak ? `⚠️ Caña tier ${z.min_tier}+ requerida` : `Nivel ${z.min_level}+`}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {z.loot.map((l: any) => rpg.items[l.i] && <span key={l.i} className={`rounded border px-1 text-sm ${RARITY[rpg.items[l.i].rarity].cls}`} title={rpg.items[l.i].name}>{rpg.items[l.i].emoji}</span>)}
              </div>
            </button>
          )
        })}
      </div>

      <Card glow="cyan" className="space-y-3">
        <p className="text-xs text-zinc-400">Caña: {rod ? `${rod.emoji} ${rod.name}` : '—'} · Cebo: {stats?.bait_charges ?? 0} usos</p>
        <CooldownBar readyAt={stats?.fish_ready_at} total={rod?.cooldown_s ?? 30} now={now} />
        <div className="relative flex h-40 items-end justify-center overflow-hidden rounded-xl bg-gradient-to-b from-sky-900/40 to-sky-950">
          <motion.div className="absolute text-4xl" animate={phase === 'bite' ? { y: [0, 22, 0, 22, 0], scale: [1, 1.3, 1] } : phase === 'waiting' ? { y: [0, 4, 0] } : { y: 0 }}
            transition={{ repeat: phase === 'idle' ? 0 : Infinity, duration: phase === 'bite' ? 0.35 : 1.4 }} style={{ top: 40 }}>🪝</motion.div>
          <div className="absolute inset-x-0 bottom-0 h-8 bg-sky-500/20" />
          <p className="relative z-10 mb-2 text-sm font-black">
            {phase === 'idle' && 'Lanza la caña'}{phase === 'waiting' && 'Espera la picada…'}
            {phase === 'bite' && <span className="animate-pulse text-xl text-amber-300">¡¡PICÓ!! ¡TIRA!</span>}
          </p>
        </div>
        {phase === 'idle'
          ? <NeonButton onClick={cast} disabled={busy || !ready || !stats} variant="cyan" className="w-full py-3">🎣 Lanzar</NeonButton>
          : <NeonButton onClick={reel} disabled={busy} variant={phase === 'bite' ? 'amber' : 'ghost'} className="w-full py-3">{phase === 'bite' ? '¡TIRAR!' : 'Esperando…'}</NeonButton>}
        {last?.ok && last.item && (
          <div className="rounded-xl border border-white/10 bg-black/30 p-2 text-sm">Pescaste: <ItemChip id={last.item} qty={last.qty} rpg={rpg} /> <span className="text-zinc-400">+{last.xp} XP</span></div>
        )}
        <p className="text-[11px] text-zinc-500">Cuando la boya se hunde tienes poco más de 1.5s. Si tiras antes o después, se escapa.</p>
      </Card>
    </div>
  )
}
