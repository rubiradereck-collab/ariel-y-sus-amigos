'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { toast } from 'sonner'
import { Crown, Link as LinkIcon, Popcorn, Send, Users, Upload, Info, ChevronDown, ChevronUp, FileVideo } from 'lucide-react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type Hls from 'hls.js'
import { MainLayout } from '@/components/layout/MainLayout'
import { createClient } from '@/lib/supabase/client'
import { extractYouTubeId, loadYouTubeApi, YT_STATE, type YTPlayer } from '@/lib/youtube'

/* ------------------------------------------------------------------ */
/* Tipos                                                               */
/* ------------------------------------------------------------------ */

type SourceKind = 'youtube' | 'file' | 'hls'

interface Source {
  kind: SourceKind
  url: string
  videoId?: string
}

interface Viewer {
  id: string
  nickname: string
  avatar_url: string | null
  joined_at: number
}

interface ChatMsg {
  id: string
  nickname: string
  text: string
  at: number
}

interface FloatingReaction {
  id: string
  emoji: string
  x: number
}

interface Controller {
  play(): void
  pause(): void
  seek(t: number): void
  time(): number
  playing(): boolean
}

interface Pending {
  t: number
  playing: boolean
}

interface SyncRequestPayload {
  by: string
}
interface SyncStatePayload {
  to: string
  source: Source
  t: number
  playing: boolean
  sentAt: number
}
interface LoadPayload {
  source: Source
}
interface TimePayload {
  t: number
}
interface ReactionPayload {
  emoji: string
}

const ROOM = 'watchparty:cine'
const EMOJIS = ['😂', '🍿', '😱', '🔥', '💀']

function parseSource(raw: string): Source | null {
  const url = raw.trim()
  if (!url) return null
  const id = extractYouTubeId(url)
  if (id) return { kind: 'youtube', url, videoId: id }
  try {
    const u = new URL(url)
    if (u.protocol !== 'https:') return null
    if (/\.m3u8$/i.test(u.pathname)) return { kind: 'hls', url }
    return { kind: 'file', url }
  } catch {
    return null
  }
}

/* ------------------------------------------------------------------ */
/* Página                                                              */
/* ------------------------------------------------------------------ */

