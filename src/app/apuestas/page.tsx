'use client'

import { useState, useEffect, useMemo, useCallback, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Trophy, Coins, Gift, ArrowLeft, Star, Sparkles, AlertCircle, ChevronRight
} from 'lucide-react'
import { useSearchParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { MainLayout } from '@/components/layout/MainLayout'
import { createClient } from '@/lib/supabase/client'
import { useUserStats } from '@/hooks/useUserStats'
import { useRpg } from '@/lib/rpg'
import { useNotice } from '@/components/rpg/ui'
import { CASINO_GAMES, GameDef, GameCategory } from '@/lib/casino/catalog'
import { GameCard } from '@/components/casino/GameCard'
import { SearchBar } from '@/components/casino/SearchBar'
import { CategoryChips, LobbyCategoryFilter } from '@/components/casino/CategoryChips'
import { RewardsHubModal } from '@/components/rewards/RewardsHubModal'

// Juegos montados
import { BlackjackTable } from '@/components/casino/BlackjackTable'
import { EuropeanRoulette } from '@/components/casino/EuropeanRoulette'
import { SlotMachine } from '@/components/casino/SlotMachine'
import { DiceGame } from '@/components/casino/DiceGame'
import Plinko from '@/components/casino/Plinko'
import Crash from '@/components/casino/Crash'
import Mines from '@/components/casino/Mines'
import Coinflip from '@/components/casino/Coinflip'
import Duels from '@/components/casino/Duels'

export default function ApuestasLobbyPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#0b0b0d] text-[#d4af37]">
          Cargando Casino Clandestino...
        </div>
      }
    >
      <ApuestasLobbyContent />
    </Suspense>
  )
}

function ApuestasLobbyContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [supabase] = useState(() => createClient())
  const { stats: coinStats, refresh: mutateStats } = useUserStats(supabase)
  const { stats, error } = useRpg()
  const { show, node } = useNotice()

  // Búsqueda y Filtros
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<LobbyCategoryFilter>('todos')
  const [favorites, setFavorites] = useState<string[]>([])
  const [recents, setRecents] = useState<string[]>([])
  const [userId, setUserId] = useState<string | null>(null)

  // Juego activo en escenario
  const initialGameParam = searchParams.get('game')
  const [activeGameSlug, setActiveGameSlug] = useState<string | null>(initialGameParam)

  // Bóveda de Recompensas
  const [rewardsOpen, setRewardsOpen] = useState(searchParams.get('rewards') === 'open')

  // Cargar usuario, favoritos y recientes
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id || null
      setUserId(uid)

      if (uid) {
        supabase
          .from('game_favorites')
          .select('game_slug')
          .eq('user_id', uid)
          .then(({ data: favData }) => {
            if (favData) {
              setFavorites(favData.map((f: any) => f.game_slug))
            }
          })
      }
    })

    try {
      const storedFavs = localStorage.getItem('casino_favs')
      if (storedFavs) setFavorites(JSON.parse(storedFavs))
      const storedRecents = localStorage.getItem('casino_recents')
      if (storedRecents) setRecents(JSON.parse(storedRecents))
    } catch {}
  }, [supabase])

  // Toggle Favorito
  const toggleFavorite = useCallback(async (slug: string) => {
    setFavorites((prev) => {
      const next = prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
      try {
        localStorage.setItem('casino_favs', JSON.stringify(next))
      } catch {}
      return next
    })

    if (userId) {
      const isFav = favorites.includes(slug)
      if (isFav) {
        await supabase.from('game_favorites').delete().match({ user_id: userId, game_slug: slug })
      } else {
        await supabase.from('game_favorites').insert({ user_id: userId, game_slug: slug })
      }
    }
  }, [favorites, userId, supabase])

  // Lanzar Juego
  const handleLaunchGame = (game: GameDef) => {
    if (game.slug === 'wheel_fortune') {
      setRewardsOpen(true)
      return
    }

    // Agregar a recientes
    setRecents((prev) => {
      const next = [game.slug, ...prev.filter((s) => s !== game.slug)].slice(0, 10)
      try {
        localStorage.setItem('casino_recents', JSON.stringify(next))
      } catch {}
      return next
    })

    setActiveGameSlug(game.slug)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Filtrado de juegos
  const filteredGames = useMemo(() => {
    return CASINO_GAMES.filter((g) => {
      // Filtro de búsqueda
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matches = g.title.toLowerCase().includes(q) || g.category.toLowerCase().includes(q) || g.desc.toLowerCase().includes(q)
        if (!matches) return false
      }

      // Filtro de categoría
      if (categoryFilter === 'todos') return true
      if (categoryFilter === 'favoritos') return favorites.includes(g.slug)
      if (categoryFilter === 'recientes') return recents.includes(g.slug)
      return g.category === categoryFilter
    })
  }, [searchQuery, categoryFilter, favorites, recents])

  // Conteos para chips
  const categoryCounts = useMemo(() => {
    return {
      todos: CASINO_GAMES.length,
      slots: CASINO_GAMES.filter((g) => g.category === 'slots').length,
      crash: CASINO_GAMES.filter((g) => g.category === 'crash').length,
      mesa: CASINO_GAMES.filter((g) => g.category === 'mesa').length,
      instantaneo: CASINO_GAMES.filter((g) => g.category === 'instantaneo').length,
      favoritos: favorites.length,
      recientes: recents.length,
    }
  }, [favorites, recents])

  const coins = coinStats?.coins ?? 0
  const isBroke = coins < 20
  const activeGame = CASINO_GAMES.find((g) => g.slug === activeGameSlug)

  return (
    <MainLayout>
      <div className="min-h-screen bg-[#000] text-white selection:bg-[#d4af37]/30 pb-20">
        {node}

        {/* 1. BARRA SUPERIOR DE CONTROL & SALDO (Estilo VIP Casino) */}
        <div className="sticky top-0 z-30 border-b border-[rgba(212,175,55,0.15)] bg-[#0b0b0d]/95 backdrop-blur-md px-4 py-3 sm:px-8">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
            {/* Buscador */}
            <SearchBar value={searchQuery} onChange={setSearchQuery} />

            {/* Saldo y Botón de Recompensas */}
            <div className="flex items-center gap-2.5 sm:gap-3">
              {/* Saldo de Monedas */}
              <div className="flex items-center gap-2 rounded-2xl border border-[rgba(212,175,55,0.3)] bg-[#1b1b1d] px-3.5 py-1.5 shadow-inner">
                <Coins className="h-4 w-4 text-[#d4af37]" />
                <span className="font-mono text-xs sm:text-sm font-black text-white">
                  {coins.toLocaleString()}
                </span>
                <span className="text-[10px] font-black uppercase text-[#d4af37]">🪙</span>
              </div>

              {/* Botón Recompensas & Ruleta */}
              <button
                onClick={() => setRewardsOpen(true)}
                className="cursor-pointer flex items-center gap-1.5 rounded-2xl border border-[#d4af37]/50 bg-gradient-to-r from-[#d4af37]/20 via-amber-500/20 to-[#d4af37]/30 px-3.5 py-1.5 text-xs font-black text-[#d4af37] shadow-[0_0_15px_rgba(212,175,55,0.25)] transition hover:brightness-110 active:scale-95"
              >
                <Gift className="h-4 w-4 text-[#d4af37]" />
                <span className="hidden sm:inline">Bóveda & Ruleta</span>
              </button>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-8 space-y-6">
          {/* 2. BANNER DE AUXILIO POR BANCARROTA (Si coins < 20) */}
          {isBroke && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-3xl border border-red-500/40 bg-gradient-to-r from-red-950/60 to-black p-4 shadow-xl"
            >
              <div className="flex items-center gap-3 text-left">
                <span className="text-3xl">💸</span>
                <div>
                  <h4 className="text-sm font-black text-red-200">
                    Fondo de Rescate Clandestino
                  </h4>
                  <p className="text-xs text-red-300/80">
                    Tienes {coins} 🪙. Solicita un auxilio inmediato de 50 🪙 del prestamista.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setRewardsOpen(true)}
                className="cursor-pointer whitespace-nowrap rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 px-5 py-2 text-xs font-black text-white shadow-lg shadow-red-600/30 transition hover:brightness-110 active:scale-95"
              >
                Pedir 50 🪙 de Auxilio
              </button>
            </motion.div>
          )}

          {/* 3. ESCENARIO CENTRAL DE JUEGO (Si hay un juego seleccionado) */}
          {activeGame ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-4 rounded-3xl border border-[rgba(212,175,55,0.2)] bg-[#0b0b0d] p-4 sm:p-6 shadow-2xl"
            >
              {/* Barra superior de navegación del juego */}
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <button
                  onClick={() => setActiveGameSlug(null)}
                  className="cursor-pointer flex items-center gap-2 rounded-xl border border-white/10 bg-[#1b1b1d] px-3.5 py-2 text-xs font-bold text-zinc-300 transition hover:border-[#d4af37] hover:text-[#d4af37]"
                >
                  <ArrowLeft className="h-4 w-4" /> Volver al Lobby de Juegos
                </button>

                <div className="flex items-center gap-2">
                  <span className="text-2xl">{activeGame.emoji}</span>
                  <div className="text-right">
                    <h3 className="text-sm sm:text-base font-black text-white">{activeGame.title}</h3>
                    <span className="text-[10px] uppercase font-bold text-[#d4af37]">{activeGame.category}</span>
                  </div>
                </div>
              </div>

              {/* Contenedor del Juego */}
              <div className="py-2">
                {activeGame.slug === 'blackjack' && (
                  <BlackjackTable
                    supabase={supabase}
                    coins={coins}
                    onBalanceChange={() => void mutateStats()}
                  />
                )}
                {activeGame.slug === 'ruleta_europea' && (
                  <EuropeanRoulette
                    supabase={supabase}
                    coins={coins}
                    onBalanceChange={() => void mutateStats()}
                  />
                )}
                {activeGame.slug === 'tragaperras_bonanza' && (
                  <SlotMachine
                    supabase={supabase}
                    coins={coins}
                    onBalanceChange={() => void mutateStats()}
                  />
                )}
                {activeGame.slug === 'dice' && (
                  <DiceGame
                    supabase={supabase}
                    coins={coins}
                    onBalanceChange={() => void mutateStats()}
                  />
                )}
                {activeGame.slug === 'plinko' && <Plinko supabase={supabase} coins={coins} />}
                {activeGame.slug === 'crash' && <Crash supabase={supabase} coins={coins} />}
                {activeGame.slug === 'mines' && <Mines stats={stats} notify={show} />}
                {activeGame.slug === 'coinflip' && <Coinflip stats={stats} notify={show} />}
                {activeGame.slug === 'duels' && <Duels stats={stats} notify={show} />}
              </div>
            </motion.div>
          ) : (
            /* 4. VISTA PRINCIPAL DEL LOBBY */
            <div className="space-y-6">
              {/* Chips de Categoría */}
              <CategoryChips
                selected={categoryFilter}
                onSelect={setCategoryFilter}
                counts={categoryCounts}
              />

              {/* Cabecera de Categoría: Trofeo + Título en Poppins 300 / font-light */}
              <div className="flex items-center justify-between border-b border-white/5 pb-3 pt-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[rgba(212,175,55,0.3)] bg-gradient-to-tr from-[#d4af37]/20 to-black text-[#d4af37] shadow-[0_0_15px_rgba(212,175,55,0.2)]">
                    <Trophy className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-light tracking-wide text-white uppercase font-sans">
                      {categoryFilter === 'todos'
                        ? 'Todos los juegos'
                        : categoryFilter === 'favoritos'
                        ? 'Mis Juegos Favoritos'
                        : categoryFilter === 'recientes'
                        ? 'Jugados Recientemente'
                        : `Juegos de ${categoryFilter}`}
                    </h2>
                    <p className="text-[11px] text-zinc-500">
                      Mesas con crupier, dados Provably Fair y slots de alta volatilidad
                    </p>
                  </div>
                </div>

                <span className="text-xs font-mono font-bold text-zinc-500">
                  {filteredGames.length} {filteredGames.length === 1 ? 'juego' : 'juegos'}
                </span>
              </div>

              {/* GRID DE JUEGOS ESTILO CASINO */}
              {filteredGames.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-x-5 sm:gap-x-7 gap-y-7 sm:gap-y-9">
                  {filteredGames.map((game) => (
                    <GameCard
                      key={game.slug}
                      game={game}
                      isFavorite={favorites.includes(game.slug)}
                      onToggleFavorite={toggleFavorite}
                      onLaunch={handleLaunchGame}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-3xl border border-white/10 bg-[#161619] p-12 text-center space-y-3">
                  <span className="text-4xl">🔍</span>
                  <h3 className="text-base font-bold text-zinc-300">
                    No se encontraron juegos en esta categoría
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Prueba a limpiar la búsqueda o cambia de filtro.
                  </p>
                  <button
                    onClick={() => {
                      setSearchQuery('')
                      setCategoryFilter('todos')
                    }}
                    className="cursor-pointer rounded-xl bg-white/10 px-4 py-2 text-xs font-bold text-white hover:bg-white/20"
                  >
                    Ver Todos los Juegos
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal de Bóveda de Recompensas & Ruleta */}
        <RewardsHubModal
          isOpen={rewardsOpen}
          onClose={() => setRewardsOpen(false)}
          onUpdateCoins={() => void mutateStats()}
        />
      </div>
    </MainLayout>
  )
}
