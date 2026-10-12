'use client'

import { MainLayout } from '@/components/layout/MainLayout'
import { createClient } from '@/lib/supabase/client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Camera, Coins, Crown, Loader2, MessageSquare, Newspaper, Trophy } from 'lucide-react'
import { toast } from 'sonner'

const MAX_AVATAR_BYTES = 5 * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

interface RichProfile {
  id: string
  nickname: string | null
  username: string | null
  avatar_url: string | null
  bio: string | null
  description: string | null
  role: string | null
  equippedRole: string | null
  level: number
  xp: number
  coins: number
  posts: number
  messages: number
  achievements: number
}

/** Mismo cálculo que /tienda: nivel = floor(sqrt(xp/25)) + 1  ->  tramo [25(L-1)², 25L²) */
function levelProgress(xp: number, level: number) {
  const start = 25 * (level - 1) ** 2
  const end = 25 * level ** 2
  return { pct: Math.min(100, Math.max(0, ((xp - start) / (end - start)) * 100)), next: end - xp }
}

export default function ProfilesPage() {
  const supabase = useMemo(() => createClient(), [])
  const [profiles, setProfiles] = useState<RichProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [me, setMe] = useState<string | null>(null)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser()
    setMe(auth.user?.id ?? null)

    const [users, stats, posts, msgs, achs, equipped] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: true }),
      supabase.from('user_stats').select('user_id, level, xp_total, coins'),
      supabase.from('posts').select('author_id'),
      supabase.from('messages').select('sender_id'),
      supabase.from('user_achievements').select('user_id'),
      supabase
        .from('user_inventory')
        .select('user_id, shop_items(category, payload)')
        .eq('equipped', true),
    ])
    if (users.error || !users.data) {
      toast.error('No se pudieron cargar los perfiles.')
      setLoading(false)
      return
    }

    const countBy = (rows: any[] | null, key: string) => {
      const m = new Map<string, number>()
      rows?.forEach(r => m.set(r[key], (m.get(r[key]) ?? 0) + 1))
      return m
    }
    const statsMap = new Map((stats.data ?? []).map((s: any) => [s.user_id, s]))
    const postCount = countBy(posts.data, 'author_id')
    const msgCount = countBy(msgs.data, 'sender_id')
    const achCount = countBy(achs.data, 'user_id')
    const roleMap = new Map<string, string>()
    ;(equipped.data ?? []).forEach((r: any) => {
      const item = Array.isArray(r.shop_items) ? r.shop_items[0] : r.shop_items
      if (item?.category === 'role' && item.payload?.role) roleMap.set(r.user_id, item.payload.role)
    })

    setProfiles(
      users.data.map((p: any): RichProfile => {
        const st: any = statsMap.get(p.id)
        return {
          ...p,
          equippedRole: roleMap.get(p.id) ?? null,
          // Fuente de verdad: user_stats (la misma que usan Dashboard y Tienda)
          level: st?.level ?? 1,
          xp: Number(st?.xp_total ?? 0),
          coins: Number(st?.coins ?? 0),
          posts: postCount.get(p.id) ?? 0,
          messages: msgCount.get(p.id) ?? 0,
          achievements: achCount.get(p.id) ?? 0,
        }
      })
    )
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    load()
    // Si cambia el nivel/XP de alguien, se refleja sin recargar
    const ch = supabase
      .channel('profiles-stats')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'user_stats' }, payload => {
        const n: any = payload.new
        setProfiles(prev =>
          prev.map(p =>
            p.id === n.user_id ? { ...p, level: n.level, xp: Number(n.xp_total), coins: Number(n.coins) } : p
          )
        )
      })
      .subscribe()
    return () => {
      supabase.removeChannel(ch)
    }
  }, [load, supabase])

  async function handleAvatarFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // permite volver a elegir el mismo archivo
    if (!file || !me) return
    if (!ALLOWED_TYPES.includes(file.type)) return toast.error('Usa una imagen JPG, PNG, WEBP o GIF.')
    if (file.size > MAX_AVATAR_BYTES) return toast.error('La foto pesa más de 5 MB.')

    setUploadingId(me)
    const ext = file.type.split('/')[1]
    const path = `${me}/avatar-${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, {
      contentType: file.type,
      cacheControl: '3600',
    })
    if (upErr) {
      setUploadingId(null)
      return toast.error('No se pudo subir la foto: ' + upErr.message)
    }
    const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path)
    const { error: dbErr } = await supabase.from('profiles').update({ avatar_url: pub.publicUrl }).eq('id', me)
    if (dbErr) {
      setUploadingId(null)
      return toast.error('La foto se subió pero no se pudo guardar en tu perfil.')
    }

    // Limpia fotos anteriores del mismo usuario (best effort)
    const { data: old } = await supabase.storage.from('avatars').list(me)
    const stale = (old ?? []).filter(o => `${me}/${o.name}` !== path).map(o => `${me}/${o.name}`)
    if (stale.length) await supabase.storage.from('avatars').remove(stale)

    setProfiles(prev => prev.map(p => (p.id === me ? { ...p, avatar_url: pub.publicUrl } : p)))
    setUploadingId(null)
    toast.success('¡Foto de perfil actualizada!')
  }

  return (
    <MainLayout>
      <div className="w-full min-h-screen bg-black/90 font-serif pt-10 pb-32 overflow-x-hidden relative">
        <div className="fixed inset-0 pointer-events-none z-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-red-900/20 via-black to-black mix-blend-multiply" />
        <input ref={fileRef} type="file" accept={ALLOWED_TYPES.join(',')} className="hidden" onChange={handleAvatarFile} />

        <div className="max-w-6xl mx-auto px-4 relative z-10">
          <header className="mb-20">
            <motion.h1
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-6xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-b from-red-500 to-red-900 uppercase tracking-widest"
              style={{ textShadow: '0 0 40px rgba(220, 38, 38, 0.6), 0 0 10px rgba(220, 38, 38, 0.4)' }}
            >
              Los 6 Elegidos
            </motion.h1>
            <div className="flex gap-4 mt-6 text-red-500/80 font-sans text-sm uppercase tracking-widest font-bold">
              <span>2026</span><span>•</span><span>18+</span><span>•</span><span>Única Temporada</span>
            </div>
            <p className="text-zinc-300 mt-4 max-w-xl font-sans text-lg leading-relaxed border-l-4 border-red-600 pl-4">
              Cuando un grupo de extraños se une en un servidor privado, descubren un misterio que involucra memes
              secretos, fuerzas sobrenaturales y a un tal Joel.
            </p>
            <div className="mt-10 rounded-2xl overflow-hidden border border-red-900/50 shadow-[0_0_50px_rgba(220,38,38,0.3)] bg-zinc-950">
              <img src="/images/los_seis_panas.jpg" alt="Los 6 Panas - Team Select" className="w-full h-auto object-cover" style={{ imageRendering: 'pixelated' }} />
            </div>
          </header>

          {loading ? (
            <div className="flex justify-center py-32"><Loader2 className="w-10 h-10 text-red-600 animate-spin" /></div>
          ) : (
            <div className="space-y-32">
              {profiles.map((profile, index) => {
                const isEven = index % 2 === 0
                const isMe = profile.id === me
                const prog = levelProgress(profile.xp, profile.level)
                const name = profile.nickname || profile.username || 'Anónimo'
                const roleLabel = profile.equippedRole ?? (profile.role === 'admin' ? 'Admin' : 'Miembro')
                const bio = profile.bio || profile.description

                return (
                  <motion.div
                    key={profile.id}
                    initial={{ opacity: 0, x: isEven ? -50 : 50 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, margin: '-100px' }}
                    transition={{ duration: 0.8 }}
                    className={`flex flex-col ${isEven ? 'md:flex-row' : 'md:flex-row-reverse'} items-center gap-12 relative`}
                  >
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-[1px] bg-red-600/30 blur-sm -z-10" />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-[1px] bg-red-500 shadow-[0_0_20px_rgba(239,68,68,1)] -z-10" />

                    {/* Foto */}
                    <div className="w-full md:w-1/2 relative group">
                      <div className="absolute -inset-1 bg-gradient-to-r from-red-600 to-black opacity-50 blur-lg group-hover:opacity-100 transition duration-1000 group-hover:duration-200" />
                      <div className="relative aspect-video md:aspect-square overflow-hidden border border-red-900/50 rounded-sm bg-zinc-900">
                        {profile.avatar_url ? (
                          <img
                            src={profile.avatar_url}
                            alt={name}
                            className="w-full h-full object-cover object-top scale-110 grayscale opacity-80 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-700 group-hover:scale-[1.15]"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-zinc-950 text-red-900 text-6xl font-black">
                            {name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="absolute top-4 left-4">
                          <h3 className="text-3xl font-black text-white/90 drop-shadow-md">{name}</h3>
                          <span className="inline-flex items-center gap-1 mt-1 bg-red-600/90 text-white px-2 py-0.5 text-[10px] font-sans font-bold tracking-widest uppercase rounded">
                            <Crown className="w-3 h-3" /> {roleLabel}
                          </span>
                        </div>
                        {isMe && (
                          <button
                            onClick={() => fileRef.current?.click()}
                            disabled={uploadingId === me}
                            className="absolute bottom-4 right-4 bg-red-600 hover:bg-red-500 disabled:opacity-60 backdrop-blur text-white px-4 py-2 text-xs font-sans font-bold tracking-widest uppercase rounded flex items-center gap-2 transition-colors"
                          >
                            {uploadingId === me ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                            {uploadingId === me ? 'Subiendo…' : 'Cambiar foto'}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Info */}
                    <div className={`w-full md:w-1/2 ${isEven ? 'md:pr-12' : 'md:pl-12 md:text-right'} font-sans`}>
                      <div className={`flex items-baseline gap-4 mb-6 ${!isEven ? 'md:justify-end' : ''}`}>
                        <span className="text-red-500 font-bold uppercase tracking-widest text-sm">Capítulo</span>
                        <span className="text-6xl md:text-7xl font-light text-white">{String(index + 1).padStart(2, '0')}</span>
                      </div>

                      <p className="text-zinc-300 text-lg leading-relaxed mb-8">
                        {bio || 'Un personaje envuelto en misterio. Nadie sabe de dónde vino ni cuáles son sus verdaderas intenciones en el servidor.'}
                      </p>

                      {/* Barra de nivel (misma fuente que Dashboard/Tienda) */}
                      <div className="mb-6 max-w-sm inline-block w-full text-left">
                        <div className="flex justify-between text-xs uppercase tracking-widest font-bold text-zinc-400 mb-1">
                          <span className="text-white">Nivel {profile.level}</span>
                          <span>{prog.next} XP para el {profile.level + 1}</span>
                        </div>
                        <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-red-700 to-red-400" style={{ width: `${prog.pct}%` }} />
                        </div>
                      </div>

                      <div className={`grid grid-cols-3 sm:grid-cols-5 gap-4 ${!isEven ? 'md:justify-items-end' : ''}`}>
                        <Stat label="Nivel" value={profile.level} />
                        <Stat label="XP" value={profile.xp.toLocaleString()} />
                        <Stat label="Monedas" value={profile.coins.toLocaleString()} icon={<Coins className="w-3 h-3 text-yellow-500" />} />
                        <Stat label="Posts" value={profile.posts} icon={<Newspaper className="w-3 h-3" />} />
                        <Stat label="Mensajes" value={profile.messages} icon={<MessageSquare className="w-3 h-3" />} />
                        <Stat label="Logros" value={profile.achievements} icon={<Trophy className="w-3 h-3 text-yellow-500" />} />
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  )
}

function Stat({ label, value, icon }: { label: string; value: string | number; icon?: React.ReactNode }) {
  return (
    <div className="text-center">
      <p className="text-2xl font-black text-white">{value}</p>
      <p className="text-[10px] uppercase text-zinc-500 font-bold tracking-widest flex items-center justify-center gap-1">
        {icon}{label}
      </p>
    </div>
  )
}
