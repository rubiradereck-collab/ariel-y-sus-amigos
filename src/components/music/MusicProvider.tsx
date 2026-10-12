'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { ChevronDown, ChevronUp, Music, SkipForward, Volume2, VolumeX } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { extractYouTubeId, loadYouTubeApi, YT_STATE, type YTPlayer } from '@/lib/youtube'

/* ------------------------------------------------------------------ */
/* Tipos                                                               */
/* ------------------------------------------------------------------ */

export interface QueueItem {
  id: string
  title: string
  url: string
  kind: 'youtube' | 'audio'
  video_id: string | null
  thumb: string | null
  added_by: string
  added_name: string | null
  status: 'playing' | 'queued'
  started_at_ms: number | null
  votes: number
  my_vote: boolean
}

interface MusicState {
  server_now: number
  items: QueueItem[]
}

export interface SearchResult {
  videoId: string
  title: string
  channel: string
  thumb: string | null
}

export interface AddInput {
  url?: string
  videoId?: string
  title?: string
  thumb?: string | null
}

interface MusicContextValue {
  userId: string | null
  current: QueueItem | null
  queue: QueueItem[]
  elapsed: number
  listening: boolean
  setListening: (v: boolean) => void
  volume: number
  setVolume: (v: number) => void
  autoplayBlocked: boolean
  resume: () => void
  addTrack: (input: AddInput) => Promise<boolean>
  voteSkip: (id: string) => Promise<void>
  search: (q: string) => Promise<SearchResult[] | 'no_api_key'>
}

const MusicContext = createContext<MusicContextValue | null>(null)

export function useMusic(): MusicContextValue {
  const ctx = useContext(MusicContext)
  if (!ctx) throw new Error('useMusic debe usarse dentro de <MusicProvider>')
  return ctx
}

const SKIP_VOTES_NEEDED = 3 // igual que music_vote_skip en supabase_update.sql

const MUSIC_ERRORS: Record<string, string> = {
  queue_limit: 'Ya tienes 5 canciones en la cola. Espera a que suenen.',
  invalid_url: 'Enlace no válido (debe ser https).',
  invalid_video: 'No se reconoció el video de YouTube.',
  not_authenticated: 'Tu sesión expiró, vuelve a iniciar sesión.',
  not_found: 'Esa canción ya no está en la cola.',
}

function musicError(message: string): string {
  const key = Object.keys(MUSIC_ERRORS).find((k) => message.includes(k))
  return key ? MUSIC_ERRORS[key] : 'Ocurrió un error inesperado.'
}

export function formatTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/* ------------------------------------------------------------------ */
/* Provider                                                            */
/* ------------------------------------------------------------------ */

