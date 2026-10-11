'use client'
import type { ReactNode } from 'react'
import { RARITY, type RpgData } from '@/lib/rpg'
import { fmt } from '@/components/rpg/ui'

export interface AdvProps { rpg: RpgData; notify: (m: string, t?: 'ok' | 'err' | 'info') => void }

export function ItemChip({ id, qty, rpg, extra }: { id: string; qty?: number; rpg: RpgData; extra?: ReactNode }) {
  const it = rpg.items[id]
  if (!it) return null
  return (
    <span className={`inline-flex items-center gap-1 rounded-lg border bg-black/40 px-2 py-1 text-sm shadow ${RARITY[it.rarity].cls}`}>
      {it.emoji} {it.name}{qty !== undefined && <b className="text-cyan-300">×{fmt(qty)}</b>}{extra}
    </span>
  )
}

export function CooldownBar({ readyAt, total, now }: { readyAt: string | undefined; total: number; now: number }) {
  const left = Math.max(0, (readyAt ? new Date(readyAt).getTime() : 0) - now)
  const pct = total > 0 ? Math.min(100, (left / (total * 1000)) * 100) : 0
  return (
    <div className="space-y-1">
      <div className="h-3 overflow-hidden rounded-full bg-white/10">
        <div className="h-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-[width] duration-200" style={{ width: `${100 - pct}%` }} />
      </div>
      <p className="text-right text-xs text-zinc-400">{left > 0 ? `Listo en ${(left / 1000).toFixed(1)}s` : '¡Listo!'}</p>
    </div>
  )
}
