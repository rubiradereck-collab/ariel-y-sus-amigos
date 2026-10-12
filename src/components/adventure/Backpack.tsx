'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { bagCap, rpc, RARITY, type Item, type Rarity } from '@/lib/rpg'
import { sfx } from '@/lib/sfx'
import { Card, NeonButton } from '@/components/rpg/ui'
import type { AdvProps } from './shared'
import { useAction } from './utils'

type Filter = 'all' | Item['category']

const CATEGORIES: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Todo' },
  { id: 'mineral', label: '💎 Minerales' },
  { id: 'pez', label: '🐟 Peces' },
  { id: 'material', label: '🪵 Materiales' },
  { id: 'consumible', label: '🧪 Consumibles' },
]

const RARITY_ORDER: Rarity[] = ['mitico', 'legendario', 'epico', 'raro', 'comun']

// Estos consumibles se usan desde Minas o Pesca, no desde la mochila
const USED_ELSEWHERE: Record<string, string> = {
  dinamita: 'Se usa en Minas',
  antorcha: 'Se usa en Minas',
  pocion_suerte: 'Se bebe en Minas',
  carnada_brillante: 'Se usa en Pesca',
  carnada_legendaria: 'Se usa en Pesca',
}

export default function Backpack({ rpg, notify }: AdvProps) {
  const { inventory, items, stats, tools, myTools } = rpg
  const { busy, run } = useAction(notify)
  const [filter, setFilter] = useState<Filter>('all')

  const entries = Object.entries(inventory)
    .filter(([id]) => items[id])
    .map(([id, qty]) => ({ item: items[id], qty }))
    .filter((e) => filter === 'all' || e.item.category === filter)
    .sort(
      (a, b) =>
        RARITY_ORDER.indexOf(a.item.rarity) - RARITY_ORDER.indexOf(b.item.rarity) ||
        a.item.name.localeCompare(b.item.name)
    )

  const used = Object.values(inventory).reduce((a, b) => a + b, 0)
  const cap = bagCap(stats?.backpack_level ?? 1)
  const pct = Math.min(100, (used / cap) * 100)
  const totalValue = Object.entries(inventory).reduce((sum, [id, qty]) => sum + (items[id]?.sell_price ?? 0) * qty, 0)
  const shopItems = Object.values(items).filter((i) => i.buy_price !== null)
  const ownedTools = myTools.filter((t) => tools[t.tool_id])

  const sell = (item: Item, qty: number) => {
    const precious = ['epico', 'legendario', 'mitico'].includes(item.rarity)
    if (precious && !window.confirm(`¿Vender ${qty}× ${item.name} (${RARITY[item.rarity].label})?`)) return
    void run(async () => {
      await rpc('sell_item', { p_item: item.id, p_qty: qty })
      sfx.coin()
      notify(`Vendido: ${qty}× ${item.name} (+${(item.sell_price * qty).toLocaleString()} 🪙)`, 'ok')
      await rpg.reload()
    })
  }

  const sellCommons = () =>
    run(async () => {
      await rpc('sell_all_common')
      sfx.coin()
      notify('Vendiste todos los objetos comunes', 'ok')
      await rpg.reload()
    })

  const useItem = (item: Item) =>
    run(async () => {
      await rpc('use_item', { p_item: item.id })
      sfx.win()
      notify(`Usaste ${item.name}`, 'ok')
      await rpg.reload()
    })

  const upgrade = () =>
    run(async () => {
      await rpc('upgrade_backpack')
      sfx.bigWin()
      notify('¡Mochila mejorada! +20 espacios 🎒', 'ok')
      await rpg.reload()
    })

  const equip = (toolId: string) =>
    run(async () => {
      await rpc('equip_tool', { p_tool: toolId })
      sfx.coin()
      notify(`Equipado: ${tools[toolId]?.name ?? toolId}`, 'ok')
      await rpg.reload()
    })

  const buy = (item: Item, qty: number) =>
    run(async () => {
      await rpc('buy_item', { p_item: item.id, p_qty: qty })
      sfx.coin()
      notify(`Comprado: ${qty}× ${item.name}`, 'ok')
      await rpg.reload()
    })

  return (
    <div className="space-y-4">
      {/* Capacidad */}
      <Card glow="cyan" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-black text-cyan-300">🎒 Mochila nivel {stats?.backpack_level ?? 1}</h3>
            <p className="text-xs text-zinc-400">
              Valor total de venta: <b className="text-amber-300">🪙 {totalValue.toLocaleString()}</b>
            </p>
          </div>
          <div className="flex gap-2">
            <NeonButton variant="amber" onClick={sellCommons} disabled={busy}>
              💰 Vender comunes
            </NeonButton>
            <NeonButton variant="cyan" onClick={upgrade} disabled={busy}>
              ⬆️ Mejorar mochila
            </NeonButton>
          </div>
        </div>
        <div>
          <div className="h-3 overflow-hidden rounded-full bg-white/10">
            <motion.div
              className={`h-full ${pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-400' : 'bg-emerald-400'}`}
              animate={{ width: `${pct}%` }}
              transition={{ type: 'spring', stiffness: 120, damping: 20 }}
            />
          </div>
          <p className="mt-1 text-right text-xs text-zinc-400">
            {used}/{cap} espacios {pct >= 100 && <span className="font-black text-red-300">· ¡LLENA!</span>}
          </p>
        </div>
      </Card>

      {/* Herramientas */}
      {ownedTools.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-black uppercase tracking-widest text-zinc-400">Herramientas</h3>
          <div className="flex flex-wrap gap-2">
            {ownedTools.map((t) => {
              const tool = tools[t.tool_id]
              return (
                <button
                  key={t.tool_id}
                  onClick={() => equip(t.tool_id)}
                  disabled={busy || t.equipped}
                  className={`rounded-xl border px-3 py-2 text-left text-sm transition ${
                    t.equipped
                      ? 'border-emerald-400 bg-emerald-500/10 text-emerald-100'
                      : 'border-white/10 bg-black/30 text-zinc-300 hover:border-cyan-400/60'
                  }`}
                >
                  <span className="font-black">
                    {tool.emoji} {tool.name}
                  </span>
                  <span className="block text-[11px] text-zinc-400">
                    Tier {tool.tier} · {tool.cooldown_s}s · suerte x{Number(tool.luck).toFixed(2)}
                  </span>
                  <span className="block text-[11px] font-black">{t.equipped ? '✓ Equipado' : 'Equipar'}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => setFilter(c.id)}
            className={`whitespace-nowrap rounded-full border px-4 py-1.5 text-xs font-black transition ${
              filter === c.id
                ? 'border-cyan-400 bg-cyan-500/20 text-cyan-100'
                : 'border-white/10 text-zinc-400 hover:text-white'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Objetos */}
      {entries.length === 0 ? (
        <p className="text-center text-zinc-500">Nada por aquí todavía. ¡Ve a minar o a pescar!</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {entries.map(({ item, qty }) => (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`rounded-2xl border bg-black/40 p-3 shadow ${RARITY[item.rarity].cls}`}
            >
              <div className="flex items-center gap-3">
                <span className="text-3xl">{item.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-black text-white">{item.name}</p>
                  <p className="text-[11px] text-zinc-400">
                    {RARITY[item.rarity].label} · 🪙 {item.sell_price} c/u
                  </p>
                </div>
                <b className="text-lg text-cyan-300">×{qty}</b>
              </div>
              {item.description && <p className="mt-1 text-[11px] leading-tight text-zinc-500">{item.description}</p>}

              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  onClick={() => sell(item, 1)}
                  disabled={busy}
                  className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs font-black text-white hover:bg-white/10 disabled:opacity-40"
                >
                  Vender 1
                </button>
                {qty > 1 && (
                  <button
                    onClick={() => sell(item, qty)}
                    disabled={busy}
                    className="rounded-lg border border-amber-400/40 bg-amber-500/10 px-2 py-1 text-xs font-black text-amber-200 hover:bg-amber-500/20 disabled:opacity-40"
                  >
                    Vender todo (+{(item.sell_price * qty).toLocaleString()})
                  </button>
                )}
                {item.category === 'consumible' &&
                  (USED_ELSEWHERE[item.id] ? (
                    <span className="self-center text-[11px] text-zinc-500">{USED_ELSEWHERE[item.id]}</span>
                  ) : (
                    <button
                      onClick={() => useItem(item)}
                      disabled={busy}
                      className="rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-2 py-1 text-xs font-black text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-40"
                    >
                      Usar
                    </button>
                  ))}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Tienda rápida */}
      {shopItems.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-black uppercase tracking-widest text-zinc-400">Tienda rápida</h3>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {shopItems.map((item) => (
              <div key={item.id} className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 p-2">
                <span className="text-2xl">{item.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black text-white">{item.name}</p>
                  <p className="text-[11px] text-amber-300">🪙 {item.buy_price}</p>
                </div>
                <button
                  onClick={() => buy(item, 1)}
                  disabled={busy}
                  className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs font-black text-white hover:bg-white/10 disabled:opacity-40"
                >
                  +1
                </button>
                <button
                  onClick={() => buy(item, 5)}
                  disabled={busy}
                  className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs font-black text-white hover:bg-white/10 disabled:opacity-40"
                >
                  +5
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
