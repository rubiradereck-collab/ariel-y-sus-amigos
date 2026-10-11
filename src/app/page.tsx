'use client'

import { MainLayout } from "@/components/layout/MainLayout"
import { motion } from "framer-motion"
import Link from "next/link"
import { Play, MessageSquare, Gamepad2, ImageIcon, Users, ChevronRight } from "lucide-react"

const shortcuts = [
  { name: 'ENTRAR AL CHAT', desc: 'SISTEMA RPG ACTIVO', path: '/chat', image: '/images/card1.jpg' },
  { name: 'ARCADE', desc: 'MINIJUEGOS', path: '/arcade', image: '/images/card2.jpg' },
  { name: 'MEMES & GALERÍA', desc: 'NUESTROS RECUERDOS', path: '/memes', image: '/images/card3.jpg' },
  { name: 'PERFILES', desc: 'LOS PANAS', path: '/profiles', image: '/images/card4.jpg' },
]

export default function Home() {
  return (
    <MainLayout>
      <div className="absolute inset-0 pt-24 flex flex-col justify-between overflow-hidden pointer-events-none">
        
        {/* TITULO ESTILO SPIDER-MAN (Limpio, sin cajas oscuras) */}
        <div className="px-12 md:px-24 pt-12 md:pt-20 pointer-events-auto w-full max-w-7xl mx-auto flex-1">
          <motion.div 
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 1, delay: 0.2 }}
          >
            <div className="flex items-center gap-6 mb-4">
              <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl flex-shrink-0 bg-black/60 backdrop-blur-md">
                <img src="/images/DyD.jpg" alt="Logo DyD" className="w-full h-full object-cover" />
              </div>
              <h1 className="text-6xl md:text-[6rem] font-black leading-[0.85] text-white tracking-tighter drop-shadow-2xl">
                ARIEL Y SUS<br/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-red-700">AMIGOS</span>
              </h1>
            </div>
            <div className="mt-4 flex items-center gap-4">
              <span className="px-3 py-1 border border-white/30 text-white/80 text-xs font-bold tracking-widest uppercase rounded-full backdrop-blur-md">
                (Y Joel)
              </span>
              <p className="text-white/90 text-sm md:text-base font-medium max-w-md drop-shadow-md">
                Servidor privado online. Modo cooperativo activado.
              </p>
            </div>
            
            <Link href="/chat">
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="mt-8 bg-red-600 hover:bg-red-500 text-white font-black px-8 py-3 rounded-full flex items-center gap-3 uppercase tracking-widest text-sm shadow-[0_0_30px_rgba(220,38,38,0.5)] transition-all"
              >
                <Play className="w-5 h-5 fill-current" /> Jugar Ahora
              </motion.button>
            </Link>
          </motion.div>
        </div>

        {/* CAROUSEL INFERIOR ESTILO SPIDER-MAN (Minimalista) */}
        <div className="w-full bg-gradient-to-t from-black via-black/90 to-transparent pt-12 pb-8 px-6 md:px-12 pointer-events-auto">
          <div className="max-w-[1800px] mx-auto">
            <h3 className="text-xs font-bold text-white/50 uppercase tracking-[0.2em] mb-4">Módulos Destacados</h3>
            
            <div className="flex gap-4 overflow-x-auto hide-scrollbar snap-x pb-4">
              {shortcuts.map((item, i) => (
                <Link key={i} href={item.path} className="snap-start flex-shrink-0">
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 + (i * 0.1) }}
                    className="relative w-64 md:w-80 h-32 md:h-40 rounded-xl overflow-hidden group cursor-pointer border border-white/10 hover:border-red-500/50 transition-colors"
                  >
                    <img src={item.image} alt={item.name} className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                    
                    <div className="absolute bottom-0 inset-x-0 p-4">
                      <p className="text-[10px] text-red-400 font-bold uppercase tracking-widest mb-1">{item.desc}</p>
                      <h4 className="text-white font-black uppercase text-sm md:text-base flex items-center justify-between">
                        {item.name}
                        <ChevronRight className="w-4 h-4 text-white/50 group-hover:text-white transition-colors" />
                      </h4>
                    </div>
                  </motion.div>
                </Link>
              ))}
            </div>
          </div>
        </div>

      </div>
    </MainLayout>
  )
}