export function MusicProvider({ children }: { children: ReactNode }) {
  const [supabase] = useState(() => createClient())
  const pathname = usePathname()

  const [userId, setUserId] = useState<string | null>(null)
  const [items, setItems] = useState<QueueItem[]>([])
  const [listening, setListening] = useState<boolean>(true)
  const [volume, setVolumeState] = useState<number>(0.7)
  const [elapsed, setElapsed] = useState<number>(0)
  const [autoplayBlocked, setAutoplayBlocked] = useState<boolean>(false)
  const [nonce, setNonce] = useState<number>(0)

  const anchorRef = useRef<{ serverNow: number; local: number }>({ serverNow: 0, local: 0 })
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const ytHostRef = useRef<HTMLDivElement | null>(null)
  const ytPlayerRef = useRef<YTPlayer | null>(null)
  const ytReadyRef = useRef<Promise<YTPlayer> | null>(null)
  const loadedKeyRef = useRef<string>('')
  const currentRef = useRef<QueueItem | null>(null)
  const volumeRef = useRef<number>(0.7)
  const refreshTimer = useRef<number | undefined>(undefined)

  const current = useMemo(() => items.find((i) => i.status === 'playing') ?? null, [items])
  const queue = useMemo(() => items.filter((i) => i.status === 'queued'), [items])

  useEffect(() => {
    currentRef.current = current
  }, [current])

  /* ---- segundo exacto según el servidor ---- */
  const elapsedFor = useCallback((item: QueueItem): number => {
    if (!item.started_at_ms) return 0
    const { serverNow, local } = anchorRef.current
    return (serverNow - item.started_at_ms) / 1000 + (Date.now() - local) / 1000
  }, [])

  const refresh = useCallback(async () => {
    const { data, error } = await supabase.rpc('music_state')
    if (error || !data) return
    const s = data as MusicState
    anchorRef.current = { serverNow: s.server_now, local: Date.now() }
    setItems(s.items)
  }, [supabase])

  const advance = useCallback(
    async (id: string) => {
      await supabase.rpc('music_advance', { p_expected: id })
      await refresh()
    },
    [supabase, refresh]
  )
  const advanceRef = useRef(advance)
  useEffect(() => {
    advanceRef.current = advance
  }, [advance])

  /* ---- sesión ---- */
  useEffect(() => {
    let mounted = true
    supabase.auth.getUser().then(({ data }) => {
      if (mounted) setUserId(data.user?.id ?? null)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id ?? null)
    })
    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [supabase])

  /* ---- cola en vivo ---- */
  useEffect(() => {
    if (!userId) {
      setItems([])
      return
    }
    void refresh()
    const schedule = () => {
      window.clearTimeout(refreshTimer.current)
      refreshTimer.current = window.setTimeout(() => void refresh(), 150)
    }
    const channel = supabase
      .channel('music-queue')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'music_queue' }, schedule)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'music_skip_votes' }, schedule)
      .subscribe()
    return () => {
      window.clearTimeout(refreshTimer.current)
      supabase.removeChannel(channel)
    }
  }, [userId, supabase, refresh])

  /* ---- volumen persistente ---- */
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('music:volume')
      if (saved !== null) {
        const v = Math.min(1, Math.max(0, Number(saved)))
        if (Number.isFinite(v)) {
          volumeRef.current = v
          setVolumeState(v)
        }
      }
    } catch {
      // localStorage no disponible: se usa el volumen por defecto
    }
  }, [])

  const setVolume = useCallback((v: number) => {
    const clamped = Math.min(1, Math.max(0, v))
    volumeRef.current = clamped
    setVolumeState(clamped)
    if (audioRef.current) audioRef.current.volume = clamped
    ytPlayerRef.current?.setVolume(clamped * 100)
    try {
      window.localStorage.setItem('music:volume', String(clamped))
    } catch {
      // ignorar
    }
  }, [])

  /* ---- reproductor de YouTube oculto (se crea una sola vez) ---- */
  const ensureYT = useCallback((): Promise<YTPlayer> => {
    if (ytReadyRef.current) return ytReadyRef.current
    ytReadyRef.current = loadYouTubeApi().then(
      (YT) =>
        new Promise<YTPlayer>((resolve, reject) => {
          const host = ytHostRef.current
          if (!host) {
            reject(new Error('Sin contenedor para YouTube'))
            return
          }
          const mount = document.createElement('div')
          host.appendChild(mount)
          new YT.Player(mount, {
            width: 200,
            height: 200,
            playerVars: { playsinline: 1, controls: 0 },
            events: {
              onReady: (e) => {
                ytPlayerRef.current = e.target
                resolve(e.target)
              },
              onStateChange: (e) => {
                const cur = currentRef.current
                if (!cur || cur.kind !== 'youtube') return
                if (e.data === YT_STATE.ENDED) {
                  void advanceRef.current(cur.id)
                } else if (e.data === YT_STATE.PLAYING) {
                  setAutoplayBlocked(false)
                  const dur = e.target.getDuration()
                  // Cola "atrasada" (todos estaban desconectados): la canción ya terminó, se pasa a la siguiente.
                  if (dur > 0 && elapsedFor(cur) > dur + 3) void advanceRef.current(cur.id)
                }
              },
              onError: () => {
                const cur = currentRef.current
                if (cur && cur.kind === 'youtube') {
                  toast.error('No se pudo reproducir un video de la cola. Pasando al siguiente.')
                  void advanceRef.current(cur.id)
                }
              },
            },
          })
        })
    )
    return ytReadyRef.current
  }, [elapsedFor])

  /* ---- reproducir la canción actual en el segundo correcto ---- */
  const currentId = current?.id ?? null
  useEffect(() => {
    const audio = audioRef.current
    const key = `${currentId ?? 'none'}:${listening ? 1 : 0}:${userId ?? 'x'}:${nonce}`
    if (loadedKeyRef.current === key) return
    loadedKeyRef.current = key

    const cur = currentRef.current
    if (!cur || !listening || !userId) {
      audio?.pause()
      ytPlayerRef.current?.pauseVideo()
      return
    }

    const start = Math.max(0, elapsedFor(cur))

    if (cur.kind === 'audio') {
      ytPlayerRef.current?.pauseVideo()
      if (!audio) return
      audio.src = cur.url
      audio.volume = volumeRef.current
      const seek = () => {
        if (Number.isFinite(audio.duration) && start < audio.duration) {
          try {
            audio.currentTime = start
          } catch {
            // streams en vivo no permiten saltar: se escucha en directo
          }
        }
      }
      audio.addEventListener('loadedmetadata', seek, { once: true })
      audio
        .play()
        .then(() => setAutoplayBlocked(false))
        .catch(() => setAutoplayBlocked(true))
    } else {
      audio?.pause()
      ensureYT()
        .then((p) => {
          p.setVolume(volumeRef.current * 100)
          p.loadVideoById({ videoId: cur.video_id ?? '', startSeconds: start })
          window.setTimeout(() => {
            const st = p.getPlayerState()
            if (currentRef.current?.id === cur.id && st !== YT_STATE.PLAYING && st !== YT_STATE.BUFFERING) {
              setAutoplayBlocked(true)
            }
          }, 2500)
        })
        .catch(() => toast.error('No se pudo iniciar YouTube.'))
    }
  }, [currentId, listening, userId, nonce, elapsedFor, ensureYT])

  /* ---- contador de tiempo transcurrido ---- */
  useEffect(() => {
    if (!currentId) {
      setElapsed(0)
      return
    }
    const tick = () => {
      const c = currentRef.current
      if (c) setElapsed(Math.max(0, elapsedFor(c)))
    }
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [currentId, elapsedFor])

  /* ---- acciones públicas ---- */
  const resume = useCallback(() => {
    loadedKeyRef.current = ''
    setNonce((n) => n + 1)
  }, [])

  const addTrack = useCallback(
    async (input: AddInput): Promise<boolean> => {
      const raw = (input.url ?? '').trim()
      const ytId = input.videoId ?? extractYouTubeId(raw)

      let payload: {
        p_title: string
        p_url: string
        p_kind: 'youtube' | 'audio'
        p_video_id: string | null
        p_thumb: string | null
      }

      if (ytId) {
        let title = input.title
        if (!title) {
          try {
            const r = await fetch(`/api/yt?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${ytId}`)}`)
            if (r.ok) title = ((await r.json()) as { title: string }).title
          } catch {
            // sin título: se usa uno genérico
          }
        }
        payload = {
          p_title: title ?? 'Video de YouTube',
          p_url: `https://www.youtube.com/watch?v=${ytId}`,
          p_kind: 'youtube',
          p_video_id: ytId,
          p_thumb: input.thumb ?? `https://i.ytimg.com/vi/${ytId}/mqdefault.jpg`,
        }
      } else {
        let u: URL
        try {
          u = new URL(raw)
        } catch {
          toast.error('Enlace no válido.')
          return false
        }
        if (u.protocol !== 'https:') {
          toast.error('Solo se admiten enlaces https.')
          return false
        }
        let fileName = u.hostname
        try {
          fileName = decodeURIComponent(u.pathname.split('/').filter(Boolean).pop() ?? u.hostname)
        } catch {
          // nombre malformado: se usa el host
        }
        payload = {
          p_title: input.title ?? fileName,
          p_url: u.toString(),
          p_kind: 'audio',
          p_video_id: null,
          p_thumb: null,
        }
      }

      const { error } = await supabase.rpc('music_add', payload)
      if (error) {
        toast.error(musicError(error.message))
        return false
      }
      toast.success('Agregada a la cola 🎶')
      await refresh()
      return true
    },
    [supabase, refresh]
  )

  const voteSkip = useCallback(
    async (id: string) => {
      const { data, error } = await supabase.rpc('music_vote_skip', { p_id: id })
      if (error) {
        toast.error(musicError(error.message))
        return
      }
      const r = data as { skipped: boolean; votes: number }
      toast(r.skipped ? '⏭️ Canción saltada' : `Voto registrado (${r.votes}/${SKIP_VOTES_NEEDED})`)
      await refresh()
    },
    [supabase, refresh]
  )

  const search = useCallback(async (q: string): Promise<SearchResult[] | 'no_api_key'> => {
    const r = await fetch(`/api/yt?q=${encodeURIComponent(q)}`)
    if (r.status === 503) return 'no_api_key'
    if (!r.ok) throw new Error('search_failed')
    return ((await r.json()) as { results: SearchResult[] }).results
  }, [])

  const value = useMemo<MusicContextValue>(
    () => ({
      userId,
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
      voteSkip,
      search,
    }),
    [userId, current, queue, elapsed, listening, volume, setVolume, autoplayBlocked, resume, addTrack, voteSkip, search]
  )

  return (
    <MusicContext.Provider value={value}>
      {children}

      <audio
        ref={audioRef}
        preload="none"
        onEnded={() => {
          const c = currentRef.current
          if (c && c.kind === 'audio') void advance(c.id)
        }}
        onError={() => {
          const c = currentRef.current
          if (c && c.kind === 'audio') {
            toast.error('No se pudo reproducir una canción de la cola. Pasando a la siguiente.')
            void advance(c.id)
          }
        }}
      />
      <div
        ref={ytHostRef}
        aria-hidden
        className="pointer-events-none fixed -left-[9999px] top-0 h-[200px] w-[200px] overflow-hidden"
      />

      {userId && current && pathname !== '/musica' && <MiniPlayer />}
    </MusicContext.Provider>
  )
}

