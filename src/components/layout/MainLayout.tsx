'use client'

import { PS5Navbar } from "./PS5Navbar"
import { FloatingControls } from "./FloatingControls"
import { ReactNode, useState, useEffect } from "react"
import { Toaster, toast } from "sonner"
import { motion, AnimatePresence } from "framer-motion"
import { Gamepad2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { usePathname, useRouter } from "next/navigation"
import { useWallUnread } from "@/hooks/useWallUnread"
import { useTrophyToasts } from "@/hooks/useTrophyToasts"

export function MainLayout({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(false)
  const [globalTheme, setGlobalTheme] = useState('cyan')
  const [activeLFGAlert, setActiveLFGAlert] = useState<any>(null)
  const pathname = usePathname()
  const router = useRouter()

  const supabase = createClient()

  // Escuchar y disparar notificaciones de trofeos PS5
  useTrophyToasts()

  useEffect(() => {
    useWallUnread.getState().init()
    const unsub = useWallUnread.subscribe((state) => {
      if (state.ready && state.count > 0) {
        try {
          if (!sessionStorage.getItem('wall-toast')) {
            sessionStorage.setItem('wall-toast', 'true')
            toast(`📰 Tienes ${state.count} ${state.count === 1 ? 'publicación nueva' : 'publicaciones nuevas'} en el Muro`, {
              action: {
                label: 'Ver Muro',
                onClick: () => router.push('/muro')
              }
            })
          }
        } catch {}
      }
    })
    return () => unsub()
  }, [router])

  // Alarma acústica potente generada por Web Audio API
  const playLoudAlarmSound = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      if (!AudioCtx) return
      const ctx = new AudioCtx()
      const now = ctx.currentTime
      for (let i = 0; i < 4; i++) {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sawtooth'
        
        osc.frequency.setValueAtTime(587.33, now + i * 0.35)
        osc.frequency.exponentialRampToValueAtTime(880, now + i * 0.35 + 0.18)
        osc.frequency.exponentialRampToValueAtTime(440, now + i * 0.35 + 0.32)
        
        gain.gain.setValueAtTime(0.5, now + i * 0.35)
        gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.35 + 0.34)
        
        osc.connect(gain)
        gain.connect(ctx.destination)
        
        osc.start(now + i * 0.35)
        osc.stop(now + i * 0.35 + 0.35)
      }
    } catch (e) {
      console.error('Error al generar sonido de alarma', e)
    }
  }

  useEffect(() => {
    const savedTheme = localStorage.getItem('globalTheme')
    if (savedTheme) setGlobalTheme(savedTheme)

    if (typeof window !== 'undefined' && !sessionStorage.getItem('appLoaded')) {
      setLoading(true)
      const timer = setTimeout(() => {
        setLoading(false)
        sessionStorage.setItem('appLoaded', 'true')
      }, 2000)
    }

    const channel = supabase.channel('global:notifications')
      .on('broadcast', { event: 'lfg' }, (payload) => {
        const { user, game, message } = payload.payload
        setActiveLFGAlert({ user, game, message })
        playLoudAlarmSound()
        
        // Auto-cerrar después de 12 segundos
        setTimeout(() => {
          setActiveLFGAlert(null)
        }, 12000)
      })
      .subscribe()

    const handleThemeChange = (e: any) => {
      setGlobalTheme(e.detail)
      localStorage.setItem('globalTheme', e.detail)
    }
    window.addEventListener('themeChanged', handleThemeChange)

    return () => { 
      supabase.removeChannel(channel)
      window.removeEventListener('themeChanged', handleThemeChange)
    }
  }, [])

  const isHome = pathname === '/'

  const themeGradients: Record<string, string> = {
    cyan: 'from-cyan-900/60 via-black to-blue-900/60',
    pink: 'from-pink-900/60 via-black to-purple-900/60',
    emerald: 'from-emerald-900/60 via-black to-teal-900/60',
    purple: 'from-purple-900/60 via-black to-indigo-900/60',
    orange: 'from-orange-900/60 via-black to-red-900/60'
  }

  const orbColors: Record<string, string> = {
    cyan: 'bg-cyan-500 shadow-cyan-500',
    pink: 'bg-pink-500 shadow-pink-500',
    emerald: 'bg-emerald-500 shadow-emerald-500',
    purple: 'bg-purple-500 shadow-purple-500',
    orange: 'bg-orange-500 shadow-orange-500'
  }

  return (
    <>
      {/* ALERTA GIGANTE DE JUEGO (Llamativa y con Alarma) */}
      <AnimatePresence>
        {activeLFGAlert && (
          <motion.div
            initial={{ y: -150, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -150, opacity: 0, scale: 0.9 }}
            className="fixed top-6 inset-x-4 max-w-2xl mx-auto z-[999999] bg-gradient-to-r from-red-600 via-rose-700 to-black border-2 border-red-400 rounded-3xl p-6 shadow-[0_0_100px_rgba(239,68,68,0.9)] backdrop-blur-2xl text-white flex items-center justify-between gap-6"
          >
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center flex-shrink-0 animate-bounce">
                <Gamepad2 className="w-10 h-10 text-yellow-300 drop-shadow-[0_0_15px_rgba(253,224,71,0.8)]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-400 animate-ping" />
                  <span className="text-xs font-black uppercase tracking-[0.2em] text-red-200">
                    ¡CONVOCATORIA PARA JUGAR!
                  </span>
                </div>
                <h3 className="text-2xl font-black text-white mt-1 leading-tight">
                  <span className="text-yellow-300">{activeLFGAlert.user}</span> invita a todos a:
                </h3>
                <p className="text-xl font-black uppercase tracking-wider text-white bg-black/40 px-3 py-1 rounded-lg inline-block mt-2 border border-white/10">
                  🎮 {activeLFGAlert.game}
                </p>
                {activeLFGAlert.message && (
                  <p className="text-xs text-red-200 font-bold mt-1">"{activeLFGAlert.message}"</p>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button 
                onClick={() => setActiveLFGAlert(null)}
                className="bg-black/60 hover:bg-black text-white/80 hover:text-white px-4 py-2 rounded-xl text-xs font-bold transition-all border border-white/10 cursor-pointer"
              >
                Cerrar (X)
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={`flex min-h-screen relative overflow-x-hidden ${isHome ? 'overflow-y-auto' : 'overflow-hidden'} bg-black text-white font-sans selection:bg-white/30 ${isHome ? '' : 'bg-gradient-to-br ' + themeGradients[globalTheme]} transition-colors duration-1000`}>
        
        <AnimatePresence>
          {loading && (
            <motion.div 
              initial={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8, ease: "easeInOut" }}
              className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center"
            >
              <motion.div
                animate={{ scale: [1, 1.2, 1], rotate: [0, 5, -5, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className={`text-${globalTheme}-500 mb-6 drop-shadow-[0_0_20px_rgba(255,255,255,0.3)]`}
              >
                <Gamepad2 className="w-20 h-20" />
              </motion.div>
              <h1 className={`text-3xl font-black tracking-widest uppercase bg-clip-text text-transparent bg-gradient-to-r from-${globalTheme}-500 to-white`}>
                Conectando al Servidor...
              </h1>
            </motion.div>
          )}
        </AnimatePresence>

        
        {/* Fondo Principal de Ariel Hero (en páginas internas; en Home se usa el dinámico PS5) */}
        {!isHome && (
          <div 
            className="fixed inset-0 z-0 bg-cover bg-right md:bg-center pointer-events-none transition-all duration-1000"
            style={{ backgroundImage: 'url("/images/ariel-hero.png")' }}
          >
            <div className="absolute inset-0 bg-black/85" />
          </div>
        )}

        <div className={`fixed inset-0 z-0 pointer-events-none overflow-hidden ${isHome ? 'hidden' : 'block'}`}>
          <motion.div 
            animate={{ x: [0, 100, -100, 0], y: [0, -50, 50, 0] }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className={`absolute top-1/4 left-1/4 w-96 h-96 ${orbColors[globalTheme]} rounded-full blur-[140px] opacity-25`} 
          />
          <motion.div 
            animate={{ x: [0, -100, 100, 0], y: [0, 50, -50, 0] }}
            transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
            className={`absolute bottom-1/4 right-1/4 w-96 h-96 ${orbColors[globalTheme]} rounded-full blur-[140px] opacity-20`} 
          />
        </div>

        <PS5Navbar currentTheme={globalTheme} />
        
        <main className={`flex-1 w-full relative z-10 ${isHome ? 'pt-20 pb-4' : 'pt-24 pb-20'}`}>
          {children}
        </main>

        <FloatingControls />
        <Toaster position="bottom-right" theme="dark" richColors />
      </div>
    </>
  )
}
