'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { Award, Coins, Crown, Dices, Flame, Trophy } from 'lucide-react'
import { MainLayout } from '@/components/layout/MainLayout'
import { createClient } from '@/lib/supabase/client'

/* ------------------------------------------------------------------ */
/* Tipos                                                               */
/* ------------------------------------------------------------------ */

interface UserRow {
  user_id: string
  nickname: string
  avatar_url: string | null
  coins: number
  xp_total: number
  level: number
  total_wagered: number
  biggest_win: number
  messages: number
  posts: number
  games: number
  current_streak: number
  best_streak: number
}

interface Overview {
  users: UserRow[]
  hourly: number[]
}

interface LedgerRow {
  delta: number
  created_at: string
}

interface DayFlow {
  label: string
  gain: number
  loss: number
}

type AchievementRow = Record<string, unknown> & { id: string }

type RankBy = 'xp' | 'coins' | 'wagered'

const RANK_OPTIONS: { id: RankBy; label: string; value: (u: UserRow) => number }[] = [
  { id: 'xp', label: 'XP', value: (u) => u.xp_total },
  { id: 'coins', label: 'Monedas', value: (u) => u.coins },
  { id: 'wagered', label: 'Apostado', value: (u) => u.total_wagered },
]

interface Medal {
  id: string
  icon: string
  name: string
  desc: string
  goal: number
  value: (u: UserRow) => number
}

const MEDALS: Medal[] = [
  { id: 'casino_king', icon: '👑', name: 'Rey del Casino', desc: 'Gana 5.000 monedas en una sola jugada', goal: 5000, value: (u) => u.biggest_win },
  { id: 'high_roller', icon: '💸', name: 'Apostador Compulsivo', desc: 'Apuesta 20.000 monedas en total', goal: 20000, value: (u) => u.total_wagered },
  { id: 'gamer', icon: '🎲', name: 'Jugador', desc: 'Juega 50 partidas de Plinko o Crash', goal: 50, value: (u) => u.games },
  { id: 'talker', icon: '💬', name: 'Charlatán', desc: 'Envía 100 mensajes en el chat', goal: 100, value: (u) => u.messages },
  { id: 'muralist', icon: '🖼️', name: 'Muralista', desc: 'Publica 10 veces en el muro', goal: 10, value: (u) => u.posts },
  { id: 'fire', icon: '🔥', name: 'Racha de fuego', desc: '7 días seguidos activo', goal: 7, value: (u) => u.best_streak },
  { id: 'veteran', icon: '⭐', name: 'Veterano', desc: 'Llega al nivel 10', goal: 10, value: (u) => u.level },
]

const FLOW_DAYS = 14

/* ------------------------------------------------------------------ */
/* Piezas visuales                                                     */
/* ------------------------------------------------------------------ */

function Avatar({ user, size = 40 }: { user: Pick<UserRow, 'nickname' | 'avatar_url'>; size?: number }) {
  if (user.avatar_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={user.avatar_url} alt="" style={{ width: size, height: size }} className="rounded-full border border-white/20 object-cover" />
  }
  return (
    <div
      style={{ width: size, height: size }}
      className="flex items-center justify-center rounded-full bg-indigo-600/40 font-black text-indigo-100"
    >
      {user.nickname.slice(0, 1).toUpperCase()}
    </div>
  )
}

function Podium({ users, rank }: { users: UserRow[]; rank: (typeof RANK_OPTIONS)[number] }) {
  const top = users.slice(0, 3)
  if (top.length === 0) return null
  // Orden visual: 2º, 1º, 3º
  const slots = [
    { pos: 2, user: top[1], height: 120, grad: 'from-zinc-300 to-zinc-500', ring: 'ring-zinc-300' },
    { pos: 1, user: top[0], height: 160, grad: 'from-yellow-300 to-amber-500', ring: 'ring-yellow-400' },
    { pos: 3, user: top[2], height: 90, grad: 'from-orange-400 to-amber-700', ring: 'ring-orange-500' },
  ]

  return (
    <div className="flex items-end justify-center gap-3 sm:gap-6">
      {slots.map(({ pos, user, height, grad, ring }) =>
        user ? (
          <div key={pos} className="flex w-28 flex-col items-center sm:w-36">
            {pos === 1 && <Crown className="mb-1 h-7 w-7 text-yellow-400 drop-shadow-[0_0_10px_#facc15]" />}
            <div className={`rounded-full ring-4 ${ring}`}>
              <Avatar user={user} size={pos === 1 ? 64 : 52} />
            </div>
            <p className="mt-2 max-w-full truncate text-sm font-black text-white">{user.nickname}</p>
            <p className="text-xs font-bold text-zinc-400">{rank.value(user).toLocaleString()}</p>
            <motion.div
              initial={{ height: 0 }}
              animate={{ height }}
              transition={{ type: 'spring', stiffness: 90, damping: 16, delay: pos === 1 ? 0.2 : 0.4 }}
              className={`mt-2 flex w-full items-start justify-center rounded-t-2xl bg-gradient-to-b ${grad} pt-2 text-3xl font-black text-black/70`}
            >
              {pos}
            </motion.div>
          </div>
        ) : (
          <div key={pos} className="w-28 sm:w-36" />
        )
      )}
    </div>
  )
}

