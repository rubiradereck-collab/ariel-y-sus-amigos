'use client'

import { MainLayout } from "@/components/layout/MainLayout"
import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Battery, BatteryCharging, BatteryWarning, Trophy, RefreshCw, Skull, Play } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"

export default function FNAFMinigame() {
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(12) // 12 AM to 6 AM (60 seconds = 1 hour per 10s)
  const [power, setPower] = useState(100)
  const [leftDoorClosed, setLeftDoorClosed] = useState(false)
  const [rightDoorClosed, setRightDoorClosed] = useState(false)
  const [animatronicPos, setAnimatronicPos] = useState<'far' | 'approaching' | 'left_door' | 'right_door' | 'jumpscare'>('far')
  
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const powerRef = useRef<NodeJS.Timeout | null>(null)
  const animatronicRef = useRef<NodeJS.Timeout | null>(null)
  
  // Game loop
  useEffect(() => {
    if (!playing) return

    // 1 Hour = 10 Seconds
    timerRef.current = setInterval(() => {
      setTime(t => {
        if (t === 5) {
          endGame(true)
          return 6
        }
        return t === 12 ? 1 : t + 1
      })
    }, 10000)

    // Power Drain
    powerRef.current = setInterval(() => {
      setPower(p => {
        let drain = 1
        if (leftDoorClosed) drain += 2
        if (rightDoorClosed) drain += 2
        
        const newPower = p - drain
        if (newPower <= 0) {
          triggerJumpscare()
          return 0
        }
        return newPower
      })
    }, 1000)

    // Animatronic AI
    animatronicRef.current = setInterval(() => {
      setAnimatronicPos(pos => {
        const rand = Math.random()
        
        if (pos === 'far') {
          return rand > 0.6 ? 'approaching' : 'far'
        } else if (pos === 'approaching') {
          if (rand > 0.5) return 'left_door'
          if (rand > 0.2) return 'right_door'
          return 'approaching'
        } else if (pos === 'left_door') {
          if (leftDoorClosed) {
            toast.success("¡Detuviste a Bonnie!")
            return 'far' // blocked!
          } else {
            triggerJumpscare()
            return 'jumpscare'
          }
        } else if (pos === 'right_door') {
          if (rightDoorClosed) {
            toast.success("¡Detuviste a Chica!")
            return 'far' // blocked!
          } else {
            triggerJumpscare()
            return 'jumpscare'
          }
        }
        return pos
      })
    }, 3000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (powerRef.current) clearInterval(powerRef.current)
      if (animatronicRef.current) clearInterval(animatronicRef.current)
    }
  }, [playing, leftDoorClosed, rightDoorClosed])

  const triggerJumpscare = () => {
    setPlaying(false)
    setAnimatronicPos('jumpscare')
    if (timerRef.current) clearInterval(timerRef.current)
    if (powerRef.current) clearInterval(powerRef.current)
    if (animatronicRef.current) clearInterval(animatronicRef.current)
    
    const audio = new Audio('https://www.myinstants.com/media/sounds/fnaf-jumpscare-sound.mp3')
    audio.volume = 1
    audio.play().catch(() => {})
    
    toast.error("¡GAME OVER! Sobreviviste hasta las " + time + " AM")
  }

  const endGame = (win: boolean) => {
    setPlaying(false)
    if (timerRef.current) clearInterval(timerRef.current)
    if (powerRef.current) clearInterval(powerRef.current)
    if (animatronicRef.current) clearInterval(animatronicRef.current)
    
    if (win) {
      toast.success("¡6 AM! Sobreviviste la noche. (+1000 XP)")
      const audio = new Audio('https://www.myinstants.com/media/sounds/fnaf-6-am.mp3')
      audio.volume = 1
      audio.play().catch(() => {})
    }
  }

  const startGame = () => {
    setPlaying(true)
    setTime(12)
    setPower(100)
    setLeftDoorClosed(false)
    setRightDoorClosed(false)
    setAnimatronicPos('far')
  }

  return (
    <MainLayout>
      <div className="w-full max-w-6xl mx-auto px-4 py-8 flex flex-col items-center">
        
        <header className="mb-8 text-center">
          <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-600 to-orange-600 uppercase tracking-widest mb-2 drop-shadow-[0_0_20px_rgba(220,38,38,0.8)]">
            Five Nights At Arcade
          </h1>
          <p className="text-red-200/60 font-bold">Cierra las puertas cuando se acerquen. Vigila tu energía.</p>
        </header>

        {/* Game Container */}
        <div className="relative w-full max-w-4xl aspect-video bg-black rounded-3xl border-4 border-zinc-900 overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.8)]">
          
          {/* Background Office Image */}
          <div 
            className={`absolute inset-0 bg-cover bg-center transition-opacity duration-300 ${power <= 0 ? 'opacity-10' : 'opacity-100'}`}
            style={{ backgroundImage: 'url("/images/fnaf-office.png")' }}
          />
          
          {/* Static overlay */}
          <div className="absolute inset-0 opacity-10 pointer-events-none mix-blend-screen" style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/tv-noise.png")' }} />

          {/* JUMPSCARE */}
          <AnimatePresence>
            {animatronicPos === 'jumpscare' && (
              <motion.div 
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: [1, 1.5, 1.2, 1.8], opacity: [0, 1, 1, 1], x: [0, -50, 50, 0] }}
                transition={{ duration: 0.5 }}
                className="absolute inset-0 z-50 flex items-center justify-center bg-black/80"
              >
                <Skull className="w-64 h-64 text-red-600 animate-pulse drop-shadow-[0_0_50px_rgba(220,38,38,1)]" />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Game UI */}
          {playing && power > 0 && (
            <div className="absolute inset-0 z-10 pointer-events-none">
              
              {/* Top HUD */}
              <div className="absolute top-4 left-6 text-white font-black text-3xl font-mono flex flex-col items-start drop-shadow-[0_2px_2px_rgba(0,0,0,1)]">
                <span className="text-4xl">{time} AM</span>
                <span className="text-sm mt-1">Noche 1</span>
              </div>
              
              <div className="absolute top-4 right-6 flex flex-col items-end gap-1 drop-shadow-[0_2px_2px_rgba(0,0,0,1)]">
                <div className="text-white font-black text-2xl font-mono flex items-center gap-2">
                  Power left: {power}% {power < 20 ? <BatteryWarning className="w-6 h-6 text-red-500 animate-pulse" /> : <Battery className="w-6 h-6 text-emerald-500" />}
                </div>
                <div className="text-red-500 font-bold font-mono text-sm">
                  Usage: {1 + (leftDoorClosed ? 2 : 0) + (rightDoorClosed ? 2 : 0)} bars
                </div>
              </div>

              {/* Animatronic Indicators (Fake cameras) */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-black/80 border border-white/20 px-6 py-2 rounded-xl backdrop-blur-md pointer-events-auto">
                <div className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Sensores:</div>
                <div className="flex gap-2">
                  <div className={`w-3 h-3 rounded-full ${animatronicPos === 'left_door' ? 'bg-red-500 animate-ping shadow-[0_0_10px_rgba(220,38,38,1)]' : 'bg-zinc-700'}`} />
                  <div className={`w-3 h-3 rounded-full ${animatronicPos === 'approaching' ? 'bg-yellow-500 animate-pulse shadow-[0_0_10px_rgba(234,179,8,1)]' : 'bg-zinc-700'}`} />
                  <div className={`w-3 h-3 rounded-full ${animatronicPos === 'right_door' ? 'bg-red-500 animate-ping shadow-[0_0_10px_rgba(220,38,38,1)]' : 'bg-zinc-700'}`} />
                </div>
              </div>

              {/* Doors Controls */}
              <div className="absolute inset-y-0 left-0 w-32 flex items-center pointer-events-auto group">
                <button 
                  onClick={() => setLeftDoorClosed(!leftDoorClosed)}
                  className={`ml-4 px-4 py-8 rounded-xl font-black text-white border-2 uppercase tracking-widest transition-all shadow-[0_0_30px_rgba(0,0,0,0.8)] ${leftDoorClosed ? 'bg-red-600 border-red-400' : 'bg-green-600 border-green-400 opacity-50 hover:opacity-100'}`}
                >
                  {leftDoorClosed ? 'OPEN' : 'DOOR'}
                </button>
                {/* Visual Door Left */}
                <div className={`absolute top-0 bottom-0 left-0 w-48 bg-zinc-800 border-r-8 border-zinc-950 transition-transform duration-500 ease-in-out z-[-1] pointer-events-none ${leftDoorClosed ? 'translate-x-0' : '-translate-x-full'}`} style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 40px, rgba(0,0,0,0.2) 40px, rgba(0,0,0,0.2) 80px)' }} />
              </div>

              <div className="absolute inset-y-0 right-0 w-32 flex items-center justify-end pointer-events-auto group">
                <button 
                  onClick={() => setRightDoorClosed(!rightDoorClosed)}
                  className={`mr-4 px-4 py-8 rounded-xl font-black text-white border-2 uppercase tracking-widest transition-all shadow-[0_0_30px_rgba(0,0,0,0.8)] ${rightDoorClosed ? 'bg-red-600 border-red-400' : 'bg-green-600 border-green-400 opacity-50 hover:opacity-100'}`}
                >
                  {rightDoorClosed ? 'OPEN' : 'DOOR'}
                </button>
                {/* Visual Door Right */}
                <div className={`absolute top-0 bottom-0 right-0 w-48 bg-zinc-800 border-l-8 border-zinc-950 transition-transform duration-500 ease-in-out z-[-1] pointer-events-none ${rightDoorClosed ? 'translate-x-0' : 'translate-x-full'}`} style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 40px, rgba(0,0,0,0.2) 40px, rgba(0,0,0,0.2) 80px)' }} />
              </div>

            </div>
          )}

          {/* Menus */}
          <AnimatePresence>
            {!playing && (
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 z-40 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-8"
              >
                {animatronicPos === 'jumpscare' ? (
                  <div className="text-center">
                    <h2 className="text-6xl font-black text-red-600 mb-4 drop-shadow-[0_0_30px_rgba(220,38,38,0.8)] uppercase">Estás muerto</h2>
                    <p className="text-zinc-400 text-xl mb-8">Sobreviviste hasta las {time} AM</p>
                    <button onClick={startGame} className="bg-red-600 hover:bg-red-500 text-white font-black px-8 py-4 rounded-xl flex items-center gap-2 mx-auto uppercase tracking-widest transition-transform hover:scale-110">
                      <RefreshCw className="w-6 h-6" /> Intentar de nuevo
                    </button>
                  </div>
                ) : time === 6 ? (
                  <div className="text-center">
                    <h2 className="text-6xl font-black text-emerald-400 mb-4 drop-shadow-[0_0_30px_rgba(16,185,129,0.8)]">6:00 AM</h2>
                    <p className="text-zinc-300 text-xl mb-8 font-bold">+1000 XP Añadidos a tu cuenta</p>
                    <button onClick={startGame} className="bg-emerald-600 hover:bg-emerald-500 text-white font-black px-8 py-4 rounded-xl flex items-center gap-2 mx-auto uppercase tracking-widest transition-transform hover:scale-110">
                      <Trophy className="w-6 h-6" /> Jugar Noche 2
                    </button>
                  </div>
                ) : (
                  <div className="text-center max-w-lg">
                    <h2 className="text-3xl font-black text-white mb-6 uppercase tracking-widest border-b border-white/20 pb-4">Instrucciones</h2>
                    <ul className="text-zinc-300 text-left space-y-4 mb-8 text-lg">
                      <li>🔋 <strong className="text-red-400">Energía Limitada:</strong> Empiezas con 100%. Usar puertas gasta energía más rápido.</li>
                      <li>🚪 <strong className="text-blue-400">Puertas:</strong> Ciérralas SOLO cuando los sensores (rojos) indiquen peligro.</li>
                      <li>🕒 <strong className="text-emerald-400">Objetivo:</strong> Sobrevive hasta las 6 AM (60 segundos reales).</li>
                    </ul>
                    <button onClick={startGame} className="w-full bg-white hover:bg-zinc-300 text-black font-black px-8 py-4 rounded-xl flex items-center justify-center gap-2 uppercase tracking-widest transition-transform hover:scale-105 text-xl">
                      <Play className="w-6 h-6" /> INICIAR NOCHE 1
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

        </div>
        
        <div className="mt-8">
          <Link href="/arcade" className="text-zinc-500 font-bold hover:text-white transition-colors underline">
            Volver al Arcade
          </Link>
        </div>
      </div>
    </MainLayout>
  )
}

