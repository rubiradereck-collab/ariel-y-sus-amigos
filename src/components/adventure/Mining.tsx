'use client'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { rpc, useNow, RARITY } from '@/lib/rpg'
import { sfx } from '@/lib/sfx'
import { Card, NeonButton, useBusy } from '@/components/rpg/ui'
import { CooldownBar, ItemChip, type AdvProps } from './shared'

interface MineRes { loot: { item: string; qty: number }[]; event: 'cofre' | 'derrumbe' | null; bonus: number; xp: number; cooldown: number }

export default function Mining({ rpg, notify }: AdvProps) {
  const { stats, zones, myTools, tools, inventory } = rpg
  const now = useNow()
  const [zone, setZone] = useState('mine_1')
  const [dyn, setDyn] = useState(false)
  const [last, setLast] = useState<MineRes | null>(null)
  const [hit, setHit] = useState(0)
  const { busy, run } = useBusy(notify)

  const pick = tools[myTools.find((t: any) => t.equipped && tools[t.tool_id]?.kind === 'pickaxe')?.tool_id ?? '']
  const mines = zones.filter((z: any) => z.kind === 'mine')
  const cur = mines.find((z: any) => z.id === zone)
  const ready = !!stats && new Date(stats.mine_ready_at).getTime() <= now
  const dynQty = inventory['dinamita'] ?? 0

  const mine = () => run(async () => {
    sfx.mine(); setHit(h => h + 1)
    const r = await rpc<MineRes>('mine', { p_zone: zone, p_dynamite: dyn && dynQty > 0 })
    setLast(r)
    if (r.event === 'cofre') { sfx.bigWin(); notify(`¡Cofre misterioso! +${r.bonus} monedas`, 'ok') }
    else if (r.event === 'derrumbe') { sfx.boom(); notify('¡Derrumbe! Tu pico tarda 20s más en enfriarse', 'err') }
    else if (r.loot.some((l: any) => ['epico', 'legendario', 'mitico'].includes(rpg.items[l.item]?.rarity ?? ''))) sfx.win()
    else sfx.coin()
    await rpg.reload()
  })

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_320px]">
      <div className="grid gap-3 sm:grid-cols-2">
        {mines.map((z: any) => {
          const locked = !stats || stats.level < z.min_level
          const weak = !pick || pick.tier < z.min_tier
          return (
            <button key={z.id} onClick={() => setZone(z.id)} disabled={locked}
              className={`rounded-2xl border p-3 text-left transition ${zone === z.id ? 'border-fuchsia-400 bg-fuchsia-500/10 shadow-[0_0_18px_#d946ef50]' : 'border-white/10 bg-zinc-950/60'} ${locked ? 'opacity-40' : 'hover:border-fuchsia-400/60'}`}>
              <div className="text-2xl">{z.emoji} <span className="text-base font-black">{z.name}</span></div>
              <p className="text-xs text-zinc-400">{z.description}</p>
              <p className="mt-1 text-[11px] text-amber-300">{locked ? `🔒 Nivel ${z.min_level}` : weak ? `⚠️ Pico tier ${z.min_tier}+ requerido` : `Nivel ${z.min_level}+`}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {z.loot.map((l: any) => rpg.items[l.i] && (
                  <span key={l.i} title={`${rpg.items[l.i].name} · peso ${l.w}`} className={`rounded border px-1 text-sm ${RARITY[rpg.items[l.i].rarity].cls}`}>{rpg.items[l.i].emoji}</span>
                ))}
              </div>
            </button>
          )
        })}
      </div>

      <Card glow="cyan" className="space-y-3">
        <h3 className="font-black text-cyan-300">{cur?.emoji} {cur?.name}</h3>
        <p className="text-xs text-zinc-400">Pico: {pick ? `${pick.emoji} ${pick.name} · enfriamiento ${pick.cooldown_s}s` : '—'}</p>
        <CooldownBar readyAt={stats?.mine_ready_at} total={pick?.cooldown_s ?? 30} now={now} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={dyn} onChange={e => setDyn(e.target.checked)} disabled={dynQty === 0} />
          🧨 Usar dinamita (5 golpes) <span className="text-zinc-500">({dynQty})</span>
        </label>
        <motion.div key={hit} animate={{ rotate: [0, -12, 8, 0] }} transition={{ duration: 0.3 }} className="flex justify-center text-6xl">⛏️</motion.div>
        <NeonButton onClick={mine} disabled={busy || !ready || !stats} variant="cyan" className="w-full py-3 text-base">Minar</NeonButton>
        {last && (
          <div className="space-y-1 rounded-xl border border-white/10 bg-black/30 p-2">
            <p className="text-xs text-zinc-400">Botín (+{last.xp} XP)</p>
            <div className="flex flex-wrap gap-1">{last.loot.map((l, i) => <ItemChip key={i} id={l.item} qty={l.qty} rpg={rpg} />)}</div>
          </div>
        )}
      </Card>
    </div>
  )
}
