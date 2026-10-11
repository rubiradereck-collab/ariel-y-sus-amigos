'use client'

import { MainLayout } from "@/components/layout/MainLayout"
import { motion } from "framer-motion"
import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { ShoppingCart, Sparkles, Zap, Coins, Crown, PaintBucket, Ghost, Rocket } from "lucide-react"
import { toast } from "sonner"

const storeItems = [
  { id: 1, name: 'Nombre Dorado', type: 'Color', price: 5000, icon: <Crown className="w-8 h-8 text-yellow-500" />, desc: 'Haz que tu nombre brille en oro en el chat.' },
  { id: 2, name: 'Rango: Leyenda', type: 'Título', price: 10000, icon: <Sparkles className="w-8 h-8 text-purple-500" />, desc: 'Añade el título [LEYENDA] antes de tu nombre.' },
  { id: 3, name: 'Bomba de Sonido', type: 'Troleo', price: 1000, icon: <Zap className="w-8 h-8 text-blue-500" />, desc: 'Reproduce un sonido fuerte en la PC de todos al instante.' },
  { id: 4, name: 'Cambio de Tema VIP', type: 'Estética', price: 3000, icon: <PaintBucket className="w-8 h-8 text-pink-500" />, desc: 'Desbloquea el tema "Neon Hacker" para toda la página.' },
  { id: 5, name: 'Modo Fantasma', type: 'Utilidad', price: 8000, icon: <Ghost className="w-8 h-8 text-zinc-500" />, desc: 'Puedes leer el chat sin aparecer en la lista de conectados.' },
  { id: 6, name: 'Revivir en FNAF', type: 'Ventaja', price: 2000, icon: <Rocket className="w-8 h-8 text-red-500" />, desc: 'Empieza la noche con 150% de batería.' },
]

export default function TiendaPage() {
  
  const [xp, setXp] = useState<number>(0)
  const [profileId, setProfileId] = useState<string | null>(null)
  const [buying, setBuying] = useState<number | null>(null)
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setProfileId(user.id)
        supabase.from('profiles').select('xp').eq('id', user.id).single().then(({ data }) => {
          if (data) setXp(data.xp || 0)
        })
      }
    })
  }, [])

  const handleBuy = async (id: number, price: number, name: string) => {
    if (!profileId) return toast.error('Inicia sesión primero')
    if (xp < price) return toast.error('No tienes suficiente XP para comprar esto.')
    
    setBuying(id)
    const newXp = xp - price
    const { error } = await supabase.from('profiles').update({ xp: newXp }).eq('id', profileId)
    
    if (error) {
      toast.error('Error en la compra: ' + error.message)
    } else {
      setXp(newXp)
      toast.success(`¡Has comprado "${name}" exitosamente!`)
    }
    setBuying(null)
  }

  return (

    <MainLayout>
      <div className="w-full max-w-7xl mx-auto px-4 py-8">
        
        <header className="mb-12 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <h1 className="text-5xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 uppercase tracking-tighter flex items-center gap-4">
              <ShoppingCart className="w-12 h-12 text-yellow-500" /> Mercado Negro
            </h1>
            <p className="text-xl text-yellow-200/60 font-medium mt-2">
              Gasta tu XP de Minar, Pescar y sobrevivir a FNAF aquí.
            </p>
          </div>
          <div className="bg-black/80 border border-yellow-500/30 px-6 py-4 rounded-2xl flex items-center gap-4 shadow-[0_0_20px_rgba(234,179,8,0.2)]">
            <div className="bg-yellow-500/20 p-3 rounded-xl">
              <Coins className="w-8 h-8 text-yellow-500" />
            </div>
            <div>
              <span className="block text-xs font-black text-zinc-400 uppercase tracking-widest">Tu Saldo (XP)</span>
              <span className="text-3xl font-black text-white">{xp.toLocaleString()} XP</span>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {storeItems.map((item, i) => (
            <motion.div 
              key={item.id}
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
              className="bg-black/60 backdrop-blur-xl border border-white/10 p-6 rounded-3xl flex flex-col justify-between group hover:border-yellow-500/50 transition-all hover:-translate-y-2 hover:shadow-[0_10px_40px_rgba(234,179,8,0.15)]"
            >
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div className="bg-white/5 p-4 rounded-2xl border border-white/10 group-hover:bg-yellow-500/10 group-hover:border-yellow-500/30 transition-colors">
                    {item.icon}
                  </div>
                  <span className="bg-white/5 text-zinc-400 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border border-white/10">
                    {item.type}
                  </span>
                </div>
                <h3 className="text-2xl font-black text-white mb-2 uppercase tracking-wide">{item.name}</h3>
                <p className="text-zinc-400 font-medium text-sm leading-relaxed mb-6">{item.desc}</p>
              </div>
              
              <button 
                onClick={() => handleBuy(item.id, item.price, item.name)}
                disabled={buying === item.id}
                className="w-full bg-zinc-900 hover:bg-yellow-600 disabled:bg-zinc-800 disabled:opacity-50 text-white font-black px-6 py-4 rounded-xl flex items-center justify-between uppercase transition-colors group/btn border border-white/5"
              >
                <span>{buying === item.id ? 'Procesando...' : 'Comprar'}</span>
                <span className="flex items-center gap-2 text-yellow-500 group-hover/btn:text-white transition-colors">
                  <Coins className="w-4 h-4" /> {item.price.toLocaleString()} XP
                </span>
              </button>
            </motion.div>
          ))}
        </div>

      </div>
    </MainLayout>
  )
}
