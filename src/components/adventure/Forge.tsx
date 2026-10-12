'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { rpc, type Recipe } from '@/lib/rpg'
import { sfx } from '@/lib/sfx'
import { Card, NeonButton } from '@/components/rpg/ui'
import type { AdvProps } from './shared'
import { useAction } from './utils'

type Filter = 'all' | 'tool' | 'item'

interface Check {
  missing: { id: string; need: number; have: number }[]
  coinsMissing: number
  levelLocked: boolean
  needsBase: boolean
  alreadyOwned: boolean
  canCraft: boolean
}

export default function Forge({ rpg, notify }: AdvProps) {
  const { recipes, inventory, items, tools, stats, myTools } = rpg
  const { busy, run } = useAction(notify)
  const [filter, setFilter] = useState<Filter>('all')
  const [craftingId, setCraftingId] = useState<string | null>(null)

  const ownedTools = new Set(myTools.map((t) => t.tool_id))
  const coins = stats?.coins ?? 0
  const level = stats?.level ?? 1

  const check = (r: Recipe): Check => {
    const missing = Object.entries(r.ingredients)
      .map(([id, need]) => ({ id, need, have: inventory[id] ?? 0 }))
      .filter((i) => i.have < i.need)
    const coinsMissing = Math.max(0, r.coin_cost - coins)
    const levelLocked = level < r.min_level
    const needsBase = r.base_tool !== null && !ownedTools.has(r.base_tool)
    const alreadyOwned = r.kind === 'tool' && ownedTools.has(r.result_id)
    return {
      missing,
      coinsMissing,
      levelLocked,
      needsBase,
      alreadyOwned,
      canCraft: missing.length === 0 && coinsMissing === 0 && !levelLocked && !needsBase && !alreadyOwned,
    }
  }

  const resultInfo = (r: Recipe) => {
    const t = tools[r.result_id]
    const it = items[r.result_id]
    return { emoji: t?.emoji ?? it?.emoji ?? r.emoji, name: t?.name ?? it?.name ?? r.name }
  }

  const craft = (r: Recipe) =>
    run(async () => {
      setCraftingId(r.id)
      try {
        sfx.mine()
        await rpc('craft', { p_recipe: r.id })
        sfx.bigWin()
        notify(`¡Fabricaste ${r.name}!`, 'ok')
        await rpg.reload()
      } finally {
        setCraftingId(null)
      }
    })

  const rows = recipes
    .filter((r) => filter === 'all' || r.kind === filter)
    .map((r) => ({ r, c: check(r) }))
    .sort((a, b) => Number(b.c.canCraft) - Number(a.c.canCraft))

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(
          [
            ['all', 'Todo'],
            ['tool', 'Herramientas'],
            ['item', 'Objetos'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setFilter(id)}
            className={`rounded-full border px-4 py-1.5 text-xs font-black uppercase tracking-widest transition ${
              filter === id
                ? 'border-cyan-400 bg-cyan-500/20 text-cyan-100'
                : 'border-white/10 text-zinc-400 hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {rows.map(({ r, c }) => {
          const res = resultInfo(r)
          const crafting = craftingId === r.id
          return (
            <motion.div
              key={r.id}
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card glow="cyan" className={`space-y-3 ${c.canCraft ? '' : 'opacity-90'}`}>
                <div className="flex items-center gap-3">
                  <span className="text-4xl">{res.emoji}</span>
                  <div className="flex-1">
                    <h3 className="font-black text-white">
                      {r.name} {r.result_qty > 1 && <span className="text-cyan-300">×{r.result_qty}</span>}
                    </h3>
                    <p className="text-[11px] uppercase tracking-widest text-zinc-500">
                      {r.kind === 'tool' ? 'Herramienta' : 'Objeto'} · Nivel {r.min_level}+
                    </p>
                  </div>
                  {c.alreadyOwned && (
                    <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-black uppercase text-emerald-300">
                      La tienes
                    </span>
                  )}
                </div>

                <ul className="space-y-1">
                  {Object.entries(r.ingredients).map(([id, need]) => {
                    const have = inventory[id] ?? 0
                    const ok = have >= need
                    const it = items[id]
                    return (
                      <li
                        key={id}
                        className={`flex items-center justify-between rounded-lg border px-2 py-1 text-sm ${
                          ok ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-red-500/40 bg-red-500/10'
                        }`}
                      >
                        <span className="text-zinc-200">
                          {it?.emoji ?? '📦'} {it?.name ?? id}
                        </span>
                        <span className={`font-black ${ok ? 'text-emerald-300' : 'text-red-300'}`}>
                          {have}/{need}
                          {!ok && <span className="ml-1 text-[11px]">(faltan {need - have})</span>}
                        </span>
                      </li>
                    )
                  })}
                  {r.coin_cost > 0 && (
                    <li
                      className={`flex items-center justify-between rounded-lg border px-2 py-1 text-sm ${
                        c.coinsMissing === 0
                          ? 'border-emerald-500/30 bg-emerald-500/5'
                          : 'border-red-500/40 bg-red-500/10'
                      }`}
                    >
                      <span className="text-zinc-200">🪙 Monedas</span>
                      <span className={`font-black ${c.coinsMissing === 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                        {coins.toLocaleString()}/{r.coin_cost.toLocaleString()}
                        {c.coinsMissing > 0 && (
                          <span className="ml-1 text-[11px]">(faltan {c.coinsMissing.toLocaleString()})</span>
                        )}
                      </span>
                    </li>
                  )}
                  {r.base_tool && (
                    <li
                      className={`flex items-center justify-between rounded-lg border px-2 py-1 text-sm ${
                        c.needsBase ? 'border-red-500/40 bg-red-500/10' : 'border-emerald-500/30 bg-emerald-500/5'
                      }`}
                    >
                      <span className="text-zinc-200">
                        {tools[r.base_tool]?.emoji ?? '🔧'} Requiere {tools[r.base_tool]?.name ?? r.base_tool}
                      </span>
                      <span className={`font-black ${c.needsBase ? 'text-red-300' : 'text-emerald-300'}`}>
                        {c.needsBase ? 'falta' : '✓'}
                      </span>
                    </li>
                  )}
                </ul>

                <NeonButton
                  variant="cyan"
                  onClick={() => craft(r)}
                  disabled={busy || !c.canCraft}
                  className="w-full"
                >
                  {crafting
                    ? 'Fabricando...'
                    : c.alreadyOwned
                      ? 'Ya la tienes'
                      : c.levelLocked
                        ? `🔒 Nivel ${r.min_level}`
                        : c.canCraft
                          ? '⚒️ Fabricar en 1-clic'
                          : 'Faltan materiales'}
                </NeonButton>
              </Card>
            </motion.div>
          )
        })}
      </div>

      {rows.length === 0 && <p className="text-center text-zinc-500">No hay recetas en esta categoría.</p>}
    </div>
  )
}
