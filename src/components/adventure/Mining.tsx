'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { rpc, useNow, RARITY } from '@/lib/rpg'
import { sfx } from '@/lib/sfx'
import { Card, NeonButton } from '@/components/rpg/ui'
import { CooldownBar, ItemChip, type AdvProps } from './shared'
import { useAction } from './utils'

interface MineRes {
  loot: { item: string; qty: number }[]
  event: 'cofre' | 'derrumbe' | null
  bonus: number
  xp: number
  cooldown: number
  geode: boolean
  doubled: boolean
}

interface ConsumableProps {
  emoji: string
  name: string
  desc: string
  qty: number
  price: number | null
  active?: boolean
  activeLabel?: string
  disabled: boolean
  actionLabel: string
  onUse: () => void
  onBuy: () => void
}

function ConsumableButton({
  emoji,
  name,
  desc,
  qty,
  price,
  active,
  activeLabel,
  disabled,
  actionLabel,
  onUse,
  onBuy,
}: ConsumableProps) {
  return (
    <div
      className={`rounded-xl border p-2 transition ${
        active ? 'border-amber-400 bg-amber-500/10 shadow-[0_0_14px_#f59e0b55]' : 'border-white/10 bg-black/30'
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="text-2xl">{emoji}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-white">
            {name} <span className="text-cyan-300">×{qty}</span>
          </p>
          <p className="text-[11px] leading-tight text-zinc-400">{desc}</p>
        </div>
      </div>
      <div className="mt-2 flex gap-2">
        <button
          onClick={onUse}
          disabled={disabled || qty <= 0}
          className="flex-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs font-black text-white transition hover:bg-white/10 disabled:opacity-40"
        >
          {active && activeLabel ? activeLabel : actionLabel}
        </button>
        {price !== null && (
          <button
            onClick={onBuy}
            disabled={disabled}
            className="rounded-lg border border-amber-400/40 bg-amber-500/10 px-2 py-1.5 text-xs font-black text-amber-200 transition hover:bg-amber-500/20 disabled:opacity-40"
          >
            🪙 {price}
          </button>
        )}
      </div>
    </div>
  )
}

export default function Mining({ rpg, notify }: AdvProps) {
  const { stats, zones, myTools, tools, inventory, items } = rpg
  const now = useNow()
  const [zone, setZone] = useState<string>('mine_1')
  const [torch, setTorch] = useState<boolean>(false)
  const [last, setLast] = useState<MineRes | null>(null)
  const [hit, setHit] = useState<number>(0)
  const [boom, setBoom] = useState<boolean>(false)
  const { busy, run } = useAction(notify)

  const equipped = myTools.find((t) => t.equipped && tools[t.tool_id]?.kind === 'pickaxe')
  const pick = equipped ? tools[equipped.tool_id] : undefined
  const mines = zones.filter((z) => z.kind === 'mine')
  const cur = mines.find((z) => z.id === zone)
  const ready = !!stats && new Date(stats.mine_ready_at).getTime() <= now

  const dynQty = inventory['dinamita'] ?? 0
  const torchQty = inventory['antorcha'] ?? 0
  const potionQty = inventory['pocion_suerte'] ?? 0
  const luckLeft = stats?.luck_until ? Math.max(0, new Date(stats.luck_until).getTime() - now) : 0
  const luckActive = luckLeft > 0

  const doMine = (withDynamite: boolean) =>
    run(async () => {
      sfx.mine()
      setHit((h) => h + 1)
      if (withDynamite) {
        setBoom(true)
        sfx.boom()
        window.setTimeout(() => setBoom(false), 650)
      }
      const r = await rpc<MineRes>('adv_mine', { p_zone: zone, p_dynamite: withDynamite, p_torch: torch })
      setLast(r)
      setTorch(false)

      if (r.event === 'cofre') {
        sfx.bigWin()
        notify(`¡Cofre misterioso! +${r.bonus} monedas`, 'ok')
      } else if (r.event === 'derrumbe') {
        sfx.boom()
        notify('¡Derrumbe! Tu pico tarda 20s más en enfriarse', 'err')
      } else if (r.geode) {
        sfx.bigWin()
        notify('¡Encontraste una GEODA! 🔮', 'ok')
      } else if (r.loot.some((l) => ['epico', 'legendario', 'mitico'].includes(items[l.item]?.rarity ?? ''))) {
        sfx.win()
      } else {
        sfx.coin()
      }
      await rpg.reload()
    })

  const usePotion = () =>
    run(async () => {
      await rpc('adv_use_potion')
      sfx.win()
      notify('🧪 ¡Suerte! Minerales x2 durante 30 segundos', 'ok')
      await rpg.reload()
    })

  const buy = (item: string) =>
    run(async () => {
      await rpc('buy_item', { p_item: item, p_qty: 1 })
      sfx.coin()
      notify(`Comprado: ${items[item]?.name ?? item}`, 'ok')
      await rpg.reload()
    })

  const needTool = !pick
  const mineDisabled = busy || !ready || !cur || needTool

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_340px]">
      <div className="grid gap-3 sm:grid-cols-2">
        {mines.map((z) => {
          const locked = !stats || stats.level < z.min_level
          const weak = !pick || pick.tier < z.min_tier
          return (
            <button
              key={z.id}
              onClick={() => setZone(z.id)}
              disabled={locked}
              className={`rounded-2xl border p-3 text-left transition ${
                zone === z.id
                  ? 'border-fuchsia-400 bg-fuchsia-500/10 shadow-[0_0_18px_#d946ef50]'
                  : 'border-white/10 bg-zinc-950/60'
              } ${locked ? 'opacity-40' : 'hover:border-fuchsia-400/60'}`}
            >
              <div className="text-2xl">
                {z.emoji} <span className="text-base font-black">{z.name}</span>
              </div>
              <p className="text-xs text-zinc-400">{z.description}</p>
              <p className="mt-1 text-[11px] text-amber-300">
                {locked
                  ? `🔒 Nivel ${z.min_level}`
                  : weak
                    ? `⚠️ Pico tier ${z.min_tier}+ requerido`
                    : `Nivel ${z.min_level}+`}
              </p>
              <div className="mt-2 flex flex-wrap gap-1">
                {z.loot.map(
                  (l) =>
                    items[l.i] && (
                      <span
                        key={l.i}
                        title={`${items[l.i].name} · peso ${l.w}`}
                        className={`rounded border px-1 text-sm ${RARITY[items[l.i].rarity].cls}`}
                      >
                        {items[l.i].emoji}
                      </span>
                    )
                )}
              </div>
            </button>
          )
        })}
      </div>

      <Card glow="cyan" className="relative space-y-3 overflow-hidden">
        <AnimatePresence>
          {boom && (
            <motion.div
              initial={{ opacity: 0.9, scale: 0.4 }}
              animate={{ opacity: 0, scale: 2.4 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6 }}
              className="pointer-events-none absolute inset-0 z-10 m-auto h-40 w-40 rounded-full bg-gradient-to-r from-orange-500 to-yellow-300 blur-xl"
            />
          )}
        </AnimatePresence>

        <h3 className="font-black text-cyan-300">
          {cur?.emoji} {cur?.name}
        </h3>

        <div className="flex justify-center">
          <motion.div
            key={hit}
            animate={hit ? { x: [0, -8, 8, -5, 5, 0], rotate: [0, -4, 4, -2, 2, 0] } : undefined}
            transition={{ duration: 0.35 }}
            className={`text-7xl ${torch ? 'drop-shadow-[0_0_18px_#fbbf24]' : ''}`}
          >
            {torch ? '🔦' : '🪨'}
          </motion.div>
        </div>

        <div className="text-xs text-zinc-300">
          Pico equipado: <b>{pick ? `${pick.emoji} ${pick.name}` : 'Ninguno (equípalo en la Mochila o la Herrería)'}</b>
        </div>
        <CooldownBar readyAt={stats?.mine_ready_at} total={pick?.cooldown_s ?? 30} now={now} />

        {luckActive && (
          <div className="rounded-lg border border-amber-400/50 bg-amber-500/10 px-2 py-1 text-center text-xs font-black text-amber-200">
            🧪 Suerte activa: minerales x2 · {(luckLeft / 1000).toFixed(0)}s
          </div>
        )}
        {torch && (
          <div className="rounded-lg border border-yellow-400/50 bg-yellow-500/10 px-2 py-1 text-center text-xs font-black text-yellow-200">
            🔦 Antorcha lista: la próxima acción busca la veta profunda
          </div>
        )}

        <NeonButton variant="cyan" onClick={() => doMine(false)} disabled={mineDisabled} className="w-full">
          ⛏️ Picar mineral
        </NeonButton>

        <div className="grid gap-2">
          <ConsumableButton
            emoji="💥"
            name="Dinamita"
            desc="Detona 3 bloques de golpe. 15% de encontrar una geoda rara."
            qty={dynQty}
            price={items['dinamita']?.buy_price ?? null}
            disabled={mineDisabled}
            actionLabel="💥 ¡Detonar!"
            onUse={() => doMine(true)}
            onBuy={() => buy('dinamita')}
          />
          <ConsumableButton
            emoji="🔦"
            name="Antorcha"
            desc="Ilumina la veta profunda: ×4 de probabilidad de minerales épicos o mejores."
            qty={torchQty}
            price={items['antorcha']?.buy_price ?? null}
            active={torch}
            activeLabel="Quitar antorcha"
            disabled={busy}
            actionLabel="🔦 Encender"
            onUse={() => setTorch((t) => !t)}
            onBuy={() => buy('antorcha')}
          />
          <ConsumableButton
            emoji="🧪"
            name="Poción de Suerte"
            desc="Duplica los minerales que obtienes durante 30 segundos."
            qty={potionQty}
            price={items['pocion_suerte']?.buy_price ?? null}
            active={luckActive}
            activeLabel="🧪 Beber otra (+30s)"
            disabled={busy}
            actionLabel="🧪 Beber"
            onUse={usePotion}
            onBuy={() => buy('pocion_suerte')}
          />
        </div>

        {last && (
          <motion.div
            key={hit}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-1 rounded-xl border border-white/10 bg-black/40 p-2 text-xs"
          >
            <p className="font-bold text-emerald-300">
              ¡Obtuviste (+{last.xp} XP){last.doubled ? ' · x2 🧪' : ''}!
            </p>
            <div className="flex flex-wrap gap-1">
              {last.loot.map((l, idx) => (
                <ItemChip key={idx} id={l.item} qty={l.qty} rpg={rpg} />
              ))}
            </div>
            {last.event === 'cofre' && <p className="font-bold text-amber-300">🎁 Cofre: +{last.bonus} monedas</p>}
            {last.event === 'derrumbe' && <p className="font-bold text-red-300">🪨 Derrumbe: +20s de enfriamiento</p>}
          </motion.div>
        )}
      </Card>
    </div>
  )
}
