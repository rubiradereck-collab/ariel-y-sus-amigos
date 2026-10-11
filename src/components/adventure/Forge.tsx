'use client'
import { rpc } from '@/lib/rpg'
import { sfx } from '@/lib/sfx'
import { Card, NeonButton, fmt, useBusy } from '@/components/rpg/ui'
import { ItemChip, type AdvProps } from './shared'

export default function Forge({ rpg, notify }: AdvProps) {
  const { stats, recipes, inventory, myTools, tools } = rpg
  const { busy, run } = useBusy(notify)
  const owned = new Set(myTools.map((t: any) => t.tool_id))
  const bpCost = 150 * ((stats?.backpack_level ?? 0) + 1) ** 2

  const craft = (id: string, name: string) => run(async () => {
    await rpc('craft', { p_recipe: id }); sfx.craft(); notify(`¡Fabricaste ${name}!`, 'ok'); await rpg.reload()
  })
  const upBag = () => run(async () => {
    await rpc('upgrade_backpack'); sfx.win(); notify('¡Mochila ampliada! +20 espacios', 'ok'); await rpg.reload()
  })

  return (
    <div className="space-y-3">
      <Card glow="amber" className="flex items-center justify-between gap-3">
        <div><div className="font-black">🎒 Ampliar mochila (nivel {stats?.backpack_level ?? 0}/8)</div><div className="text-xs text-zinc-400">+20 espacios por mejora</div></div>
        <NeonButton variant="amber" disabled={busy || (stats?.backpack_level ?? 0) >= 8} onClick={upBag}>{fmt(bpCost)} 🪙</NeonButton>
      </Card>
      <div className="grid gap-3 md:grid-cols-2">
        {recipes.map((r: any) => {
          const done = r.kind === 'tool' && owned.has(r.result_id)
          const hasBase = !r.base_tool || owned.has(r.base_tool)
          const enough = Object.entries(r.ingredients as Record<string, number>).every(([id, q]) => (inventory[id] ?? 0) >= Number(q))
          const can = !done && hasBase && enough && (stats?.level ?? 0) >= r.min_level && (stats?.coins ?? 0) >= r.coin_cost
          return (
            <Card key={r.id} className={done ? 'opacity-50' : ''}>
              <div className="flex items-center justify-between">
                <div className="font-black">{r.emoji} {r.name}{r.result_qty > 1 && ` ×${r.result_qty}`}</div>
                <span className="text-xs text-zinc-400">Nv {r.min_level}</span>
              </div>
              <div className="my-2 flex flex-wrap gap-1">
                {Object.entries(r.ingredients as Record<string, number>).map(([id, q]) => (
                  <ItemChip key={id} id={id} rpg={rpg} qty={Number(q)}
                    extra={<span className={(inventory[id] ?? 0) >= Number(q) ? 'text-emerald-400' : 'text-red-400'}>({inventory[id] ?? 0})</span>} />
                ))}
                {r.base_tool && <span className={`rounded-lg border px-2 py-1 text-sm ${hasBase ? 'border-emerald-500/50' : 'border-red-500/50'}`}>{tools[r.base_tool]?.emoji} {tools[r.base_tool]?.name} (se consume)</span>}
                {r.coin_cost > 0 && <span className="rounded-lg border border-amber-400/40 px-2 py-1 text-sm">{r.coin_cost} 🪙</span>}
              </div>
              <NeonButton variant="fuchsia" disabled={busy || !can} onClick={() => craft(r.id, r.name)}>{done ? 'Ya la tienes' : 'Fabricar'}</NeonButton>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
