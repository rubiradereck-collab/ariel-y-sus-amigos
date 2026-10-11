'use client'

import { MainLayout } from "@/components/layout/MainLayout"
import { useState, useRef, useEffect } from "react"
import { motion } from "framer-motion"
import { createClient } from "@/lib/supabase/client"
import { Dices, Users, Plus, X, RotateCw, Trophy } from "lucide-react"

export default function RoulettePage() {
  const [options, setOptions] = useState<string[]>(['Dereck', 'Ariel', 'Andre', 'Jefferson', 'Santiago', 'Joel'])
  const [newOption, setNewOption] = useState('')
  const [isSpinning, setIsSpinning] = useState(false)
  const [winner, setWinner] = useState<string | null>(null)
  const [rotation, setRotation] = useState(0)
  const supabase = createClient()
  const [profile, setProfile] = useState<any>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase.from('profiles').select('*').eq('id', user.id).single().then(({ data }) => setProfile(data))
      }
    })
  }, [])

  const addOption = (e: React.FormEvent) => {
    e.preventDefault()
    if (newOption.trim() && !options.includes(newOption.trim())) {
      setOptions([...options, newOption.trim()])
      setNewOption('')
    }
  }

  const removeOption = (index: number) => {
    if (options.length <= 2) return alert("¡Necesitas al menos 2 opciones para la ruleta!")
    setOptions(options.filter((_, i) => i !== index))
  }

  const spin = async () => {
    if (isSpinning || options.length < 2) return
    setIsSpinning(true)
    setWinner(null)

    // Calculate rotation
    const spins = 5 // Full rotations
    const prizeIndex = Math.floor(Math.random() * options.length)
    const degreesPerSlice = 360 / options.length
    
    // El objetivo es caer en el prizeIndex (que el puntero arriba [0 grados] apunte al centro del trozo)
    // Para alinear el premio en la parte superior (0 grados), la ruleta debe girar negativamente o positivamente hacia el ángulo del premio
    const prizeAngle = (prizeIndex * degreesPerSlice) + (degreesPerSlice / 2)
    const targetRotation = rotation + (360 * spins) + (360 - (prizeAngle % 360)) + (Math.random() * (degreesPerSlice * 0.6) - (degreesPerSlice * 0.3)) // Pequeña aleatoriedad dentro del trozo

    setRotation(targetRotation)

    setTimeout(async () => {
      const selected = options[prizeIndex]
      setWinner(selected)
      setIsSpinning(false)

      // Guardar en la BD que jugó a la ruleta (+10 pts por jugar/girar)
      if (profile) {
        await supabase.from('game_scores').insert([
          { user_id: profile.id, game_type: 'roulette', score: 10 }
        ])
      }
    }, 5000) // Match the CSS transition duration
  }

  return (
    <MainLayout>
      <div className="w-full h-full max-w-6xl mx-auto px-4 pt-10 pb-32 overflow-y-auto hide-scrollbar flex flex-col md:flex-row gap-12">
        
        {/* Panel Izquierdo: Configuración */}
        <div className="w-full md:w-1/3 flex flex-col gap-6">
          <h1 className="text-4xl font-black uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-rose-600 drop-shadow-[0_0_15px_rgba(244,63,94,0.5)]">
            Ruleta del Caos
          </h1>
          <p className="text-zinc-400 font-medium">Configura las opciones y deja que el destino decida el próximo sacrificio.</p>

          <div className="bg-black/60 border border-white/10 rounded-3xl p-6 backdrop-blur-xl">
            <h3 className="text-white font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-pink-500" /> Opciones ({options.length})
            </h3>
            
            <form onSubmit={addOption} className="flex gap-2 mb-4">
              <input 
                type="text" 
                value={newOption}
                onChange={(e) => setNewOption(e.target.value)}
                placeholder="Añadir castigo o persona..."
                className="flex-1 bg-zinc-900 border border-white/10 rounded-xl px-4 py-2 text-white outline-none focus:border-pink-500"
              />
              <button type="submit" className="bg-pink-600 hover:bg-pink-500 text-white p-2 rounded-xl transition-colors">
                <Plus className="w-6 h-6" />
              </button>
            </form>

            <ul className="space-y-2 max-h-60 overflow-y-auto hide-scrollbar pr-2">
              {options.map((opt, i) => (
                <li key={i} className="flex justify-between items-center bg-white/5 border border-white/5 px-4 py-3 rounded-xl text-white">
                  <span className="font-bold">{opt}</span>
                  <button onClick={() => removeOption(i)} className="text-zinc-500 hover:text-red-400 transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Panel Derecho: Ruleta Visual */}
        <div className="w-full md:w-2/3 flex flex-col items-center justify-center">
          
          <div className="relative w-80 h-80 md:w-[500px] md:h-[500px] mb-10">
            {/* Puntero Superior */}
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-20 w-8 h-12 bg-white drop-shadow-[0_0_10px_rgba(255,255,255,0.8)]" style={{ clipPath: 'polygon(50% 100%, 0 0, 100% 0)' }} />

            {/* Círculo de la ruleta */}
            <div className="w-full h-full rounded-full border-8 border-zinc-800 shadow-[0_0_50px_rgba(244,63,94,0.3)] overflow-hidden relative" style={{ transform: `rotate(${rotation}deg)`, transition: 'transform 5s cubic-bezier(0.2, 0.8, 0.1, 1)' }}>
              {options.map((opt, index) => {
                const angle = 360 / options.length;
                const skewY = 90 - angle;
                // Colors rotation
                const colors = ['#ec4899', '#f43f5e', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b'];
                const bgColor = colors[index % colors.length];

                return (
                  <div
                    key={index}
                    className="absolute top-0 right-0 w-1/2 h-1/2 origin-bottom-left border border-black/20"
                    style={{
                      backgroundColor: bgColor,
                      transform: `rotate(${index * angle}deg) skewY(-${skewY}deg)`,
                    }}
                  >
                    <div 
                      className="absolute bottom-0 left-0 text-white font-black uppercase tracking-widest flex items-end justify-center pb-4 text-xs md:text-lg"
                      style={{ 
                        transform: `skewY(${skewY}deg) rotate(${angle / 2}deg) translateY(-80px)`, 
                        transformOrigin: 'bottom left',
                        width: '200px',
                        textShadow: '0 2px 4px rgba(0,0,0,0.8)'
                      }}
                    >
                      <span className="truncate max-w-[120px] md:max-w-[180px] -rotate-90 origin-left inline-block pl-20">{opt}</span>
                    </div>
                  </div>
                )
              })}
            </div>
            
            {/* Centro de la ruleta */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 bg-zinc-900 rounded-full border-4 border-white/20 z-10 flex items-center justify-center shadow-2xl">
              <div className="w-6 h-6 bg-pink-500 rounded-full animate-pulse" />
            </div>
          </div>

          {winner ? (
            <motion.div 
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-gradient-to-r from-pink-600 to-rose-600 px-8 py-6 rounded-3xl border-2 border-white/20 text-center shadow-[0_0_40px_rgba(244,63,94,0.6)]"
            >
              <h2 className="text-zinc-200 uppercase tracking-widest text-sm font-bold mb-1">El ganador / sacrificado es:</h2>
              <p className="text-4xl md:text-5xl font-black text-white">{winner}</p>
              <p className="text-xs text-white/60 mt-4">+10 XP de recompensa añadida a tus estadísticas.</p>
            </motion.div>
          ) : (
            <button 
              onClick={spin}
              disabled={isSpinning}
              className="bg-white text-black hover:bg-zinc-200 hover:scale-105 transition-all px-12 py-5 rounded-full font-black uppercase tracking-widest text-xl shadow-[0_0_30px_rgba(255,255,255,0.4)] disabled:opacity-50 disabled:hover:scale-100 flex items-center gap-3"
            >
              {isSpinning ? <RotateCw className="w-6 h-6 animate-spin" /> : <Dices className="w-6 h-6" />}
              {isSpinning ? 'Girando el destino...' : 'GIRAR LA RULETA'}
            </button>
          )}

        </div>

      </div>
    </MainLayout>
  )
}
