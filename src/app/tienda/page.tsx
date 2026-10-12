'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  BadgeCheck,
  Check,
  Coins,
  Crown,
  Flame,
  Loader2,
  Palette,
  Shield,
  ShoppingCart,
  Sparkles,
  Star,
  Tag,
  X,
  Zap,
} from 'lucide-react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { MainLayout } from '@/components/layout/MainLayout'
import { createClient } from '@/lib/supabase/client'
import { buyShopItem, rpcErrorMessage, useUserStats } from '@/hooks/useUserStats'

/* ------------------------------------------------------------------ */
/* Tipos                                                               */
/* ------------------------------------------------------------------ */

type Category = 'title' | 'name_color' | 'cosmetic' | 'boost' | 'role'

interface ShopItem {
  id: string
  name: string
  description: string | null
  category: Category
  price: number
  payload: Record<string, unknown>
}

interface InventoryRow {
  item_id: string
  equipped: boolean
}

type Filter = 'all' | Category

/* ------------------------------------------------------------------ */
/* Sonido (Web Audio, sin archivos)                                    */
/* ------------------------------------------------------------------ */

interface Note {
  f: number
  t: number
  d: number
  type?: OscillatorType
}

let audioCtx: AudioContext | null = null

function playNotes(notes: Note[]) {
  try {
    if (!audioCtx) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return
      audioCtx = new Ctor()
    }
    const ctx = audioCtx
    if (ctx.state === 'suspended') void ctx.resume()
    const now = ctx.currentTime
    notes.forEach((n) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = n.type ?? 'sine'
      osc.frequency.setValueAtTime(n.f, now + n.t)
      gain.gain.setValueAtTime(0.0001, now + n.t)
      gain.gain.exponentialRampToValueAtTime(0.18, now + n.t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + n.t + n.d)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now + n.t)
      osc.stop(now + n.t + n.d + 0.05)
    })
  } catch {
    // El audio es decorativo: si el navegador lo bloquea, la tienda sigue funcionando.
  }
}

const SFX = {
  open: () => playNotes([{ f: 520, t: 0, d: 0.08, type: 'triangle' }]),
  success: () =>
    playNotes([
      { f: 988, t: 0, d: 0.1, type: 'square' },
      { f: 1319, t: 0.09, d: 0.1, type: 'square' },
      { f: 1568, t: 0.18, d: 0.14, type: 'square' },
      { f: 2093, t: 0.3, d: 0.25, type: 'triangle' },
    ]),
  error: () =>
    playNotes([
      { f: 180, t: 0, d: 0.15, type: 'sawtooth' },
      { f: 120, t: 0.12, d: 0.22, type: 'sawtooth' },
    ]),
  equip: () => playNotes([{ f: 740, t: 0, d: 0.07 }, { f: 880, t: 0.07, d: 0.1 }]),
}

/* ------------------------------------------------------------------ */
/* Presentación por categoría                                          */
/* ------------------------------------------------------------------ */

const CATEGORY_META: Record<Category, { label: string; icon: React.ReactNode; accent: string }> = {
  title: { label: 'Título', icon: <Tag className="w-8 h-8 text-purple-400" />, accent: 'hover:border-purple-500/60' },
  name_color: { label: 'Color de nombre', icon: <Palette className="w-8 h-8 text-yellow-400" />, accent: 'hover:border-yellow-500/60' },
  cosmetic: { label: 'Cosmético', icon: <Shield className="w-8 h-8 text-sky-400" />, accent: 'hover:border-sky-500/60' },
  boost: { label: 'Multiplicador', icon: <Zap className="w-8 h-8 text-emerald-400" />, accent: 'hover:border-emerald-500/60' },
  role: { label: 'Rol del grupo', icon: <Star className="w-8 h-8 text-pink-400" />, accent: 'hover:border-pink-500/60' },
}

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Todo' },
  { id: 'title', label: 'Títulos' },
  { id: 'name_color', label: 'Colores' },
  { id: 'cosmetic', label: 'Cosméticos' },
  { id: 'boost', label: 'Boosts' },
  { id: 'role', label: 'Roles' },
]

