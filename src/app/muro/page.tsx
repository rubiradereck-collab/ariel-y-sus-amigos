'use client'

import { MainLayout } from "@/components/layout/MainLayout"
import { createClient } from "@/lib/supabase/client"
import { useEffect, useState, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Send, Image as ImageIcon, Smile, MessageSquare, Heart, MoreHorizontal, Sparkles, Hash, Users, Gamepad2, Image as LucideImage, TrendingUp, Activity } from "lucide-react"
import Link from "next/link"
import EmojiPicker from 'emoji-picker-react'
import { toast } from 'sonner'

export default function MuroPage() {
  const [posts, setPosts] = useState<any[]>([])
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any>(null)
  const [activeUsers, setActiveUsers] = useState<any[]>([])
  const [showEmoji, setShowEmoji] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase.from('profiles').select('*').eq('id', user.id).single().then(({ data }) => setProfile(data))
      }
    })

    fetchPosts()
    
    // Simular usuarios activos
    supabase.from('profiles').select('*').limit(5).then(({ data }) => {
      if(data) setActiveUsers(data)
    })

    const channel = supabase
      .channel('public:posts')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, payload => {
        fetchPosts()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  async function fetchPosts() {
    const { data, error } = await supabase
      .from('posts')
      .select(`*, profiles ( username, nickname, avatar_url )`)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error("Error fetching posts:", error)
    } else if (data) {
      setPosts(data)
    }
    setLoading(false)
  }

  const createPost = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim() || !profile) return
    const currentContent = content
    setContent('')
    setShowEmoji(false)
    await supabase.from('posts').insert([{ author_id: profile.id, content: currentContent }])
  }

  return (
    <MainLayout>
      <div className="w-full max-w-[1400px] mx-auto px-4 py-8 flex gap-8">
        
        {/* SIDEBAR IZQUIERDO: Navegacion Rapida */}
        <div className="hidden lg:flex w-64 flex-col gap-4 flex-shrink-0 sticky top-10 h-fit">
          <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl">
            <h3 className="text-xs font-black text-white/50 uppercase tracking-widest mb-6">Explorar</h3>
            <div className="space-y-2">
              <Link href="/muro" className="flex items-center gap-3 text-pink-400 bg-pink-500/10 px-4 py-3 rounded-xl font-bold transition-all">
                <Sparkles className="w-5 h-5" /> Feed Global
              </Link>
              <Link href="/chat" className="flex items-center gap-3 text-zinc-400 hover:text-white hover:bg-white/5 px-4 py-3 rounded-xl font-bold transition-all">
                <MessageSquare className="w-5 h-5" /> Chat General
              </Link>
              <Link href="/arcade" className="flex items-center gap-3 text-zinc-400 hover:text-white hover:bg-white/5 px-4 py-3 rounded-xl font-bold transition-all">
                <Gamepad2 className="w-5 h-5" /> Minijuegos
              </Link>
            </div>
          </div>
          
          <div className="bg-gradient-to-tr from-purple-900/40 to-pink-900/40 backdrop-blur-xl border border-pink-500/30 rounded-3xl p-6 shadow-[0_0_30px_rgba(236,72,153,0.15)] relative overflow-hidden group cursor-pointer">
            <div className="absolute top-0 right-0 p-4 opacity-50 group-hover:opacity-100 transition-opacity">
              <Activity className="w-24 h-24 text-pink-500 blur-xl" />
            </div>
            <h3 className="font-black text-white text-xl relative z-10 mb-2">Pase de Batalla</h3>
            <p className="text-pink-200/80 text-sm font-medium relative z-10">Temporada 1 finaliza en 14 dias.</p>
            <div className="mt-4 w-full h-2 bg-black/50 rounded-full overflow-hidden relative z-10">
              <div className="h-full bg-gradient-to-r from-pink-500 to-purple-500 w-[75%]" />
            </div>
          </div>
        </div>

        {/* FEED CENTRAL */}
        <div className="flex-1 max-w-2xl">
          {/* Caja para publicar */}
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-3xl p-6 mb-8 relative z-20 shadow-[0_10px_40px_rgba(0,0,0,0.5)]"
          >
            <form onSubmit={createPost}>
              <div className="flex gap-4">
                <div className="w-12 h-12 flex-shrink-0 bg-black rounded-2xl border-2 border-white/10 flex items-center justify-center overflow-hidden shadow-inner">
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span className="font-bold text-white text-lg">{profile?.nickname?.charAt(0) || '?'}</span>
                  )}
                </div>
                <div className="flex-1">
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Que esta pasando en el servidor?"
                    className="w-full bg-transparent border-none text-white text-xl placeholder-zinc-600 focus:outline-none resize-none min-h-[80px]"
                  />
                </div>
              </div>
              
              <div className="flex justify-between items-center mt-4 pt-4 border-t border-white/5">
                <div className="flex gap-2 relative">
                  <button type="button" onClick={() => toast.info('Sube imagenes desde la Galeria directamente!')} className="p-3 text-purple-400 hover:text-white hover:bg-purple-500/20 rounded-xl transition-colors">
                    <ImageIcon className="w-6 h-6" />
                  </button>
                  <button type="button" onClick={() => setShowEmoji(!showEmoji)} className="p-3 text-pink-400 hover:text-white hover:bg-pink-500/20 rounded-xl transition-colors">
                    <Smile className="w-6 h-6" />
                  </button>
                  {showEmoji && (
                    <div className="absolute top-14 left-0 z-50">
                      <EmojiPicker onEmojiClick={(e) => setContent(content + e.emoji)} theme="dark" />
                    </div>
                  )}
                </div>
                <button 
                  type="submit"
                  disabled={!content.trim()}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-black px-8 py-3 rounded-xl flex items-center gap-2 transition-all disabled:opacity-50 shadow-[0_0_20px_rgba(192,38,211,0.4)] hover:shadow-[0_0_30px_rgba(192,38,211,0.6)] hover:scale-105"
                >
                  PUBLICAR <Send className="w-5 h-5 ml-1" />
                </button>
              </div>
            </form>
          </motion.div>

          {/* Feed de Posts */}
          {loading ? (
            <div className="flex justify-center py-20">
              <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-8 relative z-10 pb-10">
              <AnimatePresence>
                {posts.map((post, i) => (
                  <motion.div 
                    key={post.id}
                    initial={{ opacity: 0, y: 50, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ delay: i * 0.1 }}
                    className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-3xl p-6 hover:bg-zinc-900/80 hover:border-white/20 transition-all group shadow-xl"
                  >
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex gap-4 items-center">
                        <div className="w-14 h-14 flex-shrink-0 bg-black rounded-2xl border-2 border-white/10 flex items-center justify-center overflow-hidden shadow-lg group-hover:border-purple-500/50 transition-colors">
                          {post.profiles?.avatar_url ? (
                            <img src={post.profiles.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                          ) : (
                            <span className="font-bold text-white text-xl">{post.profiles?.nickname?.charAt(0) || '?'}</span>
                          )}
                        </div>
                        <div>
                          <h3 className="font-black text-white text-lg flex items-center gap-2">
                            {post.profiles?.nickname} 
                            <span className="text-[10px] bg-purple-600/30 text-purple-400 px-2 py-0.5 rounded-full uppercase tracking-widest border border-purple-500/20">Jugador</span>
                          </h3>
                          <p className="text-zinc-500 text-sm font-bold">@{post.profiles?.username} - {new Date(post.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <button className="text-zinc-600 hover:text-white transition-colors p-2">
                        <MoreHorizontal className="w-6 h-6" />
                      </button>
                    </div>
                    
                    <div className="pl-[72px]">
                      <p className="text-zinc-200 text-lg md:text-xl leading-relaxed whitespace-pre-wrap font-medium">
                        {post.content}
                      </p>
                      
                      <div className="flex gap-6 mt-8 pt-4 border-t border-white/5">
                        <button className="flex items-center gap-2 text-zinc-500 hover:text-pink-500 transition-colors group/btn">
                          <div className="p-2 rounded-full group-hover/btn:bg-pink-500/20 transition-colors">
                            <Heart className="w-5 h-5" />
                          </div>
                          <span className="font-bold text-sm">Me gusta</span>
                        </button>
                        <button className="flex items-center gap-2 text-zinc-500 hover:text-blue-500 transition-colors group/btn">
                          <div className="p-2 rounded-full group-hover/btn:bg-blue-500/20 transition-colors">
                            <MessageSquare className="w-5 h-5" />
                          </div>
                          <span className="font-bold text-sm">Comentar</span>
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* SIDEBAR DERECHO: Tendencias / Info */}
        <div className="hidden xl:flex w-80 flex-col gap-6 flex-shrink-0 h-[calc(100vh-140px)] overflow-y-auto hide-scrollbar sticky top-10">
          
          {/* Trending Box */}
          <div className="bg-gradient-to-b from-purple-900/30 to-black/60 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-lg">
            <h3 className="text-xs font-black text-white uppercase tracking-widest mb-6 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-pink-500" /> Temas del Servidor
            </h3>
            <div className="space-y-4">
              <div className="group cursor-pointer">
                <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-1">Tendencia 1</p>
                <p className="font-bold text-white group-hover:text-pink-400 transition-colors">#ArielYAmigos</p>
                <p className="text-zinc-600 text-xs mt-1">12K Interacciones</p>
              </div>
              <div className="group cursor-pointer">
                <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-1">Tendencia 2</p>
                <p className="font-bold text-white group-hover:text-pink-400 transition-colors">#JoelSatanas</p>
                <p className="text-zinc-600 text-xs mt-1">4.2K Interacciones</p>
              </div>
            </div>
          </div>

          {/* Usuarios Activos */}
          <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-lg">
            <h3 className="text-xs font-black text-white uppercase tracking-widest mb-6 flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-500" /> En linea ahora
            </h3>
            <div className="space-y-4">
              {activeUsers.map(u => (
                <div key={u.id} className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-zinc-900 border border-white/10 overflow-hidden">
                      {u.avatar_url ? <img src={u.avatar_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center font-bold text-white">{u.nickname?.charAt(0)}</div>}
                    </div>
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-black rounded-full" />
                  </div>
                  <div>
                    <p className="font-bold text-white text-sm">{u.nickname}</p>
                    <p className="text-[10px] text-zinc-500 font-bold uppercase">Jugador</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>
    </MainLayout>
  )
}
