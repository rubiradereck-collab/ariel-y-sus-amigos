'use client'

import React, { useState, useRef, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Repeat1, Volume2,
  Plus, Trash2, FolderPlus, Music, Share2, Upload, Search, ArrowUpDown,
  Clock, Disc3, HardDrive, MoreVertical, Radio, Check, X
} from 'lucide-react'
import { useLocalLibrary } from '@/components/music/LocalLibraryProvider'
import { useMusic } from '@/components/music/MusicProvider'
import { formatDuration, type SortKey, type SortDir, sortTracks } from '@/lib/localMusicUtils'
import type { LocalTrack } from '@/lib/localMusicDb'
import { toast } from 'sonner'

export function LibraryView() {
  const {
    tracks, playlists, usage, importFiles, removeTrack,
    createPlaylist, deletePlaylist, addToPlaylist, removeFromPlaylist,
    nowPlaying, playing, position, duration, shuffle, repeat,
    playTrack, toggle, next, prev, seek, setShuffle, setRepeat, shareToJukebox
  } = useLocalLibrary()

  const { setListening } = useMusic()

  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null) // null = Todas las canciones
  const [sortKey, setSortKey] = useState<SortKey>('added')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [searchQuery, setSearchQuery] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [importProgress, setImportProgress] = useState<{ done: number; total: number } | null>(null)
  const [newPlaylistName, setNewPlaylistName] = useState('')
  const [showNewPlaylistModal, setShowNewPlaylistModal] = useState(false)
  const [menuTrackId, setMenuTrackId] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragCounterRef = useRef(0)

  // Prevenir que soltar un archivo fuera de la app abra la pestaña de navegador
  useEffect(() => {
    const prevent = (e: DragEvent) => {
      e.preventDefault()
    }
    window.addEventListener('dragover', prevent)
    window.addEventListener('drop', prevent)
    return () => {
      window.removeEventListener('dragover', prevent)
      window.removeEventListener('drop', prevent)
    }
  }, [])

  // Drag & drop con depth counter
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    if (e.dataTransfer.types.includes('Files')) {
      dragCounterRef.current++
      setIsDragging(true)
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    dragCounterRef.current--
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0
      setIsDragging(false)
    }
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    dragCounterRef.current = 0
    setIsDragging(false)
    const files = Array.from(e.dataTransfer.files)
    if (files.length === 0) return
    await processIncomingFiles(files)
  }

  const processIncomingFiles = async (files: File[]) => {
    setIsImporting(true)
    setImportProgress({ done: 0, total: files.length })
    try {
      const res = await importFiles(files, {
        playlistId: activePlaylistId || undefined,
        onProgress: (done, total) => setImportProgress({ done, total }),
      })

      if (res.added > 0) {
        toast.success(`¡${res.added} canciones añadidas a tu biblioteca! 🎵`)
      }
      if (res.duplicates > 0) {
        toast.info(`${res.duplicates} canciones ya existían en tu biblioteca.`)
      }
      if (res.rejected.length > 0) {
        toast.error(`${res.rejected.length} archivos omitidos (no eran audio o eran >100MB).`)
      }
      if (res.quotaExceeded) {
        toast.error('Se agotó el espacio de almacenamiento local del navegador.')
      }
    } finally {
      setIsImporting(false)
      setImportProgress(null)
    }
  }

  const handleManualFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      void processIncomingFiles(Array.from(e.target.files))
      e.target.value = ''
    }
  }

  // Filtrado y ordenamiento de pistas
  const currentPlaylist = playlists.find((p) => p.id === activePlaylistId)

  const displayedTracks = useMemo(() => {
    let list = tracks
    if (activePlaylistId) {
      const pl = playlists.find((p) => p.id === activePlaylistId)
      const idSet = new Set(pl?.trackIds || [])
      list = tracks.filter((t) => idSet.has(t.id))
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter(
        (t) => t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q)
      )
    }

    return sortTracks(list, sortKey, sortDir)
  }, [tracks, playlists, activePlaylistId, searchQuery, sortKey, sortDir])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) return
    const pl = await createPlaylist(newPlaylistName)
    setNewPlaylistName('')
    setShowNewPlaylistModal(false)
    setActivePlaylistId(pl.id)
    toast.success(`Lista "${pl.name}" creada`)
  }

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="relative min-h-[650px] rounded-3xl border border-white/10 bg-zinc-950/80 backdrop-blur-xl shadow-2xl overflow-hidden flex flex-col"
    >
      {/* Overlay Drag & Drop */}
      <AnimatePresence>
        {isDragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-fuchsia-950/90 border-4 border-dashed border-fuchsia-400 backdrop-blur-md flex flex-col items-center justify-center pointer-events-none p-6 text-center"
          >
            <Upload className="w-16 h-16 text-fuchsia-300 animate-bounce mb-4" />
            <h3 className="text-3xl font-black text-white">¡Suelta tu música aquí!</h3>
            <p className="text-fuchsia-200 text-sm mt-2 font-medium">
              Acepta archivos .mp3, .wav, .ogg de hasta 100 MB. Se guardarán en tu navegador.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Indicador de importación en progreso */}
      {isImporting && importProgress && (
        <div className="bg-fuchsia-600 px-4 py-2 text-xs font-black text-white flex items-center justify-between">
          <span>Importando canciones: {importProgress.done} de {importProgress.total}…</span>
          <div className="w-32 h-2 bg-black/40 rounded-full overflow-hidden">
            <div
              className="h-full bg-white transition-[width]"
              style={{ width: `${(importProgress.done / importProgress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Cuerpo principal de la biblioteca estilo Spotify */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0">
        
        {/* PANEL IZQUIERDO: BIBLIOTECA & PLAYLISTS */}
        <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-white/10 p-4 flex flex-col justify-between bg-black/40 shrink-0">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-widest text-zinc-400">Tu Biblioteca</span>
              <button
                onClick={() => setShowNewPlaylistModal(true)}
                className="text-xs font-bold text-fuchsia-400 hover:text-fuchsia-300 flex items-center gap-1 transition"
                title="Nueva lista"
              >
                <Plus className="w-4 h-4" /> Nueva
              </button>
            </div>

            {/* Selector Todas las canciones */}
            <button
              onClick={() => setActivePlaylistId(null)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-black transition ${
                activePlaylistId === null
                  ? 'bg-fuchsia-600 text-white shadow-[0_0_15px_rgba(217,70,239,0.5)]'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-2.5 truncate">
                <Music className="w-4 h-4" />
                <span className="truncate">Todas las canciones</span>
              </div>
              <span className="text-[10px] opacity-80">{tracks.length}</span>
            </button>

            {/* Listas de reproducción */}
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 px-2 block">
                Playlists ({playlists.length})
              </span>
              <div className="max-h-48 overflow-y-auto space-y-1 pr-1 hide-scrollbar">
                {playlists.map((pl) => (
                  <div
                    key={pl.id}
                    className={`group flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition ${
                      activePlaylistId === pl.id
                        ? 'bg-fuchsia-600/30 text-fuchsia-200 border border-fuchsia-500/40'
                        : 'text-zinc-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <button
                      onClick={() => setActivePlaylistId(pl.id)}
                      className="flex-1 text-left truncate flex items-center gap-2"
                    >
                      <Disc3 className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{pl.name}</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        if (confirm(`¿Eliminar la lista "${pl.name}"?`)) {
                          void deletePlaylist(pl.id)
                          if (activePlaylistId === pl.id) setActivePlaylistId(null)
                        }
                      }}
                      className="opacity-0 group-hover:opacity-100 hover:text-red-400 p-1 transition"
                      title="Eliminar lista"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Botón de añadir y barra de uso del navegador */}
          <div className="pt-4 border-t border-white/10 space-y-3">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="audio/*,.mp3,.wav,.ogg,.m4a"
              hidden
              onChange={handleManualFileInput}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-2.5 px-3 bg-white/10 hover:bg-white/20 text-white font-black text-xs rounded-xl flex items-center justify-center gap-2 border border-white/10 transition hover:scale-[1.02]"
            >
              <Upload className="w-4 h-4 text-fuchsia-400" /> Añadir Archivos .mp3
            </button>

            {usage && (
              <div className="text-[10px] text-zinc-500 font-medium space-y-1 px-1">
                <div className="flex justify-between">
                  <span>Espacio local</span>
                  <span>{(usage.used / (1024 * 1024)).toFixed(1)} MB</span>
                </div>
                <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-fuchsia-500"
                    style={{ width: `${Math.min(100, (usage.used / usage.quota) * 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* PANEL CENTRAL: TABLA DE CANCIONES */}
        <main className="flex-1 p-6 flex flex-col min-w-0 overflow-y-auto">
          {/* Header de la lista actual */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-3xl font-black text-white flex items-center gap-3">
                {currentPlaylist ? currentPlaylist.name : 'Todas las canciones'}
              </h2>
              <p className="text-xs text-zinc-400 font-bold mt-1">
                {displayedTracks.length} {displayedTracks.length === 1 ? 'canción' : 'canciones'} disponibles localmente en este navegador.
              </p>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-48">
                <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar en la biblioteca…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 outline-none focus:border-fuchsia-500 transition"
                />
              </div>

              {displayedTracks.length > 0 && (
                <button
                  onClick={() => {
                    const first = displayedTracks[0]
                    if (first) {
                      void playTrack(
                        first.id,
                        activePlaylistId
                          ? { type: 'playlist', playlistId: activePlaylistId }
                          : { type: 'library', sort: sortKey, dir: sortDir }
                      )
                    }
                  }}
                  className="px-4 py-2 bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-black text-xs rounded-xl flex items-center gap-1.5 shadow-[0_0_15px_rgba(217,70,239,0.4)] transition shrink-0"
                >
                  <Play className="w-3.5 h-3.5 fill-white" /> Reproducir
                </button>
              )}
            </div>
          </div>

          {/* Tabla de pistas */}
          {displayedTracks.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center border border-white/5 rounded-2xl bg-black/20">
              <Disc3 className="w-12 h-12 text-zinc-600 mb-3 animate-spin" />
              <h4 className="text-lg font-black text-white">No hay canciones aquí todavía</h4>
              <p className="text-xs text-zinc-500 max-w-sm mt-1">
                Arrastra y suelta tus archivos de audio (.mp3, .wav) en esta pantalla o haz clic en "Añadir Archivos" para empezar.
              </p>
            </div>
          ) : (
            <div className="flex-1 overflow-x-auto">
              <table className="w-full text-left text-xs text-zinc-300">
                <thead>
                  <tr className="border-b border-white/10 text-[10px] font-black uppercase tracking-wider text-zinc-500 select-none">
                    <th className="py-2 px-3 w-10">#</th>
                    <th
                      onClick={() => toggleSort('title')}
                      className="py-2 px-3 cursor-pointer hover:text-white transition"
                    >
                      <div className="flex items-center gap-1">
                        Título {sortKey === 'title' && <ArrowUpDown className="w-3 h-3 text-fuchsia-400" />}
                      </div>
                    </th>
                    <th
                      onClick={() => toggleSort('artist')}
                      className="py-2 px-3 cursor-pointer hover:text-white transition hidden sm:table-cell"
                    >
                      <div className="flex items-center gap-1">
                        Artista {sortKey === 'artist' && <ArrowUpDown className="w-3 h-3 text-fuchsia-400" />}
                      </div>
                    </th>
                    <th
                      onClick={() => toggleSort('duration')}
                      className="py-2 px-3 cursor-pointer hover:text-white transition w-20 text-right"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <Clock className="w-3 h-3" />
                      </div>
                    </th>
                    <th className="py-2 px-3 w-28 text-right">Opciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {displayedTracks.map((track, idx) => {
                    const isCur = nowPlaying?.id === track.id
                    return (
                      <tr
                        key={track.id}
                        className={`group transition hover:bg-white/5 ${isCur ? 'bg-fuchsia-500/10 text-white font-bold' : ''}`}
                      >
                        {/* Índice o Play icon */}
                        <td className="py-2.5 px-3">
                          <button
                            onClick={() =>
                              playTrack(
                                track.id,
                                activePlaylistId
                                  ? { type: 'playlist', playlistId: activePlaylistId }
                                  : { type: 'library', sort: sortKey, dir: sortDir }
                              )
                            }
                            className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-fuchsia-600 transition"
                          >
                            {isCur && playing ? (
                              <Pause className="w-3 h-3 fill-fuchsia-400 group-hover:fill-white" />
                            ) : (
                              <Play className="w-3 h-3 fill-zinc-400 group-hover:fill-white" />
                            )}
                          </button>
                        </td>

                        {/* Título */}
                        <td className="py-2.5 px-3 max-w-[200px] truncate">
                          <span className={isCur ? 'text-fuchsia-300 font-black' : 'text-white'}>
                            {track.title}
                          </span>
                          <span className="block sm:hidden text-[10px] text-zinc-500 truncate">
                            {track.artist}
                          </span>
                        </td>

                        {/* Artista */}
                        <td className="py-2.5 px-3 text-zinc-400 hidden sm:table-cell truncate">
                          {track.artist}
                        </td>

                        {/* Duración */}
                        <td className="py-2.5 px-3 text-right font-mono text-zinc-400">
                          {formatDuration(track.durationSec)}
                        </td>

                        {/* Opciones */}
                        <td className="py-2.5 px-3 text-right relative">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => void shareToJukebox(track.id)}
                              className="p-1 text-zinc-500 hover:text-cyan-300 rounded hover:bg-cyan-500/10 transition"
                              title="Compartir al Jukebox del grupo (sube a la cola compartida)"
                            >
                              <Share2 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => setMenuTrackId(menuTrackId === track.id ? null : track.id)}
                              className="p-1 text-zinc-500 hover:text-white rounded hover:bg-white/10 transition"
                              title="Más opciones"
                            >
                              <MoreVertical className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Popover menú */}
                          {menuTrackId === track.id && (
                            <div className="absolute right-3 top-8 z-30 w-44 rounded-xl border border-white/10 bg-zinc-900 p-1.5 shadow-2xl text-left">
                              {playlists.length > 0 && (
                                <div className="border-b border-white/10 pb-1 mb-1">
                                  <span className="text-[10px] text-zinc-500 font-black uppercase px-2 block">
                                    Añadir a playlist:
                                  </span>
                                  {playlists.map((p) => (
                                    <button
                                      key={p.id}
                                      onClick={() => {
                                        void addToPlaylist(p.id, [track.id])
                                        setMenuTrackId(null)
                                      }}
                                      className="w-full text-left px-2 py-1 text-xs text-zinc-300 hover:text-white hover:bg-white/10 rounded truncate"
                                    >
                                      + {p.name}
                                    </button>
                                  ))}
                                </div>
                              )}

                              {activePlaylistId && (
                                <button
                                  onClick={() => {
                                    void removeFromPlaylist(activePlaylistId, track.id)
                                    setMenuTrackId(null)
                                  }}
                                  className="w-full text-left px-2 py-1 text-xs text-amber-400 hover:bg-white/10 rounded"
                                >
                                  Quitar de esta lista
                                </button>
                              )}

                              <button
                                onClick={() => {
                                  if (confirm(`¿Eliminar "${track.title}" de tu dispositivo?`)) {
                                    void removeTrack(track.id)
                                    setMenuTrackId(null)
                                  }
                                }}
                                className="w-full text-left px-2 py-1 text-xs text-red-400 hover:bg-white/10 rounded"
                              >
                                Eliminar de la biblioteca
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>

      {/* ========================================================= */}
      {/* BARRA INFERIOR DE REPRODUCCIÓN LOCAL                      */}
      {/* ========================================================= */}
      {nowPlaying && (
        <footer className="border-t border-white/10 bg-zinc-950 p-3 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          {/* Pista actual */}
          <div className="flex items-center gap-3 w-full sm:w-1/3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-fuchsia-600/30 border border-fuchsia-500/40 flex items-center justify-center shrink-0">
              <Disc3 className={`w-6 h-6 text-fuchsia-300 ${playing ? 'animate-spin' : ''}`} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black text-white truncate">{nowPlaying.title}</p>
              <p className="text-[10px] text-zinc-400 truncate">{nowPlaying.artist}</p>
            </div>
          </div>

          {/* Controles de reproducción */}
          <div className="flex flex-col items-center gap-1.5 w-full sm:w-1/3">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setShuffle(!shuffle)}
                className={`transition ${shuffle ? 'text-fuchsia-400' : 'text-zinc-500 hover:text-white'}`}
                title="Aleatorio"
              >
                <Shuffle className="w-4 h-4" />
              </button>

              <button onClick={prev} className="text-zinc-400 hover:text-white transition">
                <SkipBack className="w-4 h-4" />
              </button>

              <button
                onClick={toggle}
                className="w-8 h-8 rounded-full bg-white hover:bg-zinc-200 text-black flex items-center justify-center transition shadow-[0_0_15px_rgba(255,255,255,0.4)]"
              >
                {playing ? <Pause className="w-4 h-4 fill-black" /> : <Play className="w-4 h-4 fill-black ml-0.5" />}
              </button>

              <button onClick={next} className="text-zinc-400 hover:text-white transition">
                <SkipForward className="w-4 h-4" />
              </button>

              <button
                onClick={() => {
                  if (repeat === 'off') setRepeat('all')
                  else if (repeat === 'all') setRepeat('one')
                  else setRepeat('off')
                }}
                className={`transition ${repeat !== 'off' ? 'text-fuchsia-400' : 'text-zinc-500 hover:text-white'}`}
                title={repeat === 'one' ? 'Repetir una' : repeat === 'all' ? 'Repetir todas' : 'Sin repetir'}
              >
                {repeat === 'one' ? <Repeat1 className="w-4 h-4" /> : <Repeat className="w-4 h-4" />}
              </button>
            </div>

            {/* Barra de progreso */}
            <div className="flex items-center gap-2 w-full max-w-md">
              <span className="text-[10px] font-mono text-zinc-500 w-8 text-right">
                {formatDuration(position)}
              </span>
              <input
                type="range"
                min={0}
                max={duration || 100}
                value={position}
                onChange={(e) => seek(Number(e.target.value))}
                className="flex-1 accent-fuchsia-500 h-1 bg-white/10 rounded-lg cursor-pointer"
              />
              <span className="text-[10px] font-mono text-zinc-500 w-8">
                {formatDuration(duration)}
              </span>
            </div>
          </div>

          {/* Botón volver al Jukebox */}
          <div className="flex items-center justify-end gap-2 w-full sm:w-1/3">
            <button
              onClick={() => {
                toggle()
                setListening(true)
                toast('Volviste a sintonizar el Jukebox del grupo 📻')
              }}
              className="px-3 py-1.5 rounded-xl border border-cyan-500/40 bg-cyan-950/40 text-cyan-300 hover:bg-cyan-900/50 text-xs font-black flex items-center gap-1.5 transition"
            >
              <Radio className="w-3.5 h-3.5 animate-pulse" /> Volver al Jukebox
            </button>
          </div>
        </footer>
      )}

      {/* Modal Nueva Playlist */}
      <AnimatePresence>
        {showNewPlaylistModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm rounded-2xl border border-white/10 bg-zinc-900 p-5 space-y-4 shadow-2xl"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black text-white">Nueva Lista de Reproducción</h3>
                <button onClick={() => setShowNewPlaylistModal(false)} className="text-zinc-500 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <input
                type="text"
                placeholder="Nombre de la lista…"
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleCreatePlaylist()
                }}
                autoFocus
                className="w-full rounded-xl border border-white/10 bg-black p-3 text-xs text-white outline-none focus:border-fuchsia-500"
              />

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowNewPlaylistModal(false)}
                  className="px-3 py-2 text-xs font-bold text-zinc-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreatePlaylist}
                  disabled={!newPlaylistName.trim()}
                  className="px-4 py-2 bg-fuchsia-600 hover:bg-fuchsia-500 disabled:opacity-50 text-white font-black text-xs rounded-xl transition"
                >
                  Crear Lista
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