/* ------------------------------------------------------------------ */
/* Mini-reproductor global                                             */
/* ------------------------------------------------------------------ */

function MiniPlayer() {
  const { current, elapsed, listening, setListening, volume, setVolume, autoplayBlocked, resume, voteSkip } =
    useMusic()
  const [collapsed, setCollapsed] = useState<boolean>(false)
  if (!current) return null

  return (
    <motion.div
      initial={{ y: 40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed bottom-4 right-4 z-40 w-72 overflow-hidden rounded-2xl border border-fuchsia-500/30 bg-zinc-950/95 shadow-[0_0_30px_rgba(217,70,239,0.25)] backdrop-blur"
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <Music className="h-4 w-4 shrink-0 text-fuchsia-400" />
        <Link href="/musica" className="flex-1 truncate text-sm font-black text-white hover:text-fuchsia-300">
          {current.title}
        </Link>
        <button
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Expandir' : 'Minimizar'}
          className="text-zinc-400 hover:text-white"
        >
          {collapsed ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {!collapsed && (
        <div className="space-y-3 border-t border-white/10 px-3 pb-3 pt-2">
          <div className="flex items-center gap-3">
            {current.thumb && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={current.thumb} alt="" className="h-12 w-12 rounded-lg object-cover" />
            )}
            <div className="min-w-0 flex-1 text-xs text-zinc-400">
              <p className="truncate">Agregada por {current.added_name ?? 'alguien'}</p>
              <p className="font-mono text-fuchsia-300">{formatTime(elapsed)}</p>
            </div>
          </div>

          {autoplayBlocked && listening && (
            <button
              onClick={resume}
              className="w-full rounded-lg bg-fuchsia-600 py-2 text-xs font-black uppercase text-white hover:bg-fuchsia-500"
            >
              ▶ Toca para unirte al sonido
            </button>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={() => setListening(!listening)}
              aria-label={listening ? 'Silenciar para mí' : 'Escuchar'}
              className="rounded-lg border border-white/10 bg-white/5 p-2 text-white hover:bg-white/10"
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
              className="flex-1 accent-fuchsia-500"
            />
            <button
              onClick={() => void voteSkip(current.id)}
              disabled={current.my_vote}
              aria-label="Votar para saltar"
              className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-xs font-black text-white hover:bg-white/10 disabled:opacity-50"
            >
              <SkipForward className="h-4 w-4" /> {current.votes}/{SKIP_VOTES_NEEDED}
            </button>
          </div>
        </div>
      )}
    </motion.div>
  )
}
