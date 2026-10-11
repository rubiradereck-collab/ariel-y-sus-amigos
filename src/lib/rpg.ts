'use client'
import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client' // ← ajusta si tu helper se llama distinto

export type Currency = 'coins' | 'xp'
export type Rarity = 'comun' | 'raro' | 'epico' | 'legendario' | 'mitico'

export interface Item { id: string; name: string; emoji: string; category: 'mineral' | 'pez' | 'material' | 'consumible'; rarity: Rarity; sell_price: number; buy_price: number | null; description: string | null }
export interface Tool { id: string; kind: 'pickaxe' | 'rod'; tier: number; name: string; emoji: string; cooldown_s: number; luck: number }
export interface Zone { id: string; kind: 'mine' | 'water'; name: string; emoji: string; min_level: number; min_tier: number; description: string; loot: { i: string; w: number; min: number; max: number }[] }
export interface Recipe { id: string; name: string; emoji: string; kind: 'tool' | 'item'; result_id: string; result_qty: number; ingredients: Record<string, number>; base_tool: string | null; coin_cost: number; min_level: number }
export interface Stats {
  user_id: string; coins: number; xp: number; lifetime_xp: number; level: number; backpack_level: number
  golem_level: number; golem_claimed_at: string; mine_ready_at: string; fish_ready_at: string
  luck_until: string | null; bait_charges: number; stones_mined: number; fish_caught: number
  items_crafted: number; treasures_found: number; titles: string[]; active_title: string | null
}
export interface Quest { id: string; requirements: Record<string, number>; reward_coins: number; reward_xp: number; reward_title: string | null; claimed: boolean }

let _sb: ReturnType<typeof createClient> | null = null
export const supabase = () => (_sb ??= createClient())

export async function rpc<T = any>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase().rpc(fn, args)
  if (error) throw new Error(error.message)
  return data as T
}

export const bagCap = (backpackLevel: number) => 30 + 20 * backpackLevel
export function levelProgress(lifetimeXp: number) {
  const lvl = Math.floor(Math.sqrt(lifetimeXp / 25)) + 1
  const base = 25 * (lvl - 1) ** 2, next = 25 * lvl ** 2
  return { lvl, pct: Math.min(100, ((lifetimeXp - base) / (next - base)) * 100), next }
}

export const RARITY: Record<Rarity, { label: string; cls: string }> = {
  comun: { label: 'Común', cls: 'border-zinc-500/60 shadow-zinc-500/20' },
  raro: { label: 'Raro', cls: 'border-sky-400/80 shadow-sky-400/30' },
  epico: { label: 'Épico', cls: 'border-fuchsia-500/80 shadow-fuchsia-500/40' },
  legendario: { label: 'Legendario', cls: 'border-amber-400 shadow-amber-400/50' },
  mitico: { label: 'Mítico', cls: 'border-red-500 shadow-red-500/60 animate-pulse' },
}

/** Reloj que "late" cada `ms` para cuentas regresivas. */
export function useNow(ms = 250) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t) }, [ms])
  return now
}

/** Estado completo del RPG: catálogos (1 vez), stats en vivo (Realtime), inventario y herramientas. */
export function useRpg() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [items, setItems] = useState<Record<string, Item>>({})
  const [tools, setTools] = useState<Record<string, Tool>>({})
  const [zones, setZones] = useState<Zone[]>([])
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [inventory, setInventory] = useState<Record<string, number>>({})
  const [myTools, setMyTools] = useState<{ tool_id: string; equipped: boolean }[]>([])
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    const sb = supabase()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return
    const [st, inv, ut] = await Promise.all([
      sb.from('user_stats').select('*').eq('user_id', user.id).single(),
      sb.from('inventory').select('item_id, qty'),
      sb.from('user_tools').select('tool_id, equipped'),
    ])
    if (st.data) setStats(st.data as Stats)
    if (inv.data) setInventory(Object.fromEntries(inv.data.map(r => [r.item_id, r.qty])))
    if (ut.data) setMyTools(ut.data)
  }, [])

  useEffect(() => {
    let channel: ReturnType<ReturnType<typeof supabase>['channel']> | null = null
    let alive = true
    ;(async () => {
      try {
        const sb = supabase()
        const { data: { user } } = await sb.auth.getUser()
        if (!user) return
        await rpc('ensure_stats')
        const [it, tl, zn, rc] = await Promise.all([
          sb.from('items').select('*'), sb.from('tools').select('*'),
          sb.from('zones').select('*').order('min_level'), sb.from('recipes').select('*').order('min_level'),
        ])
        if (!alive) return
        setItems(Object.fromEntries((it.data ?? []).map(i => [i.id, i as Item])))
        setTools(Object.fromEntries((tl.data ?? []).map(t => [t.id, t as Tool])))
        setZones((zn.data ?? []) as Zone[]); setRecipes((rc.data ?? []) as Recipe[])
        await reload()
        // Saldo en vivo (entre pestañas y duelos). Cleanup abajo: sin fugas.
        channel = sb.channel(`stats:${user.id}`)
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'user_stats', filter: `user_id=eq.${user.id}` },
            p => setStats(p.new as Stats))
          .subscribe()
      } catch (e) { setError((e as Error).message) }
    })()
    return () => { alive = false; if (channel) supabase().removeChannel(channel) }
  }, [reload])

  return { stats, items, tools, zones, recipes, inventory, myTools, reload, error }
}

export type RpgData = ReturnType<typeof useRpg>
