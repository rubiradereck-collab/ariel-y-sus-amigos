'use client'

import { MainLayout } from "@/components/layout/MainLayout"
import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"
import { useState, useEffect, useRef } from "react"
import { 
  Play, MessageSquare, Gamepad2, ImageIcon, Users, ChevronRight, ChevronLeft,
  Pickaxe, Coins, Sparkles, Flame, Shield, ArrowRight
} from "lucide-react"

interface PS5Game {
  id: string
  titleLine1: string
  titleLine2: string
  subtitle: string
  tag: string
  desc: string
  path: string
  ctaText: string
  bgImage: string
  cardImage: string
  gradientText: string
  buttonGradient: string
  buttonShadow: string
  accentBorder: string
}

const games: PS5Game[] = [
  {
    id: 'chat',
    titleLine1: 'ARIEL Y SUS',
    titleLine2: 'AMIGOS',
    subtitle: 'SALA DE CHAT & CAOS',
    tag: '(Y JOEL)',
    desc: 'Frecuencia de chat en vivo, notas de voz y bot del caos. Conéctate con los panas.',
    path: '/chat',
    ctaText: 'Entrar al Chat',
    bgImage: '/images/ariel-hero.png',
    cardImage: '/images/ariel-hero.png',
    gradientText: 'from-red-500 via-rose-600 to-red-700',
    buttonGradient: 'from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600',
    buttonShadow: 'shadow-[0_0_35px_rgba(220,38,38,0.6)]',
    accentBorder: 'border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.5)]'
  },
  {
    id: 'aventura',
    titleLine1: 'CRÓNICAS DE LA',
    titleLine2: 'CAVERNA',
    subtitle: 'RPG DE RECOLECCIÓN & PESCA',
    tag: 'NIVEL 1 • AVENTURA',
    desc: 'Pico y caña en mano. Extrae gemas legendarias, pesca en aguas abisales y forja tu equipamiento.',
    path: '/aventura',
    ctaText: 'Explorar Minas',
    bgImage: '/images/game-rpg.jpg',
    cardImage: '/images/game-rpg.jpg',
    gradientText: 'from-amber-400 via-orange-500 to-yellow-500',
    buttonGradient: 'from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-black',
    buttonShadow: 'shadow-[0_0_35px_rgba(245,158,11,0.6)]',
    accentBorder: 'border-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.5)]'
  },
  {
    id: 'apuestas',
    titleLine1: 'CASINO ROYAL:',
    titleLine2: 'NEON HEIST',
    subtitle: 'DIAMOND BONANZA & MINES',
    tag: 'ALTO RIESGO • XP x100',
    desc: 'Arriesga tu fortuna en la Sweet Bonanza, busca gemas en el Buscaminas o dobla en Cara o Cruz.',
    path: '/apuestas',
    ctaText: 'Apostar Ahora',
    bgImage: '/images/game-casino.jpg',
    cardImage: '/images/game-casino.jpg',
    gradientText: 'from-fuchsia-400 via-pink-500 to-purple-400',
    buttonGradient: 'from-fuchsia-600 to-pink-600 hover:from-fuchsia-500 hover:to-pink-500',
    buttonShadow: 'shadow-[0_0_35px_rgba(236,72,153,0.6)]',
    accentBorder: 'border-pink-500 shadow-[0_0_20px_rgba(236,72,153,0.5)]'
  },
  {
    id: 'arcade',
    titleLine1: 'ARCADE KOMBAT:',
    titleLine2: 'LUCHA LEGENDS',
    subtitle: 'TORNEO DE MINIJUEGOS',
    tag: 'MULTI-PANAS • 1V1',
    desc: 'Ruleta Rusa de la Muerte, Trivia de los Panas, Adivina el Meme y Desafío FNAF.',
    path: '/arcade',
    ctaText: 'Jugar Arcade',
    bgImage: '/images/game-arcade.jpg',
    cardImage: '/images/game-arcade.jpg',
    gradientText: 'from-cyan-400 via-blue-500 to-indigo-500',
    buttonGradient: 'from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black',
    buttonShadow: 'shadow-[0_0_35px_rgba(6,182,212,0.6)]',
    accentBorder: 'border-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.5)]'
  },
  {
    id: 'memes',
    titleLine1: 'MIAMI MAYHEM:',
    titleLine2: 'FUEGO & FUN',
    subtitle: 'MUSEO DEL CAOS & MEMES',
    tag: 'HISTORIAL DEL GRUPO',
    desc: 'El museo definitivo de fotos prohibidas, capturas fuera de contexto y recuerdos legendarios.',
    path: '/memes',
    ctaText: 'Ver Museo de Memes',
    bgImage: '/images/game-memes.jpg',
    cardImage: '/images/game-memes.jpg',
    gradientText: 'from-yellow-300 via-amber-400 to-orange-500',
    buttonGradient: 'from-yellow-400 to-amber-500 hover:from-yellow-300 hover:to-amber-400 text-black',
    buttonShadow: 'shadow-[0_0_35px_rgba(234,179,8,0.6)]',
    accentBorder: 'border-yellow-400 shadow-[0_0_20px_rgba(234,179,8,0.5)]'
  },
  {
    id: 'profiles',
    titleLine1: 'NEON OPS:',
    titleLine2: 'NIGHTFALL',
    subtitle: 'ESCUADRÓN DE LOS 6 & PERFILES',
    tag: 'AGENTE TÁCTICO • STATS',
    desc: 'Dereck, Ariel, Andre, Jefferson, Santiago y Joel. Rangos, medallas, bio y personalización táctica.',
    path: '/profiles',
    ctaText: 'Ver Escuadrón',
    bgImage: '/images/game-chat.jpg',
    cardImage: '/images/game-chat.jpg',
    gradientText: 'from-cyan-400 via-teal-400 to-emerald-400',
    buttonGradient: 'from-cyan-500 to-teal-600 hover:from-cyan-400 hover:to-teal-500 text-black',
    buttonShadow: 'shadow-[0_0_35px_rgba(6,182,212,0.6)]',
    accentBorder: 'border-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.5)]'
  }
]