function levelProgress(xp: number, level: number) {
  const start = 25 * (level - 1) ** 2
  const end = 25 * level ** 2
  const pct = ((xp - start) / (end - start)) * 100
  return { pct: Math.min(100, Math.max(0, pct)), start, end }
}

function itemPreview(item: ShopItem) {
  const color = typeof item.payload.color === 'string' ? item.payload.color : undefined
  return color ? { color, textShadow: `0 0 14px ${color}88` } : undefined
}

/* ------------------------------------------------------------------ */
/* Página                                                              */
/* ------------------------------------------------------------------ */

export default function TiendaPage() {
  // useState con inicializador: el cliente es estable entre renders
  // (si se recreara en cada render, el hook resuscribiría Realtime sin parar).
  const [supabase] = useState(() => createClient())
  const { stats, loading: statsLoading } = useUserStats(supabase)

  const [items, setItems] = useState<ShopItem[]>([])
  const [itemsLoading, setItemsLoading] = useState(true)
  const [inventory, setInventory] = useState<InventoryRow[]>([])
  const [filter, setFilter] = useState<Filter>('all')
  const [confirmItem, setConfirmItem] = useState<ShopItem | null>(null)
  const [buyingId, setBuyingId] = useState<string | null>(null)
  const [equippingId, setEquippingId] = useState<string | null>(null)
  const busyRef = useRef(false) // bloqueo síncrono anti doble clic

  const loadInventory = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) return
    const { data } = await supabase
      .from('user_inventory')
      .select('item_id, equipped')
      .eq('user_id', auth.user.id)
    if (data) setInventory(data as InventoryRow[])
  }, [supabase])

  // Catálogo + inventario inicial + inventario en vivo
  useEffect(() => {
    let cancelled = false
    let channel: RealtimeChannel | null = null

    ;(async () => {
      const { data, error } = await supabase
        .from('shop_items')
        .select('id, name, description, category, price, payload')
        .eq('active', true)
        .order('price', { ascending: true })
      if (cancelled) return
      if (error) toast.error('No se pudo cargar el catálogo.')
      else setItems((data ?? []) as ShopItem[])
      setItemsLoading(false)

      await loadInventory()

      const { data: auth } = await supabase.auth.getUser()
      if (cancelled || !auth.user) return
      channel = supabase
        .channel(`inventory:${auth.user.id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'user_inventory', filter: `user_id=eq.${auth.user.id}` },
          () => {
            void loadInventory()
          }
        )
        .subscribe()
    })()

    return () => {
      cancelled = true
      if (channel) supabase.removeChannel(channel)
    }
  }, [supabase, loadInventory])

  const ownedMap = new Map(inventory.map((r) => [r.item_id, r]))
  const coins = stats?.coins ?? 0
  const boostActive = !!stats?.xp_boost_until && new Date(stats.xp_boost_until) > new Date()
  const progress = stats ? levelProgress(stats.xp_total, stats.level) : null
  const visibleItems = filter === 'all' ? items : items.filter((i) => i.category === filter)

  const openConfirm = (item: ShopItem) => {
    if (busyRef.current) return
    SFX.open()
    setConfirmItem(item)
  }

  const handleConfirmBuy = async () => {
    if (!confirmItem || busyRef.current) return
    busyRef.current = true
    const item = confirmItem
    setBuyingId(item.id)

    const res = await buyShopItem(supabase, item.id, item.price)

    if (res.ok) {
      SFX.success()
      toast.success(`¡Compraste "${item.name}"!`, {
        description: `Te quedan ${res.balance.toLocaleString()} monedas.`,
      })
      await loadInventory()
    } else {
      SFX.error()
      toast.error(res.error)
    }

    setBuyingId(null)
    setConfirmItem(null)
    busyRef.current = false
  }

  const handleEquip = async (item: ShopItem, equip: boolean) => {
    if (busyRef.current) return
    busyRef.current = true
    setEquippingId(item.id)
    const { error } = await supabase.rpc('equip_item', { p_item_id: item.id, p_equip: equip })
    if (error) {
      SFX.error()
      toast.error(rpcErrorMessage(error.message))
    } else {
      SFX.equip()
      toast.success(equip ? `Equipado: ${item.name}` : `Desequipado: ${item.name}`)
      await loadInventory()
    }
    setEquippingId(null)
    busyRef.current = false
  }

  return (
    <MainLayout>
      <div className="w-full max-w-7xl mx-auto px-4 py-8">
        {/* Cabecera */}
        <header className="mb-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div>
            <h1 className="text-5xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 uppercase tracking-tighter flex items-center gap-4">
              <ShoppingCart className="w-12 h-12 text-yellow-500" /> Mercado Negro
            </h1>
            <p className="text-lg text-yellow-200/60 font-medium mt-2">
              Gasta las monedas que ganas en el casino, la aventura y los logros.
            </p>
          </div>

          <motion.div
            layout
            className="w-full lg:w-auto bg-black/80 border border-yellow-500/30 px-6 py-4 rounded-2xl shadow-[0_0_20px_rgba(234,179,8,0.2)] min-w-[300px]"
          >
            <div className="flex items-center gap-4">
              <div className="bg-yellow-500/20 p-3 rounded-xl">
                <Coins className="w-8 h-8 text-yellow-500" />
              </div>
              <div className="flex-1">
                <span className="block text-xs font-black text-zinc-400 uppercase tracking-widest">Tu saldo</span>
                {statsLoading ? (
                  <div className="h-9 w-32 bg-white/10 rounded animate-pulse" />
                ) : (
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span
                      key={coins}
                      initial={{ y: -12, opacity: 0, scale: 1.15 }}
                      animate={{ y: 0, opacity: 1, scale: 1 }}
                      exit={{ y: 12, opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                      className="block text-3xl font-black text-white"
                    >
                      {coins.toLocaleString()} <span className="text-yellow-500 text-xl">monedas</span>
                    </motion.span>
                  </AnimatePresence>
                )}
              </div>
            </div>

            {stats && progress && (
              <div className="mt-4">
                <div className="flex justify-between text-[11px] font-black uppercase tracking-widest text-zinc-400 mb-1">
                  <span className="flex items-center gap-1">
                    <Crown className="w-3 h-3 text-yellow-500" /> Nivel {stats.level}
                  </span>
                  <span>{stats.xp_total.toLocaleString()} XP</span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-yellow-400 to-orange-500"
                    initial={false}
                    animate={{ width: `${progress.pct}%` }}
                    transition={{ type: 'spring', stiffness: 120, damping: 20 }}
                  />
                </div>
                {boostActive && (
                  <div className="mt-2 inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-3 py-1">
                    <Flame className="w-3 h-3" /> XP x{stats.xp_boost_mult} activo hasta{' '}
                    {new Date(stats.xp_boost_until as string).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </header>

        {/* Filtros */}
        <div className="flex flex-wrap gap-2 mb-8">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest border transition-colors ${
                filter === f.id
                  ? 'bg-yellow-500 text-black border-yellow-500'
                  : 'bg-white/5 text-zinc-400 border-white/10 hover:border-yellow-500/40 hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Catálogo */}
        {itemsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-64 rounded-3xl bg-white/5 border border-white/10 animate-pulse" />
            ))}
          </div>
        ) : visibleItems.length === 0 ? (
          <p className="text-zinc-500 font-medium">No hay artículos en esta categoría.</p>
        ) : (
          <motion.div layout className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence>
              {visibleItems.map((item, i) => {
                const meta = CATEGORY_META[item.category]
                const owned = item.category !== 'boost' ? ownedMap.get(item.id) : undefined
                const missing = item.price - coins
                const canAfford = missing <= 0
                const isBuying = buyingId === item.id
                const isEquipping = equippingId === item.id
                const disabledAll = buyingId !== null || equippingId !== null

                return (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, y: 24, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: i * 0.05, type: 'spring', stiffness: 260, damping: 24 }}
                    whileHover={{ y: -6 }}
                    className={`relative bg-black/60 backdrop-blur-xl border p-6 rounded-3xl flex flex-col justify-between transition-colors ${
                      owned ? 'border-emerald-500/40' : `border-white/10 ${meta.accent}`
                    }`}
                  >
                    {owned && (
                      <div className="absolute top-4 right-4 flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-3 py-1">
                        <BadgeCheck className="w-3 h-3" /> {owned.equipped ? 'Equipado' : 'Ya comprado'}
                      </div>
                    )}

                    <div>
                      <div className="flex justify-between items-start mb-4">
                        <div className="bg-white/5 p-4 rounded-2xl border border-white/10">{meta.icon}</div>
                        {!owned && (
                          <span className="bg-white/5 text-zinc-400 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border border-white/10">
                            {meta.label}
                          </span>
                        )}
                      </div>
                      <h3
                        className="text-2xl font-black text-white mb-2 uppercase tracking-wide"
                        style={itemPreview(item)}
                      >
                        {item.name}
                      </h3>
                      <p className="text-zinc-400 font-medium text-sm leading-relaxed mb-6">
                        {item.description}
                      </p>
                    </div>

                    {owned ? (
                      <button
                        onClick={() => handleEquip(item, !owned.equipped)}
                        disabled={disabledAll}
                        className="w-full bg-emerald-600/20 hover:bg-emerald-600/40 disabled:opacity-50 text-emerald-300 font-black px-6 py-4 rounded-xl flex items-center justify-center gap-2 uppercase transition-colors border border-emerald-500/30"
                      >
                        {isEquipping ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Check className="w-4 h-4" />
                        )}
                        {owned.equipped ? 'Quitar' : 'Equipar'}
                      </button>
                    ) : (
                      <button
                        onClick={() => openConfirm(item)}
                        disabled={!canAfford || disabledAll || statsLoading}
                        className="w-full bg-zinc-900 enabled:hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black px-6 py-4 rounded-xl flex items-center justify-between uppercase transition-colors border border-white/5"
                      >
                        <span>
                          {isBuying ? 'Procesando...' : canAfford ? 'Comprar' : `Faltan ${missing.toLocaleString()}`}
                        </span>
                        <span className="flex items-center gap-2 text-yellow-500">
                          <Coins className="w-4 h-4" /> {item.price.toLocaleString()}
                        </span>
                      </button>
                    )}
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      {/* Modal de confirmación */}
      <AnimatePresence>
        {confirmItem && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              if (!buyingId) setConfirmItem(null)
            }}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              className="w-full max-w-md bg-zinc-950 border border-yellow-500/30 rounded-3xl p-8 shadow-[0_0_60px_rgba(234,179,8,0.2)]"
              initial={{ scale: 0.9, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: 20, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 24 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <Sparkles className="w-6 h-6 text-yellow-500" />
                <h2 className="text-2xl font-black text-white uppercase tracking-wide">Confirmar compra</h2>
              </div>
              <p className="text-zinc-300 mb-1 font-semibold" style={itemPreview(confirmItem)}>
                {confirmItem.name}
              </p>
              <p className="text-zinc-500 text-sm mb-6">{confirmItem.description}</p>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-6 text-sm font-bold">
                <div className="flex justify-between text-zinc-400">
                  <span>Precio</span>
                  <span className="text-yellow-500">{confirmItem.price.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-zinc-400 mt-1">
                  <span>Saldo después</span>
                  <span className="text-white">{(coins - confirmItem.price).toLocaleString()}</span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmItem(null)}
                  disabled={buyingId !== null}
                  className="flex-1 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 text-zinc-300 font-black py-3 rounded-xl uppercase flex items-center justify-center gap-2 border border-white/10"
                >
                  <X className="w-4 h-4" /> Cancelar
                </button>
                <button
                  onClick={handleConfirmBuy}
                  disabled={buyingId !== null}
                  className="flex-1 bg-yellow-500 hover:bg-yellow-400 disabled:opacity-60 text-black font-black py-3 rounded-xl uppercase flex items-center justify-center gap-2"
                >
                  {buyingId ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {buyingId ? 'Procesando' : 'Comprar'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </MainLayout>
  )
}
