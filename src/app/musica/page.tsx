'use client'

import { MainLayout } from "@/components/layout/MainLayout"
import { Headphones, Disc, Upload, FolderHeart, Play, Radio, Music2, ExternalLink } from "lucide-react"
import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"

export default function MusicaPage() {
  const [activeTab, setActiveTab] = useState<'streaming' | 'local'>('streaming')
  const [localSongs, setLocalSongs] = useState<any[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    fetchSongs()
  }, [])

  const fetchSongs = async () => {
    const { data } = await supabase.storage.from('musica').list()
    if (data) {
      setLocalSongs(data.filter(f => f.name !== '.emptyFolderPlaceholder'))
    }
  }

  const handleUpload = async () => {
    if (!file) {
      toast.error('Selecciona un archivo de audio primero')
      return
    }
    setUploading(true)
    const safeName = file.name.replace(/[^a-zA-Z0-9.\-]/g, '_')
    const { data, error } = await supabase.storage
      .from('musica')
      .upload(`${Date.now()}_${safeName}`, file, { cacheControl: '3600', upsert: false })
    
    if (error) {
      toast.error('Error al subir: ' + error.message)
    } else {
      toast.success('¡Canción subida con éxito!')
      setFile(null)
      fetchSongs()
    }
    setUploading(false)
  }

  const getPublicUrl = (path: string) => {
    const { data } = supabase.storage.from('musica').getPublicUrl(path)
    return data.publicUrl
  }

  return (
    <MainLayout>
      <div className="w-full max-w-7xl mx-auto px-4 py-8">
        
        {/* HEADER */}
        <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-4xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-green-500 to-teal-500 uppercase tracking-tighter flex items-center gap-4">
              <Headphones className="w-10 h-10 text-emerald-500" /> Radio del Caos
            </h1>
            <p className="text-emerald-200/60 font-medium text-base mt-1">
              Las playlists elegidas por ustedes y música local del grupo.
            </p>
          </div>

          {/* SELECTOR DE PESTAÑAS */}
          <div className="flex bg-zinc-900 border border-white/10 p-1.5 rounded-2xl gap-2 self-start md:self-auto">
            <button 
              onClick={() => setActiveTab('streaming')}
              className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
                activeTab === 'streaming' 
                  ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20' 
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Radio className="w-4 h-4" /> Playlists Oficiales
            </button>
            <button 
              onClick={() => setActiveTab('local')}
              className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
                activeTab === 'local' 
                  ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20' 
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Music2 className="w-4 h-4" /> Canciones de los Panas ({localSongs.length})
            </button>
          </div>
        </header>

        {/* CONTENIDO SEGÚN PESTAÑA */}
        {activeTab === 'streaming' ? (
          <div className="space-y-8">
            
            {/* 1. SPOTIFY PLAYLIST OFICIAL DEL USUARIO */}
            <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-black text-white flex items-center gap-2">
                    <Disc className="w-5 h-5 text-emerald-500" /> Playlist Oficial en Spotify
                  </h2>
                  <p className="text-xs text-zinc-400">Tu selección de canciones seleccionada directamente.</p>
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-full border border-emerald-500/20">
                  Spotify
                </span>
              </div>
              
              <div className="rounded-2xl overflow-hidden bg-zinc-900 border border-white/5">
                <iframe 
                  data-testid="embed-iframe" 
                  style={{ borderRadius: '12px' }} 
                  src="https://open.spotify.com/embed/playlist/4pnXzlKEJwkjsB6JmhscTi?utm_source=generator&si=749e1aa8f0a74211&theme=0" 
                  width="100%" 
                  height="352" 
                  frameBorder="0" 
                  allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" 
                  loading="lazy"
                />
              </div>
            </div>

            {/* 2. GRID CON YOUTUBE MUSIC Y APPLE MUSIC */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              {/* YOUTUBE MUSIC */}
              <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-xl font-black text-white flex items-center gap-2">
                        <Play className="w-5 h-5 text-red-500" /> YouTube Music
                      </h2>
                      <p className="text-xs text-zinc-400">Reproducción directa desde YouTube Music.</p>
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest bg-red-500/10 text-red-400 px-3 py-1 rounded-full border border-red-500/20">
                      YouTube
                    </span>
                  </div>
                  
                  <div className="rounded-2xl overflow-hidden bg-zinc-900 border border-white/5 aspect-video">
                    <iframe 
                      width="100%" 
                      height="100%" 
                      src="https://www.youtube.com/embed/WxaU6nrYaN4" 
                      title="YouTube Music Player" 
                      frameBorder="0" 
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                      allowFullScreen 
                    />
                  </div>
                </div>
              </div>

              {/* APPLE MUSIC */}
              <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-xl font-black text-white flex items-center gap-2">
                        <ExternalLink className="w-5 h-5 text-pink-500" /> Apple Music (Salsa Romántica)
                      </h2>
                      <p className="text-xs text-zinc-400">Salsa romántica para nostálgicos.</p>
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest bg-pink-500/10 text-pink-400 px-3 py-1 rounded-full border border-pink-500/20">
                      Apple Music
                    </span>
                  </div>

                  <div className="rounded-2xl overflow-hidden bg-zinc-900 border border-white/5">
                    <iframe 
                      allow="autoplay *; encrypted-media *; fullscreen *; clipboard-write" 
                      frameBorder="0" 
                      height="352" 
                      style={{ width: '100%', overflow: 'hidden', borderRadius: '12px' }} 
                      sandbox="allow-forms allow-popups allow-same-origin allow-scripts allow-storage-access-by-user-activation allow-top-navigation-by-user-activation" 
                      src="https://embed.music.apple.com/es/playlist/salsa-rom%C3%A1ntica-para-nost%C3%A1lgicos/pl.343b8e998a924d24985827b2db873c56" 
                    />
                  </div>
                </div>
              </div>

            </div>

          </div>
        ) : (
          /* PESTAÑA DE MUSICA LOCAL */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl">
                <h2 className="text-xl font-black text-white mb-4 flex items-center gap-3">
                  <Music2 className="w-6 h-6 text-emerald-500" /> Canciones Subidas por los Panas
                </h2>
                
                {localSongs.length === 0 ? (
                  <div className="text-center py-16 text-zinc-500 font-bold border-2 border-dashed border-white/5 rounded-2xl flex flex-col items-center gap-3">
                    <Upload className="w-10 h-10 text-zinc-600" />
                    <span>Aún no hay canciones subidas. Usa el panel de la derecha para subir la primera.</span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {localSongs.map(song => (
                      <div key={song.name} className="bg-zinc-900 border border-white/5 p-4 rounded-2xl flex flex-col md:flex-row items-center gap-4 group hover:border-emerald-500/30 transition-colors">
                        <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-500/20 transition-colors">
                          <Play className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div className="flex-1 truncate w-full text-center md:text-left">
                          <p className="text-white font-bold truncate text-sm">{song.name.replace(/^\d+_/, '')}</p>
                          <span className="text-[10px] text-zinc-500 font-mono">Archivo de Audio</span>
                        </div>
                        <audio controls src={getPublicUrl(song.name)} className="w-full md:w-72 h-10" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* PANEL DE SUBIDA */}
            <div>
              <div className="bg-gradient-to-b from-emerald-950/40 to-black/80 backdrop-blur-xl border border-emerald-500/20 rounded-3xl p-6 sticky top-28 shadow-2xl">
                <h3 className="text-base font-black text-emerald-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Upload className="w-5 h-5" /> Subir Tu Archivo
                </h3>
                <p className="text-zinc-400 mb-6 font-medium text-xs leading-relaxed">
                  Sube canciones desde tu computadora para que todos en la página puedan escucharlas. Acepta MP3, M4A, WAV.
                </p>
                
                <label className="border-2 border-dashed border-emerald-500/30 rounded-2xl p-8 text-center hover:bg-emerald-500/10 transition-colors cursor-pointer group mb-6 block relative">
                  <input 
                    type="file" 
                    className="hidden" 
                    accept="audio/*,.mp3,.wav,.m4a,.ogg" 
                    onChange={e => {
                      if (e.target.files && e.target.files[0]) {
                        setFile(e.target.files[0])
                      }
                    }} 
                  />
                  <Upload className="w-10 h-10 text-emerald-500/50 mx-auto mb-3 group-hover:scale-110 transition-transform group-hover:text-emerald-400" />
                  <span className="text-xs font-bold text-zinc-300 group-hover:text-emerald-200 block truncate">
                    {file ? file.name : "Haz clic para elegir archivo"}
                  </span>
                </label>
                
                <button 
                  onClick={handleUpload}
                  disabled={uploading || !file}
                  className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-zinc-800 disabled:text-zinc-500 text-black font-black px-6 py-4 rounded-xl flex items-center justify-center gap-2 uppercase text-xs tracking-widest transition-all shadow-lg"
                >
                  {uploading ? 'Subiendo archivo...' : 'Guardar en la nube'}
                </button>
              </div>
            </div>

          </div>
        )}

      </div>
    </MainLayout>
  )
}
