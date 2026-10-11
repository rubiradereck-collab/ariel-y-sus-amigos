'use client'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { useRpg } from '@/lib/rpg'
import { BalanceBar, useNotice } from '@/components/rpg/ui'
import Mining from '@/components/adventure/Mining'
import Fishing from '@/components/adventure/Fishing'
import Backpack from '@/components/adventure/Backpack'
import Forge from '@/components/adventure/Forge'
import Town from '@/components/adventure/Town'
import { MainLayout } from '@/components/layout/MainLayout'

const TABS = [
  { id: 'mine', label: '⛏️ Minería' }, { id: 'fish', label: '🎣 Pesca' }, { id: 'bag', label: '🎒 Mochila' },
  { id: 'forge', label: '🔨 Herrería' }, { id: 'town', label: '🏘️ Pueblo' },
] as const
type Tab = (typeof TABS)[number]['id']

export default function AventuraPage() {
  const rpg = useRpg()
  const { show, node } = useNotice()
  const [tab, setTab] = useState<Tab>('mine')
  const props = { rpg, notify: show }

  return (
    <MainLayout>
      <div className="min-h-[calc(100vh-6rem)] bg-[radial-gradient(ellipse_at_top_left,#0e7490_0%,#09090b_50%)] px-3 py-6 text-white sm:px-6">
        {node}
        <div className="mx-auto max-w-5xl space-y-4">
          <motion.h1 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className="text-center text-3xl font-black tracking-wider text-cyan-300 drop-shadow-[0_0_14px_#22d3ee] sm:text-5xl">
            AVENTURA & RECOLECCIÓN
          </motion.h1>
          {rpg.error && <p className="rounded-lg bg-red-950/60 p-2 text-sm text-red-300">{rpg.error}</p>}
          <BalanceBar stats={rpg.stats} />
          <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`whitespace-nowrap rounded-xl border px-4 py-2 text-sm font-bold transition cursor-pointer ${tab === t.id ? 'border-cyan-400 bg-cyan-500/20 shadow-[0_0_14px_#22d3ee60]' : 'border-white/10 text-zinc-400 hover:text-white'}`}>
                {t.label}
              </button>
            ))}
          </div>
          {!rpg.stats ? <p className="py-10 text-center text-zinc-400">Cargando tu aventura…</p> : (
            <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              {tab === 'mine' && <Mining {...props} />}
              {tab === 'fish' && <Fishing {...props} />}
              {tab === 'bag' && <Backpack {...props} />}
              {tab === 'forge' && <Forge {...props} />}
              {tab === 'town' && <Town {...props} />}
            </motion.div>
          )}
        </div>
      </div>
    </MainLayout>
  )
}
