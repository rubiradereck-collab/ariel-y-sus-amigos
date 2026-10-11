'use client'

import { MainLayout } from "@/components/layout/MainLayout"
import { createClient } from "@/lib/supabase/client"
import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Trophy, Swords, Shield, Target, Award, Star, Activity, Clock, Users, Zap, Terminal } from "lucide-react"

export default function DashboardPage() {
  const [profiles, setProfiles] = useState<any[]>([])
  const [timeline, setTimeline] = useState<any[]>([])
  const [totalXp, setTotalXp] = useState(0)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function loadDashboard() {
      const { data: users } = await supabase.from('profiles').select('*')
      if (!users) return

      const [
        { data: posts },
        { data: messages },
        { data: achievements },
        { data: scores }
      ] = await Promise.all([
        supabase.from('posts').select('*, profiles(nickname)').order('created_at', { ascending: false }).limit(5),
        supabase.from('messages').select('*'),
        supabase.from('user_achievements').select('*, achievements(*), profiles(nickname)').order('awarded_at', { ascending: false }).limit(5),
        supabase.from('game_scores').select('*')
      ])

      let serverXp = 0
      
      const richProfiles = users.map(profile => {
        const userPosts = posts?.filter(p => p.author_id === profile.id).length || 0
        const userMsgs = messages?.filter(m => m.sender_id === profile.id).length || 0
        
        let xp = (userPosts * 50) + (userMsgs * 10)
        
        const userAchievs = achievements?.filter(a => a.user_id === profile.id) || []
        userAchievs.forEach((a: any) => {
          if (a.achievements?.xp_reward) xp += a.achievements.xp_reward
        })

        const userScores = scores?.filter(s => s.user_id === profile.id) || []
        userScores.forEach(s => { xp += s.score })

        serverXp += xp
        const level = Math.max(1, Math.floor(Math.sqrt(xp / 50)))

        return {
          ...profile,
          stats: { xp, level }
        }
      }).sort((a, b) => b.stats.xp - a.stats.xp) // Sort by XP descending

      // Construir la línea de tiempo (mezclando posts y logros)
      const mixTimeline = [
        ...(posts || []).map(p => ({ type: 'post', date: p.created_at, user: p.profiles?.nickname, desc: 'Publicó en el Muro' })),
        ...(achievements || []).map(a => ({ type: 'achievement', date: a.awarded_at, user: a.profiles?.nickname, desc: `Desbloqueó: ${a.achievements?.title}` }))
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 8)

      setTotalXp(serverXp)
      setTimeline(mixTimeline)
      setProfiles(richProfiles)
      setLoading(false)
    }
    
    loadDashboard()
  }, [])

  return (
    <MainLayout>
      <div className="w-full h-full max-w-7xl mx-auto px-4 pt-10 pb-32 overflow-y-auto hide-scrollbar text-white">
        
        <header className="mb-12">
          <h1 className="text-4xl md:text-5xl font-black uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-600 mb-2 drop-shadow-[0_0_15px_rgba(239,68,68,0.5)] flex items-center gap-4">
            <Activity className="w-10 h-10 text-orange-500" /> DASHBOARD GLOBAL
          </h1>
          <p className="text-zinc-400 font-bold tracking-widest uppercase text-sm">Monitoreo de Actividad del Servidor Privado</p>
        </header>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Columna Principal (Gráficos y Ranking) */}
            <div className="lg:col-span-2 space-y-8">
              
              {/* Top Stats Cards */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gradient-to-br from-orange-500/20 to-red-900/40 border border-orange-500/30 rounded-3xl p-6 backdrop-blur-md shadow-[0_0_30px_rgba(249,115,22,0.1)] relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-20"><Zap className="w-24 h-24" /></div>
                  <h3 className="text-sm font-bold text-orange-400 uppercase tracking-widest mb-2">Energía Total (XP)</h3>
                  <p className="text-5xl font-black text-white">{totalXp.toLocaleString()}</p>
                </div>
                <div className="bg-gradient-to-br from-blue-500/20 to-cyan-900/40 border border-blue-500/30 rounded-3xl p-6 backdrop-blur-md shadow-[0_0_30px_rgba(59,130,246,0.1)] relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-20"><Users className="w-24 h-24" /></div>
                  <h3 className="text-sm font-bold text-blue-400 uppercase tracking-widest mb-2">Miembros Activos</h3>
                  <p className="text-5xl font-black text-white">{profiles.length}</p>
                </div>
              </div>

              {/* Leaderboard */}
              <div className="bg-black/60 border border-white/10 rounded-3xl p-6 backdrop-blur-xl">
                <h3 className="text-xl font-black uppercase tracking-widest text-white mb-6 flex items-center gap-3">
                  <Trophy className="w-6 h-6 text-yellow-500" /> Clasificación
                </h3>
                
                <div className="space-y-4">
                  {profiles.map((p, i) => (
                    <motion.div 
                      key={p.id}
                      initial={{ x: -20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: i * 0.1 }}
                      className={`flex items-center gap-4 p-4 rounded-2xl border ${i === 0 ? 'bg-yellow-500/10 border-yellow-500/50 shadow-[0_0_15px_rgba(234,179,8,0.2)]' : 'bg-white/5 border-white/5'}`}
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-xl ${i === 0 ? 'text-yellow-500' : i === 1 ? 'text-zinc-300' : i === 2 ? 'text-amber-600' : 'text-zinc-600'}`}>
                        #{i + 1}
                      </div>
                      <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-white/10 overflow-hidden flex-shrink-0">
                        {p.avatar_url ? <img src={p.avatar_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center font-bold">{p.nickname?.charAt(0)}</div>}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-lg text-white">{p.nickname}</h4>
                        <div className="w-full h-1.5 bg-black rounded-full mt-2 overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-orange-500 to-yellow-500" style={{ width: `${Math.min(100, (p.stats.xp / (totalXp || 1)) * 100)}%` }} />
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-2xl text-white">{p.stats.level}</p>
                        <p className="text-[9px] uppercase tracking-widest text-zinc-500 font-bold">Nivel</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

            </div>

            {/* Columna Secundaria (Línea de tiempo) */}
            <div className="space-y-8">
              
              <div className="bg-black/60 border border-white/10 rounded-3xl p-6 backdrop-blur-xl h-full">
                <h3 className="text-xl font-black uppercase tracking-widest text-white mb-6 flex items-center gap-3">
                  <Clock className="w-6 h-6 text-emerald-500" /> Línea de Tiempo
                </h3>
                
                <div className="relative border-l-2 border-white/10 ml-4 space-y-8 py-4">
                  {timeline.length === 0 && <p className="text-zinc-500 text-sm ml-4 font-bold uppercase">Sin actividad reciente</p>}
                  {timeline.map((event, i) => (
                    <motion.div 
                      key={i}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="relative pl-6"
                    >
                      <div className={`absolute -left-[11px] top-1 w-5 h-5 rounded-full border-4 border-black ${event.type === 'achievement' ? 'bg-yellow-500' : 'bg-blue-500'}`} />
                      <p className="text-xs font-bold text-zinc-500 mb-1">{new Date(event.date).toLocaleTimeString()} - {new Date(event.date).toLocaleDateString()}</p>
                      <h4 className="font-bold text-white"><span className={event.type === 'achievement' ? 'text-yellow-400' : 'text-blue-400'}>{event.user}</span> {event.desc}</h4>
                    </motion.div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        )}
      </div>
    </MainLayout>
  )
}
