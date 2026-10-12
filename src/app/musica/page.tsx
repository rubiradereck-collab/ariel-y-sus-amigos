'use client'

import React, { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  Headphones, ListMusic, Loader2, Plus, Search, SkipForward, Volume2, VolumeX,
  Disc3, Library, Radio, Shuffle, RotateCcw, X, Check, ListPlus, ExternalLink, HelpCircle
} from 'lucide-react'
import { MainLayout } from '@/components/layout/MainLayout'
import { formatTime, useMusic, type SearchResult, type AddInput } from '@/components/music/MusicProvider'
import { useLocalLibrary } from '@/components/music/LocalLibraryProvider'
import { LibraryView } from '@/components/music/library/LibraryView'
import { resolveInput, type Resolved } from '@/lib/resolveInput'
import { shuffleArray } from '@/lib/localMusicUtils'

const SKIP_VOTES_NEEDED = 3

interface PlaylistModalState {
  listId: string
  title: string
  items: { videoId: string; title: string; channel: string; thumb: string | null; durationSec: number }[]
  loading: boolean
  shuffle: boolean
}

export default function MusicaPage() {
  const {
    current,
    queue,
    elapsed,
    listening,
    setListening,
    volume,
    setVolume,
    autoplayBlocked,
    resume,
    addTrack,
    addTrackWithId,
    addTracks,
    removeMine,
    clearMine,
    voteSkip,
    search,
  } = useMusic()

  const { tracks: localTracks } = useLocalLibrary()

  const [activeTab, setActiveTab] = useState<'jukebox' | 'library'>('jukebox')
  const [input, setInput] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [working, setWorking] = useState<boolean>(false)
  const [addingId, setAddingId] = useState<string | null>(null)

  // Modal para importar playlists de YouTube
  const [playlistModal, setPlaylistModal] = useState<PlaylistModalState | null>(null)

  const handleSearchOrAdd = async (e: React.FormEvent, forceList: boolean = false) => {
    e.preventDefault()
    const text = input.trim()
    if (!text || working) return
    setWorking(true)

    try {
      const resolved: Resolved = resolveInput(text)

      // 1. Video directo de YouTube
      if (resolved.type === 'ytVideo') {
        const res = await addTrackWithId({ videoId: resolved.videoId })
        if (res.ok) {
          setInput('')
          setResults([])
          if (res.id) {
            toast('Video añadido a la cola 🎶', {
              action: {
                label: 'Deshacer',
                onClick: () => void removeMine(res.id!),
              },
            })
          }
        }
        return
      }

      // 2. Playlist de YouTube
      if (resolved.type === 'ytPlaylist') {
        setPlaylistModal({
          listId: resolved.listId,
          title: 'Cargando playlist…',
          items: [],
          loading: true,
          shuffle: false,
        })
        setInput('')
        setResults([])

        try {
          const res = await fetch(`/api/yt?playlist=${encodeURIComponent(resolved.listId)}&max=100`)
          if (!res.ok) {
            toast.error('No se pudo cargar la playlist (puede ser privada o no existir).')
            setPlaylistModal(null)
            return
          }
          const data = await res.json()
          setPlaylistModal({
            listId: resolved.listId,
            title: data.title || 'Playlist de YouTube',
            items: data.items || [],
            loading: false,
            shuffle: false,
          })
        } catch {
          toast.error('Error al obtener la lista de YouTube.')
          setPlaylistModal(null)
        }
        return
      }

      // 3. Playlist no soportada (Mix, etc.)
      if (resolved.type === 'ytPlaylistUnsupported') {
        toast.info(resolved.reason)
        return
      }

      // 4. Audio directo por URL
      if (resolved.type === 'audioUrl') {
        const ok = await addTrack({ url: resolved.url })
        if (ok) {
          setInput('')
          setResults([])
        }
        return
      }

      // 5. Spotify
      if (resolved.type === 'spotify') {
        toast.info('Para Spotify, busca el título y artista directamente por texto 🎧')
        return
      }

      // 6. SoundCloud
      if (resolved.type === 'soundcloud') {
        toast.info('SoundCloud estará disponible próximamente en el Jukebox.')
        return
      }

      // 7. Búsqueda por texto (estilo Bot Discord)
      if (resolved.type === 'search') {
        const searchRes = await search(resolved.query)
        if (searchRes === 'no_api_key') {
          toast.error('El buscador no tiene YOUTUBE_API_KEY en Vercel. Pega el enlace directamente.')
          return
        }

        if (searchRes.length === 0) {
          toast('Sin resultados para esa búsqueda.')
          setResults([])
          return
        }

        // Modo Bot directo (Enter sin forzar lista)
        if (!forceList && !resolved.forceList) {
          const topMatch = searchRes[0]
          const res = await addTrackWithId({
            videoId: topMatch.videoId,
            title: topMatch.title,
            thumb: topMatch.thumb,
          })

          if (res.ok) {
            setInput('')
            setResults([])
            if (res.id) {
              toast(`Añadido: ${topMatch.title}`, {
                action: {
                  label: 'Deshacer',
                  onClick: () => void removeMine(res.id!),
                },
              })
            }
          }
        } else {
          // Mostrar lista de resultados
          setResults(searchRes)
        }
      }
    } catch (err) {
      console.error('Error al procesar enlace o búsqueda:', err)
      toast.error('Ocurrió un error al procesar el enlace o búsqueda.')
    } finally {
      setWorking(false)
    }
  }

  const handleAddResult = async (r: SearchResult) => {
    if (addingId) return
    setAddingId(r.videoId)
    const res = await addTrackWithId({ videoId: r.videoId, title: r.title, thumb: r.thumb })
    setAddingId(null)
    if (res.ok && res.id) {
      toast(`Añadido: ${r.title}`, {
        action: {
          label: 'Deshacer',
          onClick: () => void removeMine(res.id!),
        },
      })
    }
  }

  const handleImportPlaylist = async () => {
    if (!playlistModal || playlistModal.items.length === 0) return
    let toAdd = [...playlistModal.items]
    if (playlistModal.shuffle) {
      toAdd = shuffleArray(toAdd)
    }

    // Cap duro de 50 canciones
    toAdd = toAdd.slice(0, 50)
    const inputs: AddInput[] = toAdd.map((item) => ({
      videoId: item.videoId,
      title: item.title,
      thumb: item.thumb,
      durationSec: item.durationSec,
    }))

    toast.loading('Importando canciones a la cola…', { id: 'import-pl' })
    const res = await addTracks(inputs)
    setPlaylistModal(null)

    if (res) {
      toast.success(`¡${res.added} canciones añadidas a la cola! 🎶`, {
        id: 'import-pl',
        action: {
          label: 'Deshacer todo',
          onClick: () => void clearMine(),
        },
      })
    }
  }

  return (
    <MainLayout>
      <div className="mx-auto w-full max-w-5xl px-4 py-8 space-y-6">
        
        {/* Header y Selector de Pestañas */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-3 text-4xl font-black uppercase tracking-tight text-fuchsia-400">
              <Headphones className="h-9 w-9" /> Centro Musical
            </h1>
            <p className="font-medium text-zinc-400 text-sm mt-1">
              Sintoniza la música del grupo o escucha tu biblioteca local arrastrando canciones.
            </p>
          </div>

          {/* Pestañas: Jukebox vs Mi biblioteca */}
          <div className="flex rounded-2xl border border-white/10 bg-black/50 p-1.5 shrink-0 self-start sm:self-auto">
            <button
              onClick={() => setActiveTab('jukebox')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition ${
                activeTab === 'jukebox'
                  ? 'bg-fuchsia-600 text-white shadow-[0_0_15px_rgba(217,70,239,0.5)]'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Radio className="w-3.5 h-3.5" /> Jukebox del grupo
            </button>
            <button
              onClick={() => setActiveTab('library')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition ${
                activeTab === 'library'
                  ? 'bg-fuchsia-600 text-white shadow-[0_0_15px_rgba(217,70,239,0.5)]'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Library className="w-3.5 h-3.5" /> Mi Biblioteca ({localTracks.length})
            </button>
          </div>
        </div>

        {/* ========================================================= */}
        {/* PESTAÑA 1: JUKEBOX DEL GRUPO                              */}
        {/* ========================================================= */}
        {activeTab === 'jukebox' && (
          <div className="space-y-8">
            {/* Sonando ahora en el Jukebox */}
            <section className="overflow-hidden rounded-3xl border border-fuchsia-500/30 bg-gradient-to-br from-fuchsia-950/60 to-black p-6 shadow-2xl relative">
              <div className="absolute top-0 right-0 w-64 h-64 bg-fuchsia-500/10 rounded-full blur-3xl pointer-events-none" />
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs font-black uppercase tracking-widest text-fuchsia-300/80 flex items-center gap-2">
                  <Disc3 className={`w-4 h-4 text-fuchsia-400 ${listening && current ? 'animate-spin' : ''}`} />
                  Sintonizando en vivo
                </h2>
                {!listening && (
                  <span className="text-[10px] font-black uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full">
                    Silenciado para ti
                  </span>
                )}
              </div>

              {current ? (
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                  {current.thumb && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={current.thumb} alt="" className="h-28 w-28 rounded-2xl object-cover shadow-lg border border-white/10 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="truncate text-2xl font-black text-white">{current.title}</p>
                    <p className="text-xs text-zinc-400">
                      Agregada por <b className="text-zinc-200">{current.added_name ?? 'alguien'}</b> ·{' '}
                      <span className="font-mono text-fuchsia-300 font-bold">{formatTime(elapsed)}</span>
                    </p>
                    {autoplayBlocked && listening && (
                      <button
                        onClick={resume}
                        className="mt-2 rounded-xl bg-fuchsia-600 px-4 py-2 text-xs font-black uppercase text-white hover:bg-fuchsia-500 shadow-[0_0_15px_rgba(217,70,239,0.4)] transition"
                      >
                        ▶ Toca para unirte al sonido
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-3 bg-black/40 p-3 rounded-2xl border border-white/10 shrink-0">
                    <button
                      onClick={() => setListening(!listening)}
                      aria-label={listening ? 'Silenciar para mí' : 'Escuchar'}
                      className="rounded-xl border border-white/10 bg-white/5 p-2.5 text-white hover:bg-white/10 transition"
                      title={listening ? 'Silenciar Jukebox' : 'Escuchar Jukebox'}
                    >
                      {listening ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                    </button>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={volume}
                      onChange={(e) => setVolume(Number(e.target.value))}
                      aria-label="Volumen"
                      className="w-24 accent-fuchsia-500"
                    />
                    <button
                      onClick={() => void voteSkip(current.id)}
                      disabled={current.my_vote}
                      className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs font-black text-white hover:bg-white/10 disabled:opacity-50 transition"
                    >
                      <SkipForward className="h-4 w-4" /> Saltar {current.votes}/{SKIP_VOTES_NEEDED}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center text-zinc-500 font-bold">
                  Silencio total en el servidor. ¡Sé el primero en agregar una canción! 🎶
                </div>
              )}
            </section>

            {/* Buscador inteligente estilo bot de Discord */}
            <section className="space-y-4">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span className="font-black uppercase tracking-wider text-zinc-300">
                  Añadir música al Jukebox
                </span>
                <span className="text-[11px] text-zinc-500">
                  Tip: Pulsa <b>Enter</b> para añadir el mejor resultado o <b>Shift+Enter</b> para ver la lista.
                </span>
              </div>

              <form onSubmit={(e) => void handleSearchOrAdd(e, false)} className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && e.shiftKey) {
                        e.preventDefault()
                        void handleSearchOrAdd(e, true)
                      }
                    }}
                    placeholder="Escribe el nombre de una canción o pega un enlace (YouTube, Playlist, Audio https)…"
                    className="w-full rounded-2xl border border-white/10 bg-zinc-900/90 py-3.5 pl-10 pr-4 text-xs text-white outline-none focus:border-fuchsia-500 transition shadow-inner"
                  />
                </div>
                <button
                  type="submit"
                  disabled={working || !input.trim()}
                  className="flex items-center gap-2 rounded-2xl bg-fuchsia-600 px-6 py-3.5 font-black uppercase text-xs text-white transition hover:bg-fuchsia-500 disabled:opacity-50 shadow-[0_0_20px_rgba(217,70,239,0.3)] shrink-0"
                >
                  {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  {working ? 'Procesando…' : 'Encolar'}
                </button>
              </form>

              {/* Lista expandida de resultados si se solicitó */}
              <AnimatePresence>
                {results.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="rounded-3xl border border-white/10 bg-black/60 p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between px-2">
                      <span className="text-xs font-black uppercase text-zinc-400">Resultados de búsqueda</span>
                      <button onClick={() => setResults([])} className="text-xs text-zinc-500 hover:text-white">
                        Cerrar lista (✕)
                      </button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {results.map((r) => (
                        <div
                          key={r.videoId}
                          className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 hover:bg-white/10 transition"
                        >
                          {r.thumb && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={r.thumb} alt="" className="h-14 w-20 rounded-xl object-cover shrink-0" />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="line-clamp-2 text-xs font-bold text-white">{r.title}</p>
                            <p className="truncate text-[10px] text-zinc-500 mt-0.5">{r.channel}</p>
                          </div>
                          <button
                            onClick={() => void handleAddResult(r)}
                            disabled={addingId !== null}
                            className="rounded-xl bg-fuchsia-600 p-2.5 text-white hover:bg-fuchsia-500 disabled:opacity-50 transition shrink-0"
                            title="Agregar a la cola"
                          >
                            {addingId === r.videoId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                          </button>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </section>

            {/* Cola justa round-robin */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-zinc-300">
                  <ListMusic className="h-4 w-4 text-fuchsia-400" /> Cola Compartida ({queue.length}/50)
                </h2>
                {queue.some((q) => q.my_vote) && (
                  <span className="text-xs text-zinc-500">Ya votaste en una canción</span>
                )}
              </div>

              {queue.length === 0 ? (
                <div className="p-8 text-center rounded-3xl border border-white/5 bg-black/30">
                  <p className="font-bold text-xs text-zinc-500">La cola está vacía.</p>
                </div>
              ) : (
                <ul className="space-y-2.5">
                  <AnimatePresence initial={false}>
                    {queue.map((q, i) => (
                      <motion.li
                        key={q.id}
                        layout
                        initial={{ opacity: 0, x: -16 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 16 }}
                        className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/50 p-3 hover:border-white/20 transition"
                      >
                        <span className="w-6 text-center font-black text-xs text-zinc-500">{i + 1}</span>
                        {q.thumb && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={q.thumb} alt="" className="h-12 w-16 rounded-xl object-cover shrink-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-bold text-xs text-white">{q.title}</p>
                          <p className="text-[10px] text-zinc-400">por <b className="text-zinc-200">{q.added_name ?? 'alguien'}</b></p>
                        </div>
                        <button
                          onClick={() => void voteSkip(q.id)}
                          disabled={q.my_vote}
                          className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black text-zinc-300 hover:bg-white/10 disabled:opacity-50 transition shrink-0"
                          title="Votar para saltar esta canción"
                        >
                          <SkipForward className="h-3.5 w-3.5" /> {q.votes}/{SKIP_VOTES_NEEDED}
                        </button>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              )}
            </section>
          </div>
        )}

        {/* ========================================================= */}
        {/* PESTAÑA 2: MI BIBLIOTECA LOCAL (SPOTIFY-STYLE)            */}
        {/* ========================================================= */}
        {activeTab === 'library' && <LibraryView />}

        {/* ========================================================= */}
        {/* MODAL IMPORTAR PLAYLIST DE YOUTUBE                        */}
        {/* ========================================================= */}
        <AnimatePresence>
          {playlistModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-lg rounded-3xl border border-white/10 bg-zinc-950 p-6 space-y-4 shadow-2xl"
              >
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <h3 className="text-lg font-black text-white flex items-center gap-2">
                    <ListPlus className="w-5 h-5 text-fuchsia-400" /> Importar Playlist de YouTube
                  </h3>
                  <button onClick={() => setPlaylistModal(null)} className="text-zinc-500 hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {playlistModal.loading ? (
                  <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
                    <Loader2 className="w-8 h-8 text-fuchsia-400 animate-spin" />
                    <p className="text-xs text-zinc-400 font-bold">Obteniendo canciones de la playlist…</p>
                  </div>
                ) : (
                  <>
                    <div>
                      <h4 className="text-base font-black text-white">{playlistModal.title}</h4>
                      <p className="text-xs text-zinc-400 mt-1">
                        Se importarán hasta <b>{Math.min(50, playlistModal.items.length)}</b> canciones disponibles a la cola.
                      </p>
                    </div>

                    {/* Switch de orden aleatorio */}
                    <div className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/10">
                      <div className="flex items-center gap-2 text-xs font-bold text-zinc-300">
                        <Shuffle className="w-4 h-4 text-fuchsia-400" />
                        <span>Mezclar orden antes de agregar</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={playlistModal.shuffle}
                        onChange={(e) =>
                          setPlaylistModal((prev) => (prev ? { ...prev, shuffle: e.target.checked } : null))
                        }
                        className="w-4 h-4 rounded border-white/20 bg-zinc-800 text-fuchsia-500 cursor-pointer"
                      />
                    </div>

                    {/* Preview de pistas */}
                    <div className="max-h-52 overflow-y-auto space-y-2 pr-1 hide-scrollbar">
                      {playlistModal.items.slice(0, 10).map((it, idx) => (
                        <div key={idx} className="flex items-center gap-2.5 text-xs text-zinc-300 p-1.5 rounded-lg bg-black/40">
                          <span className="w-5 text-zinc-500 font-mono text-[10px] text-right">{idx + 1}</span>
                          <span className="truncate flex-1">{it.title}</span>
                          <span className="text-[10px] text-zinc-500">{it.channel}</span>
                        </div>
                      ))}
                      {playlistModal.items.length > 10 && (
                        <p className="text-[10px] text-zinc-500 text-center py-1">
                          + {playlistModal.items.length - 10} canciones más…
                        </p>
                      )}
                    </div>

                    <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
                      <button
                        onClick={() => setPlaylistModal(null)}
                        className="px-4 py-2.5 text-xs font-bold text-zinc-400 hover:text-white"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleImportPlaylist}
                        disabled={playlistModal.items.length === 0}
                        className="px-6 py-2.5 bg-fuchsia-600 hover:bg-fuchsia-500 disabled:opacity-50 text-white font-black text-xs rounded-xl transition shadow-[0_0_15px_rgba(217,70,239,0.4)]"
                      >
                        Importar {Math.min(50, playlistModal.items.length)} canciones
                      </button>
                    </div>
                  </>
                )}
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </MainLayout>
  )
}
