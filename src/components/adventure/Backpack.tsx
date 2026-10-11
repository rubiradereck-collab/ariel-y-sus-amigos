'use client'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { bagCap, rpc, RARITY, type Item } from '@/lib/rpg'
import { sfx } from '@/lib/sfx'
import { Card, NeonButton, fmt, useBusy } from '@/components/rpg/ui'
import type { AdvProps } from './shared'

const TABS = [
  { id: 'mineral', label: '⛏️ Minerales' }, { id: 'pez', label: '🐟 Peces' }, { id: 'material', label: '🪵 Materiales' },
  { id: 'herramienta', label: '🛠️ Herramientas' }, { id: 'consumible', label: '🧪 Consumibles' },
] as const
type Tab = (typeof TABS)[number]['id']

export default function Backpack({ rpg, notify }: AdvProps) {
  const { stats, items, inventory, myTools, tools } = rpg
  const [tab, setTab] = useState<Tab>('mineral')
  const [sel, setSel] = useState<string | null>(null)
  const { busy, run } = useBusy(notify)
  const used = Object.values(inventory).reduce<number>((a, b) => a + (Number(b) || 0), 0)
  const cap = bagCap(stats?.backpack_level ?? 0)
  const list = Object.entries(inventory).map(([id, q]) => ({ it: items[id], q })).filter((x): x is { it: Item; q: number } => !!x.it && x.it.category === tab)
  const selItem = sel ? items[sel] : null

  const act = (fn: string, args: Record<string, unknown>, ok: (r: any) => string) => run(async () => {
    const r = await rpc<any>(fn, args); sfx.coin(); notify(ok(r), 'ok'); await rpg.reload()
  })

  return (
    <div className="space-y-3">
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-[200px] flex-1">
          <p className="text-sm font-bold">🎒 Mochila {used}/{cap}</p>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10"><div className={`h-full ${used / cap > 0.9 ? 'bg-red-500' : 'bg-cyan-400'}`} style={{ width: `${Math.min(100, (used / cap) * 100)}%` }} /></div>
        </div>
        <div className="flex gap-2">
          <NeonButton variant="amber" disabled={busy} onClick={() => act('sell_all_common', {}, r => `Vendiste ${r.sold} objetos comunes por ${fmt(r.gain)} 🪙`)}>💰 Vender todo lo común</NeonButton>
          <NeonButton variant="ghost" disabled={busy} onClick={() => act('buy_item', { p_item: 'madera', p_qty: 5 }, () => 'Compraste 5 maderas')}>🪵 +5 madera (30🪙)</NeonButton>
          <NeonButton variant="ghost" disabled={busy} onClick={() => act('buy_item', { p_item: 'dinamita', p_qty: 1 }, () => 'Compraste dinamita')}>🧨 Dinamita (40🪙)</NeonButton>
        </div>
      </Card>

      <div className="flex gap-2 overflow-x-auto">
        {TABS.map(t => <button key={t.id} onClick={() => { setTab(t.id); setSel(null); sfx.tick() }}
          className={`whitespace-nowrap rounded-xl border px-3 py-1.5 text-sm font-bold ${tab === t.id ? 'border-cyan-400 bg-cyan-500/20' : 'border-white/10 text-zinc-400'}`}>{t.label}</button>)}
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_280px]">
        {tab === 'herramienta' ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {myTools.map((mt: { tool_id: string; equipped: boolean }) => { const t = tools[mt.tool_id]; if (!t) return null
              return (
                <Card key={mt.tool_id} glow={mt.equipped ? 'amber' : 'fuchsia'} className="flex items-center justify-between">
                  <div><div className="font-black">{t.emoji} {t.name}</div><div className="text-xs text-zinc-400">Tier {t.tier} · {t.cooldown_s}s · suerte ×{t.luck}</div></div>
                  {mt.equipped ? <span className="text-xs font-black text-amber-300">EQUIPADO</span>
                    : <NeonButton disabled={busy} onClick={() => act('equip_tool', { p_tool: mt.tool_id }, () => `Equipaste ${t.name}`)}>Equipar</NeonButton>}
                </Card>)
            })}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
            {list.length === 0 && <p className="col-span-full text-sm text-zinc-500">Nada en esta pestaña.</p>}
            {list.map(({ it, q }) => (
              <motion.button key={it.id} whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }} onClick={() => { setSel(it.id); sfx.tick() }}
                className={`relative aspect-square rounded-xl border-2 bg-zinc-950/80 text-3xl shadow-lg ${RARITY[it.rarity].cls} ${sel === it.id ? 'ring-2 ring-white' : ''}`}>
                {it.emoji}<span className="absolute bottom-0.5 right-1 text-xs font-black text-cyan-300">{fmt(q)}</span>
              </motion.button>
            ))}
          </div>
        )}

        {selItem && tab !== 'herramienta' && (
          <Card glow="cyan" className="space-y-2">
            <div className="text-3xl">{selItem.emoji}</div>
            <div className="font-black">{selItem.name}</div>
            <div className="text-xs text-zinc-400">{RARITY[selItem.rarity].label} · vale {selItem.sell_price}🪙 · tienes {inventory[selItem.id] ?? 0}</div>
            {selItem.description && <p className="text-xs text-zinc-300">{selItem.description}</p>}
            <div className="flex flex-wrap gap-2">
              {selItem.sell_price > 0 && <>
                <NeonButton variant="amber" disabled={busy} onClick={() => act('sell_item', { p_item: selItem.id, p_qty: 1 }, r => `+${fmt(r.gain)} 🪙`)}>Vender 1</NeonButton>
                <NeonButton variant="amber" disabled={busy} onClick={() => act('sell_item', { p_item: selItem.id, p_qty: inventory[selItem.id] ?? 1 }, r => `+${fmt(r.gain)} 🪙`)}>Vender todo</NeonButton>
              </>}
              {selItem.category === 'consumible' && selItem.id !== 'dinamita' &&
                <NeonButton variant="green" disabled={busy} onClick={() => act('use_item', { p_item: selItem.id }, r => r.msg)}>Usar</NeonButton>}
            </div>
            {selItem.id === 'dinamita' && <p className="text-[11px] text-zinc-500">Se activa en la pestaña Minería.</p>}
          </Card>
        )}
      </div>
    </div>
  )
}
