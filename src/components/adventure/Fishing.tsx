'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { rpc, useNow } from '@/lib/rpg'
import { sfx } from '@/lib/sfx'
import { Card, NeonButton } from '@/components/rpg/ui'
import { CooldownBar, ItemChip, type AdvProps } from './shared'
import { useAction } from './utils'

type Phase = 'idle' | 'waiting' | 'bite' | 'fight'
type Bait = 'lombriz' | 'carnada_brillante' | 'carnada_legendaria'

interface CastRes {
  bite_in_ms: number
  window_ms: number
  fight_ms: number
  difficulty: number
  bait: Bait
}
interface HookRes {
  ok: boolean
  reason?: 'early' | 'late'
  fight_ms?: number
}
interface ReelRes {
  ok: boolean
  reason?: 'escaped'
  item?: string
  qty?: number
  xp?: number
  perfect?: boolean
  rarity?: string
}

const BAITS: { id: Bait; emoji: string; name: string; desc: string }[] = [
  { id: 'lombriz', emoji: '🪱', name: 'Lombriz', desc: 'Gratis. Probabilidades normales.' },
  { id: 'carnada_brillante', emoji: '✨', name: 'Brillante', desc: 'x2 de probabilidad de peces raros o mejores.' },
  { id: 'carnada_legendaria', emoji: '🌟', name: 'Legendaria', desc: 'x5 de probabilidad de peces épicos o mejores.' },
]

// Zona verde de la barra de tensión (0 a 1)
const ZONE_LO = 0.35
const ZONE_HI = 0.65

const DIFF_COLOR = ['', '#a1a1aa', '#38bdf8', '#d946ef', '#fbbf24', '#ef4444']
const DIFF_LABEL = ['', 'Sombra pequeña', 'Sombra mediana', 'Sombra grande', 'Sombra enorme', '¡Sombra colosal!']

