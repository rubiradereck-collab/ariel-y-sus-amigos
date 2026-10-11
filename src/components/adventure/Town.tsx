'use client'
import { useCallback, useEffect, useState } from 'react'
import { rpc, useNow } from '@/lib/rpg'
import { sfx } from '@/lib/sfx'
import { Card, NeonButton, fmt, useBusy } from '@/components/rpg/ui'
import { ItemChip, type AdvProps } from './shared'

interface Q { id: string; requirements: Record<string, number>; reward_coins: number; reward_xp: number; reward_title: string | null; claimed: boolean }
const GOLEM_COSTS = [500, 1500, 4000, 10000, 25000]
const GOLEM_LVLS = [3, 5, 8, 11, 14]

export default function Town({ rpg, notify }: AdvProps) {
  const { stats, inventory } = rpg
  const now = useNow(1000)
  const [quests, setQuests] = useState<Q[]>([])
  const { busy, run } = useBusy(notify)

  const loadQuests = useCallback(async () => { setQuests(await rpc<Q[]>('get_quests')) }, [])
  useEffect(() => { loadQuests().catch(e => notify((e as Error).message, 'err')) }, [loadQuests, notify])

  const claim = (q: Q) => run(async () => {
    const r = await rpc<{ coins: number; xp: number; title: string | null }>('claim_quest', { p_id: q.id })
    sfx.bigWin(); notify(`Contrato cumplido: +${fmt(r.coins)}🪙 +${r.xp} XP${r.title ? ` · Título «${r.title}»` : ''}`, 'ok')
    await Promise.all([loadQuests(), rpg.reload()])
  })

  const lvl = stats?.golem_level ?? 0
  const capH = 8 + 4 * lvl
  const hrs = stats ? Math.min((now - new Date(stats.golem_claimed_at).getTime()) / 3_600_000, capH) : 0
  const pending = lvl > 0 ? Math.floor(hrs * 15 * lvl) : 0

  const golem = (fn: 'buy_golem' | 'claim_golem') => run(async () => {
    const r = await rpc<any>(fn); sfx.coin()
    notify(fn === 'claim_golem' ? `Tu golem trajo ${fmt(r.gain)} 🪙` : `Golem nivel ${r.golem_level}!`, 'ok'); await rpg.reload()
  })

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-3">
        <h3 className="font-black text-amber-300">📜 Tablón de Contratos (se renueva a medianoche, hora Ecuador)</h3>
        {quests.map(q => {
          const ok = Object.entries(q.requirements).every(([id, n]) => (inventory[id] ?? 0) >= n)
          return (
            <Card key={q.id} glow="amber" className={q.claimed ? 'opacity-40' : ''}>
              <div className="mb-2 flex flex-wrap gap-1">
                {Object.entries(q.requirements).map(([id, n]) => (
                  <ItemChip key={id} id={id} qty={n} rpg={rpg} extra={<span className={(inventory[id] ?? 0) >= n ? 'text-emerald-400' : 'text-red-400'}>({inventory[id] ?? 0})</span>} />
                ))}
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-300">+{fmt(q.reward_coins)}🪙 · +{q.reward_xp} XP{q.reward_title && <b className="text-fuchsia-300"> · Título «{q.reward_title}»</b>}</span>
                <NeonButton variant="green" disabled={busy || q.claimed || !ok} onClick={() => claim(q)}>{q.claimed ? 'Cobrado' : 'Entregar'}</NeonButton>
              </div>
            </Card>
          )
        })}
      </div>

      <div className="space-y-3">
        <Card glow="cyan" className="space-y-3">
          <h3 className="font-black text-cyan-300">🗿 Golem Recolector {lvl > 0 && `· Nv ${lvl}`}</h3>
          {lvl === 0 ? <p className="text-sm text-zinc-400">Mina monedas por ti incluso con la web cerrada.</p> : (
            <>
              <p className="text-sm text-zinc-300">Produce {15 * lvl} 🪙/hora · acumula hasta {capH}h.</p>
              <div className="h-3 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-emerald-400" style={{ width: `${(hrs / capH) * 100}%` }} /></div>
              <NeonButton variant="green" disabled={busy || pending < 1} onClick={() => golem('claim_golem')} className="w-full">Reclamar {fmt(pending)} 🪙</NeonButton>
            </>
          )}
          {lvl < 5 && (
            <NeonButton variant="cyan" disabled={busy || (stats?.level ?? 0) < GOLEM_LVLS[lvl]} onClick={() => golem('buy_golem')} className="w-full">
              {lvl === 0 ? 'Despertar golem' : 'Mejorar golem'} — {fmt(GOLEM_COSTS[lvl])}🪙 (Nv {GOLEM_LVLS[lvl]})
            </NeonButton>
          )}
        </Card>
        <Card className="space-y-1 text-sm">
          <h3 className="font-black text-fuchsia-300">📊 Tus estadísticas</h3>
          <p>⛏️ Minerales extraídos: <b>{fmt(stats?.stones_mined ?? 0)}</b></p>
          <p>🐟 Peces capturados: <b>{fmt(stats?.fish_caught ?? 0)}</b></p>
          <p>🔨 Objetos crafteados: <b>{fmt(stats?.items_crafted ?? 0)}</b></p>
          <p>💎 Tesoros raros: <b>{fmt(stats?.treasures_found ?? 0)}</b></p>
          {(stats?.titles.length ?? 0) > 0 && <p>🏷️ Títulos: {stats?.titles.join(', ')}</p>}
        </Card>
      </div>
    </div>
  )
}
