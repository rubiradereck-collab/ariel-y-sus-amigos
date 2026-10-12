'use client'

import { MainLayout } from "@/components/layout/MainLayout"
import { motion } from "framer-motion"
import Link from "next/link"
import { Gamepad2, Dices, Trophy, Target as TargetIcon, MessageCircleQuestion, Skull, Bomb, Ghost, Swords, Database } from "lucide-react"

const games = [
  {
    id: 'fnaf',
    title: 'Five Nights at Arcade',
    description: 'Sobrevive la noche vigilando las puertas y tu energía. ¿Llegarás a las 6 AM?',
    icon: <Skull className="w-8 h-8 text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.8)]" />,
    image: 'https://images.unsplash.com/photo-1552820728-8b83bb6b773f?q=80&w=2070&auto=format&fit=crop', // Dark gaming setup
    color: 'from-red-600/80 to-black',
    href: '/arcade/fnaf',
    players: 'Solo Survival',
    disabled: false
  },
  {
    id: 'trivia',
    title: 'Trivia del Grupo',
    description: 'Demuestra cuánto conoces al grupo en este desafío con preguntas reales.',
    icon: <Trophy className="w-8 h-8 text-blue-500 drop-shadow-[0_0_10px_rgba(59,130,246,0.8)]" />,
    image: 'https://images.unsplash.com/photo-1606326608606-aa0b62935f2b?q=80&w=2070&auto=format&fit=crop', // Trivia / quiz look
    color: 'from-blue-600/80 to-black',
    href: '/arcade/trivia',
    players: 'Competitivo',
    disabled: false
  },
  {
    id: 'adivina',
    title: '¿Quién dijo eso?',
    description: 'El museo de frases fuera de contexto. Adivina quién lo dijo y gana XP.',
    icon: <TargetIcon className="w-8 h-8 text-orange-500 drop-shadow-[0_0_10px_rgba(249,115,22,0.8)]" />,
    image: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?q=80&w=2070&auto=format&fit=crop', // Group talking
    color: 'from-orange-600/80 to-black',
    href: '/arcade/adivina',
    players: 'Multijugador',
    disabled: false
  },
  {
    id: 'ruleta',
    title: 'Ruleta del Destino',
    description: 'Decide equipos, castigos o turnos girando la ruleta.',
    icon: <Dices className="w-8 h-8 text-purple-500 drop-shadow-[0_0_10px_rgba(168,85,247,0.8)]" />,
    image: 'https://images.unsplash.com/photo-1605806616949-1e87b487cb2a?q=80&w=2070&auto=format&fit=crop', // Dice / Casino
    color: 'from-purple-600/80 to-black',
    href: '/arcade/ruleta',
    players: '1-6 Jugadores',
    disabled: false
  },
  {
    id: 'snake',
    title: 'La Culebrita (Snake)',
    description: 'Come manzanas, esquiva tu cola y bate el récord del grupo para ganar monedas y XP.',
    icon: <Gamepad2 className="w-8 h-8 text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.8)]" />,
    image: 'https://images.unsplash.com/photo-1628277613967-6abca504d0ac?q=80&w=2070&auto=format&fit=crop',
    color: 'from-emerald-600/80 to-black',
    href: '/arcade/snake',
    players: 'Solo Arcade',
    disabled: false
  },
  {
    id: 'tictactoe',
    title: 'Tres en Raya (1v1 & CPU)',
    description: 'Enfrenta a la IA o crea una sala en tiempo real para retar a un amigo.',
    icon: <Swords className="w-8 h-8 text-cyan-400 drop-shadow-[0_0_10px_rgba(34,211,238,0.8)]" />,
    image: 'https://images.unsplash.com/photo-1668901382969-8c73e450a1f5?q=80&w=2070&auto=format&fit=crop',
    color: 'from-cyan-600/80 to-black',
    href: '/arcade/tictactoe',
    players: '1v1 / vs Bot',
    disabled: false
  },
  {
    id: 'libres',
    title: 'Juegos Libres (Minijuegos Friv)',
    description: 'Catálogo de minijuegos neón instantáneos: 2048, Pong, Sudoku, Conecta 4, Buscaminas y más.',
    icon: <Gamepad2 className="w-8 h-8 text-pink-400 drop-shadow-[0_0_10px_rgba(255,77,122,0.8)]" />,
    image: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=2070&auto=format&fit=crop',
    color: 'from-pink-600/80 to-black',
    href: '/arcade/libres',
    players: 'Solo & 2P',
    disabled: false
  }
]

