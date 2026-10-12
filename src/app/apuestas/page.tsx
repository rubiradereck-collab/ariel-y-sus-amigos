'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Coins } from 'lucide-react'
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

  const { stats, error } = useRpg()
  const { show, node } = useNotice()
  const [tab, setTab] = useState<Tab>('blackjack')
  const props = { stats, notify: show }

  const active = TABS.find((t) => t.id === tab)
  const usesCoins = active?.economy === 'coins'

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
            <div className="flex items-center justify-center gap-3 rounded-2xl border border-yellow-500/30 bg-black/60 px-4 py-3">
              <Coins className="h-5 w-5 text-yellow-500" />
              <span className="text-sm font-black uppercase tracking-widest text-yellow-200/70">Monedas</span>
              <span className="text-2xl font-black text-white">{(coinStats?.coins ?? 0).toLocaleString()}</span>
              {coinStats && (
                <span className="rounded-full bg-fuchsia-500/20 px-3 py-0.5 text-xs font-black text-fuchsia-200">
                  Nivel {coinStats.level}
                </span>
              )}
            </div>
          ) : (
            <BalanceBar stats={stats} />
          )}

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
