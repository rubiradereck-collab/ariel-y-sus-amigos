'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { toast } from 'sonner'
import { Headphones, ListMusic, Loader2, Plus, Search, SkipForward, Volume2, VolumeX } from 'lucide-react'
import { MainLayout } from '@/components/layout/MainLayout'
import { formatTime, useMusic, type SearchResult } from '@/components/music/MusicProvider'

const SKIP_VOTES_NEEDED = 3

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
    voteSkip,
    search,
  } = useMusic()

  const [input, setInput] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [working, setWorking] = useState<boolean>(false)
  const [addingId, setAddingId] = useState<string | null>(null)

  const looksLikeUrl = (s: string) => /^https?:\/\//i.test(s.trim()) || /youtu\.?be/i.test(s)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const text = input.trim()
    if (!text || working) return
    setWorking(true)
    try {
      if (looksLikeUrl(text)) {
        const ok = await addTrack({ url: text })
        if (ok) {
          setInput('')
          setResults([])
        }
      } else {
        const res = await search(text)
        if (res === 'no_api_key') {
          toast.error('El buscador no está configurado. Pega un enlace o agrega YOUTUBE_API_KEY en Vercel.')
        } else if (res.length === 0) {
          toast('Sin resultados')
          setResults([])
        } else {
          setResults(res)
        }
      }
    } catch {
      toast.error('No se pudo completar la búsqueda.')
    } finally {
      setWorking(false)
    }
  }

  const handleAddResult = async (r: SearchResult) => {
    if (addingId) return
    setAddingId(r.videoId)
    await addTrack({ videoId: r.videoId, title: r.title, thumb: r.thumb })
    setAddingId(null)
  }

  return (
    <MainLayout>
      <div className="mx-auto w-full max-w-4xl px-4 py-8">
        <h1 className="mb-1 flex items-center gap-3 text-4xl font-black uppercase tracking-tight text-fuchsia-400">
          <Headphones className="h-9 w-9" /> Jukebox del grupo
        </h1>
        <p className="mb-8 font-medium text-zinc-400">
          Todos escuchan la misma canción al mismo tiempo. La música sigue sonando aunque cambies de página.
        </p>

        {/* Sonando ahora */}
        <section className="mb-8 overflow-hidden rounded-3xl border border-fuchsia-500/30 bg-gradient-to-br from-fuchsia-950/60 to-black p-5">
          <h2 className="mb-3 text-xs font-black uppercase tracking-widest text-fuchsia-300/80">Sonando ahora</h2>
          {current ? (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              {current.thumb && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={current.thumb} alt="" className="h-24 w-24 rounded-2xl object-cover" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-xl font-black text-white">{current.title}</p>
                <p className="text-sm text-zinc-400">
                  Agregada por {current.added_name ?? 'alguien'} ·{' '}
                  <span className="font-mono text-fuchsia-300">{formatTime(elapsed)}</span>
                </p>
                {autoplayBlocked && listening && (
                  <button
                    onClick={resume}
                    className="mt-2 rounded-lg bg-fuchsia-600 px-4 py-2 text-xs font-black uppercase text-white hover:bg-fuchsia-500"
                  >
                    ▶ Toca para unirte al sonido
                  </button>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setListening(!listening)}
                  aria-label={listening ? 'Silenciar para mí' : 'Escuchar'}
                  className="rounded-xl border border-white/10 bg-white/5 p-3 text-white hover:bg-white/10"
                >
                  {listening ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={volume}
                  onChange={(e) => setVolume(Number(e.target.value))}
                  aria-label="Volumen"
                  className="w-28 accent-fuchsia-500"
                />
                <button
                  onClick={() => void voteSkip(current.id)}
                  disabled={current.my_vote}
                  className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-white hover:bg-white/10 disabled:opacity-50"
                >
                  <SkipForward className="h-4 w-4" /> Saltar {current.votes}/{SKIP_VOTES_NEEDED}
                </button>
              </div>
            </div>
          ) : (
            <p className="font-medium text-zinc-500">Silencio total. Agrega la primera canción 🎶</p>
          )}
        </section>

        {/* Agregar canciones */}
        <section className="mb-8">
          <form onSubmit={handleSubmit} className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Busca en YouTube o pega un enlace (YouTube o audio https)"
                className="w-full rounded-xl border border-white/10 bg-zinc-900 py-3 pl-10 pr-3 text-white outline-none focus:border-fuchsia-500"
              />
            </div>
            <button
              type="submit"
              disabled={working || !input.trim()}
              className="flex items-center gap-2 rounded-xl bg-fuchsia-600 px-6 py-3 font-black uppercase text-white transition hover:bg-fuchsia-500 disabled:opacity-50"
            >
              {working ? <Loader2 className="h-4 w-4 animate-spin" /> : looksLikeUrl(input) ? <Plus className="h-4 w-4" /> : <Search className="h-4 w-4" />}
              {looksLikeUrl(input) ? 'Agregar' : 'Buscar'}
            </button>
          </form>

          <AnimatePresence>
            {results.length > 0 && (
              <motion.ul
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-4 grid gap-3 sm:grid-cols-2"
              >
                {results.map((r) => (
                  <li key={r.videoId} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/50 p-3">
                    {r.thumb && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.thumb} alt="" className="h-14 w-20 rounded-lg object-cover" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-bold text-white">{r.title}</p>
                      <p className="truncate text-xs text-zinc-500">{r.channel}</p>
                    </div>
                    <button
                      onClick={() => void handleAddResult(r)}
                      disabled={addingId !== null}
                      aria-label={`Agregar ${r.title}`}
                      className="rounded-xl bg-fuchsia-600 p-2 text-white hover:bg-fuchsia-500 disabled:opacity-50"
                    >
                      {addingId === r.videoId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    </button>
                  </li>
                ))}
              </motion.ul>
            )}
          </AnimatePresence>
        </section>

        {/* Cola */}
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-widest text-zinc-400">
            <ListMusic className="h-4 w-4" /> En cola ({queue.length})
          </h2>
          {queue.length === 0 ? (
            <p className="font-medium text-zinc-500">La cola está vacía.</p>
          ) : (
            <ul className="space-y-3">
              <AnimatePresence initial={false}>
                {queue.map((q, i) => (
                  <motion.li
                    key={q.id}
                    layout
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 16 }}
                    className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/50 p-3"
                  >
                    <span className="w-6 text-center font-black text-zinc-600">{i + 1}</span>
                    {q.thumb && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={q.thumb} alt="" className="h-12 w-16 rounded-lg object-cover" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold text-white">{q.title}</p>
                      <p className="text-xs text-zinc-500">por {q.added_name ?? 'alguien'}</p>
                    </div>
                    <button
                      onClick={() => void voteSkip(q.id)}
                      disabled={q.my_vote}
                      className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-black text-zinc-300 hover:bg-white/10 disabled:opacity-50"
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
    </MainLayout>
  )
}
