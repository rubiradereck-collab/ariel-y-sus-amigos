'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { toast } from 'sonner'
import Link from 'next/link'
import { 
  ChevronLeft, ChevronRight, ImagePlus, Loader2, MessageCircle, Send, Trash2, X,
  Coins, Crown, Sparkles, Filter, Bell, AlertCircle, ArrowDown
} from 'lucide-react'
import { MainLayout } from '@/components/layout/MainLayout'
import { createClient } from '@/lib/supabase/client'
import { useWallUnread } from '@/hooks/useWallUnread'
import { useUserStats } from '@/hooks/useUserStats'
import { rankFor } from '@/lib/ranks'

/* ------------------------------------------------------------------ */
/* Tipos y constantes                                                  */
/* ------------------------------------------------------------------ */

const BUCKET = 'muro-media'
const MAX_FILES = 6
const MAX_BYTES = 50 * 1024 * 1024
const REACTION_EMOJIS = ['👍', '😂', '🔥', '😮', '💀', '❤️']

interface MediaItem {
  url: string
  type: 'image' | 'video'
}

interface AuthorInfo {
  nickname: string | null
  username: string
  avatar_url: string | null
}

interface ReactionRow {
  emoji: string
  user_id: string
}

interface CommentRow {
  id: string
  content: string
  created_at: string
  author_id: string
  profiles: AuthorInfo | null
}

interface Post {
  id: string
  author_id: string
  content: string | null
  media_url: string | null
  media_type: string | null
  media: MediaItem[] | null
  is_important?: boolean
  created_at: string
  profiles: AuthorInfo | null
  comments: CommentRow[]
  reactions: ReactionRow[]
}

interface Profile {
  id: string
  nickname: string | null
  username: string
  avatar_url: string | null
  bio: string | null
  description: string | null
  role: string | null
}

interface PendingFile {
  id: string
  file: File
  previewUrl: string
  type: 'image' | 'video'
}