export default function Home() {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const activeGame = games[selectedIndex]
  const carouselContainerRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<(HTMLDivElement | null)[]>([])

  // Precarga de imágenes para 0 delay en el cambio de fondo
  useEffect(() => {
    games.forEach(g => {
      const img = new Image()
      img.src = g.bgImage
    })
  }, [])

  // Sonido acústico ultra-suave estilo PS5 Navigation al cambiar de juego
  const playPS5NavSound = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      if (!AudioCtx) return
      const ctx = new AudioCtx()
      const now = ctx.currentTime
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(520, now)
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.035)
      gain.gain.setValueAtTime(0.06, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.045)
    } catch (e) {}
  }

  // Centrar tarjeta seleccionada automáticamente en la pantalla
  useEffect(() => {
    const el = cardRefs.current[selectedIndex]
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
    }
  }, [selectedIndex])

  // Navegación con teclado estilo mando de PS5 (flechas izquierda/derecha)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        playPS5NavSound()
        setSelectedIndex(prev => (prev + 1) % games.length)
      } else if (e.key === 'ArrowLeft') {
        playPS5NavSound()
        setSelectedIndex(prev => (prev - 1 + games.length) % games.length)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleSelectGame = (index: number) => {
    if (index !== selectedIndex) {
      playPS5NavSound()
      setSelectedIndex(index)
    }
  }

  const handlePrevGame = () => {
    playPS5NavSound()
    setSelectedIndex(prev => (prev - 1 + games.length) % games.length)
  }

  const handleNextGame = () => {
    playPS5NavSound()
    setSelectedIndex(prev => (prev + 1) % games.length)
  }

  return (
    <MainLayout>
      {/* FONDO DINÁMICO PS5 CON CROSSFADE SUAVE */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeGame.id}
            initial={{ opacity: 0, scale: 1.04 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="absolute inset-0 bg-cover bg-center md:bg-right"
            style={{ backgroundImage: `url("${activeGame.bgImage}")` }}
          >
            {/* Viñeta cinematográfica PS5 y gradientes de legibilidad */}
            <div className="absolute inset-0 bg-gradient-to-r from-black via-black/55 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/75 to-transparent" />
            <div className="absolute inset-0 bg-black/20" />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* CONTENIDO PRINCIPAL */}
      <div className="relative z-10 min-h-[calc(100vh-5rem)] flex flex-col justify-between">
        
        {/* ÁREA HERO SUPERIOR: TÍTULO Y DETALLES DINÁMICOS */}
        <div className="px-5 md:px-14 pt-2 md:pt-6 max-w-5xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeGame.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.35 }}
              className="space-y-2.5 md:space-y-3.5"
            >
              {/* LOGO & SUBTÍTULO */}
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl flex-shrink-0 bg-black/80 backdrop-blur-md p-1">
                  <img src="/images/DyD.jpg" alt="Logo DyD" className="w-full h-full object-cover rounded-xl" />
                </div>
                <div>
                  <span className="text-[10px] md:text-xs font-black tracking-[0.25em] text-white/70 uppercase block">
                    {activeGame.subtitle}
                  </span>
                  <div className="flex items-center gap-2.5 mt-0.5">
                    <span className="px-2.5 py-0.5 border border-white/30 text-white text-[10px] md:text-[11px] font-black tracking-widest uppercase rounded-full backdrop-blur-md bg-white/10">
                      {activeGame.tag}
                    </span>
                    <span className="text-white/60 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                      PlayStation 5 Hub
                    </span>
                  </div>
                </div>
              </div>

              {/* TÍTULO GIGANTE CON COLOR NEÓN DEL JUEGO */}
              <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black leading-[0.92] text-white tracking-tighter drop-shadow-2xl uppercase">
                {activeGame.titleLine1}<br />
                <span className={`text-transparent bg-clip-text bg-gradient-to-r ${activeGame.gradientText}`}>
                  {activeGame.titleLine2}
                </span>
              </h1>

              {/* DESCRIPCIÓN */}
              <p className="text-white/90 text-xs sm:text-sm md:text-base font-medium max-w-lg drop-shadow-md leading-relaxed pt-0.5">
                {activeGame.desc}
              </p>

              {/* BOTÓN CTA PRINCIPAL Y CONTROLES */}
              <div className="pt-2 md:pt-3 flex items-center gap-4">
                <Link href={activeGame.path}>
                  <motion.button 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={`bg-gradient-to-r ${activeGame.buttonGradient} text-white font-black px-8 md:px-9 py-3 rounded-full flex items-center gap-2.5 uppercase tracking-widest text-xs md:text-sm ${activeGame.buttonShadow} transition-all cursor-pointer`}
                  >
                    <Play className="w-4 h-4 fill-current" /> {activeGame.ctaText}
                  </motion.button>
                </Link>

                <span className="text-[11px] text-white/50 font-mono hidden md:inline-flex items-center gap-1.5">
                  Navega con <kbd className="bg-white/15 px-2 py-0.5 rounded text-white font-bold">◀</kbd> <kbd className="bg-white/15 px-2 py-0.5 rounded text-white font-bold">▶</kbd> o flechas laterales
                </span>
              </div>

            </motion.div>
          </AnimatePresence>
        </div>

        {/* ESTANTERÍA INFERIOR DE JUEGOS ESTILO PS5 */}
        <div className="w-full bg-gradient-to-t from-black via-black/95 to-transparent pt-3 pb-3 md:pb-6 px-3 md:px-8 mt-2 md:mt-4">
          <div className="max-w-[1800px] mx-auto relative">
            
            {/* Cabecera del carrusel con indicador y navegación rápida */}
            <div className="flex items-center justify-between mb-2 md:mb-3 px-2">
              <div className="flex items-center gap-2.5">
                <h3 className="text-[11px] md:text-xs font-black text-white/80 uppercase tracking-[0.22em] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-yellow-400" /> Catálogo de Juegos Exclusivos
                </h3>
                <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/10 text-white/70 border border-white/15">
                  {games.length} Juegos Disponibles
                </span>
              </div>

              {/* Paginación de píldoras y flechas pequeñas */}
              <div className="flex items-center gap-2.5">
                <div className="flex items-center gap-1.5 mr-1">
                  {games.map((g, idx) => (
                    <button
                      key={g.id}
                      onClick={() => handleSelectGame(idx)}
                      className={`h-1.5 rounded-full transition-all cursor-pointer ${
                        selectedIndex === idx 
                          ? 'w-6 bg-white shadow-[0_0_8px_white]' 
                          : 'w-2 bg-white/30 hover:bg-white/60'
                      }`}
                      title={g.subtitle}
                    />
                  ))}
                </div>
                <span className="text-[11px] md:text-xs text-white/60 font-bold uppercase tracking-wider">
                  {selectedIndex + 1} / {games.length}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={handlePrevGame}
                    className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/25 border border-white/20 flex items-center justify-center text-white transition-all cursor-pointer"
                    title="Juego anterior"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleNextGame}
                    className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/25 border border-white/20 flex items-center justify-center text-white transition-all cursor-pointer"
                    title="Siguiente juego"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* CARRUSEL CON BOTONES FLOTANTES LATERALES GRANDES */}
            <div className="relative group/carousel">
              
              {/* Botón flotante grande izquierdo */}
              <button
                onClick={handlePrevGame}
                aria-label="Juego anterior"
                className="absolute -left-2 md:-left-4 top-1/2 -translate-y-1/2 z-30 w-10 h-10 md:w-12 md:h-12 rounded-full bg-black/85 hover:bg-white text-white hover:text-black border border-white/30 hover:border-white shadow-[0_0_25px_rgba(0,0,0,0.9)] backdrop-blur-xl flex items-center justify-center transition-all cursor-pointer hover:scale-110 active:scale-95"
              >
                <ChevronLeft className="w-6 h-6 md:w-7 md:h-7" />
              </button>

              {/* Riel de tarjetas scrolleable */}
              <div 
                ref={carouselContainerRef}
                className="flex gap-3 md:gap-4 overflow-x-auto hide-scrollbar pb-2 pt-2 px-6 md:px-10 snap-x scroll-smooth"
              >
                {games.map((game, i) => {
                  const isSelected = selectedIndex === i

                  return (
                    <div
                      key={game.id}
                      ref={el => { cardRefs.current[i] = el }}
                      onMouseEnter={() => handleSelectGame(i)}
                      onClick={() => handleSelectGame(i)}
                      className="snap-center flex-shrink-0 cursor-pointer py-1"
                    >
                      <motion.div
                        animate={{
                          scale: isSelected ? 1.04 : 0.95,
                          y: isSelected ? -4 : 0,
                          opacity: isSelected ? 1 : 0.65
                        }}
                        transition={{ duration: 0.25 }}
                        className={`relative w-48 sm:w-56 md:w-64 lg:w-72 h-28 sm:h-32 md:h-36 lg:h-40 rounded-2xl overflow-hidden border-2 transition-all ${
                          isSelected 
                            ? `${game.accentBorder} ring-4 ring-white/20 shadow-2xl` 
                            : 'border-white/10 hover:border-white/40'
                        }`}
                      >
                        {/* IMAGEN DE PORTADA DEL JUEGO */}
                        <img 
                          src={game.cardImage} 
                          alt={game.titleLine1} 
                          className="absolute inset-0 w-full h-full object-cover transition-transform duration-700"
                        />
                        
                        {/* VIGNETTE GRADIENTE */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />

                        {/* BADGE Y TÍTULO DE LA TARJETA */}
                        <div className="absolute bottom-0 inset-x-0 p-2.5 md:p-3.5">
                          <span className="text-[8px] md:text-[9px] font-black uppercase tracking-wider text-white/70 block mb-0.5 truncate">
                            {game.subtitle}
                          </span>
                          <h4 className="text-white font-black uppercase text-xs md:text-sm truncate flex items-center justify-between">
                            <span>{game.titleLine1} {game.titleLine2}</span>
                            {isSelected && (
                              <Link href={game.path} className="ml-1 text-white hover:text-yellow-400">
                                <ArrowRight className="w-3.5 h-3.5 md:w-4 md:h-4" />
                              </Link>
                            )}
                          </h4>
                        </div>

                        {/* INDICADOR ACTIVO */}
                        {isSelected && (
                          <div className="absolute top-2 right-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-white shadow-[0_0_10px_white] block animate-pulse" />
                          </div>
                        )}
                      </motion.div>
                    </div>
                  )
                })}
              </div>

              {/* Botón flotante grande derecho */}
              <button
                onClick={handleNextGame}
                aria-label="Siguiente juego"
                className="absolute -right-2 md:-right-4 top-1/2 -translate-y-1/2 z-30 w-10 h-10 md:w-12 md:h-12 rounded-full bg-black/85 hover:bg-white text-white hover:text-black border border-white/30 hover:border-white shadow-[0_0_25px_rgba(0,0,0,0.9)] backdrop-blur-xl flex items-center justify-center transition-all cursor-pointer hover:scale-110 active:scale-95"
              >
                <ChevronRight className="w-6 h-6 md:w-7 md:h-7" />
              </button>

            </div>
          </div>
        </div>

      </div>
    </MainLayout>
  )
}
