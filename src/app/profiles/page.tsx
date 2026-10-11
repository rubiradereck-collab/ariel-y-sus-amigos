'use client'

import { MainLayout } from "@/components/layout/MainLayout"
import { createClient } from "@/lib/supabase/client"
import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Play, Info, Flame } from "lucide-react"

export default function ProfilesPage() {
  const [profiles, setProfiles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function loadProfilesAndStats() {
      const { data: users } = await supabase.from('profiles').select('*').order('created_at', { ascending: true })
      if (!users) return

      // Fetch all activity to calculate stats for each profile
      const [
        { data: posts },
        { data: messages },
        { data: achievements },
        { data: scores }
      ] = await Promise.all([
        supabase.from('posts').select('author_id'),
        supabase.from('messages').select('sender_id'),
        supabase.from('user_achievements').select('user_id, achievements(xp_reward)'),
        supabase.from('game_scores').select('user_id, score')
      ])

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

        const level = Math.max(1, Math.floor(Math.sqrt(xp / 50)))

        return {
          ...profile,
          stats: { posts: userPosts, messages: userMsgs, achievements: userAchievs.length, xp, level }
        }
      })

      setProfiles(richProfiles)
      setLoading(false)
    }
    
    loadProfilesAndStats()
  }, [])

  return (
    <MainLayout>
      <div className="w-full min-h-screen bg-black/90 font-serif pt-10 pb-32 overflow-x-hidden relative">
        {/* Fondo Ambiental Stranger Things */}
        <div className="fixed inset-0 pointer-events-none z-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-red-900/20 via-black to-black mix-blend-multiply" />
        
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
              <span>2026</span>
              <span>•</span>
              <span>18+</span>
              <span>•</span>
              <span>Única Temporada</span>
            </div>
            <p className="text-zinc-300 mt-4 max-w-xl font-sans text-lg leading-relaxed border-l-4 border-red-600 pl-4">
              Cuando un grupo de extraños se une en un servidor privado, descubren un misterio que involucra memes secretos, fuerzas sobrenaturales y a un tal Joel.
            </p>

            {/* Banner de los 6 panas juntos */}
            <div className="mt-10 rounded-2xl overflow-hidden border border-red-900/50 shadow-[0_0_50px_rgba(220,38,38,0.3)] bg-zinc-950">
              <img 
                src="/images/los_seis_panas.jpg" 
                alt="Los 6 Panas - Team Select" 
                className="w-full h-auto object-cover"
                style={{ imageRendering: 'pixelated' }}
              />
            </div>
          </header>

          <div className="space-y-32">
            {profiles.map((profile, index) => {
              const isEven = index % 2 === 0;
              const chapterNumber = String(index + 1).padStart(2, '0');

              return (
                <motion.div 
                  key={profile.id}
                  initial={{ opacity: 0, x: isEven ? -50 : 50 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.8 }}
                  className={`flex flex-col ${isEven ? 'md:flex-row' : 'md:flex-row-reverse'} items-center gap-12 relative`}
                >
                  
                  {/* Línea de Neón Decorativa */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-[1px] bg-red-600/30 blur-sm -z-10" />
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-[1px] bg-red-500 shadow-[0_0_20px_rgba(239,68,68,1)] -z-10" />

                  {/* Imagen del Personaje */}
                  <div className="w-full md:w-1/2 relative group">
                    <div className="absolute -inset-1 bg-gradient-to-r from-red-600 to-black opacity-50 blur-lg group-hover:opacity-100 transition duration-1000 group-hover:duration-200" />
                    <div className="relative aspect-video md:aspect-square overflow-hidden border border-red-900/50 rounded-sm bg-zinc-900">
                      {profile.avatar_url ? (
                        <img 
                          src={profile.avatar_url} 
                          alt={profile.nickname} 
                          className="w-full h-full object-cover object-top scale-110 grayscale opacity-80 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-700 group-hover:scale-[1.15]" 
                          style={{ imageRendering: 'pixelated' }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-zinc-950 text-red-900 text-6xl font-black">
                          {profile.nickname?.charAt(0)}
                        </div>
                      )}
                      
                      <div className="absolute bottom-4 right-4 bg-red-600/90 backdrop-blur text-white px-4 py-1 text-xs font-sans font-bold tracking-widest uppercase rounded flex items-center gap-2">
                        <Play className="w-3 h-3 fill-white" /> Ver Perfil
                      </div>
                      <div className="absolute top-4 left-4">
                        <h3 className="text-3xl font-black text-white/90 drop-shadow-md">{profile.nickname}</h3>
                      </div>
                    </div>
                  </div>

                  {/* Texto e Info */}
                  <div className={`w-full md:w-1/2 ${isEven ? 'md:pr-12' : 'md:pl-12 text-right'} font-sans`}>
                    <div className={`flex items-baseline gap-4 mb-6 ${!isEven && 'justify-end'}`}>
                      <span className="text-red-500 font-bold uppercase tracking-widest text-sm">Capítulo</span>
                      <span className="text-6xl md:text-7xl font-light text-white">{chapterNumber}</span>
                    </div>
                    
                    <p className="text-zinc-300 text-lg leading-relaxed mb-8">
                      {profile.bio || "Un personaje envuelto en misterio. Nadie sabe de dónde vino ni cuáles son sus verdaderas intenciones en el servidor."}
                    </p>

                    <div className={`flex gap-6 text-sm uppercase tracking-widest font-bold text-red-500/70 ${!isEven && 'justify-end'}`}>
                      <span className="hover:text-red-400 cursor-pointer transition-colors border-b-2 border-red-600 pb-1 text-white">Estadísticas</span>
                      <span className="hover:text-red-400 cursor-pointer transition-colors">Historial</span>
                      <span className="hover:text-red-400 cursor-pointer transition-colors">Logros</span>
                    </div>
                    
                    <div className={`mt-6 flex gap-6 ${!isEven && 'justify-end'}`}>
                      <div className="text-center">
                        <p className="text-2xl font-black text-white">{profile.stats.level}</p>
                        <p className="text-[10px] uppercase text-zinc-500 font-bold tracking-widest">Nivel</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-black text-white">{profile.stats.xp}</p>
                        <p className="text-[10px] uppercase text-zinc-500 font-bold tracking-widest">XP</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-black text-white">{profile.stats.achievements}</p>
                        <p className="text-[10px] uppercase text-zinc-500 font-bold tracking-widest">Logros</p>
                      </div>
                    </div>

                  </div>

                </motion.div>
              )
            })}
          </div>
        </div>
      </div>
    </MainLayout>
  )
}