function mediaOf(post: Post): MediaItem[] {
  if (post.media && post.media.length > 0) return post.media
  if (post.media_url) {
    return [{ url: post.media_url, type: post.media_type === 'video' ? 'video' : 'image' }]
  }
  return []
}

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'hace un momento'
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`
  return new Date(iso).toLocaleDateString()
}

function Avatar({ info, size = 40 }: { info: AuthorInfo | Profile | null; size?: number }) {
  const name = info?.nickname || info?.username || '?'
  if (info?.avatar_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={info.avatar_url} alt="" style={{ width: size, height: size }} className="rounded-full border border-white/10 object-cover flex-shrink-0" />
  }
  return (
    <div
      style={{ width: size, height: size }}
      className="flex items-center justify-center rounded-full bg-sky-600/30 font-black text-sky-200 flex-shrink-0"
    >
      {name.slice(0, 1).toUpperCase()}
    </div>
  )
}

function MediaCarousel({ items }: { items: MediaItem[] }) {
  const [index, setIndex] = useState(0)
  const current = items[index]
  if (!current) return null

  const prev = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIndex((i) => (i === 0 ? items.length - 1 : i - 1))
  }
  const next = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIndex((i) => (i === items.length - 1 ? 0 : i + 1))
  }

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-black">
      {current.type === 'video' ? (
        <video src={current.url} controls playsInline className="h-full w-full object-contain" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={current.url} alt="" className="h-full w-full object-contain" />
      )}

      {items.length > 1 && (
        <>
          <button
            onClick={prev}
            aria-label="Anterior"
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-1.5 text-white backdrop-blur transition hover:bg-black"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={next}
            aria-label="Siguiente"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-1.5 text-white backdrop-blur transition hover:bg-black"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1 rounded-full bg-black/60 px-2 py-1 backdrop-blur">
            {items.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 w-1.5 rounded-full transition ${i === index ? 'w-4 bg-sky-400' : 'bg-white/40'}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Página principal del Muro                                           */
/* ------------------------------------------------------------------ */

export default function MuroPage() {
  const [supabase] = useState(() => createClient())
  const { stats } = useUserStats(supabase)

  const [profile, setProfile] = useState<Profile | null>(null)
  const profileRef = useRef<Profile | null>(null)
  profileRef.current = profile

  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [content, setContent] = useState('')
  const [files, setFiles] = useState<PendingFile[]>([])
  const [publishing, setPublishing] = useState<string | null>(null)
  const [isImportant, setIsImportant] = useState(false)
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({})
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({})

  // Filtros
  const [filter, setFilter] = useState<'all' | 'mine'>('all')
  const filterRef = useRef<'all' | 'mine'>('all')
  filterRef.current = filter
  const [myPostsCount, setMyPostsCount] = useState<number>(0)

  // No leídos & Snapshot
  const snapshotRef = useRef<{ lastSeenAt: string | null; count: number }>({ lastSeenAt: null, count: 0 })
  const [bannerCount, setBannerCount] = useState<number>(0)

  const fileInput = useRef<HTMLInputElement>(null)
  const filesRef = useRef<PendingFile[]>([])
  const refetchTimer = useRef<number | undefined>(undefined)
  const firstPostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    filesRef.current = files
  }, [files])

  useEffect(() => {
    return () => filesRef.current.forEach((f) => URL.revokeObjectURL(f.previewUrl))
  }, [])

  const fetchPosts = useCallback(async () => {
    let q = supabase
      .from('posts')
      .select(
        `id, author_id, content, media_url, media_type, media, is_important, created_at,
         profiles(username, nickname, avatar_url),
         comments(id, content, created_at, author_id, profiles(username, nickname, avatar_url)),
         reactions(emoji, user_id)`
      )
      .order('created_at', { ascending: false })
      .limit(50)

    if (filterRef.current === 'mine' && profileRef.current) {
      q = q.eq('author_id', profileRef.current.id)
    }

    const { data, error } = await q
    if (error) {
      toast.error('No se pudo cargar el muro.')
    } else if (data) {
      const rows = data as unknown as Post[]
      rows.forEach((p) => p.comments.sort((a, b) => a.created_at.localeCompare(b.created_at)))
      setPosts(rows)
    }

    // Contar mis posts
    if (profileRef.current) {
      const { count } = await supabase
        .from('posts')
        .select('id', { count: 'exact', head: true })
        .eq('author_id', profileRef.current.id)
      if (typeof count === 'number') setMyPostsCount(count)
    }

    setLoading(false)
  }, [supabase])

  const scheduleRefetch = useCallback(() => {
    window.clearTimeout(refetchTimer.current)
    refetchTimer.current = window.setTimeout(() => void fetchPosts(), 300)
  }, [fetchPosts])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data: auth } = await supabase.auth.getUser()
      if (auth.user) {
        const { data } = await supabase
          .from('profiles')
          .select('id, nickname, username, avatar_url, bio, description, role')
          .eq('id', auth.user.id)
          .maybeSingle()
        if (!cancelled && data) {
          setProfile(data as Profile)
          profileRef.current = data as Profile
        }
      }

      // Snapshot de no leídos antes de marcar visto
      await useWallUnread.getState().refresh()
      const { lastSeenAt, count, firstVisit } = useWallUnread.getState()
      snapshotRef.current = { lastSeenAt, count }
      if (count > 0 && !firstVisit) {
        setBannerCount(count)
      }

      if (!cancelled) await fetchPosts()

      // Marcar visto tras 3 segundos
      setTimeout(() => {
        if (!cancelled) void useWallUnread.getState().markSeen()
      }, 3000)
    })()

    const channel = supabase
      .channel('muro-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, scheduleRefetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, scheduleRefetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reactions' }, scheduleRefetch)
      .subscribe()

    return () => {
      cancelled = true
      window.clearTimeout(refetchTimer.current)
      supabase.removeChannel(channel)
    }
  }, [supabase, fetchPosts, scheduleRefetch])

  /* ------------------------- selección de archivos ----------------- */

  const handleFiles = (list: FileList | null) => {
    if (!list) return
    const incoming = Array.from(list)
    const accepted: PendingFile[] = []
    for (const file of incoming) {
      const isImage = file.type.startsWith('image/')
      const isVideo = file.type.startsWith('video/')
      if (!isImage && !isVideo) {
        toast.error(`"${file.name}" no es una imagen ni un video.`)
        continue
      }
      if (file.size > MAX_BYTES) {
        toast.error(`"${file.name}" supera los 50 MB.`)
        continue
      }
      if (files.length + accepted.length >= MAX_FILES) {
        toast.error(`Máximo ${MAX_FILES} archivos por publicación.`)
        break
      }
      accepted.push({
        id: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
        type: isVideo ? 'video' : 'image',
      })
    }
    if (accepted.length) setFiles((f) => [...f, ...accepted])
    if (fileInput.current) fileInput.current.value = ''
  }

  const removeFile = (id: string) => {
    setFiles((f) => {
      const target = f.find((x) => x.id === id)
      if (target) URL.revokeObjectURL(target.previewUrl)
      return f.filter((x) => x.id !== id)
    })
  }

  /* ------------------------- subida y creación --------------------- */

  const uploadFiles = async (userId: string): Promise<MediaItem[]> => {
    const uploaded: MediaItem[] = []
    for (let i = 0; i < files.length; i++) {
      const pf = files[i]
      setPublishing(`Subiendo archivo ${i + 1} de ${files.length}…`)
      const ext = pf.file.name.split('.').pop() || (pf.type === 'video' ? 'mp4' : 'jpg')
      const path = `${userId}/${Date.now()}_${crypto.randomUUID()}.${ext}`

      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, pf.file, {
        contentType: pf.file.type,
        upsert: false,
      })
      if (upErr) throw new Error(`Fallo al subir ${pf.file.name}: ${upErr.message}`)

      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path)
      uploaded.push({ url: pub.publicUrl, type: pf.type })
    }
    return uploaded
  }

  const createPost = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) {
      toast.error('Inicia sesión para publicar.')
      return
    }
    const trimmed = content.trim()
    if (!trimmed && files.length === 0) {
      toast.error('Escribe algo o agrega fotos/videos.')
      return
    }

    try {
      setPublishing('Preparando…')
      const uploaded = await uploadFiles(profile.id)

      setPublishing('Guardando publicación…')
      const { data: insertedPost, error } = await supabase
        .from('posts')
        .insert({
          author_id: profile.id,
          content: trimmed || null,
          media_url: uploaded[0]?.url ?? null,
          media_type: uploaded[0]?.type ?? null,
          media: uploaded,
          is_important: isImportant,
        })
        .select('id, is_important')
        .single()

      if (error) throw new Error(error.message)

      if (isImportant && insertedPost && !insertedPost.is_important) {
        toast('Ya usaste tus 3 avisos importantes de hoy; se publicó como post normal.')
      } else {
        toast.success(isImportant ? '¡Publicación importante enviada!' : '¡Publicado!')
      }

      files.forEach((f) => URL.revokeObjectURL(f.previewUrl))
      setFiles([])
      setContent('')
      setIsImportant(false)
      void fetchPosts()
    } catch (err) {
      toast.error(`No se pudo publicar: ${err instanceof Error ? err.message : 'error desconocido'}`)
    } finally {
      setPublishing(null)
    }
  }

  /* ------------------------- reacciones / comentarios -------------- */

  const toggleReaction = async (post: Post, emoji: string) => {
    if (!profile) return
    const mine = post.reactions.find((r) => r.user_id === profile.id && r.emoji === emoji)

    setPosts((all) =>
      all.map((p) =>
        p.id !== post.id
          ? p
          : {
              ...p,
              reactions: mine
                ? p.reactions.filter((r) => !(r.user_id === profile.id && r.emoji === emoji))
                : [...p.reactions, { emoji, user_id: profile.id }],
            }
      )
    )

    const { error } = mine
      ? await supabase.from('reactions').delete().match({ post_id: post.id, user_id: profile.id, emoji })
      : await supabase.from('reactions').insert({ post_id: post.id, user_id: profile.id, emoji })
    if (error) {
      toast.error('No se pudo registrar la reacción.')
      void fetchPosts()
    }
  }

  const addComment = async (post: Post) => {
    if (!profile) return
    const text = (commentDrafts[post.id] ?? '').trim()
    if (!text) return
    setCommentDrafts((d) => ({ ...d, [post.id]: '' }))
    const { error } = await supabase
      .from('comments')
      .insert({ post_id: post.id, author_id: profile.id, content: text })
    if (error) toast.error('No se pudo comentar.')
    else void fetchPosts()
  }

  const deleteComment = async (id: string) => {
    const { error } = await supabase.from('comments').delete().eq('id', id)
    if (error) toast.error('No se pudo borrar el comentario.')
    else void fetchPosts()
  }

  const deletePost = async (post: Post) => {
    if (!window.confirm('¿Borrar esta publicación?')) return
    const paths = mediaOf(post)
      .map((m) => m.url.split(`/${BUCKET}/`)[1])
      .filter((p): p is string => Boolean(p))
    const { error } = await supabase.from('posts').delete().eq('id', post.id)
    if (error) {
      toast.error('No se pudo borrar.')
      return
    }
    if (paths.length) await supabase.storage.from(BUCKET).remove(paths)
    setPosts((all) => all.filter((p) => p.id !== post.id))
    toast.success('Publicación borrada')
  }

  // Cálculos de nivel y progreso para el sidebar
  const level = stats?.level ?? 1
  const startXp = 25 * (level - 1) ** 2
  const endXp = 25 * level ** 2
  const curXp = stats?.xp_total ?? 0
  const xpPct = Math.min(100, Math.max(0, ((curXp - startXp) / Math.max(1, endXp - startXp)) * 100))

  return (
    <MainLayout>
      <div className="mx-auto w-full max-w-5xl px-4 py-8 grid gap-8 lg:grid-cols-[280px_minmax(0,1fr)]">
        
        {/* ========================================================= */}
        {/* SIDEBAR LATERAL: PERFIL DEL USUARIO ACTIVO Y FILTROS      */}
        {/* ========================================================= */}
        <aside className="lg:sticky lg:top-24 self-start space-y-4">
          <div className="rounded-3xl border border-white/10 bg-black/60 p-5 backdrop-blur-xl shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/10 rounded-full blur-2xl pointer-events-none" />
            
            {/* Cabecera de perfil */}
            <div className="flex flex-col items-center text-center">
              <div className="relative mb-3">
                <Avatar info={profile} size={76} />
                <span className="absolute -bottom-1 -right-1 bg-sky-500 text-black text-[10px] font-black px-1.5 py-0.5 rounded-full border border-black shadow">
                  Lv.{level}
                </span>
              </div>
              <h2 className="text-xl font-black text-white leading-tight">
                {profile?.nickname || profile?.username || 'Usuario'}
              </h2>
              <p className="text-xs text-zinc-400 font-bold">@{profile?.username || 'usuario'}</p>
              
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-xs font-black uppercase tracking-wider text-sky-300">
                <Crown className="w-3.5 h-3.5 text-yellow-400" />
                {rankFor(level)}
              </div>
            </div>

            {/* Biografía / Descripción */}
            <div className="mt-4 pt-4 border-t border-white/10 text-center">
              {profile?.bio || profile?.description ? (
                <p className="text-xs text-zinc-300 line-clamp-3 leading-relaxed">
                  "{profile.bio || profile.description}"
                </p>
              ) : (
                <Link
                  href="/settings"
                  className="text-xs text-sky-400/80 hover:text-sky-300 font-bold inline-block hover:underline"
                >
                  + Agrega tu descripción
                </Link>
              )}
            </div>

            {/* Barra de Nivel & XP */}
            <div className="mt-4 space-y-1">
              <div className="flex justify-between text-[11px] font-black uppercase text-zinc-400">
                <span>Nivel {level}</span>
                <span>{curXp.toLocaleString()} XP</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                <motion.div
                  className="h-full bg-gradient-to-r from-sky-400 to-indigo-500"
                  initial={false}
                  animate={{ width: `${xpPct}%` }}
                />
              </div>
            </div>

            {/* Estadísticas rápidas */}
            <div className="mt-4 grid grid-cols-2 gap-2 pt-3 border-t border-white/10 text-center">
              <div className="rounded-xl bg-white/5 p-2">
                <span className="block text-[10px] font-black text-zinc-400 uppercase">Monedas</span>
                <span className="text-sm font-black text-yellow-400 flex items-center justify-center gap-1">
                  <Coins className="w-3.5 h-3.5" /> {(stats?.coins ?? 0).toLocaleString()}
                </span>
              </div>
              <div className="rounded-xl bg-white/5 p-2">
                <span className="block text-[10px] font-black text-zinc-400 uppercase">Mis Posts</span>
                <span className="text-sm font-black text-white">{myPostsCount}</span>
              </div>
            </div>
          </div>

          {/* Filtros: Todas vs Mis Publicaciones */}
          <div className="rounded-2xl border border-white/10 bg-black/50 p-2 flex gap-1">
            <button
              onClick={() => {
                setFilter('all')
                setLoading(true)
                setTimeout(() => void fetchPosts(), 0)
              }}
              className={`flex-1 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition ${
                filter === 'all'
                  ? 'bg-sky-500 text-black shadow-[0_0_12px_rgba(14,165,233,0.5)]'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              Todas
            </button>
            <button
              onClick={() => {
                setFilter('mine')
                setLoading(true)
                setTimeout(() => void fetchPosts(), 0)
              }}
              className={`flex-1 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition ${
                filter === 'mine'
                  ? 'bg-sky-500 text-black shadow-[0_0_12px_rgba(14,165,233,0.5)]'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              Mis Posts ({myPostsCount})
            </button>
          </div>
        </aside>

        {/* ========================================================= */}
        {/* COLUMNA PRINCIPAL DEL MURO                                */}
        {/* ========================================================= */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-4xl font-black uppercase tracking-tight text-sky-400">El Muro</h1>
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
              {filter === 'mine' ? 'Mis publicaciones' : 'Actividad del grupo'}
            </span>
          </div>

          {/* Banner de publicaciones no leídas */}
          <AnimatePresence>
            {bannerCount > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                className="rounded-2xl border border-sky-400/40 bg-sky-950/40 p-4 backdrop-blur flex items-center justify-between gap-3 text-sky-200 shadow-[0_0_20px_rgba(14,165,233,0.2)]"
              >
                <div className="flex items-center gap-3">
                  <Bell className="w-5 h-5 text-sky-400 animate-bounce flex-shrink-0" />
                  <p className="text-sm font-bold">
                    Tienes <b className="text-white">{bannerCount}</b> {bannerCount === 1 ? 'publicación nueva' : 'publicaciones nuevas'} desde tu última visita.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => firstPostRef.current?.scrollIntoView({ behavior: 'smooth' })}
                    className="px-3 py-1 bg-sky-500 hover:bg-sky-400 text-black font-black text-xs rounded-xl flex items-center gap-1 transition"
                  >
                    <ArrowDown className="w-3.5 h-3.5" /> Ver
                  </button>
                  <button
                    onClick={() => setBannerCount(0)}
                    className="p-1 text-zinc-400 hover:text-white rounded-lg transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Compositor */}
          <form onSubmit={createPost} className="rounded-3xl border border-white/10 bg-black/50 p-4">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="¿Qué está pasando, pana?"
              rows={3}
              maxLength={1000}
              disabled={!!publishing}
              className="w-full resize-none rounded-2xl border border-white/10 bg-zinc-900 p-3 text-white outline-none focus:border-sky-500 disabled:opacity-60"
            />

            {files.length > 0 && (
              <div className="mt-3 grid grid-cols-3 gap-2">
                {files.map((f) => (
                  <div key={f.id} className="relative aspect-square overflow-hidden rounded-xl border border-white/10 bg-black">
                    {f.type === 'video' ? (
                      <video src={f.previewUrl} muted playsInline className="h-full w-full object-cover" />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={f.previewUrl} alt="" className="h-full w-full object-cover" />
                    )}
                    {!publishing && (
                      <button
                        type="button"
                        onClick={() => removeFile(f.id)}
                        aria-label="Quitar archivo"
                        className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white hover:bg-red-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                    {f.type === 'video' && (
                      <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 text-[10px] font-black text-white">
                        VIDEO
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-3">
              <div className="flex items-center gap-3">
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  hidden
                  onChange={(e) => handleFiles(e.target.files)}
                />
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  disabled={!!publishing || files.length >= MAX_FILES}
                  className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-zinc-300 transition hover:bg-white/10 disabled:opacity-50"
                >
                  <ImagePlus className="h-4 w-4 text-sky-400" /> Foto / Video
                </button>

                {/* Checkbox Importante */}
                <label className="flex items-center gap-2 text-xs font-bold text-zinc-300 cursor-pointer hover:text-white transition">
                  <input
                    type="checkbox"
                    checked={isImportant}
                    onChange={(e) => setIsImportant(e.target.checked)}
                    className="w-4 h-4 rounded border-white/20 bg-zinc-800 text-sky-500 focus:ring-0 cursor-pointer"
                  />
                  <span>📢 Importante (avisa al grupo)</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={!profile || !!publishing || (!content.trim() && files.length === 0)}
                className="flex items-center gap-2 rounded-xl bg-sky-600 px-5 py-2 font-black uppercase text-white text-xs transition hover:bg-sky-500 disabled:opacity-50"
              >
                {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {publishing ?? 'Publicar'}
              </button>
            </div>
          </form>

          {/* Listado de publicaciones */}
          <div ref={firstPostRef} />
          {loading ? (
            <div className="space-y-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-40 animate-pulse rounded-3xl border border-white/10 bg-white/5" />
              ))}
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-12 rounded-3xl border border-white/10 bg-black/30 p-6">
              <p className="font-bold text-zinc-400">
                {filter === 'mine' ? 'Aún no has publicado nada.' : 'Todavía no hay publicaciones. ¡Sé el primero!'}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <AnimatePresence initial={false}>
                {posts.map((post) => {
                  const items = mediaOf(post)
                  const isOpen = !!openComments[post.id]
                  const isNew = snapshotRef.current.lastSeenAt &&
                    post.created_at > snapshotRef.current.lastSeenAt &&
                    post.author_id !== profile?.id

                  const counts = REACTION_EMOJIS.map((emoji) => ({
                    emoji,
                    count: post.reactions.filter((r) => r.emoji === emoji).length,
                    mine: post.reactions.some((r) => r.emoji === emoji && r.user_id === profile?.id),
                  }))

                  return (
                    <motion.article
                      key={post.id}
                      layout
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.97 }}
                      className={`rounded-3xl border p-5 transition ${
                        post.is_important
                          ? 'border-amber-500/50 bg-gradient-to-b from-amber-950/20 to-black/60 shadow-[0_0_25px_rgba(245,158,11,0.15)]'
                          : isNew
                          ? 'border-sky-500/60 bg-black/60 ring-2 ring-sky-500/40 shadow-[0_0_20px_rgba(14,165,233,0.15)]'
                          : 'border-white/10 bg-black/50'
                      }`}
                    >
                      <header className="mb-3 flex items-center gap-3">
                        <Avatar info={post.profiles} size={44} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-black text-white truncate">
                              {post.profiles?.nickname || post.profiles?.username || 'Alguien'}
                            </p>
                            {post.is_important && (
                              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-[10px] font-black uppercase text-amber-300">
                                📢 Importante
                              </span>
                            )}
                            {isNew && (
                              <span className="px-2 py-0.5 rounded-full bg-sky-500/20 border border-sky-500/40 text-[10px] font-black uppercase text-sky-300 animate-pulse">
                                NUEVO
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-zinc-500">{timeAgo(post.created_at)}</p>
                        </div>
                        {post.author_id === profile?.id && (
                          <button
                            onClick={() => void deletePost(post)}
                            aria-label="Borrar publicación"
                            className="rounded-lg p-2 text-zinc-500 transition hover:bg-red-500/10 hover:text-red-400"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </header>

                      {post.content && <p className="mb-3 whitespace-pre-wrap text-zinc-200 text-sm leading-relaxed">{post.content}</p>}
                      {items.length > 0 && (
                        <div className="mb-3">
                          <MediaCarousel items={items} />
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/5">
                        {counts.map(({ emoji, count, mine }) => (
                          <motion.button
                            key={emoji}
                            whileTap={{ scale: 0.85 }}
                            onClick={() => void toggleReaction(post, emoji)}
                            className={`rounded-full border px-3 py-1 text-xs font-bold transition ${
                              mine
                                ? 'border-sky-400 bg-sky-500/20 text-sky-100'
                                : 'border-white/10 bg-white/5 text-zinc-400 hover:border-white/20 hover:text-white'
                            }`}
                          >
                            <span>{emoji}</span> {count > 0 && <span className="ml-1">{count}</span>}
                          </motion.button>
                        ))}

                        <button
                          onClick={() => setOpenComments((o) => ({ ...o, [post.id]: !o[post.id] }))}
                          className="ml-auto flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold text-zinc-400 transition hover:border-white/20 hover:text-white"
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                          <span>{post.comments.length}</span>
                        </button>
                      </div>

                      {/* Comentarios */}
                      {isOpen && (
                        <div className="mt-4 border-t border-white/10 pt-4 space-y-3">
                          {post.comments.map((c) => (
                            <div key={c.id} className="flex items-start gap-2.5 text-xs">
                              <Avatar info={c.profiles} size={28} />
                              <div className="flex-1 rounded-2xl bg-zinc-900/80 p-2.5 border border-white/5">
                                <div className="flex items-center justify-between gap-2 mb-1">
                                  <span className="font-black text-white">
                                    {c.profiles?.nickname || c.profiles?.username || 'Alguien'}
                                  </span>
                                  <span className="text-[10px] text-zinc-500">{timeAgo(c.created_at)}</span>
                                </div>
                                <p className="text-zinc-300 whitespace-pre-wrap">{c.content}</p>
                              </div>
                              {c.author_id === profile?.id && (
                                <button
                                  onClick={() => void deleteComment(c.id)}
                                  className="text-zinc-600 hover:text-red-400 p-1 transition"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          ))}

                          <div className="flex items-center gap-2 pt-2">
                            <input
                              type="text"
                              value={commentDrafts[post.id] ?? ''}
                              onChange={(e) => setCommentDrafts((d) => ({ ...d, [post.id]: e.target.value }))}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault()
                                  void addComment(post)
                                }
                              }}
                              placeholder="Escribe un comentario…"
                              className="flex-1 rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white outline-none focus:border-sky-500"
                            />
                            <button
                              onClick={() => void addComment(post)}
                              disabled={!(commentDrafts[post.id] ?? '').trim()}
                              className="rounded-xl bg-sky-600 px-4 py-2 text-xs font-black text-white transition hover:bg-sky-500 disabled:opacity-50"
                            >
                              Enviar
                            </button>
                          </div>
                        </div>
                      )}
                    </motion.article>
                  )
                })}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  )
}
