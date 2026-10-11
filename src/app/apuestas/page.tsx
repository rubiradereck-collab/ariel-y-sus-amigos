'use client'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { useRpg } from '@/lib/rpg'
import { BalanceBar, useNotice } from '@/components/rpg/ui'
import Slots from '@/components/casino/Slots'
import Mines from '@/components/casino/Mines'
import Roulette from '@/components/casino/Roulette'
import Coinflip from '@/components/casino/Coinflip'
import Duels from '@/components/casino/Duels'
import { MainLayout } from '@/components/layout/MainLayout'

const TABS = [
  { id: 'slots', label: '🎰 Bonanza' }, { id: 'mines', label: '💎 Minas' },
  { id: 'roulette', label: '🎡 Ruleta' }, { id: 'coin', label: '🪙 Cara/Cruz' }, { id: 'duels', label: '⚔️ Duelos' },
] as const
type Tab = (typeof TABS)[number]['id']

export default function ApuestasPage() {
  const { stats, error } = useRpg()
  const { show, node } = useNotice()
  const [tab, setTab] = useState<Tab>('slots')
  const props = { stats, notify: show }

  return (
    <MainLayout>
      <div className="relative min-h-[calc(100vh-6rem)] overflow-hidden bg-[radial-gradient(ellipse_at_top,#3b0764_0%,#09090b_55%)] px-3 py-6 text-white sm:px-6">
        {node}
        <div className="mx-auto max-w-5xl space-y-4">
          <motion.h1 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className="text-center text-3xl font-black tracking-wider text-fuchsia-300 drop-shadow-[0_0_14px_#d946ef] sm:text-5xl">
            CASINO CLANDESTINO
          </motion.h1>
          <p className="text-center text-xs text-zinc-400">Solo para los 6 panas. Monedas y XP virtuales. La casa siempre tiene su ventaja: las probabilidades están a la vista en cada juego.</p>
          {error && <p className="rounded-lg bg-red-950/60 p-2 text-sm text-red-300">{error}</p>}
          <BalanceBar stats={stats} />
          <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`whitespace-nowrap rounded-xl border px-4 py-2 text-sm font-bold transition cursor-pointer ${tab === t.id ? 'border-fuchsia-400 bg-fuchsia-500/20 text-fuchsia-100 shadow-[0_0_14px_#d946ef60]' : 'border-white/10 text-zinc-400 hover:text-white'}`}>
                {t.label}
              </button>
            ))}
          </div>
          <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            {tab === 'slots' && <Slots {...props} />}
            {tab === 'mines' && <Mines {...props} />}
            {tab === 'roulette' && <Roulette {...props} />}
            {tab === 'coin' && <Coinflip {...props} />}
            {tab === 'duels' && <Duels {...props} />}
          </motion.div>
        </div>
      </div>
    </MainLayout>
  )
}