export default function Fishing({ rpg, notify }: AdvProps) {
  const { stats, zones, myTools, tools, inventory, items } = rpg
  const now = useNow()
  const { busy, run } = useAction(notify)

  const [zone, setZone] = useState<string>('fish_1')
  const [bait, setBait] = useState<Bait>('lombriz')
  const [phase, setPhase] = useState<Phase>('idle')
  const [cast, setCast] = useState<CastRes | null>(null)
  const [blip, setBlip] = useState<{ a: number; d: number }>({ a: 0, d: 0.5 })
  const [tension, setTension] = useState<number>(0.5)
  const [last, setLast] = useState<ReelRes | null>(null)

  const phaseRef = useRef<Phase>('idle')
  const timers = useRef<number[]>([])
  const rafRef = useRef<number | null>(null)
  const holdRef = useRef<boolean>(false)
  const posRef = useRef<number>(0.5)
  const inZoneRef = useRef<number>(0)

  const go = (p: Phase) => {
    phaseRef.current = p
    setPhase(p)
  }
  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t))
    timers.current = []
  }

  useEffect(() => {
    return () => {
      timers.current.forEach((t) => window.clearTimeout(t))
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  // Barra espaciadora = mantener tensión
  useEffect(() => {
    if (phase !== 'fight') return
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault()
        holdRef.current = true
      }
    }
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') holdRef.current = false
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [phase])

  const equipped = myTools.find((t) => t.equipped && tools[t.tool_id]?.kind === 'rod')
  const rod = equipped ? tools[equipped.tool_id] : undefined
  const waters = zones.filter((z) => z.kind === 'water')
  const ready = !!stats && new Date(stats.fish_ready_at).getTime() <= now
  const baitQty = (id: Bait) => (id === 'lombriz' ? Infinity : inventory[id] ?? 0)

  /* ----------------------------- acciones -------------------------- */

  const finish = (score: number) =>
    run(async () => {
      go('idle')
      const r = await rpc<ReelRes>('adv_fish_reel', { p_score: Math.round(score * 1000) / 1000 })
      setLast(r)
      if (!r.ok) {
        sfx.lose()
        notify('El pez se escapó… la línea no estuvo en la zona verde el tiempo suficiente 🐟💨', 'err')
      } else if (r.perfect) {
        sfx.bigWin()
        notify('¡CAPTURA PERFECTA! +1 pez extra y XP x1.5 🌟', 'ok')
      } else {
        sfx.win()
        notify('¡Pescaste algo!', 'ok')
      }
      await rpg.reload()
    })

  const startFight = (fightMs: number, difficulty: number) => {
    go('fight')
    posRef.current = 0.5
    inZoneRef.current = 0
    holdRef.current = false
    setTension(0.5)
    const seed = Math.random() * 10
    const begin = performance.now()
    let lastTs = begin

    const tick = (ts: number) => {
      const dt = Math.min(0.05, (ts - lastTs) / 1000)
      lastTs = ts
      const t = (ts - begin) / 1000
      // El pez tira con una fuerza oscilante; cuanto más raro, más fuerte
      const pull = Math.sin(t * 2.1 + seed) * 0.5 + Math.sin(t * 5.3 + seed * 2) * 0.35
      const v = (holdRef.current ? 0.5 : -0.5) + pull * (0.2 + difficulty * 0.1)
      posRef.current = Math.min(1, Math.max(0, posRef.current + v * dt))
      if (posRef.current >= ZONE_LO && posRef.current <= ZONE_HI) inZoneRef.current += dt * 1000
      setTension(posRef.current)

      if (ts - begin >= fightMs) {
        rafRef.current = null
        void finish(Math.min(1, inZoneRef.current / fightMs))
        return
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }

  const doCast = () =>
    run(async () => {
      setLast(null)
      const r = await rpc<CastRes>('adv_fish_cast', { p_zone: zone, p_bait: bait })
      setCast(r)
      setBlip({ a: Math.random() * Math.PI * 2, d: 0.25 + Math.random() * 0.55 })
      sfx.whoosh()
      go('waiting')
      clearTimers()
      timers.current.push(
        window.setTimeout(() => {
          go('bite')
          sfx.bite()
        }, r.bite_in_ms)
      )
      timers.current.push(
        window.setTimeout(() => {
          if (phaseRef.current === 'bite') {
            go('idle')
            sfx.lose()
            notify('Se escapó… muy lento 🐟💨', 'err')
            void rpg.reload()
          }
        }, r.bite_in_ms + r.window_ms + 600)
      )
      await rpg.reload()
    })

  const doHook = () =>
    run(async () => {
      clearTimers()
      const r = await rpc<HookRes>('adv_fish_hook')
      if (!r.ok) {
        go('idle')
        sfx.lose()
        notify(r.reason === 'early' ? 'Tiraste demasiado pronto 🙈' : 'Se escapó… muy lento 🐟💨', 'err')
        await rpg.reload()
        return
      }
      sfx.win()
      startFight(r.fight_ms ?? 3000, cast?.difficulty ?? 1)
    })

  const buy = (item: string) =>
    run(async () => {
      await rpc('buy_item', { p_item: item, p_qty: 1 })
      sfx.coin()
      notify(`Comprado: ${items[item]?.name ?? item}`, 'ok')
      await rpg.reload()
    })

  /* ----------------------------- render ---------------------------- */

  const color = DIFF_COLOR[cast?.difficulty ?? 1]
  const showBlip = phase === 'bite' || phase === 'fight'

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_360px]">
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          {waters.map((z) => {
            const locked = !stats || stats.level < z.min_level
            return (
              <button
                key={z.id}
                onClick={() => setZone(z.id)}
                disabled={locked || phase !== 'idle'}
                className={`rounded-2xl border p-3 text-left transition ${
                  zone === z.id ? 'border-cyan-400 bg-cyan-500/10' : 'border-white/10 bg-zinc-950/60'
                } ${locked ? 'opacity-40' : ''}`}
              >
                <div className="text-2xl">
                  {z.emoji} <span className="text-base font-black">{z.name}</span>
                </div>
                <p className="text-xs text-zinc-400">{z.description}</p>
                {locked && <p className="mt-1 text-[11px] text-amber-300">🔒 Nivel {z.min_level}</p>}
              </button>
            )
          })}
        </div>

        <div>
          <h3 className="mb-2 text-xs font-black uppercase tracking-widest text-zinc-400">Carnada</h3>
          <div className="grid gap-2 sm:grid-cols-3">
            {BAITS.map((b) => {
              const qty = baitQty(b.id)
              const empty = qty <= 0
              const price = items[b.id]?.buy_price ?? null
              return (
                <div
                  key={b.id}
                  className={`rounded-xl border p-2 ${
                    bait === b.id ? 'border-cyan-400 bg-cyan-500/10' : 'border-white/10 bg-black/30'
                  }`}
                >
                  <button
                    onClick={() => setBait(b.id)}
                    disabled={phase !== 'idle' || empty}
                    className="w-full text-left disabled:opacity-40"
                  >
                    <p className="text-sm font-black text-white">
                      {b.emoji} {b.name} <span className="text-cyan-300">{qty === Infinity ? '∞' : `×${qty}`}</span>
                    </p>
                    <p className="text-[11px] leading-tight text-zinc-400">{b.desc}</p>
                  </button>
                  {b.id !== 'lombriz' && price !== null && (
                    <button
                      onClick={() => buy(b.id)}
                      disabled={busy || phase !== 'idle'}
                      className="mt-2 w-full rounded-lg border border-amber-400/40 bg-amber-500/10 py-1 text-xs font-black text-amber-200 hover:bg-amber-500/20 disabled:opacity-40"
                    >
                      Comprar 🪙 {price}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <Card glow="cyan" className="space-y-3">
        <h3 className="font-black text-cyan-300">Radar de pesca</h3>
        <p className="text-xs text-zinc-400">
          Caña: <b>{rod ? `${rod.emoji} ${rod.name}` : 'Ninguna (equípala en la Mochila o la Herrería)'}</b>
        </p>

        {/* Radar */}
        <div className="relative mx-auto h-56 w-56 overflow-hidden rounded-full border border-emerald-400/40 bg-emerald-950/40">
          {[25, 50, 75].map((p) => (
            <div
              key={p}
              className="absolute rounded-full border border-emerald-400/20"
              style={{ inset: `${(100 - p) / 2}%` }}
            />
          ))}
          <div className="absolute left-1/2 top-0 h-full w-px bg-emerald-400/20" />
          <div className="absolute left-0 top-1/2 h-px w-full bg-emerald-400/20" />

          {(phase === 'waiting' || phase === 'bite') && (
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{ background: 'conic-gradient(from 0deg, rgba(16,185,129,0.55), transparent 35%)' }}
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 2.4, ease: 'linear' }}
            />
          )}

          {showBlip && (
            <motion.span
              className="absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{
                left: `${50 + Math.cos(blip.a) * blip.d * 50}%`,
                top: `${50 + Math.sin(blip.a) * blip.d * 50}%`,
                background: color,
                boxShadow: `0 0 16px ${color}`,
              }}
              animate={{ scale: [1, 1.5, 1], opacity: [1, 0.6, 1] }}
              transition={{ repeat: Infinity, duration: 0.8 }}
            />
          )}

          {phase === 'idle' && (
            <div className="absolute inset-0 flex items-center justify-center text-5xl opacity-60">🎣</div>
          )}
        </div>

        <p className="text-center text-xs font-bold" style={{ color: showBlip ? color : '#a1a1aa' }}>
          {phase === 'idle' && 'Lanza la caña para escanear'}
          {phase === 'waiting' && 'Escaneando el agua…'}
          {(phase === 'bite' || phase === 'fight') && DIFF_LABEL[cast?.difficulty ?? 1]}
        </p>

        <CooldownBar readyAt={stats?.fish_ready_at} total={rod?.cooldown_s ?? 25} now={now} />

        {phase === 'idle' && (
          <NeonButton variant="cyan" onClick={doCast} disabled={busy || !ready || !rod} className="w-full">
            🎣 Lanzar caña
          </NeonButton>
        )}
        {phase === 'waiting' && (
          <p className="animate-pulse text-center text-sm text-yellow-300">Esperando que pique…</p>
        )}
        {phase === 'bite' && (
          <NeonButton variant="amber" onClick={doHook} disabled={busy} className="w-full animate-bounce text-base">
            ⚡ ¡TIRA AHORA! 🐟
          </NeonButton>
        )}

        {phase === 'fight' && (
          <div className="space-y-2">
            <div className="relative h-10 overflow-hidden rounded-full border border-white/20 bg-zinc-900">
              <div
                className="absolute inset-y-0 bg-emerald-500/40"
                style={{ left: `${ZONE_LO * 100}%`, width: `${(ZONE_HI - ZONE_LO) * 100}%` }}
              />
              <div
                className="absolute inset-y-0 w-2 rounded bg-white shadow-[0_0_10px_#fff]"
                style={{ left: `calc(${tension * 100}% - 4px)` }}
              />
            </div>
            <p className="text-center text-[11px] text-zinc-400">
              Mantén pulsado para tensar la línea y suelta para aflojar. ¡Mantén la aguja en la zona verde!
            </p>
            <button
              onPointerDown={() => {
                holdRef.current = true
              }}
              onPointerUp={() => {
                holdRef.current = false
              }}
              onPointerLeave={() => {
                holdRef.current = false
              }}
              onPointerCancel={() => {
                holdRef.current = false
              }}
              className="w-full touch-none select-none rounded-xl border border-cyan-400/60 bg-cyan-500/20 py-4 text-sm font-black text-cyan-100 active:bg-cyan-500/40"
            >
              🎣 MANTENER (o barra espaciadora)
            </button>
          </div>
        )}

        {last && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-1 rounded-xl border border-white/10 bg-black/40 p-2 text-xs"
          >
            {last.ok ? (
              <>
                <p className="font-bold text-emerald-300">
                  ¡Pescaste (+{last.xp} XP){last.perfect ? ' · PERFECTA 🌟' : ''}!
                </p>
                {last.item && <ItemChip id={last.item} qty={last.qty} rpg={rpg} />}
              </>
            ) : (
              <p className="font-bold text-red-300">Se te escapó. ¡Inténtalo otra vez!</p>
            )}
          </motion.div>
        )}
      </Card>
    </div>
  )
}