export default function WatchPartyPage() {
  const [supabase] = useState(() => createClient())

  const [source, setSource] = useState<Source | null>(null)
  const [urlInput, setUrlInput] = useState('')
  const [viewers, setViewers] = useState<Viewer[]>([])
  const [connected, setConnected] = useState(false)
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [chatInput, setChatInput] = useState('')
  const [reactions, setReactions] = useState<FloatingReaction[]>([])
  const [now, setNow] = useState<number>(0)
  const [myId, setMyId] = useState<string | null>(null)
  const [uploading, setUploading] = useState<boolean>(false)
  const [showDrmInfo, setShowDrmInfo] = useState<boolean>(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const channelRef = useRef<RealtimeChannel | null>(null)
  const ctrlRef = useRef<Controller | null>(null)
  const sourceRef = useRef<Source | null>(null)
  const viewersRef = useRef<Viewer[]>([])
  const uidRef = useRef<string | null>(null)
  const nickRef = useRef<string>('Anónimo')
  const pendingRef = useRef<Pending | null>(null)
  const lockRef = useRef<boolean>(false)
  const lockTimer = useRef<number | undefined>(undefined)
  const pauseTimer = useRef<number | undefined>(undefined)
  const lastTimeRef = useRef<number>(0)
  const ytHostRef = useRef<HTMLDivElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  /* ------------------------- utilidades ---------------------------- */

  const send = useCallback((event: string, payload: Record<string, unknown>) => {
    void channelRef.current?.send({ type: 'broadcast', event, payload })
  }, [])

  // Ejecuta una acción remota sin que los eventos locales resultantes se re-emitan (evita bucles).
  const applyRemote = useCallback((fn: () => void) => {
    lockRef.current = true
    try {
      fn()
    } finally {
      window.clearTimeout(lockTimer.current)
      lockTimer.current = window.setTimeout(() => {
        lockRef.current = false
      }, 900)
    }
  }, [])

  const applyPending = useCallback(() => {
    const p = pendingRef.current
    const c = ctrlRef.current
    if (!p || !c) return
    pendingRef.current = null
    applyRemote(() => {
      c.seek(p.t)
      if (p.playing) c.play()
      else c.pause()
    })
  }, [applyRemote])

  const loadSource = useCallback((src: Source, pending: Pending | null) => {
    ctrlRef.current = null
    pendingRef.current = pending
    sourceRef.current = src
    setSource(src)
  }, [])

  const isHost = useCallback((): boolean => {
    const list = viewersRef.current
    if (list.length === 0) return true
    return list[0].id === uidRef.current
  }, [])

  const handleRemote = useCallback(
    (kind: 'play' | 'pause' | 'seek', t: number) => {
      const c = ctrlRef.current
      if (!c) {
        pendingRef.current = {
          t,
          playing: kind === 'seek' ? pendingRef.current?.playing ?? true : kind === 'play',
        }
        return
      }
      applyRemote(() => {
        if (kind === 'pause') {
          c.pause()
          c.seek(t)
        } else if (kind === 'play') {
          if (Math.abs(c.time() - t) > 0.8) c.seek(t)
          c.play()
        } else {
          c.seek(t)
        }
      })
    },
    [applyRemote]
  )

  const addMessage = useCallback((msg: ChatMsg) => {
    setMessages((m) => [...m, msg].slice(-40))
  }, [])

  const spawnReaction = useCallback((emoji: string) => {
    const id = `${Date.now()}-${Math.random()}`
    setReactions((r) => [...r, { id, emoji, x: 8 + Math.random() * 80 }])
    window.setTimeout(() => setReactions((r) => r.filter((x) => x.id !== id)), 3200)
  }, [])

  /* ------------------------- canal Realtime ------------------------ */

  useEffect(() => {
    let cancelled = false
    let channel: RealtimeChannel | null = null

    ;(async () => {
      const { data: auth } = await supabase.auth.getUser()
      if (cancelled || !auth.user) return
      const uid = auth.user.id
      uidRef.current = uid
      setMyId(uid)

      const { data: prof } = await supabase
        .from('profiles')
        .select('nickname, username, avatar_url')
        .eq('id', uid)
        .maybeSingle()
      if (cancelled) return

      const nickname: string = prof?.nickname || prof?.username || 'Anónimo'
      const avatar: string | null = prof?.avatar_url ?? null
      nickRef.current = nickname

      const ch = supabase.channel(ROOM, {
        config: { broadcast: { self: false }, presence: { key: uid } },
      })
      channel = ch
      channelRef.current = ch

      ch.on('broadcast', { event: 'load' }, ({ payload }) => {
        const p = payload as LoadPayload
        loadSource(p.source, { t: 0, playing: true })
        toast('🍿 Nueva película en la sala')
      })
      ch.on('broadcast', { event: 'play' }, ({ payload }) => handleRemote('play', (payload as TimePayload).t))
      ch.on('broadcast', { event: 'pause' }, ({ payload }) => handleRemote('pause', (payload as TimePayload).t))
      ch.on('broadcast', { event: 'seek' }, ({ payload }) => handleRemote('seek', (payload as TimePayload).t))

      // Un recién llegado pide el estado; el anfitrión (el que entró primero) responde.
      ch.on('broadcast', { event: 'sync_request' }, ({ payload }) => {
        const p = payload as SyncRequestPayload
        const src = sourceRef.current
        const c = ctrlRef.current
        if (!src || !isHost()) return
        send('sync_state', {
          to: p.by,
          source: src,
          t: c ? c.time() : 0,
          playing: c ? c.playing() : false,
          sentAt: Date.now(),
        })
      })

      ch.on('broadcast', { event: 'sync_state' }, ({ payload }) => {
        const p = payload as SyncStatePayload
        if (p.to !== uidRef.current) return
        const t = p.t + (p.playing ? (Date.now() - p.sentAt) / 1000 : 0)
        const current = sourceRef.current
        if (current && current.url === p.source.url && ctrlRef.current) {
          handleRemote(p.playing ? 'play' : 'pause', t)
        } else {
          loadSource(p.source, { t, playing: p.playing })
        }
        toast.success('Sincronizado con la sala')
      })

      ch.on('broadcast', { event: 'chat' }, ({ payload }) => addMessage(payload as ChatMsg))
      ch.on('broadcast', { event: 'reaction' }, ({ payload }) => spawnReaction((payload as ReactionPayload).emoji))

      ch.on('presence', { event: 'sync' }, () => {
        const state = ch.presenceState<Viewer>()
        const list = Object.values(state)
          .map((arr) => arr[0])
          .filter((v): v is Viewer & { presence_ref: string } => Boolean(v))
          .map((v) => ({ id: v.id, nickname: v.nickname, avatar_url: v.avatar_url, joined_at: v.joined_at }))
          .sort((a, b) => a.joined_at - b.joined_at || a.id.localeCompare(b.id))
        viewersRef.current = list
        setViewers(list)
      })

      ch.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await ch.track({ id: uid, nickname, avatar_url: avatar, joined_at: Date.now() })
          setConnected(true)
          void ch.send({ type: 'broadcast', event: 'sync_request', payload: { by: uid } })
        }
        if (status === 'CLOSED' || status === 'CHANNEL_ERROR') setConnected(false)
      })
    })()

    return () => {
      cancelled = true
      if (channel) supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [supabase, loadSource, handleRemote, isHost, send, addMessage, spawnReaction])

  // Reloj para desvanecer el chat flotante
  useEffect(() => {
    setNow(Date.now())
    const id = window.setInterval(() => setNow(Date.now()), 2000)
    return () => window.clearInterval(id)
  }, [])

  /* ------------------------- reproductor YouTube ------------------- */

  useEffect(() => {
    if (!source || source.kind !== 'youtube' || !source.videoId) return
    const videoId = source.videoId
    let destroyed = false
    let player: YTPlayer | null = null
    let interval: number | undefined

    loadYouTubeApi()
      .then((YT) => {
        const host = ytHostRef.current
        if (destroyed || !host) return
        host.innerHTML = ''
        const mount = document.createElement('div')
        host.appendChild(mount)

        player = new YT.Player(mount, {
          width: '100%',
          height: '100%',
          videoId,
          playerVars: { playsinline: 1, rel: 0, modestbranding: 1 },
          events: {
            onReady: (e) => {
              const p = e.target
              ctrlRef.current = {
                play: () => p.playVideo(),
                pause: () => p.pauseVideo(),
                seek: (t) => p.seekTo(t, true),
                time: () => p.getCurrentTime(),
                playing: () => p.getPlayerState() === YT_STATE.PLAYING,
              }
              applyPending()
            },
            onStateChange: (e) => {
              if (lockRef.current) return
              if (e.data === YT_STATE.PLAYING) {
                window.clearTimeout(pauseTimer.current)
                send('play', { t: e.target.getCurrentTime() })
              } else if (e.data === YT_STATE.PAUSED) {
                // Al arrastrar la barra YouTube emite "pausa" un instante: se espera para confirmar.
                window.clearTimeout(pauseTimer.current)
                pauseTimer.current = window.setTimeout(() => {
                  if (!lockRef.current && e.target.getPlayerState() === YT_STATE.PAUSED) {
                    send('pause', { t: e.target.getCurrentTime() })
                  }
                }, 350)
              }
            },
          },
        })

        // YouTube no emite evento de "seek": se detecta como un salto en el tiempo.
        interval = window.setInterval(() => {
          if (!player || !ctrlRef.current) return
          const cur = player.getCurrentTime()
          const playing = player.getPlayerState() === YT_STATE.PLAYING
          const expected = lastTimeRef.current + (playing ? 0.5 : 0)
          if (!lockRef.current && Math.abs(cur - expected) > 1.5) send('seek', { t: cur })
          lastTimeRef.current = cur
        }, 500)
      })
      .catch(() => toast.error('No se pudo cargar el reproductor de YouTube.'))

    return () => {
      destroyed = true
      if (interval) window.clearInterval(interval)
      window.clearTimeout(pauseTimer.current)
      try {
        player?.destroy()
      } catch {
        // el iframe ya pudo haber sido removido
      }
      ctrlRef.current = null
    }
  }, [source, send, applyPending])

  /* ------------------------- reproductor MP4 / HLS ----------------- */

  useEffect(() => {
    if (!source || source.kind === 'youtube') return
    const v = videoRef.current
    if (!v) return
    const url = source.url
    let hls: Hls | null = null
    let cancelled = false

    if (source.kind === 'hls' && !v.canPlayType('application/vnd.apple.mpegurl')) {
      import('hls.js')
        .then(({ default: HlsLib }) => {
          if (cancelled) return
          if (!HlsLib.isSupported()) {
            toast.error('Tu navegador no soporta HLS.')
            return
          }
          hls = new HlsLib()
          hls.loadSource(url)
          hls.attachMedia(v)
        })
        .catch(() => toast.error('No se pudo cargar HLS (¿instalaste hls.js?).'))
    } else {
      v.src = url
    }

    ctrlRef.current = {
      play: () => {
        void v.play().catch(() => toast('Toca el reproductor para unirte a la reproducción.'))
      },
      pause: () => v.pause(),
      seek: (t) => {
        v.currentTime = t
      },
      time: () => v.currentTime,
      playing: () => !v.paused,
    }

    return () => {
      cancelled = true
      hls?.destroy()
      v.removeAttribute('src')
      v.load()
      ctrlRef.current = null
    }
  }, [source])

  /* ------------------------- acciones de UI ------------------------ */

  const handleLoad = () => {
    const src = parseSource(urlInput)
    if (!src) {
      toast.error('Enlace no válido. Usa YouTube, un .mp4/.webm directo o un .m3u8 (todo en https).')
      return
    }
    loadSource(src, { t: 0, playing: true })
    send('load', { source: src })
    setUrlInput('')
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 52428800) {
      toast.error('El archivo supera los 50 MB (límite del plan gratuito de Supabase)')
      return
    }
    setUploading(true)
    const toastId = toast.loading('Subiendo video a la sala…')
    try {
      const fileName = `${myId || 'anon'}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
      const { error } = await supabase.storage.from('watchparty').upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
      })
      if (error) {
        toast.error(`Error al subir: ${error.message}`, { id: toastId })
        return
      }
      const { data: pub } = supabase.storage.from('watchparty').getPublicUrl(fileName)
      toast.success('¡Video subido con éxito!', { id: toastId })
      const src: Source = { kind: 'file', url: pub.publicUrl }
      loadSource(src, { t: 0, playing: true })
      send('load', { source: src })
    } catch {
      toast.error('Error al procesar el archivo', { id: toastId })
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault()
    const text = chatInput.trim().slice(0, 200)
    if (!text) return
    const msg: ChatMsg = { id: crypto.randomUUID(), nickname: nickRef.current, text, at: Date.now() }
    addMessage(msg)
    send('chat', { ...msg })
    setChatInput('')
  }

  const handleReaction = (emoji: string) => {
    spawnReaction(emoji)
    send('reaction', { emoji })
  }

  const localPlay = () => {
    if (lockRef.current || !videoRef.current) return
    send('play', { t: videoRef.current.currentTime })
  }
  const localPause = () => {
    if (lockRef.current || !videoRef.current) return
    send('pause', { t: videoRef.current.currentTime })
  }
  const localSeek = () => {
    if (lockRef.current || !videoRef.current) return
    send('seek', { t: videoRef.current.currentTime })
  }

  const visibleMessages = messages.filter((m) => now - m.at < 15000).slice(-5)

  /* ------------------------- render -------------------------------- */

  return (
    <MainLayout>
      <div className="mx-auto w-full max-w-7xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h1 className="flex items-center gap-4 text-4xl font-black text-red-500">
            <Popcorn className="h-9 w-9" /> Cine en Casa
          </h1>
          <span
            className={`rounded-full border px-3 py-1 text-xs font-black uppercase tracking-widest ${
              connected
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                : 'border-zinc-600 bg-zinc-800 text-zinc-400'
            }`}
          >
            {connected ? 'En vivo' : 'Conectando...'}
          </span>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
          <div>
            <div className="relative aspect-video overflow-hidden rounded-3xl border border-white/10 bg-black">
              {!source && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center text-zinc-500">
                  <Popcorn className="h-14 w-14 opacity-40" />
                  <p className="px-6 font-semibold">
                    Pega un enlace abajo para empezar. Todos los que estén en la sala lo verán sincronizado.
                  </p>
                </div>
              )}

              {source?.kind === 'youtube' && <div ref={ytHostRef} className="absolute inset-0 h-full w-full" />}

              {source && source.kind !== 'youtube' && (
                <video
                  ref={videoRef}
                  controls
                  playsInline
                  className="absolute inset-0 h-full w-full bg-black"
                  onLoadedMetadata={applyPending}
                  onPlay={localPlay}
                  onPause={localPause}
                  onSeeked={localSeek}
                />
              )}

              {/* Capa superpuesta: chat flotante y reacciones (no bloquea los controles) */}
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute bottom-14 left-3 flex max-w-[60%] flex-col gap-1">
                  <AnimatePresence>
                    {visibleMessages.map((m) => (
                      <motion.div
                        key={m.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0 }}
                        className="w-fit rounded-xl bg-black/55 px-3 py-1 text-sm text-white backdrop-blur-sm"
                      >
                        <span className="font-black text-red-400">{m.nickname}: </span>
                        {m.text}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>

                <AnimatePresence>
                  {reactions.map((r) => (
                    <motion.span
                      key={r.id}
                      initial={{ y: 0, opacity: 1, scale: 0.6 }}
                      animate={{ y: -240, opacity: 0, scale: 1.6 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 3, ease: 'easeOut' }}
                      className="absolute bottom-16 text-4xl"
                      style={{ left: `${r.x}%` }}
                    >
                      {r.emoji}
                    </motion.span>
                  ))}
                </AnimatePresence>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <LinkIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <input
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLoad()}
                  placeholder="YouTube, .mp4 directo o stream .m3u8 (https)"
                  className="w-full rounded-xl border border-white/10 bg-zinc-900 py-3 pl-10 pr-3 text-white outline-none focus:border-red-500"
                />
              </div>
              <button
                onClick={handleLoad}
                className="cursor-pointer rounded-xl bg-red-600 px-6 py-3 font-black uppercase text-white transition hover:bg-red-500"
              >
                Reproducir para todos
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/mp4,video/webm,video/ogg"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-bold uppercase tracking-wider text-zinc-300 transition hover:bg-white/10 disabled:opacity-50"
              >
                <Upload className="h-4 w-4 text-red-400" />
                {uploading ? 'Subiendo…' : 'Subir .mp4 (50MB)'}
              </button>
            </div>

            {/* Bloque Informativo: ¿Por qué no Netflix / Disney+? */}
            <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-black/40">
              <button
                onClick={() => setShowDrmInfo((v) => !v)}
                className="flex w-full cursor-pointer items-center justify-between p-3.5 text-left text-xs font-bold text-zinc-400 transition hover:bg-white/5"
              >
                <span className="flex items-center gap-2 text-zinc-300">
                  <Info className="h-4 w-4 text-yellow-400" />
                  ¿Se pueden reproducir enlaces de Netflix, Disney+ o Prime Video?
                </span>
                {showDrmInfo ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {showDrmInfo && (
                <div className="border-t border-white/5 p-4 text-xs leading-relaxed text-zinc-400 space-y-2">
                  <p>
                    <strong className="text-zinc-200">No es posible técnica ni legalmente:</strong> Las plataformas de streaming comerciales utilizan medidas de seguridad estrictas que impiden su inserción en reproductores web de terceros:
                  </p>
                  <ul className="list-disc pl-5 space-y-1 text-zinc-400">
                    <li>
                      <strong className="text-zinc-300">Cabeceras anti-embebido:</strong> Sus servidores envían <code className="text-red-400">X-Frame-Options: DENY</code> y <code className="text-red-400">Content-Security-Policy: frame-ancestors &apos;none&apos;</code>, lo que hace que los navegadores bloqueen de inmediato cualquier intento de cargarlas dentro de otra web.
                    </li>
                    <li>
                      <strong className="text-zinc-300">Cifrado DRM de Hardware (Widevine / PlayReady):</strong> El video viaja cifrado en bloques CENC y se decodifica en un chip protegido del sistema operativo. La clave nunca pasa por JavaScript, y compartirla eludiendo la protección viola las leyes de derechos de autor (DMCA §1201).
                    </li>
                  </ul>
                  <p className="text-zinc-300">
                    💡 <strong>Solución soportada:</strong> Puedes ver videos sincronizados de <span className="text-red-400">YouTube</span>, streams en directo <span className="text-red-400">.m3u8 (HLS)</span> y archivos <span className="text-red-400">.mp4 / .webm</span> directos o subidos desde tu equipo con el botón de subida.
                  </p>
                </div>
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {EMOJIS.map((e) => (
                <motion.button
                  key={e}
                  whileTap={{ scale: 0.8 }}
                  onClick={() => handleReaction(e)}
                  className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-2xl transition hover:bg-white/10"
                >
                  {e}
                </motion.button>
              ))}
            </div>

            <form onSubmit={handleSendChat} className="mt-3 flex gap-2">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                maxLength={200}
                placeholder="Escribe en el chat del cine..."
                className="flex-1 rounded-xl border border-white/10 bg-zinc-900 p-3 text-white outline-none focus:border-red-500"
              />
              <button
                type="submit"
                aria-label="Enviar mensaje"
                className="rounded-xl bg-zinc-800 px-4 text-white transition hover:bg-zinc-700"
              >
                <Send className="h-5 w-5" />
              </button>
            </form>
            <p className="mt-2 text-xs text-zinc-500">
              El chat del cine es efímero: solo lo ven quienes están en la sala en ese momento.
            </p>
          </div>

          <aside className="h-fit rounded-3xl border border-white/10 bg-black/50 p-5">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-black uppercase tracking-widest text-zinc-400">
              <Users className="h-4 w-4" /> En la sala ({viewers.length})
            </h2>
            <ul className="space-y-3">
              {viewers.map((v, i) => (
                <li key={v.id} className="flex items-center gap-3">
                  {v.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={v.avatar_url} alt="" className="h-9 w-9 rounded-full border border-white/10 object-cover" />
                  ) : (
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-600/30 text-sm font-black text-red-200">
                      {v.nickname.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <span className="flex-1 truncate font-bold text-white">
                    {v.nickname}
                    {v.id === myId && <span className="ml-1 text-xs text-zinc-500">(tú)</span>}
                  </span>
                  {i === 0 && <Crown className="h-4 w-4 text-yellow-500" aria-label="Anfitrión" />}
                </li>
              ))}
              {viewers.length === 0 && <li className="text-sm text-zinc-500">Nadie todavía...</li>}
            </ul>
          </aside>
        </div>
      </div>
    </MainLayout>
  )
}
