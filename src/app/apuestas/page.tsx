'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Coins, Gift } from 'lucide-react'
import { useRpg } from '@/lib/rpg'
import { BalanceBar, useNotice } from '@/components/rpg/ui'
import Slots from '@/components/casino/Slots'
import Mines from '@/components/casino/Mines'
import Roulette from '@/components/casino/Roulette'
import Coinflip from '@/components/casino/Coinflip'
import Duels from '@/components/casino/Duels'
import Plinko from '@/components/casino/Plinko'
import Crash from '@/components/casino/Crash'
import { BlackjackTable } from '@/components/casino/BlackjackTable'
import { EuropeanRoulette } from '@/components/casino/EuropeanRoulette'
import { SlotMachine } from '@/components/casino/SlotMachine'
import { RewardsHubModal } from '@/components/rewards/RewardsHubModal'
import { MainLayout } from '@/components/layout/MainLayout'
import { createClient } from '@/lib/supabase/client'
import { useUserStats } from '@/hooks/useUserStats'

const TABS = [
  { id: 'blackjack', label: '🃏 Blackjack 21', economy: 'coins' },
  { id: 'roulette_v2', label: '🎡 Ruleta Europea', economy: 'coins' },
  { id: 'slots_v2', label: '🎰 Tragaperras', economy: 'coins' },
  { id: 'plinko', label: '🔻 Plinko', economy: 'coins' },
  { id: 'crash', label: '🚀 Crash', economy: 'coins' },
  { id: 'mines', label: '💎 Minas (RPG)', economy: 'rpg' },
  { id: 'coin', label: '🪙 Cara/Cruz (RPG)', economy: 'rpg' },
  { id: 'duels', label: '⚔️ Duelos (RPG)', economy: 'rpg' },
] as const

type Tab = (typeof TABS)[number]['id']

export default function ApuestasPage() {
  const [supabase] = useState(() => createClient())
  const { stats: coinStats, refresh: mutateStats } = useUserStats(supabase)
  const [rewardsOpen, setRewardsOpen] = useState(false)

  const { stats, error } = useRpg()
  const { show, node } = useNotice()
  const [tab, setTab] = useState<Tab>('blackjack')
  const props = { stats, notify: show }

  const active = TABS.find((t) => t.id === tab)
  const usesCoins = active?.economy === 'coins'
  const isBroke = usesCoins && (coinStats?.coins ?? 0) < 20

  return (
    <MainLayout>
      <div className="relative min-h-[calc(100vh-6rem)] overflow-hidden bg-[radial-gradient(ellipse_at_top,#3b0764_0%,#09090b_55%)] px-3 py-6 text-white sm:px-6">
        {node}
        <div className="mx-auto max-w-5xl space-y-4">
          <motion.h1
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center text-3xl font-black tracking-wider text-fuchsia-300 drop-shadow-[0_0_14px_#d946ef] sm:text-5xl"
          >
            CASINO CLANDESTINO
          </motion.h1>

          {usesCoins ? (
            <div className="flex flex-wrap items-center justify-center gap-3 rounded-2xl border border-yellow-500/30 bg-black/60 px-4 py-3">
              <div className="flex items-center gap-2">
                <Coins className="h-5 w-5 text-yellow-500" />
                <span className="text-sm font-black uppercase tracking-widest text-yellow-200/70">Monedas</span>
                <span className="text-2xl font-black text-white">{(coinStats?.coins ?? 0).toLocaleString()}</span>
              </div>
              {coinStats && (
                <span className="rounded-full bg-fuchsia-500/20 px-3 py-0.5 text-xs font-black text-fuchsia-200">
                  Nivel {coinStats.level}
                </span>
              )}
              <button
                onClick={() => setRewardsOpen(true)}
                className="cursor-pointer ml-auto flex items-center gap-1.5 rounded-xl border border-yellow-400/40 bg-gradient-to-r from-yellow-500/20 to-amber-500/20 px-3 py-1.5 text-xs font-black text-yellow-300 transition hover:bg-yellow-500/30 hover:shadow-[0_0_15px_rgba(234,179,8,0.3)] active:scale-95"
              >
                <Gift className="h-4 w-4 text-yellow-400" /> Recompensas & Ruleta
              </button>
            </div>
          ) : (
            <BalanceBar stats={stats} />
          )}

          {/* Banner de Auxilio por Bancarrota si tiene menos de 20 monedas */}
          {isBroke && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl border border-red-500/40 bg-red-950/40 px-4 py-3 shadow-lg shadow-red-950/50"
            >
              <div className="flex items-center gap-2.5 text-left">
                <span className="text-2xl">💸</span>
                <div>
                  <p className="text-sm font-black text-red-200">¿Bancarrota? Tienes menos de 20 🪙</p>
                  <p className="text-xs text-red-300/80">El fondo de rescate clandestino te otorga un auxilio de 50 🪙 inmediatas.</p>
                </div>
              </div>
              <button
                onClick={() => setRewardsOpen(true)}
                className="whitespace-nowrap cursor-pointer rounded-xl bg-gradient-to-r from-red-600 to-rose-600 px-4 py-2 text-xs font-black text-white hover:brightness-110 transition shadow-lg shadow-red-600/30 active:scale-95"
              >
                Pedir 50 🪙 de Auxilio
              </button>
            </motion.div>
          )}

          <RewardsHubModal
            isOpen={rewardsOpen}
            onClose={() => setRewardsOpen(false)}
            onUpdateCoins={() => void mutateStats()}
          />

          <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`cursor-pointer whitespace-nowrap rounded-xl border px-4 py-2 text-sm font-bold transition ${
                  tab === t.id
                    ? 'border-fuchsia-400 bg-fuchsia-500/20 text-fuchsia-100 shadow-md shadow-fuchsia-500/20'
                    : 'border-white/10 text-zinc-400 hover:border-white/20 hover:text-zinc-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {error && !usesCoins && <p className="text-center text-sm text-red-400">{String(error)}</p>}

          <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            {tab === 'blackjack' && (
              <BlackjackTable
                supabase={supabase}
                coins={coinStats?.coins ?? 0}
                onBalanceChange={() => void mutateStats()}
              />
            )}
            {tab === 'roulette_v2' && (
              <EuropeanRoulette
                supabase={supabase}
                coins={coinStats?.coins ?? 0}
                onBalanceChange={() => void mutateStats()}
              />
            )}
            {tab === 'slots_v2' && (
              <SlotMachine
                supabase={supabase}
                coins={coinStats?.coins ?? 0}
                onBalanceChange={() => void mutateStats()}
              />
            )}
            {tab === 'plinko' && <Plinko supabase={supabase} coins={coinStats?.coins ?? 0} />}
            {tab === 'crash' && <Crash supabase={supabase} coins={coinStats?.coins ?? 0} />}
            {tab === 'mines' && <Mines {...props} />}
            {tab === 'coin' && <Coinflip {...props} />}
            {tab === 'duels' && <Duels {...props} />}
          </motion.div>
        </div>
      </div>
    </MainLayout>
  )
}
