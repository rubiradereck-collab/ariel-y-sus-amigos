'use client'
import { useCallback, useEffect, useState } from 'react'
import { rpc, supabase, type Currency } from '@/lib/rpg'
import { sfx } from '@/lib/sfx'
import { BetControls, Card, NeonButton, fmt, useBusy } from '@/components/rpg/ui'
import type { CasinoProps } from './types'

interface Duel { id: string; challenger_id: string; opponent_id: string; amount: number; currency: Currency; status: string; winner_id: string | null; created_at: string }
interface Prof { id: string; username: string; nickname: string | null }

export default function Duels({ stats, notify }: CasinoProps) {
  const [me, setMe] = useState<string | null>(null)
  const [profiles, setProfiles] = useState<Record<string, Prof>>({})
  const [duels, setDuels] = useState<Duel[]>([])
  const [opponent, setOpponent] = useState('')
  const [amount, setAmount] = useState(100)
  const [currency, setCurrency] = useState<Currency>('coins')
  const { busy, run } = useBusy(notify)
  const name = (id: string) => profiles[id]?.nickname || profiles[id]?.username || 'Pana'

  const load = useCallback(async () => {
    const { data } = await supabase().from('duels').select('*').order('created_at', { ascending: false }).limit(12)
    setDuels((data ?? []) as Duel[])
  }, [])

  useEffect(() => {
    const sb = supabase(); let ch: ReturnType<typeof sb.channel> | null = null; let alive = true
    ;(async () => {
      const { data: { user } } = await sb.auth.getUser(); if (!user || !alive) return
      setMe(user.id)
      const { data: ps } = await sb.from('profiles').select('id, username, nickname')
      setProfiles(Object.fromEntries((ps ?? []).map((p: any) => [p.id, p as Prof])))
      await load()
      // RLS filtra: solo recibes eventos de tus propios duelos.
      ch = sb.channel('duels-live').on('postgres_changes', { event: '*', schema: 'public', table: 'duels' }, () => { void load() }).subscribe()
    })()
    return () => { alive = false; if (ch) sb.removeChannel(ch) }
  }, [load])

  const challenge = () => run(async () => {
    if (!opponent) throw new Error('Elige a quién retar')
    await rpc('duel_create', { p_opponent: opponent, p_amount: amount, p_currency: currency })
    notify(`Reto enviado a ${name(opponent)}. Tu apuesta queda en garantía.`, 'ok'); sfx.coin(); await load()
  })
  const accept = (id: string) => run(async () => {
    const r = await rpc<{ winner: string; prize: number }>('duel_accept', { p_duel: id })
    if (r.winner === me) { sfx.bigWin(); notify(`¡GANASTE el duelo! +${fmt(r.prize)}`, 'ok') } else { sfx.lose(); notify('Perdiste el duelo… 💀', 'err') }
    await load()
  })
  const cancel = (id: string) => run(async () => { await rpc('duel_cancel', { p_duel: id }); notify('Duelo cerrado, apuesta devuelta.', 'info'); await load() })

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="space-y-4">
        <h3 className="text-lg font-black text-fuchsia-300">⚔️ Duelo PvP</h3>
        <select value={opponent} onChange={e => setOpponent(e.target.value)} disabled={busy}
          className="w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-white">
          <option value="">¿A quién retas?</option>
          {Object.values(profiles).filter(p => p.id !== me).map(p => <option key={p.id} value={p.id}>{p.nickname || p.username}</option>)}
        </select>
        <BetControls amount={amount} setAmount={setAmount} currency={currency} setCurrency={setCurrency} stats={stats} disabled={busy} />
        <NeonButton onClick={challenge} disabled={busy} variant="red" className="w-full">Lanzar reto</NeonButton>
        <p className="text-[11px] text-zinc-500">Tu apuesta se retiene al retar. Si el rival acepta, una moneda 50/50 decide; el ganador se lleva el pozo menos 5% de comisión. Si rechaza o cancelas, se te devuelve.</p>
      </Card>
      <Card glow="red" className="space-y-2">
        <h3 className="font-black text-red-300">Tus duelos</h3>
        {duels.length === 0 && <p className="text-sm text-zinc-500">Nada por aquí. Reta a alguien.</p>}
        {duels.map(d => {
          const incoming = d.opponent_id === me
          return (
            <div key={d.id} className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/30 p-2 text-sm">
              <div>
                <b>{name(d.challenger_id)}</b> vs <b>{name(d.opponent_id)}</b>
                <div className="text-xs text-zinc-400">{fmt(d.amount)} {d.currency === 'coins' ? '🪙' : '✨'} ·{' '}
                  {d.status === 'pending' ? 'pendiente' : d.status === 'resolved' ? `ganó ${name(d.winner_id ?? '')}` : d.status === 'declined' ? 'rechazado' : 'cancelado'}</div>
              </div>
              {d.status === 'pending' && (
                <div className="flex gap-1">
                  {incoming && <NeonButton onClick={() => accept(d.id)} disabled={busy} variant="green">Aceptar</NeonButton>}
                  <NeonButton onClick={() => cancel(d.id)} disabled={busy} variant="ghost">{incoming ? 'Rechazar' : 'Cancelar'}</NeonButton>
                </div>
              )}
            </div>
          )
        })}
      </Card>
    </div>
  )
}
