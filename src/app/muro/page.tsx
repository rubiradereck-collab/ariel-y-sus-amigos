'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight, ImagePlus, Loader2, MessageCircle, Send, Trash2, X } from 'lucide-react'
import { MainLayout } from '@/components/layout/MainLayout'
import { createClient } from '@/lib/supabase/client'

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
  created_at: string
  profiles: AuthorInfo | null
  comments: CommentRow[]
  reactions: ReactionRow[]
}

interface Profile {
  id: string
  nickname: string | null
  username: string
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

function Avatar({ info, size = 40 }: { info: AuthorInfo | null; size?: number }) {
  const name = info?.nickname || info?.username || '?'
  if (info?.avatar_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={info.avatar_url} alt="" style={{ width: size, height: size }} className="rounded-full border border-white/10 object-cover" />
  }
  return (
    <div
      style={{ width: size, height: size }}
      className="flex items-center justify-center rounded-full bg-sky-600/30 font-black text-sky-200"
    >
      {name.slice(0, 1).toUpperCase()}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Carrusel multimedia                                                 */
/* ------------------------------------------------------------------ */

function MediaCarousel({ items }: { items: MediaItem[] }) {
  const [index, setIndex] = useState(0)
  if (items.length === 0) return null
  const item = items[Math.min(index, items.length - 1)]

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black">
      {item.type === 'video' ? (
        <video key={item.url} src={item.url} controls playsInline preload="metadata" className="max-h-[520px] w-full" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={item.url} src={item.url} alt="" loading="lazy" className="max-h-[520px] w-full object-contain" />
      )}
      {items.length > 1 && (
        <>
          <button
            onClick={() => setIndex((i) => (i - 1 + items.length) % items.length)}
            aria-label="Anterior"
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white hover:bg-black/80"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={() => setIndex((i) => (i + 1) % items.length)}
            aria-label="Siguiente"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white hover:bg-black/80"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
            {items.map((_, i) => (
              <span key={i} className={`h-1.5 w-1.5 rounded-full ${i === index ? 'bg-white' : 'bg-white/40'}`} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Página                                                              */
/* ------------------------------------------------------------------ */

export default function MuroPage() {
  const [supabase] = useState(() => createClient())
  const [profile, setProfile] = useState<Profile | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [content, setContent] = useState('')
  const [files, setFiles] = useState<PendingFile[]>([])
  const [publishing, setPublishing] = useState<string | null>(null)
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({})
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({})
  const fileInput = useRef<HTMLInputElement | null>(null)
  const filesRef = useRef<PendingFile[]>([])
  const refetchTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    filesRef.current = files
  }, [files])

  // Libera las URLs de preview al salir
  useEffect(() => {
    return () => filesRef.current.forEach((f) => URL.revokeObjectURL(f.previewUrl))
  }, [])

  const fetchPosts = useCallback(async () => {
    const { data, error } = await supabase
      .from('posts')
      .select(
        `id, author_id, content, media_url, media_type, media, created_at,
         profiles(username, nickname, avatar_url),
         comments(id, content, created_at, author_id, profiles(username, nickname, avatar_url)),
         reactions(emoji, user_id)`
      )
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) {
      toast.error('No se pudo cargar el muro.')
    } else if (data) {
      const rows = data as unknown as Post[]
      rows.forEach((p) => p.comments.sort((a, b) => a.created_at.localeCompare(b.created_at)))
      setPosts(rows)
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
          .select('id, nickname, username')
          .eq('id', auth.user.id)
          .maybeSingle()
        if (!cancelled && data) setProfile(data as Profile)
      }
      if (!cancelled) await fetchPosts()
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

  /* ------------------------- publicar ------------------------------ */

  const createPost = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile || publishing) return
    const text = content.trim()
    if (!text && files.length === 0) return

    const uploaded: MediaItem[] = []
    try {
      for (let i = 0; i < files.length; i++) {
        setPublishing(`Subiendo ${i + 1}/${files.length}...`)
        const f = files[i]
        const safeName = f.file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        const path = `${profile.id}/${Date.now()}_${i}_${safeName}`
        const { error } = await supabase.storage.from(BUCKET).upload(path, f.file, {
          contentType: f.file.type,
          cacheControl: '3600',
          upsert: false,
        })
        if (error) throw new Error(error.message)
        const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
        uploaded.push({ url: data.publicUrl, type: f.type })
      }

      setPublishing('Publicando...')
      const first = uploaded[0]
      const { error } = await supabase.from('posts').insert({
        author_id: profile.id,
        content: text || null,
        media: uploaded,
        media_url: first?.url ?? null,
        media_type: first?.type ?? null,
      })
      if (error) throw new Error(error.message)

      files.forEach((f) => URL.revokeObjectURL(f.previewUrl))
      setFiles([])
      setContent('')
      toast.success('¡Publicado!')
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

    // Actualización optimista; Realtime reconcilia después.
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

  /* ------------------------- render -------------------------------- */

  return (
    <MainLayout>
      <div className="mx-auto w-full max-w-2xl px-4 py-8">
        <h1 className="mb-6 text-4xl font-black uppercase tracking-tight text-sky-400">El Muro</h1>

        {/* Compositor */}
        <form onSubmit={createPost} className="mb-8 rounded-3xl border border-white/10 bg-black/50 p-4">
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

          <div className="mt-3 flex items-center justify-between gap-3">
            <div>
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
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-zinc-300 transition hover:bg-white/10 disabled:opacity-50"
              >
                <ImagePlus className="h-4 w-4" /> Foto / Video
              </button>
            </div>
            <button
              type="submit"
              disabled={!profile || !!publishing || (!content.trim() && files.length === 0)}
              className="flex items-center gap-2 rounded-xl bg-sky-600 px-6 py-2 font-black uppercase text-white transition hover:bg-sky-500 disabled:opacity-50"
            >
              {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {publishing ?? 'Publicar'}
            </button>
          </div>
        </form>

        {/* Publicaciones */}
        {loading ? (
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-40 animate-pulse rounded-3xl border border-white/10 bg-white/5" />
            ))}
          </div>
        ) : posts.length === 0 ? (
          <p className="text-center font-medium text-zinc-500">Todavía no hay publicaciones. ¡Sé el primero!</p>
        ) : (
          <div className="space-y-6">
            <AnimatePresence initial={false}>
              {posts.map((post) => {
                const items = mediaOf(post)
                const isOpen = !!openComments[post.id]
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
                    className="rounded-3xl border border-white/10 bg-black/50 p-4"
                  >
                    <header className="mb-3 flex items-center gap-3">
                      <Avatar info={post.profiles} />
                      <div className="flex-1">
                        <p className="font-black text-white">
                          {post.profiles?.nickname || post.profiles?.username || 'Alguien'}
                        </p>
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

                    {post.content && <p className="mb-3 whitespace-pre-wrap text-zinc-200">{post.content}</p>}
                    {items.length > 0 && (
                      <div className="mb-3">
                        <MediaCarousel items={items} />
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2">
                      {counts.map(({ emoji, count, mine }) => (
                        <motion.button
                          key={emoji}
                          whileTap={{ scale: 0.85 }}
                          onClick={() => void toggleReaction(post, emoji)}
                          className={`rounded-full border px-3 py-1 text-sm font-bold transition ${
                            mine
                              ? 'border-sky-400 bg-sky-500/20 text-sky-100'
                              : 'border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10'
                          }`}
                        >
                          {emoji} {count > 0 && count}
                        </motion.button>
                      ))}
                      <button
                        onClick={() => setOpenComments((o) => ({ ...o, [post.id]: !o[post.id] }))}
                        className="ml-auto flex items-center gap-1 text-sm font-bold text-zinc-400 hover:text-white"
                      >
                        <MessageCircle className="h-4 w-4" /> {post.comments.length}
                      </button>
                    </div>

                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
                            {post.comments.map((c) => (
                              <div key={c.id} className="flex items-start gap-2">
                                <Avatar info={c.profiles} size={28} />
                                <div className="flex-1 rounded-2xl bg-white/5 px-3 py-2">
                                  <p className="text-xs font-black text-sky-300">
                                    {c.profiles?.nickname || c.profiles?.username || 'Alguien'}{' '}
                                    <span className="font-medium text-zinc-500">{timeAgo(c.created_at)}</span>
                                  </p>
                                  <p className="text-sm text-zinc-200">{c.content}</p>
                                </div>
                                {c.author_id === profile?.id && (
                                  <button
                                    onClick={() => void deleteComment(c.id)}
                                    aria-label="Borrar comentario"
                                    className="p-1 text-zinc-600 hover:text-red-400"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                            ))}
                            <form
                              onSubmit={(e) => {
                                e.preventDefault()
                                void addComment(post)
                              }}
                              className="flex gap-2"
                            >
                              <input
                                value={commentDrafts[post.id] ?? ''}
                                onChange={(e) => setCommentDrafts((d) => ({ ...d, [post.id]: e.target.value }))}
                                placeholder="Escribe un comentario..."
                                maxLength={500}
                                className="flex-1 rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-sky-500"
                              />
                              <button
                                type="submit"
                                aria-label="Enviar comentario"
                                className="rounded-xl bg-sky-600 px-3 text-white hover:bg-sky-500"
                              >
                                <Send className="h-4 w-4" />
                              </button>
                            </form>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.article>
                )
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </MainLayout>
  )
}