function HourlyChart({ data }: { data: number[] }) {
  const max = Math.max(1, ...data)
  const peak = data.indexOf(Math.max(...data))
  const W = 480
  const H = 150
  const bw = W / 24
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H + 20}`} className="w-full" role="img" aria-label="Actividad por hora">
        {data.map((v, h) => {
          const bh = (v / max) * H
          return (
            <g key={h}>
              <motion.rect
                x={h * bw + 2}
                width={bw - 4}
                rx={3}
                fill={h === peak && v > 0 ? '#f472b6' : '#6366f1'}
                initial={{ y: H, height: 0 }}
                animate={{ y: H - bh, height: bh }}
                transition={{ delay: h * 0.02, type: 'spring', stiffness: 120, damping: 18 }}
              >
                <title>{`${h}:00 — ${v} acciones`}</title>
              </motion.rect>
              {h % 3 === 0 && (
                <text x={h * bw + bw / 2} y={H + 14} textAnchor="middle" fontSize={9} fill="#a1a1aa">
                  {h}h
                </text>
              )}
            </g>
          )
        })}
      </svg>
      {data.some((v) => v > 0) && (
        <p className="mt-1 text-xs font-medium text-zinc-500">
          Hora pico del grupo: <span className="font-black text-pink-300">{peak}:00</span>
        </p>
      )}
    </div>
  )
}

function FlowChart({ days }: { days: DayFlow[] }) {
  const max = Math.max(1, ...days.map((d) => Math.max(d.gain, d.loss)))
  const W = 480
  const H = 170
  const mid = H / 2
  const bw = W / days.length
  return (
    <svg viewBox={`0 0 ${W} ${H + 18}`} className="w-full" role="img" aria-label="Ganancias y pérdidas de monedas">
      <line x1={0} y1={mid} x2={W} y2={mid} stroke="#ffffff22" />
      {days.map((d, i) => {
        const gh = (d.gain / max) * (mid - 4)
        const lh = (d.loss / max) * (mid - 4)
        return (
          <g key={i}>
            <motion.rect
              x={i * bw + 3}
              width={bw - 6}
              rx={3}
              fill="#22c55e"
              initial={{ y: mid, height: 0 }}
              animate={{ y: mid - gh, height: gh }}
              transition={{ delay: i * 0.03 }}
            >
              <title>{`${d.label}: +${d.gain.toLocaleString()}`}</title>
            </motion.rect>
            <motion.rect
              x={i * bw + 3}
              y={mid}
              width={bw - 6}
              rx={3}
              fill="#ef4444"
              initial={{ height: 0 }}
              animate={{ height: lh }}
              transition={{ delay: i * 0.03 }}
            >
              <title>{`${d.label}: -${d.loss.toLocaleString()}`}</title>
            </motion.rect>
            {i % 2 === 0 && (
              <text x={i * bw + bw / 2} y={H + 12} textAnchor="middle" fontSize={8} fill="#a1a1aa">
                {d.label}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

function Card({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-white/10 bg-black/50 p-5">
      <h2 className="mb-4 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-zinc-400">
        {icon} {title}
      </h2>
      {children}
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Página                                                              */
/* ------------------------------------------------------------------ */

export default function StatsPage() {
  const [supabase] = useState(() => createClient())
  const [overview, setOverview] = useState<Overview | null>(null)
  const [flow, setFlow] = useState<DayFlow[]>([])
  const [achievements, setAchievements] = useState<AchievementRow[]>([])
  const [unlocked, setUnlocked] = useState<Set<string>>(new Set())
  const [myId, setMyId] = useState<string | null>(null)
  const [rankBy, setRankBy] = useState<RankBy>('xp')
  const [loading, setLoading] = useState<boolean>(true)
  const timer = useRef<number | undefined>(undefined)

  const load = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser()
    const uid = auth.user?.id ?? null
    setMyId(uid)

    const { data, error } = await supabase.rpc('stats_overview')
    if (error) {
      toast.error('No se pudieron cargar las estadísticas.')
      setLoading(false)
      return
    }
    setOverview(data as Overview)

    if (uid) {
      const since = new Date()
      since.setDate(since.getDate() - (FLOW_DAYS - 1))
      since.setHours(0, 0, 0, 0)

      const [ledger, ach, mine] = await Promise.all([
        supabase.from('economy_ledger').select('delta, created_at').gte('created_at', since.toISOString()),
        supabase.from('achievements').select('*'),
        supabase.from('user_achievements').select('achievement_id').eq('user_id', uid),
      ])

      const buckets = new Map<string, DayFlow>()
      for (let i = 0; i < FLOW_DAYS; i++) {
        const d = new Date(since)
        d.setDate(since.getDate() + i)
        buckets.set(d.toLocaleDateString('en-CA'), {
          label: d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
          gain: 0,
          loss: 0,
        })
      }
      ;((ledger.data ?? []) as LedgerRow[]).forEach((row) => {
        const b = buckets.get(new Date(row.created_at).toLocaleDateString('en-CA'))
        if (!b) return
        if (row.delta >= 0) b.gain += row.delta
        else b.loss += -row.delta
      })
      setFlow(Array.from(buckets.values()))
      setAchievements((ach.data ?? []) as AchievementRow[])
      setUnlocked(new Set(((mine.data ?? []) as { achievement_id: string }[]).map((r) => r.achievement_id)))
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    void load()
    const schedule = () => {
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => void load(), 400)
    }
    const channel = supabase
      .channel('stats-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_stats' }, schedule)
      .subscribe()
    return () => {
      window.clearTimeout(timer.current)
      supabase.removeChannel(channel)
    }
  }, [supabase, load])

  const users = overview?.users ?? []
  const rank = RANK_OPTIONS.find((r) => r.id === rankBy) ?? RANK_OPTIONS[0]
  const ranked = [...users].sort((a, b) => rank.value(b) - rank.value(a))
  const me = users.find((u) => u.user_id === myId) ?? null

  const topBettor = [...users].sort((a, b) => b.total_wagered - a.total_wagered)[0]
  const topJackpot = [...users].sort((a, b) => b.biggest_win - a.biggest_win)[0]
  const topStreak = [...users].sort((a, b) => b.current_streak - a.current_streak)[0]

  if (loading) {
    return (
      <MainLayout>
        <div className="mx-auto grid max-w-6xl gap-4 px-4 py-8 md:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-56 animate-pulse rounded-3xl border border-white/10 bg-white/5" />
          ))}
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8">
        <header>
          <h1 className="flex items-center gap-3 text-4xl font-black uppercase tracking-tight text-indigo-300">
            <Trophy className="h-9 w-9 text-yellow-400" /> Centro de mando
          </h1>
          <p className="font-medium text-zinc-400">Trofeos y estadísticas de los panas, en vivo.</p>
        </header>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            {
              icon: <Dices className="h-5 w-5 text-fuchsia-400" />,
              label: 'Mayor apostador',
              who: topBettor,
              value: topBettor ? `${topBettor.total_wagered.toLocaleString()} apostadas` : '—',
            },
            {
              icon: <Coins className="h-5 w-5 text-yellow-400" />,
              label: 'Récord de jackpot',
              who: topJackpot,
              value: topJackpot ? `${topJackpot.biggest_win.toLocaleString()} monedas` : '—',
            },
            {
              icon: <Flame className="h-5 w-5 text-orange-400" />,
              label: 'Racha activa',
              who: topStreak,
              value: topStreak ? `${topStreak.current_streak} días 🔥` : '—',
            },
            {
              icon: <Award className="h-5 w-5 text-sky-400" />,
              label: 'Nivel más alto',
              who: [...users].sort((a, b) => b.level - a.level)[0],
              value: users.length ? `Nivel ${Math.max(...users.map((u) => u.level))}` : '—',
            },
          ].map((k) => (
            <motion.div
              key={k.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-3xl border border-white/10 bg-black/50 p-4"
            >
              <p className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-zinc-400">
                {k.icon} {k.label}
              </p>
              <p className="truncate text-lg font-black text-white">{k.who?.nickname ?? '—'}</p>
              <p className="text-sm font-bold text-zinc-400">{k.value}</p>
            </motion.div>
          ))}
        </div>

        {/* Podio + ranking */}
        <Card title="Clasificación en vivo" icon={<Trophy className="h-4 w-4" />}>
          <div className="mb-6 flex gap-2">
            {RANK_OPTIONS.map((r) => (
              <button
                key={r.id}
                onClick={() => setRankBy(r.id)}
                className={`rounded-full border px-4 py-1.5 text-xs font-black uppercase tracking-widest transition ${
                  rankBy === r.id
                    ? 'border-yellow-500 bg-yellow-500 text-black'
                    : 'border-white/10 bg-white/5 text-zinc-400 hover:text-white'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          <Podium users={ranked} rank={rank} />

          <div className="mt-8 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="text-[11px] font-black uppercase tracking-widest text-zinc-500">
                  <th className="pb-2 pr-2">#</th>
                  <th className="pb-2">Jugador</th>
                  <th className="pb-2 text-right">Nivel</th>
                  <th className="pb-2 text-right">XP</th>
                  <th className="pb-2 text-right">Monedas</th>
                  <th className="pb-2 text-right">Apostado</th>
                  <th className="pb-2 text-right">Racha</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((u, i) => (
                  <motion.tr
                    key={u.user_id}
                    layout
                    className={`border-t border-white/5 ${u.user_id === myId ? 'bg-indigo-500/10' : ''}`}
                  >
                    <td className="py-2 pr-2 font-black text-zinc-500">{i + 1}</td>
                    <td className="py-2">
                      <span className="flex items-center gap-2 font-bold text-white">
                        <Avatar user={u} size={28} /> {u.nickname}
                      </span>
                    </td>
                    <td className="py-2 text-right font-bold text-zinc-300">{u.level}</td>
                    <td className="py-2 text-right text-zinc-300">{u.xp_total.toLocaleString()}</td>
                    <td className="py-2 text-right text-yellow-400">{u.coins.toLocaleString()}</td>
                    <td className="py-2 text-right text-zinc-300">{u.total_wagered.toLocaleString()}</td>
                    <td className="py-2 text-right text-orange-400">
                      {u.current_streak > 0 ? `${u.current_streak} 🔥` : '—'}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Gráficos */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card title="¿A qué hora se conectan?" icon={<Flame className="h-4 w-4" />}>
            <HourlyChart data={overview?.hourly ?? Array.from({ length: 24 }, () => 0)} />
          </Card>
          <Card title="Tus monedas: ganancias y pérdidas (14 días)" icon={<Coins className="h-4 w-4" />}>
            {flow.length > 0 ? (
              <>
                <FlowChart days={flow} />
                <p className="mt-1 text-xs font-medium text-zinc-500">
                  <span className="text-emerald-400">Verde</span>: monedas que entraron ·{' '}
                  <span className="text-red-400">Rojo</span>: monedas que gastaste o perdiste
                </p>
              </>
            ) : (
              <p className="text-sm text-zinc-500">Todavía no hay movimientos.</p>
            )}
          </Card>
        </div>

        {/* Medallas */}
        {me && (
          <Card title="Muro de medallas" icon={<Award className="h-4 w-4" />}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {MEDALS.map((m) => {
                const value = m.value(me)
                const pct = Math.min(100, (value / m.goal) * 100)
                const done = value >= m.goal
                return (
                  <motion.div
                    key={m.id}
                    whileHover={{ y: -3 }}
                    className={`rounded-2xl border p-4 ${
                      done ? 'border-yellow-500/50 bg-yellow-500/10' : 'border-white/10 bg-white/5'
                    }`}
                  >
                    <div className="mb-2 flex items-center gap-3">
                      <span className={`text-3xl ${done ? '' : 'opacity-40 grayscale'}`}>{m.icon}</span>
                      <div>
                        <p className="font-black text-white">{m.name}</p>
                        <p className="text-xs text-zinc-400">{m.desc}</p>
                      </div>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/10">
                      <motion.div
                        className={`h-full ${done ? 'bg-yellow-400' : 'bg-indigo-500'}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.8 }}
                      />
                    </div>
                    <p className="mt-1 text-right text-[11px] font-bold text-zinc-400">
                      {Math.min(value, m.goal).toLocaleString()} / {m.goal.toLocaleString()}
                    </p>
                  </motion.div>
                )
              })}
            </div>

            {achievements.length > 0 && (
              <>
                <h3 className="mb-3 mt-8 text-xs font-black uppercase tracking-widest text-zinc-400">
                  Logros del sistema
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {achievements.map((a) => {
                    const got = unlocked.has(a.id)
                    const name = String(a.name ?? a.title ?? a.id)
                    const desc = a.description ? String(a.description) : ''
                    return (
                      <div
                        key={a.id}
                        className={`flex items-center gap-3 rounded-2xl border p-3 ${
                          got ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-white/10 bg-white/5 opacity-60'
                        }`}
                      >
                        <Trophy className={`h-6 w-6 ${got ? 'text-emerald-400' : 'text-zinc-600'}`} />
                        <div className="min-w-0">
                          <p className="truncate font-black text-white">{name}</p>
                          {desc && <p className="truncate text-xs text-zinc-400">{desc}</p>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </Card>
        )}
      </div>
    </MainLayout>
  )
}