export default function ArcadePage() {
  return (
    <MainLayout>
      <div className="w-full h-full max-w-[1400px] mx-auto px-6 pt-10 pb-32 overflow-y-auto hide-scrollbar">
        
        <header className="mb-16 text-center">
          <h1 className="text-5xl md:text-7xl font-black uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500 drop-shadow-[0_0_20px_rgba(239,68,68,0.5)] flex justify-center items-center gap-4">
            <Gamepad2 className="w-12 h-12 text-red-500" /> ARCADE
          </h1>
          <p className="text-zinc-300 mt-4 text-lg font-bold">Minijuegos, retos y multijugador. Elige tu veneno.</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {games.map((game, i) => (
            <Link key={game.title} href={game.disabled ? '#' : game.href}>
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                whileHover={game.disabled ? {} : { scale: 1.03, y: -5 }}
                className={`relative overflow-hidden rounded-3xl border border-white/10 h-72 flex flex-col justify-end group ${game.disabled ? 'opacity-50 grayscale cursor-not-allowed' : 'cursor-pointer hover:border-white/30 hover:shadow-[0_0_40px_rgba(255,255,255,0.2)] transition-all duration-300'}`}
              >
                {/* Background Image */}
                <div 
                  className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110"
                  style={{ backgroundImage: `url("${game.image}")` }}
                />
                
                {/* Gradient Overlay */}
                <div className={`absolute inset-0 bg-gradient-to-t ${game.color} opacity-90`} />
                <div className="absolute inset-0 bg-black/40" />

                {/* Content */}
                <div className="relative z-10 p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="bg-black/60 p-3 rounded-2xl backdrop-blur-md border border-white/10 shadow-2xl">
                      {game.icon}
                    </div>
                    {game.disabled && (
                      <span className="bg-black/80 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest text-zinc-400 border border-white/10 backdrop-blur-md">
                        Próximamente
                      </span>
                    )}
                    {!game.disabled && (
                      <span className="bg-white/10 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest text-white border border-white/20 backdrop-blur-md">
                        {game.players}
                      </span>
                    )}
                  </div>
                  
                  <h2 className="text-2xl font-black text-white uppercase tracking-widest mb-2 drop-shadow-lg">{game.title}</h2>
                  <p className="text-zinc-300 font-medium text-sm line-clamp-2 leading-relaxed">{game.description}</p>
                </div>
              </motion.div>
            </Link>
          ))}
        </div>
        
        <div className="mt-16 bg-black/40 backdrop-blur-xl border border-white/10 p-8 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-6 max-w-4xl mx-auto">
           <div className="text-left">
             <h3 className="text-2xl font-black text-white uppercase tracking-widest flex items-center gap-2">
               <Database className="w-6 h-6 text-blue-500" /> Base de Datos Comunitaria
             </h3>
             <p className="text-zinc-400 font-medium mt-2">Añade frases reales para los minijuegos o preguntas de trivia.</p>
           </div>
           <Link href="/arcade/aportar" className="inline-flex items-center gap-3 bg-blue-600 hover:bg-blue-500 border border-blue-400/50 px-8 py-4 rounded-xl text-white font-black uppercase tracking-widest transition-all hover:scale-105 whitespace-nowrap">
             <MessageCircleQuestion className="w-5 h-5" /> Aportar
           </Link>
        </div>
      </div>
    </MainLayout>
  )
}

