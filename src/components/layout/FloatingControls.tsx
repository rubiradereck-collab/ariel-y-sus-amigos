'use client'

import { useState, useRef, useEffect } from 'react'
import { Music, Volume2, VolumeX, MessageCircle, Play, Pause, ExternalLink, Bomb, Zap, Wind, Upload, FolderPlus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'

export function FloatingControls() {
  const [isPlaying, setIsPlaying] = useState(false)
  const [volume, setVolume] = useState(0.3)
  const [showMusicMenu, setShowMusicMenu] = useState(false)
  const [showSoundboard, setShowSoundboard] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const whatsappLink = "https://chat.whatsapp.com/Fs4YJBcStUj0XNmKPIopAH"
  const discordLink = "https://discord.com" 

    const defaultTracks = [
    { name: "Reggaeton Beat", url: "https://cdn.pixabay.com/download/audio/2022/04/27/audio_67b36f7129.mp3" },
    { name: "Gaming Lofi", url: "https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3" },
    { name: "Cyberpunk Synth", url: "https://cdn.pixabay.com/download/audio/2022/03/15/audio_27c10b49bc.mp3" },
    { name: "Phonk Drift", url: "https://cdn.pixabay.com/download/audio/2022/07/25/audio_404b9015c9.mp3" }
  ]
  const [tracks, setTracks] = useState(defaultTracks)
  const [currentTrack, setCurrentTrack] = useState(0)
  const localInputRef = useRef<HTMLInputElement | null>(null)
  const supabase = createClient()

  // Cargar canciones subidas por los panas desde Supabase
  useEffect(() => {
    async function loadCloudMusic() {
      try {
        const { data } = await supabase.storage.from('musica').list()
        if (data && data.length > 0) {
          const valid = data.filter(f => f.name !== '.emptyFolderPlaceholder')
          const cloudTracks = valid.map(f => {
            const { data: urlData } = supabase.storage.from('musica').getPublicUrl(f.name)
            return {
              name: f.name.replace(/^\d+_/, '').replace(/\.[^/.]+$/, ''),
              url: urlData.publicUrl
            }
          })
          if (cloudTracks.length > 0) {
            setTracks([...cloudTracks, ...defaultTracks])
          }
        }
      } catch (e) {
        console.error('Error cargando música de la nube', e)
      }
    }
    loadCloudMusic()
  }, [])

  // Seleccionar MP3 desde la PC localmente
  const handleLocalFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const localUrl = URL.createObjectURL(file)
      const newTrack = {
        name: file.name.replace(/\.[^/.]+$/, ''),
        url: localUrl
      }
      const updated = [newTrack, ...tracks]
      setTracks(updated)
      setCurrentTrack(0)
      setIsPlaying(true)
      if (audioRef.current) {
        audioRef.current.src = localUrl
        audioRef.current.play()
      }
      toast.success(`Reproduciendo canción local: ${newTrack.name}`)
    }
  }

  // Soundboard sounds
  const playSound = (url: string, name: string) => {
    const audio = new Audio(url)
    audio.volume = 0.5
    audio.play().catch(e => toast.error("Error al reproducir el sonido"))
    toast.success(`Reproduciendo sonido: ${name}`)
  }

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume
    }
  }, [volume])

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) audioRef.current.pause()
      else audioRef.current.play()
      setIsPlaying(!isPlaying)
    }
  }

  const nextTrack = () => {
    const next = (currentTrack + 1) % tracks.length
    setCurrentTrack(next)
    if (audioRef.current) {
      audioRef.current.src = tracks[next].url
      if (isPlaying) audioRef.current.play()
    }
  }

  const prevTrack = () => {
    const prev = (currentTrack - 1 + tracks.length) % tracks.length
    setCurrentTrack(prev)
    if (audioRef.current) {
      audioRef.current.src = tracks[prev].url
      if (isPlaying) audioRef.current.play()
    }
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-4">
      {/* Elemento Oculto de Audio */}
      <audio 
        ref={audioRef} 
        src={tracks[currentTrack].url} 
        loop 
        onEnded={nextTrack}
      />

      {/* Menú de Soundboard (Molestar) */}
      <AnimatePresence>
        {showSoundboard && (
          <motion.div
            initial={{ opacity: 0, x: 20, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20, scale: 0.9 }}
            className="bg-black/90 backdrop-blur-xl border border-red-500/30 p-4 rounded-2xl shadow-[0_0_30px_rgba(239,68,68,0.3)] w-64 mb-2 flex flex-col gap-3"
          >
            <span className="text-xs font-black text-red-500 tracking-widest uppercase flex items-center gap-2 border-b border-red-500/20 pb-2">
              <Bomb className="w-4 h-4" /> Panel de Troleo
            </span>
            
            <div className="grid grid-cols-2 gap-2">
              <button 
                onClick={() => playSound('https://www.myinstants.com/media/sounds/bruh.mp3', 'Bruh')}
                className="bg-zinc-900 hover:bg-red-500/20 hover:text-red-400 border border-white/10 text-xs font-bold py-2 rounded-lg transition-colors"
              >
                Bruh
              </button>
              <button 
                onClick={() => playSound('https://www.myinstants.com/media/sounds/vine-boom.mp3', 'Vine Boom')}
                className="bg-zinc-900 hover:bg-red-500/20 hover:text-red-400 border border-white/10 text-xs font-bold py-2 rounded-lg transition-colors"
              >
                Boom
              </button>
              <button 
                onClick={() => playSound('https://www.myinstants.com/media/sounds/mlg-airhorn.mp3', 'Airhorn')}
                className="bg-zinc-900 hover:bg-red-500/20 hover:text-red-400 border border-white/10 text-xs font-bold py-2 rounded-lg transition-colors"
              >
                Airhorn
              </button>
              <button 
                onClick={() => playSound('https://www.myinstants.com/media/sounds/crickets_3.mp3', 'Grillos')}
                className="bg-zinc-900 hover:bg-red-500/20 hover:text-red-400 border border-white/10 text-xs font-bold py-2 rounded-lg transition-colors"
              >
                Grillos
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Menú de Música Expandible */}
      <AnimatePresence>
        {showMusicMenu && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="bg-black/90 backdrop-blur-xl border border-white/10 p-4 rounded-2xl shadow-[0_0_30px_rgba(139,92,246,0.3)] w-64 mb-2"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-primary tracking-widest uppercase text-purple-400 drop-shadow-[0_0_8px_rgba(168,85,247,0.8)]">Radio del Caos</span>
              <div className="flex gap-2 items-center">
                <button onClick={prevTrack} className="text-white hover:text-purple-400 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="19 20 9 12 19 4 19 20"></polygon><line x1="5" y1="19" x2="5" y2="5"></line></svg>
                </button>
                <button onClick={togglePlay} className="text-white hover:text-purple-400 transition-colors">
                  {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                </button>
                <button onClick={nextTrack} className="text-white hover:text-purple-400 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 4 15 12 5 20 5 4"></polygon><line x1="19" y1="5" x2="19" y2="19"></line></svg>
                </button>
              </div>
            </div>
            
            <p className="text-sm font-bold text-white truncate mb-4">{tracks[currentTrack].name}</p>
            
            <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between">
                <input 
                  type="file" 
                  ref={localInputRef} 
                  onChange={handleLocalFileSelect} 
                  accept="audio/*,.mp3,.wav,.m4a" 
                  className="hidden" 
                />
                <button 
                  onClick={() => localInputRef.current?.click()} 
                  className="w-full text-xs font-bold text-zinc-300 hover:text-white bg-white/5 hover:bg-purple-600/30 border border-white/10 rounded-xl py-2 px-3 flex items-center justify-center gap-2 transition-colors"
                >
                  <FolderPlus className="w-4 h-4 text-purple-400" /> Cargar MP3 de mi PC
                </button>
              </div>
              <div className="flex items-center gap-3 mt-3">
              <VolumeX className="w-4 h-4 text-white/50" />
              <input 
                type="range" 
                min="0" max="1" step="0.01" 
                value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="w-full h-1 bg-white/20 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:rounded-full"
              />
              <Volume2 className="w-4 h-4 text-white/50" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Botones Flotantes */}
      <div className="flex flex-col gap-3">
        {/* Soundboard */}
        <button 
          onClick={() => { setShowSoundboard(!showSoundboard); setShowMusicMenu(false); }}
          className={`w-12 h-12 border rounded-full flex items-center justify-center transition-all hover:scale-110 relative group ${showSoundboard ? 'bg-red-500 border-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.6)]' : 'bg-black/50 backdrop-blur-md border-white/20 text-white hover:border-red-500/50'}`}
        >
          <Zap className="w-5 h-5" />
          <span className="absolute right-full mr-4 bg-black/80 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap transition-opacity border border-white/10 pointer-events-none">Efectos de Sonido</span>
        </button>

        {/* Música */}
        <button 
          onClick={() => { setShowMusicMenu(!showMusicMenu); setShowSoundboard(false); }}
          className={`w-12 h-12 border rounded-full flex items-center justify-center transition-all hover:scale-110 relative group ${showMusicMenu ? 'bg-primary border-primary text-white shadow-[0_0_20px_rgba(139,92,246,0.6)]' : 'bg-black/50 backdrop-blur-md border-white/20 text-white hover:border-primary/50'}`}
        >
          <Music className="w-5 h-5" />
          {isPlaying && <span className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full animate-ping" />}
          <span className="absolute right-full mr-4 bg-black/80 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap transition-opacity border border-white/10 pointer-events-none">Radio Musical</span>
        </button>

        {/* WhatsApp */}
        <a 
          href={whatsappLink} 
          target="_blank" 
          rel="noopener noreferrer"
          className="w-12 h-12 bg-green-500/20 border border-green-500/50 rounded-full flex items-center justify-center text-green-400 hover:bg-green-500 hover:text-white transition-all shadow-[0_0_15px_rgba(34,197,94,0.3)] hover:scale-110 group relative"
        >
          <MessageCircle className="w-5 h-5" />
          <span className="absolute right-full mr-4 bg-black/80 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap transition-opacity border border-white/10 pointer-events-none">Grupo de WhatsApp</span>
        </a>

        {/* Discord */}
        <a 
          href={discordLink} 
          target="_blank" 
          rel="noopener noreferrer"
          className="w-12 h-12 bg-indigo-500/20 border border-indigo-500/50 rounded-full flex items-center justify-center text-indigo-400 hover:bg-indigo-500 hover:text-white transition-all shadow-[0_0_15px_rgba(99,102,241,0.3)] hover:scale-110 group relative"
        >
          <ExternalLink className="w-5 h-5" />
          <span className="absolute right-full mr-4 bg-black/80 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap transition-opacity border border-white/10 pointer-events-none">Servidor de Discord</span>
        </a>

      </div>
    </div>
  )
}

