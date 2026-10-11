'use client'

import { MainLayout } from "@/components/layout/MainLayout"
import { createClient } from "@/lib/supabase/client"
import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Pickaxe, Fish, Backpack, Hammer, Sparkles, Coins, Zap, Shield, 
  ChevronRight, Trophy, Flame, Compass, RefreshCw, AlertCircle, ArrowUpRight
} from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"

interface InventoryItem {
  id: string
  name: string
  icon: string
  count: number
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
  sellPrice: number
  category: 'mineral' | 'fish' | 'material'
}

export default function AventuraPage() {
  const supabase = createClient()
  const [profile, setProfile] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<'mineria' | 'pesca' | 'mochila' | 'forja'>('mineria')
  const [coins, setCoins] = useState<number>(1250)
  const [miningCooldown, setMiningCooldown] = useState<number>(0)
  const [fishingCooldown, setFishingCooldown] = useState<number>(0)
  const [isMining, setIsMining] = useState(false)
  const [isFishing, setIsFishing] = useState(false)

  // Inventario local enriquecido
  const [inventory, setInventory] = useState<InventoryItem[]>([
    { id: '1', name: 'Carbón', icon: '🪨', count: 18, rarity: 'common', sellPrice: 5, category: 'mineral' },
    { id: '2', name: 'Mineral de Hierro', icon: '⛓️', count: 9, rarity: 'common', sellPrice: 15, category: 'mineral' },
    { id: '3', name: 'Pepita de Oro', icon: '🪙', count: 4, rarity: 'rare', sellPrice: 50, category: 'mineral' },
    { id: '4', name: 'Diamante Estelar', icon: '💎', count: 1, rarity: 'epic', sellPrice: 200, category: 'mineral' },
    { id: '5', name: 'Salmón del Río', icon: '🐟', count: 6, rarity: 'common', sellPrice: 12, category: 'fish' },
    { id: '6', name: 'Trucha Arcoíris', icon: '🐠', count: 3, rarity: 'rare', sellPrice: 35, category: 'fish' },
    { id: '7', name: 'Tiburón Abisal', icon: '🦈', count: 1, rarity: 'legendary', sellPrice: 400, category: 'fish' },
  ])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase.from('profiles').select('*').eq('id', user.id).single().then(({ data }) => {
          if (data) setProfile(data)
        })
      }
    })
  }, [])

  // Cooldown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setMiningCooldown(prev => Math.max(0, prev - 1))
      setFishingCooldown(prev => Math.max(0, prev - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const playSound = (freq = 440, type: OscillatorType = 'sine', duration = 0.1) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      if (!AudioCtx) return
      const ctx = new AudioCtx()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = type
      osc.frequency.setValueAtTime(freq, ctx.currentTime)
      gain.gain.setValueAtTime(0.1, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + duration)
    } catch (e) {}
  }

  // Acción: Minar
  const handleMine = (zoneName: string, minLvl: number) => {
    if (miningCooldown > 0) {
      toast.error(`Espera ${miningCooldown}s para volver a minar.`)
      return
    }

    setIsMining(true)
    playSound(220, 'square', 0.15)

    setTimeout(() => {
      setIsMining(false)
      setMiningCooldown(6)

      const rand = Math.random()
      let rewardName = 'Piedra y Carbón'
      let rewardIcon = '🪨'
      let xpEarned = 25
      let coinsEarned = 10

      if (rand > 0.9) {
        rewardName = '¡DIAMANTE ENORME!'
        rewardIcon = '💎'
        xpEarned = 250
        coinsEarned = 150
        playSound(880, 'triangle', 0.4)
        toast.success(`¡INCREÍBLE! Hallaste ${rewardName} (+${xpEarned} XP, +${coinsEarned} Monedas)`)
      } else if (rand > 0.6) {
        rewardName = 'Mineral de Oro'
        rewardIcon = '🪙'
        xpEarned = 80
        coinsEarned = 45
        playSound(660, 'sine', 0.2)
        toast.success(`¡Bien! Picaste ${rewardName} (+${xpEarned} XP)`)
      } else {
        toast.info(`Recolectaste ${rewardName} (+${xpEarned} XP)`)
      }

      setCoins(c => c + coinsEarned)
      if (profile) {
        supabase.from('profiles').update({ xp: (profile.xp || 0) + xpEarned }).eq('id', profile.id)
        setProfile((p: any) => ({ ...p, xp: (p?.xp || 0) + xpEarned }))
      }
    }, 1200)
  }

  // Acción: Pescar
  const handleFish = () => {
    if (fishingCooldown > 0) {
      toast.error(`Espera ${fishingCooldown}s para volver a lanzar la caña.`)
      return
    }

    setIsFishing(true)
    playSound(350, 'sine', 0.2)

    setTimeout(() => {
      setIsFishing(false)
      setFishingCooldown(6)

      const rand = Math.random()
      let xpEarned = 30
      let coinsEarned = 15

      if (rand > 0.88) {
        playSound(950, 'triangle', 0.5)
        toast.success(`🦈 ¡HAS PESCADO UN TIBURÓN DORADO! (+280 XP, +180 Monedas)`)
        coinsEarned = 180
        xpEarned = 280
      } else if (rand > 0.5) {
        toast.success(`🐠 Pescaste una hermosa Trucha Arcoíris (+70 XP)`)
        coinsEarned = 35
        xpEarned = 70
      } else {
        toast.info(`🐟 Pescaste una sardina común (+30 XP)`)
      }

      setCoins(c => c + coinsEarned)
      if (profile) {
        supabase.from('profiles').update({ xp: (profile.xp || 0) + xpEarned }).eq('id', profile.id)
        setProfile((p: any) => ({ ...p, xp: (p?.xp || 0) + xpEarned }))
      }
    }, 1400)
  }

  // Vender ítem
  const handleSellItem = (item: InventoryItem) => {
    if (item.count <= 0) return
    const totalGained = item.sellPrice
    setCoins(c => c + totalGained)
    setInventory(prev => prev.map(i => i.id === item.id ? { ...i, count: i.count - 1 } : i).filter(i => i.count > 0))
    playSound(587, 'sine', 0.1)
    toast.success(`Vendiste 1x ${item.name} por +${totalGained} monedas`)
  }

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-6">
        
        {/* BANNER HEADER ESTILO PS5 */}
        <div className="relative rounded-3xl overflow-hidden border border-white/10 shadow-2xl mb-8 bg-zinc-950">
          <div 
            className="absolute inset-0 bg-cover bg-center opacity-40 filter saturate-150"
            style={{ backgroundImage: 'url("/images/game-rpg.jpg")' }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-transparent" />
          
          <div className="relative z-10 p-8 md:p-12 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="px-3 py-1 rounded-full text-xs font-black tracking-widest uppercase bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  SISTEMA RPG ACTIVO
                </span>
                <span className="text-white/60 text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                  <Compass className="w-3.5 h-3.5 text-amber-400" /> Reino de Ariel
                </span>
              </div>
              <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight uppercase">
                Aventura & <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">Recolección</span>
              </h1>
              <p className="text-zinc-300 text-sm md:text-base max-w-xl mt-2 font-medium">
                Explora las minas subterráneas, pesca criaturas abisales, forja equipamiento legendario y acumula fortuna con los panas.
              </p>
            </div>

            {/* ESTADÍSTICAS DEL JUGADOR */}
            <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-5 flex items-center gap-6 shadow-xl flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
                  <Coins className="w-6 h-6 text-amber-400" />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">Monedas de Oro</span>
                  <span className="text-2xl font-black text-amber-300 font-mono">{coins.toLocaleString()}</span>
                </div>
              </div>

              <div className="h-10 w-[1px] bg-white/10" />

              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">Nivel / XP</span>
                  <span className="text-2xl font-black text-white font-mono">{profile?.xp || 0} <span className="text-xs text-purple-400">XP</span></span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* NAVEGACIÓN POR PESTAÑAS */}
        <div className="flex gap-2 overflow-x-auto pb-4 mb-6 border-b border-white/10 hide-scrollbar">
          <button
            onClick={() => setActiveTab('mineria')}
            className={`px-6 py-3 rounded-xl font-black text-xs uppercase tracking-wider flex items-center gap-2.5 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'mineria'
                ? 'bg-amber-500 text-black shadow-[0_0_25px_rgba(245,158,11,0.4)] scale-105'
                : 'bg-zinc-900/80 text-zinc-300 hover:bg-zinc-800 border border-white/5'
            }`}
          >
            <Pickaxe className="w-4 h-4" /> Minería de Gemas
          </button>

          <button
            onClick={() => setActiveTab('pesca')}
            className={`px-6 py-3 rounded-xl font-black text-xs uppercase tracking-wider flex items-center gap-2.5 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'pesca'
                ? 'bg-cyan-500 text-black shadow-[0_0_25px_rgba(6,182,212,0.4)] scale-105'
                : 'bg-zinc-900/80 text-zinc-300 hover:bg-zinc-800 border border-white/5'
            }`}
          >
            <Fish className="w-4 h-4" /> Pesca Abisal
          </button>

          <button
            onClick={() => setActiveTab('mochila')}
            className={`px-6 py-3 rounded-xl font-black text-xs uppercase tracking-wider flex items-center gap-2.5 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'mochila'
                ? 'bg-emerald-500 text-black shadow-[0_0_25px_rgba(16,185,129,0.4)] scale-105'
                : 'bg-zinc-900/80 text-zinc-300 hover:bg-zinc-800 border border-white/5'
            }`}
          >
            <Backpack className="w-4 h-4" /> Mochila ({inventory.reduce((a, b) => a + b.count, 0)})
          </button>

          <button
            onClick={() => setActiveTab('forja')}
            className={`px-6 py-3 rounded-xl font-black text-xs uppercase tracking-wider flex items-center gap-2.5 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'forja'
                ? 'bg-rose-500 text-black shadow-[0_0_25px_rgba(244,63,94,0.4)] scale-105'
                : 'bg-zinc-900/80 text-zinc-300 hover:bg-zinc-800 border border-white/5'
            }`}
          >
            <Hammer className="w-4 h-4" /> Herrería & Mejoras
          </button>
        </div>

        {/* CONTENIDO DE PESTAÑAS */}

        {/* 1. MINERÍA */}
        {activeTab === 'mineria' && (
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Mina 1: Caverna de Piedra */}
              <div className="bg-gradient-to-b from-zinc-900 to-black border border-white/10 rounded-2xl p-6 relative overflow-hidden group hover:border-amber-500/50 transition-all">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <span className="text-[11px] font-bold text-amber-400 uppercase tracking-widest">Nivel 1 Requerido</span>
                    <h3 className="text-xl font-black text-white mt-1">Caverna de Piedra</h3>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                    <Pickaxe className="w-5 h-5 text-amber-400" />
                  </div>
                </div>

                <p className="text-zinc-400 text-xs mb-6 leading-relaxed">
                  Rica en carbón, hierro común y vetas menores de cobre. Ideal para principiantes.
                </p>

                <div className="bg-black/50 rounded-xl p-3 border border-white/5 mb-6 text-xs text-zinc-300 space-y-1">
                  <div className="flex justify-between"><span>Probabilidad Carbón:</span> <span className="font-bold text-white">70%</span></div>
                  <div className="flex justify-between"><span>Probabilidad Hierro:</span> <span className="font-bold text-white">25%</span></div>
                  <div className="flex justify-between"><span>Gemas raras:</span> <span className="font-bold text-amber-400">5%</span></div>
                </div>

                <button
                  disabled={isMining || miningCooldown > 0}
                  onClick={() => handleMine('Caverna de Piedra', 1)}
                  className={`w-full py-3.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center gap-2 ${
                    miningCooldown > 0
                      ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                      : isMining 
                      ? 'bg-amber-600 text-white animate-pulse'
                      : 'bg-amber-500 hover:bg-amber-400 text-black shadow-lg shadow-amber-500/20'
                  }`}
                >
                  <Pickaxe className={`w-4 h-4 ${isMining ? 'animate-bounce' : ''}`} />
                  {isMining ? 'Picando roca...' : miningCooldown > 0 ? `Recargando (${miningCooldown}s)` : 'Picar en la Mina'}
                </button>
              </div>

              {/* Mina 2: Caverna de Oro y Obsidiana */}
              <div className="bg-gradient-to-b from-zinc-900 to-black border border-white/10 rounded-2xl p-6 relative overflow-hidden group hover:border-yellow-500/50 transition-all">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <span className="text-[11px] font-bold text-yellow-400 uppercase tracking-widest">Nivel 4 Requerido</span>
                    <h3 className="text-xl font-black text-white mt-1">Pozo de Oro & Rubí</h3>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-yellow-400" />
                  </div>
                </div>

                <p className="text-zinc-400 text-xs mb-6 leading-relaxed">
                  Profundidades ardientes con pepitas de oro puro, amatistas y gemas de alto valor.
                </p>

                <div className="bg-black/50 rounded-xl p-3 border border-white/5 mb-6 text-xs text-zinc-300 space-y-1">
                  <div className="flex justify-between"><span>Probabilidad Oro:</span> <span className="font-bold text-white">45%</span></div>
                  <div className="flex justify-between"><span>Rubíes y Amatistas:</span> <span className="font-bold text-white">35%</span></div>
                  <div className="flex justify-between"><span>Diamantes:</span> <span className="font-bold text-yellow-400">20%</span></div>
                </div>

                <button
                  disabled={isMining || miningCooldown > 0}
                  onClick={() => handleMine('Pozo de Oro', 4)}
                  className={`w-full py-3.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center gap-2 ${
                    miningCooldown > 0
                      ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                      : 'bg-yellow-500 hover:bg-yellow-400 text-black shadow-lg shadow-yellow-500/20'
                  }`}
                >
                  <Pickaxe className="w-4 h-4" /> Picar Veta de Oro
                </button>
              </div>

              {/* Mina 3: Abismo de Cristal Legendario */}
              <div className="bg-gradient-to-b from-purple-950/40 to-black border border-purple-500/30 rounded-2xl p-6 relative overflow-hidden group hover:border-purple-400 transition-all">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <span className="text-[11px] font-bold text-purple-400 uppercase tracking-widest">Zona Épica • Lvl 8</span>
                    <h3 className="text-xl font-black text-white mt-1">Abismo de Cristal</h3>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center">
                    <Flame className="w-5 h-5 text-purple-300" />
                  </div>
                </div>

                <p className="text-zinc-400 text-xs mb-6 leading-relaxed">
                  Cristales cósmicos y fragmentos de meteorito. ¡Recompensas colosales de XP y gemas!
                </p>

                <div className="bg-black/50 rounded-xl p-3 border border-white/5 mb-6 text-xs text-zinc-300 space-y-1">
                  <div className="flex justify-between"><span>Diamante Estelar:</span> <span className="font-bold text-purple-300">40%</span></div>
                  <div className="flex justify-between"><span>Materia Oscura:</span> <span className="font-bold text-rose-400">15%</span></div>
                  <div className="flex justify-between"><span>XP Multiplicado:</span> <span className="font-bold text-emerald-400">x3</span></div>
                </div>

                <button
                  disabled={isMining || miningCooldown > 0}
                  onClick={() => handleMine('Abismo de Cristal', 8)}
                  className="w-full py-3.5 rounded-xl font-black text-xs uppercase tracking-widest bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-lg shadow-purple-500/30 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-4 h-4" /> Explorar Abismo
                </button>
              </div>

            </div>
          </motion.div>
        )}

        {/* 2. PESCA */}
        {activeTab === 'pesca' && (
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="bg-gradient-to-r from-cyan-950/40 to-blue-950/40 border border-cyan-500/30 rounded-3xl p-8 flex flex-col md:flex-row items-center justify-between gap-6">
              <div>
                <span className="text-cyan-400 text-xs font-black uppercase tracking-widest">Lago Sereno de los Panas</span>
                <h3 className="text-3xl font-black text-white mt-1">Pesca de Criaturas Acuáticas</h3>
                <p className="text-zinc-300 text-sm max-w-lg mt-2">
                  Lanza el anzuelo y atrapa desde salmones comunes hasta legendarios tiburones dorados que puedes vender por miles de monedas.
                </p>
              </div>

              <button
                disabled={isFishing || fishingCooldown > 0}
                onClick={handleFish}
                className={`px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all cursor-pointer flex items-center gap-3 ${
                  fishingCooldown > 0
                    ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                    : isFishing
                    ? 'bg-cyan-600 text-white animate-pulse'
                    : 'bg-cyan-500 hover:bg-cyan-400 text-black shadow-xl shadow-cyan-500/30 hover:scale-105'
                }`}
              >
                <Fish className={`w-5 h-5 ${isFishing ? 'animate-spin' : ''}`} />
                {isFishing ? 'Pescando...' : fishingCooldown > 0 ? `Espera (${fishingCooldown}s)` : 'Lanzar Caña al Agua'}
              </button>
            </div>
          </motion.div>
        )}

        {/* 3. MOCHILA E INVENTARIO */}
        {activeTab === 'mochila' && (
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-black text-white uppercase tracking-wider">Objetos en tu Mochila</h3>
              <span className="text-xs text-zinc-400 font-bold">Capacidad: {inventory.reduce((a, b) => a + b.count, 0)} / 100</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {inventory.map(item => (
                <div key={item.id} className="bg-zinc-900/90 border border-white/10 rounded-2xl p-4 flex flex-col justify-between hover:border-amber-500/40 transition-all">
                  <div className="text-center py-2">
                    <span className="text-4xl block mb-2">{item.icon}</span>
                    <h4 className="text-xs font-black text-white">{item.name}</h4>
                    <span className="text-[11px] font-mono text-amber-400 block mt-1">x{item.count}</span>
                  </div>

                  <button
                    onClick={() => handleSellItem(item)}
                    className="w-full mt-3 py-1.5 bg-black hover:bg-amber-500 hover:text-black text-amber-400 text-[10px] font-black uppercase tracking-wider rounded-lg border border-amber-500/30 transition-colors cursor-pointer flex items-center justify-center gap-1"
                  >
                    Vender (+{item.sellPrice} 🪙)
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* 4. FORJA & HERRERÍA */}
        {activeTab === 'forja' && (
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="bg-gradient-to-r from-rose-950/30 to-amber-950/30 border border-rose-500/30 rounded-3xl p-8">
              <span className="text-rose-400 text-xs font-black uppercase tracking-widest">Taller del Herrero</span>
              <h3 className="text-3xl font-black text-white mt-1">Mejora tus Herramientas</h3>
              <p className="text-zinc-300 text-sm max-w-xl mt-2 mb-6">
                Forja picos de hierro, cañas con sedal de fibra cósmica y mochilas con mayor almacenamiento.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-black/60 border border-white/10 p-5 rounded-2xl flex items-center justify-between">
                  <div>
                    <h4 className="font-black text-white text-sm">Pico de Diamante Refinado</h4>
                    <p className="text-xs text-zinc-400 mt-1">Reduce el tiempo de minería a 3 segundos y da +50% XP.</p>
                    <span className="text-amber-400 font-bold text-xs mt-2 block">Costo: 500 Monedas + 2 Diamantes</span>
                  </div>
                  <button 
                    onClick={() => toast.success('¡Pico de Diamante equipado con éxito!')}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-black text-xs uppercase tracking-wider rounded-xl cursor-pointer"
                  >
                    Forjar
                  </button>
                </div>

                <div className="bg-black/60 border border-white/10 p-5 rounded-2xl flex items-center justify-between">
                  <div>
                    <h4 className="font-black text-white text-sm">Mochila Reforzada XL</h4>
                    <p className="text-xs text-zinc-400 mt-1">Aumenta la capacidad máxima de tu inventario a 200 espacios.</p>
                    <span className="text-amber-400 font-bold text-xs mt-2 block">Costo: 300 Monedas</span>
                  </div>
                  <button 
                    onClick={() => toast.success('¡Mochila ampliada a 200 espacios!')}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs uppercase tracking-wider rounded-xl cursor-pointer"
                  >
                    Mejorar
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

      </div>
    </MainLayout>
  )
}
