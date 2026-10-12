'use client'

import React, { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from 'react'
import { openLibrary, type LocalTrack, type LocalPlaylist } from '@/lib/localMusicDb'
import { getAudioDuration, parseFilenameMetadata, sortTracks, shuffleArray, type SortKey, type SortDir } from '@/lib/localMusicUtils'
import { useMusic } from '@/components/music/MusicProvider'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

export interface LocalLibraryContextValue {
  ready: boolean
  tracks: LocalTrack[]
  playlists: LocalPlaylist[]
  usage: { used: number; quota: number } | null
  importFiles: (
    files: File[],
    opts?: { playlistId?: string; onProgress?: (done: number, total: number) => void }
  ) => Promise<{ added: number; duplicates: number; rejected: string[]; quotaExceeded: boolean }>
  removeTrack: (id: string) => Promise<void>
  createPlaylist: (name: string) => Promise<LocalPlaylist>
  renamePlaylist: (id: string, name: string) => Promise<void>
  deletePlaylist: (id: string) => Promise<void>
  addToPlaylist: (pid: string, trackIds: string[]) => Promise<void>
  removeFromPlaylist: (pid: string, trackId: string) => Promise<void>
  reorderPlaylist: (pid: string, orderedIds: string[]) => Promise<void>
  nowPlaying: LocalTrack | null
  playing: boolean
  position: number
  duration: number
  shuffle: boolean
  repeat: 'off' | 'all' | 'one'
  playTrack: (
    id: string,
    ctx: { type: 'library'; sort: SortKey; dir: 'asc' | 'desc' } | { type: 'playlist'; playlistId: string }
  ) => Promise<void>
  toggle: () => void
  next: () => void
  prev: () => void
  seek: (sec: number) => void
  setShuffle: (v: boolean) => void
  setRepeat: (v: 'off' | 'all' | 'one') => void
  shareToJukebox: (id: string) => Promise<boolean>
}

const LocalLibraryContext = createContext<LocalLibraryContextValue | null>(null)

export function useLocalLibrary(): LocalLibraryContextValue {
  const ctx = useContext(LocalLibraryContext)
  if (!ctx) throw new Error('useLocalLibrary debe usarse dentro de <LocalLibraryProvider>')
  return ctx
}

export function LocalLibraryProvider({ children }: { children: ReactNode }) {
  const { listening, setListening, volume, addTrack: addJukeboxTrack } = useMusic()
  const [supabase] = useState(() => createClient())

  const [userId, setUserId] = useState<string>('anon')
  const [ready, setReady] = useState(false)
  const [tracks, setTracks] = useState<LocalTrack[]>([])
  const [playlists, setPlaylists] = useState<LocalPlaylist[]>([])
  const [usage, setUsage] = useState<{ used: number; quota: number } | null>(null)

  // Reproducción
  const [nowPlaying, setNowPlaying] = useState<LocalTrack | null>(null)
  const [playing, setPlaying] = useState(false)
  const [position, setPosition] = useState(0)
  const [duration, setDuration] = useState(0)
  const [shuffle, setShuffle] = useState(false)
  const [repeat, setRepeat] = useState<'off' | 'all' | 'one'>('off')

  const queueRef = useRef<string[]>([])
  const queueIndexRef = useRef<number>(-1)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const currentObjectUrlRef = useRef<string | null>(null)

  // Obtener usuario actual para particionar DB
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      const uid = user?.id || 'local_user'
      setUserId(uid)
    })
  }, [supabase])

  // Cargar datos de IndexedDB
  const refreshLibrary = useCallback(async (uid: string) => {
    try {
      const db = await openLibrary(uid)
      const allTracks = await db.getAll('tracks')
      const allPlaylists = await db.getAll('playlists')
      setTracks(allTracks)
      setPlaylists(allPlaylists)
      setReady(true)

      if (navigator.storage && navigator.storage.estimate) {
        const est = await navigator.storage.estimate()
        setUsage({ used: est.usage || 0, quota: est.quota || 0 })
      }
    } catch (e) {
      console.error('Error abriendo IndexedDB:', e)
    }
  }, [])

  useEffect(() => {
    if (userId) void refreshLibrary(userId)
  }, [userId, refreshLibrary])

  // Coexistencia: si el Jukebox se reactiva ("Escuchar"), pausar la biblioteca local
  useEffect(() => {
    if (listening && playing) {
      if (audioRef.current) audioRef.current.pause()
      setPlaying(false)
    }
  }, [listening, playing])

  // Sincronizar volumen maestro
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume
    }
  }, [volume])

  // Limpiar URL de blob al desmontar
  useEffect(() => {
    return () => {
      if (currentObjectUrlRef.current) {
        URL.revokeObjectURL(currentObjectUrlRef.current)
      }
    }
  }, [])

  // Métodos de reproducción
  const playTrackById = useCallback(async (trackId: string) => {
    try {
      const db = await openLibrary(userId)
      const track = await db.get('tracks', trackId)
      const blob = await db.get('blobs', trackId)
      if (!track || !blob) {
        toast.error('No se encontró el audio de este archivo.')
        return
      }

      // Regla 1: Silenciar Jukebox compartido para nosotros
      setListening(false)

      if (currentObjectUrlRef.current) {
        URL.revokeObjectURL(currentObjectUrlRef.current)
      }

      const url = URL.createObjectURL(blob)
      currentObjectUrlRef.current = url

      if (!audioRef.current) {
        audioRef.current = new Audio()
      }
      const audio = audioRef.current
      audio.src = url
      audio.volume = volume

      await audio.play()
      setNowPlaying(track)
      setPlaying(true)
      setDuration(track.durationSec || 0)
      setPosition(0)

      // Media Session API
      if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: track.title,
          artist: track.artist,
          album: track.album || 'Mi biblioteca local',
        })
      }
    } catch (e) {
      console.error('Error al reproducir audio local:', e)
      toast.error('No se pudo reproducir el archivo.')
    }
  }, [userId, setListening, volume])

  const next = useCallback(() => {
    if (queueRef.current.length === 0) return
    let nextIdx = queueIndexRef.current + 1
    if (nextIdx >= queueRef.current.length) {
      if (repeat === 'all') nextIdx = 0
      else {
        setPlaying(false)
        return
      }
    }
    queueIndexRef.current = nextIdx
    const nextId = queueRef.current[nextIdx]
    if (nextId) void playTrackById(nextId)
  }, [repeat, playTrackById])

  const prev = useCallback(() => {
    if (!audioRef.current || queueRef.current.length === 0) return
    if (audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0
      return
    }
    let prevIdx = queueIndexRef.current - 1
    if (prevIdx < 0) {
      prevIdx = repeat === 'all' ? queueRef.current.length - 1 : 0
    }
    queueIndexRef.current = prevIdx
    const prevId = queueRef.current[prevIdx]
    if (prevId) void playTrackById(prevId)
  }, [repeat, playTrackById])

  // Setup eventos de audio
  useEffect(() => {
    const audio = audioRef.current || new Audio()
    audioRef.current = audio

    const onTimeUpdate = () => setPosition(Math.floor(audio.currentTime))
    const onEnded = () => {
      if (repeat === 'one') {
        audio.currentTime = 0
        void audio.play()
      } else {
        next()
      }
    }
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)

    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)

    // Media Session Handlers
    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('play', () => audio.play())
      navigator.mediaSession.setActionHandler('pause', () => audio.pause())
      navigator.mediaSession.setActionHandler('previoustrack', prev)
      navigator.mediaSession.setActionHandler('nexttrack', next)
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined) audio.currentTime = details.seekTime
      })
    }

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
    }
  }, [next, prev, repeat])

  const playTrack = useCallback(async (
    id: string,
    ctx: { type: 'library'; sort: SortKey; dir: 'asc' | 'desc' } | { type: 'playlist'; playlistId: string }
  ) => {
    let list: string[] = []
    if (ctx.type === 'library') {
      const sorted = sortTracks(tracks, ctx.sort, ctx.dir)
      list = sorted.map((t) => t.id)
    } else {
      const pl = playlists.find((p) => p.id === ctx.playlistId)
      list = pl ? [...pl.trackIds] : []
    }

    if (shuffle) {
      list = shuffleArray(list, id)
    }

    queueRef.current = list
    queueIndexRef.current = list.indexOf(id)
    await playTrackById(id)
  }, [tracks, playlists, shuffle, playTrackById])

  const toggle = useCallback(() => {
    if (!audioRef.current) return
    if (playing) {
      audioRef.current.pause()
    } else {
      setListening(false)
      audioRef.current.play().catch(() => {})
    }
  }, [playing, setListening])

  const seek = useCallback((sec: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = sec
      setPosition(sec)
    }
  }, [])

  // Importar archivos
  const importFiles = useCallback(async (
    incoming: File[],
    opts?: { playlistId?: string; onProgress?: (done: number, total: number) => void }
  ) => {
    const db = await openLibrary(userId)
    let added = 0
    let duplicates = 0
    const rejected: string[] = []
    let quotaExceeded = false

    const newTrackIds: string[] = []

    for (let i = 0; i < incoming.length; i++) {
      const file = incoming[i]
      opts?.onProgress?.(i + 1, incoming.length)

      const isAudio =
        file.type.startsWith('audio/') ||
        /\.(mp3|wav|ogg|m4a|aac)$/i.test(file.name)

      if (!isAudio) {
        rejected.push(file.name)
        continue
      }

      if (file.size > 100 * 1024 * 1024) {
        rejected.push(`${file.name} (>100MB)`)
        continue
      }

      const fp = `${file.name}|${file.size}|${file.lastModified}`
      const existing = await db.getFromIndex('tracks', 'by-fp', fp)
      if (existing) {
        duplicates++
        newTrackIds.push(existing.id)
        continue
      }

      // Metadata
      const { title, artist } = parseFilenameMetadata(file.name)
      const durationSec = await getAudioDuration(file)
      const trackId = crypto.randomUUID()

      const newTrack: LocalTrack = {
        id: trackId,
        fingerprint: fp,
        title,
        artist,
        durationSec,
        size: file.size,
        mime: file.type || 'audio/mpeg',
        addedAt: Date.now(),
      }

      try {
        const tx = db.transaction(['tracks', 'blobs'], 'readwrite')
        await tx.objectStore('tracks').put(newTrack)
        await tx.objectStore('blobs').put(file, trackId)
        await tx.done
        added++
        newTrackIds.push(trackId)
      } catch (e: any) {
        if (e.name === 'QuotaExceededError') {
          quotaExceeded = true
          break
        } else {
          rejected.push(file.name)
        }
      }
    }

    if (opts?.playlistId && newTrackIds.length > 0) {
      const pl = await db.get('playlists', opts.playlistId)
      if (pl) {
        const set = new Set([...pl.trackIds, ...newTrackIds])
        pl.trackIds = Array.from(set)
        pl.updatedAt = Date.now()
        await db.put('playlists', pl)
      }
    }

    if (navigator.storage && navigator.storage.persist) {
      await navigator.storage.persist()
    }

    await refreshLibrary(userId)
    return { added, duplicates, rejected, quotaExceeded }
  }, [userId, refreshLibrary])

  const removeTrack = useCallback(async (id: string) => {
    const db = await openLibrary(userId)
    const tx = db.transaction(['tracks', 'blobs', 'playlists'], 'readwrite')
    await tx.objectStore('tracks').delete(id)
    await tx.objectStore('blobs').delete(id)
    const allPls = await tx.objectStore('playlists').getAll()
    for (const pl of allPls) {
      if (pl.trackIds.includes(id)) {
        pl.trackIds = pl.trackIds.filter((tId) => tId !== id)
        await tx.objectStore('playlists').put(pl)
      }
    }
    await tx.done

    if (nowPlaying?.id === id) {
      if (audioRef.current) audioRef.current.pause()
      setNowPlaying(null)
      setPlaying(false)
    }

    await refreshLibrary(userId)
  }, [userId, nowPlaying, refreshLibrary])

  const createPlaylist = useCallback(async (name: string): Promise<LocalPlaylist> => {
    const db = await openLibrary(userId)
    const pl: LocalPlaylist = {
      id: crypto.randomUUID(),
      name: name.trim() || 'Nueva lista',
      trackIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    await db.put('playlists', pl)
    await refreshLibrary(userId)
    return pl
  }, [userId, refreshLibrary])

  const renamePlaylist = useCallback(async (id: string, name: string) => {
    const db = await openLibrary(userId)
    const pl = await db.get('playlists', id)
    if (pl) {
      pl.name = name.trim() || 'Sin nombre'
      pl.updatedAt = Date.now()
      await db.put('playlists', pl)
      await refreshLibrary(userId)
    }
  }, [userId, refreshLibrary])

  const deletePlaylist = useCallback(async (id: string) => {
    const db = await openLibrary(userId)
    await db.delete('playlists', id)
    await refreshLibrary(userId)
  }, [userId, refreshLibrary])

  const addToPlaylist = useCallback(async (pid: string, trackIds: string[]) => {
    const db = await openLibrary(userId)
    const pl = await db.get('playlists', pid)
    if (pl) {
      const set = new Set([...pl.trackIds, ...trackIds])
      pl.trackIds = Array.from(set)
      pl.updatedAt = Date.now()
      await db.put('playlists', pl)
      await refreshLibrary(userId)
      toast.success('Pistas añadidas a la playlist')
    }
  }, [userId, refreshLibrary])

  const removeFromPlaylist = useCallback(async (pid: string, trackId: string) => {
    const db = await openLibrary(userId)
    const pl = await db.get('playlists', pid)
    if (pl) {
      pl.trackIds = pl.trackIds.filter((id) => id !== trackId)
      pl.updatedAt = Date.now()
      await db.put('playlists', pl)
      await refreshLibrary(userId)
    }
  }, [userId, refreshLibrary])

  const reorderPlaylist = useCallback(async (pid: string, orderedIds: string[]) => {
    const db = await openLibrary(userId)
    const pl = await db.get('playlists', pid)
    if (pl) {
      pl.trackIds = orderedIds
      pl.updatedAt = Date.now()
      await db.put('playlists', pl)
      await refreshLibrary(userId)
    }
  }, [userId, refreshLibrary])

  // Compartir pista local al Jukebox del grupo subiéndola al bucket music-tracks
  const shareToJukebox = useCallback(async (id: string): Promise<boolean> => {
    try {
      const db = await openLibrary(userId)
      const track = await db.get('tracks', id)
      const blob = await db.get('blobs', id)
      if (!track || !blob) {
        toast.error('Pista no encontrada.')
        return false
      }

      toast.loading('Subiendo pista para compartir al grupo…', { id: 'share-jukebox' })
      const ext = track.mime.includes('wav') ? 'wav' : 'mp3'
      const path = `${userId}/${Date.now()}_${crypto.randomUUID()}.${ext}`

      const { error: upErr } = await supabase.storage.from('music-tracks').upload(path, blob, {
        contentType: track.mime,
        upsert: false,
      })
      if (upErr) throw new Error(upErr.message)

      const { data: pub } = supabase.storage.from('music-tracks').getPublicUrl(path)
      const added = await addJukeboxTrack({
        url: pub.publicUrl,
        title: `${track.artist} - ${track.title}`,
      })

      if (added) {
        toast.success('¡Pista compartida en el Jukebox del grupo! 🎶', { id: 'share-jukebox' })
        return true
      }
      toast.error('No se pudo encolar en el Jukebox.', { id: 'share-jukebox' })
      return false
    } catch (e: any) {
      toast.error(`Error al compartir: ${e.message}`, { id: 'share-jukebox' })
      return false
    }
  }, [userId, supabase, addJukeboxTrack])

  return (
    <LocalLibraryContext.Provider
      value={{
        ready,
        tracks,
        playlists,
        usage,
        importFiles,
        removeTrack,
        createPlaylist,
        renamePlaylist,
        deletePlaylist,
        addToPlaylist,
        removeFromPlaylist,
        reorderPlaylist,
        nowPlaying,
        playing,
        position,
        duration,
        shuffle,
        repeat,
        playTrack,
        toggle,
        next,
        prev,
        seek,
        setShuffle,
        setRepeat,
        shareToJukebox,
      }}
    >
      {children}
    </LocalLibraryContext.Provider>
  )
}
