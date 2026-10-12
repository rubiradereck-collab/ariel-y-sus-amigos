'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Coins } from 'lucide-react'
import { MainLayout } from '@/components/layout/MainLayout'
import { createClient } from '@/lib/supabase/client'
import { useUserStats } from '@/hooks/useUserStats'
import { SlotMachine } from '@/components/casino/SlotMachine'

export default function TragaperrasPage() {
  const [supabase] = useState(() => createClient())
  const { stats: coinStats } = useUserStats(supabase)

  return (
    <MainLayout>
      <div className="min-h-[calc(100vh-6rem)] bg-[radial-gradient(ellipse_at_top,#581c87_0%,#09090b_60%)] px-4 py-6 text-white sm:px-6">
        <div className="mx-auto max-w-5xl space-y-4">
          <div className="flex items-center justify-between">
            <Link
              href="/apuestas"
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-zinc-300 transition hover:bg-white/10"
            >
              <ArrowLeft className="h-4 w-4" /> Volver al Casino
            </Link>

            <div className="flex items-center gap-2 rounded-xl border border-yellow-500/30 bg-black/60 px-3.5 py-1.5">
              <Coins className="h-4 w-4 text-yellow-400" />
              <span className="text-sm font-black text-white">{(coinStats?.coins ?? 0).toLocaleString()}</span>
            </div>
          </div>

          <div className="text-center">
            <h1 className="text-3xl font-black tracking-wider text-amber-300 drop-shadow sm:text-4xl">
              TRAGAPERRAS BONANZA
            </h1>
            <p className="mt-1 text-xs text-amber-200/70">
              3 rodillos con multiplicadores de hasta x250. ¡Consigue tres 7️⃣ para el premio gordo!
            </p>
          </div>

          <SlotMachine supabase={supabase} coins={coinStats?.coins ?? 0} />
        </div>
      </div>
    </MainLayout>
  )
}
