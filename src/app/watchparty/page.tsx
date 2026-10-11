'use client'

import { MainLayout } from "@/components/layout/MainLayout"
import { motion } from "framer-motion"
import { Tv, Play, Pause, FastForward, Film, Users, Link as LinkIcon, Popcorn } from "lucide-react"
import { useState } from "react"

export default function WatchPartyPage() {
  const [urlInput, setUrlInput] = useState('')
  const [videoId, setVideoId] = useState('jfKfPfyJRdk') // Lofi hip hop radio default

  const extractVideoId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/
    const match = url.match(regExp)
    return (match && match[2].length === 11) ? match[2] : null
  }

  const handlePlay = () => {
    const id = extractVideoId(urlInput)
    if (id) {
      setVideoId(id)
      setUrlInput('')
    } else {
      alert('Por favor ingresa un enlace válido de YouTube')
    }
  }

  return (
    <MainLayout>
      <div className="w-full max-w-7xl mx-auto px-4 py-8">
        
        <header className="mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-pink-500 uppercase tracking-widest flex items-center gap-4">
              <Popcorn className="w-10 h-10 text-red-500" /> Cine en Casa
            </h1>
            <p className="text-red-200/60 font-bold mt-2">
              Pega un enlace de YouTube y míralo en la pantalla grande.
            </p>
          </div>
          
          <div className="flex gap-2">
            <div className="bg-red-500/10 border border-red-500/30 px-4 py-2 rounded-xl flex items-center gap-2">
              <Users className="w-5 h-5 text-red-400" />
              <span className="font-bold text-red-400">1 Conectado</span>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          <div className="lg:col-span-3 space-y-6">
            {/* Reproductor Simulador */}
            <div className="bg-black border border-white/10 rounded-3xl overflow-hidden aspect-video relative shadow-2xl group">
              {/* Simulacion de Video */}
              <div className="absolute inset-0 bg-zinc-900 flex items-center justify-center">
                <Tv className="w-24 h-24 text-white/5 animate-pulse" />
              </div>
              <iframe 
                width="100%" 
                height="100%" 
                src={`https://www.youtube.com/embed/${videoId}?autoplay=1`} 
                title="YouTube video player" 
                frameBorder="0" 
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                allowFullScreen
                className="relative z-10"
              />
            </div>

            {/* Input de URL */}
            <div className="bg-zinc-900 border border-white/10 rounded-2xl p-4 flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                <input 
                  type="text" 
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handlePlay()}
                  placeholder="Pega un enlace de YouTube aquí... (ej: https://youtu.be/...)"
                  className="w-full bg-black border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white focus:border-red-500 focus:outline-none transition-colors"
                />
              </div>
              <button 
                onClick={handlePlay}
                className="bg-red-600 hover:bg-red-500 text-white font-black px-8 py-3 rounded-xl uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
              >
                <Play className="w-4 h-4 fill-current" /> Reproducir
              </button>
            </div>
          </div>

          {/* Cola de Reproduccion */}
          <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-3xl p-6 flex flex-col">
            <h3 className="text-lg font-black text-white uppercase tracking-widest mb-6 flex items-center gap-2">
              <Film className="w-5 h-5 text-red-500" /> Historial
            </h3>
            
            <div className="flex-1 overflow-y-auto space-y-4 pr-2">
              <div className="flex gap-3 items-center group cursor-pointer bg-white/5 p-2 rounded-xl">
                <div className="w-20 h-12 bg-zinc-800 rounded-lg flex-shrink-0 relative overflow-hidden border border-white/5 flex items-center justify-center">
                   <Play className="w-5 h-5 text-red-500" />
                </div>
                <div className="flex-1 overflow-hidden">
                  <p className="text-white text-xs font-bold truncate">Lofi hip hop radio</p>
                  <p className="text-zinc-500 text-[10px]">Predeterminado</p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </MainLayout>
  )
}
