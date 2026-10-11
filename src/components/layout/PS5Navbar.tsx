'use client'

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Home, MessageSquare, Users, Image as ImageIcon, Search, Bell, Menu, Gamepad2, Activity, Music, Palette, Send, ShoppingCart, Tv, Settings, KeyRound, LogOut, ChevronDown, Pickaxe, Coins } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"

const navItems = [
  { name: 'INICIO', path: '/', icon: Home },
  { name: 'AVENTURA', path: '/aventura', icon: Pickaxe },
  { name: 'APUESTAS', path: '/apuestas', icon: Coins },
  { name: 'CHAT', path: '/chat', icon: MessageSquare },
  { name: 'MURO', path: '/muro', icon: MessageSquare },
  { name: 'PERFILES', path: '/profiles', icon: Users },
  { name: 'GALERIA', path: '/memes', icon: ImageIcon },
  { name: 'ARCADE', path: '/arcade', icon: Gamepad2 },
  { name: 'TIENDA', path: '/tienda', icon: ShoppingCart },
  { name: 'CINE', path: '/watchparty', icon: Tv },
  { name: 'MUSICA', path: '/musica', icon: Music },
  { name: 'DASHBOARD', path: '/stats', icon: Activity },
]

const themes = [
  { id: 'cyan', color: 'bg-cyan-500' },
  { id: 'pink', color: 'bg-pink-500' },
  { id: 'emerald', color: 'bg-emerald-500' },
  { id: 'purple', color: 'bg-purple-500' },
  { id: 'orange', color: 'bg-orange-500' },
]

export function PS5Navbar({ currentTheme = 'cyan' }: { currentTheme?: string }) {
  const pathname = usePathname()
  const [profile, setProfile] = useState<any>(null)
  const [showThemeMenu, setShowThemeMenu] = useState(false)
  const [showLFGMenu, setShowLFGMenu] = useState(false)
  const supabase = createClient()
  const router = useRouter()
  const [showUserMenu, setShowUserMenu] = useState(false)

  const handleLogout = async () => {
    await supabase.auth.signOut()
    toast.success('Sesión cerrada correctamente')
    setShowUserMenu(false)
    router.push('/login')
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase.from('profiles').select('*').eq('id', user.id).single().then(({ data }) => setProfile(data))
      }
    })
  }, [])

  const changeTheme = (themeId: string) => {
    const event = new CustomEvent('themeChanged', { detail: themeId })
    window.dispatchEvent(event)
    setShowThemeMenu(false)
  }

  const broadcastLFG = async (game: string) => {
    if (!profile) {
      toast.error("Debes iniciar sesión")
      return
    }
    
    // Broadcast message to all connected clients
    const channel = supabase.channel('global:notifications')
    await channel.send({
      type: 'broadcast',
      event: 'lfg',
      payload: { user: profile.nickname, game, message: '¡Únanse al canal de voz!' }
    })
    
    toast.success(`Notificación enviada a todos para jugar ${game}`)
    setShowLFGMenu(false)
  }

  return (
    <nav className="fixed top-0 w-full z-50 bg-gradient-to-b from-black/90 via-black/50 to-transparent backdrop-blur-[2px]">
      <div className="max-w-[1800px] mx-auto px-6 h-24 flex items-center justify-between gap-8 relative">
        
        {/* Left: Navigation Links */}
        <div className="flex-1 flex items-center gap-6 overflow-x-auto hide-scrollbar pr-12 mask-fade-right">
          {navItems.map((item) => {
            const isActive = pathname === item.path
            return (
              <Link 
                key={item.path} 
                href={item.path}
                className="relative group flex items-center gap-2 whitespace-nowrap py-2"
              >
                <item.icon className={`w-4 h-4 transition-colors ${isActive ? 'text-white' : 'text-zinc-500 group-hover:text-white'}`} />
                <span className={`text-[13px] font-black tracking-[0.2em] transition-all duration-300 ${
                  isActive ? 'text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.8)]' : 'text-zinc-500 group-hover:text-zinc-300'
                }`}>
                  {item.name}
                </span>
                {isActive && (
                  <motion.div 
                    layoutId="activeNav"
                    className="absolute -bottom-2 left-0 right-0 h-1 bg-white shadow-[0_0_15px_rgba(255,255,255,1)]"
                  />
                )}
              </Link>
            )
          })}
        </div>

        {/* Right: Actions & Profile */}
        <div className="flex items-center gap-6 flex-shrink-0 relative">
          
          {/* LFG (Looking For Group) Menu */}
          <div className="relative">
            <button 
              onClick={() => { setShowLFGMenu(!showLFGMenu); setShowThemeMenu(false); }}
              className="text-zinc-400 hover:text-white transition-colors relative group"
            >
              <Gamepad2 className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
            </button>

            <AnimatePresence>
              {showLFGMenu && (
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute top-10 right-0 bg-black/95 border border-emerald-500/30 p-4 rounded-xl w-64 shadow-[0_0_30px_rgba(16,185,129,0.2)] backdrop-blur-xl"
                >
                  <p className="text-xs font-black uppercase text-emerald-500 mb-3 text-center">Invitar a todos a jugar</p>
                  <div className="space-y-2">
                    <button onClick={() => broadcastLFG('Roblox')} className="w-full bg-zinc-900 hover:bg-emerald-500/20 text-white font-bold py-2 rounded-lg text-sm border border-white/5 hover:border-emerald-500/50 transition-colors">Roblox</button>
                    <button onClick={() => broadcastLFG('Minecraft')} className="w-full bg-zinc-900 hover:bg-emerald-500/20 text-white font-bold py-2 rounded-lg text-sm border border-white/5 hover:border-emerald-500/50 transition-colors">Minecraft</button>
                    <button onClick={() => broadcastLFG('Valorant')} className="w-full bg-zinc-900 hover:bg-emerald-500/20 text-white font-bold py-2 rounded-lg text-sm border border-white/5 hover:border-emerald-500/50 transition-colors">Valorant</button>
                    <button onClick={() => broadcastLFG('Llamada de Discord')} className="w-full bg-zinc-900 hover:bg-blue-500/20 text-white font-bold py-2 rounded-lg text-sm border border-white/5 hover:border-blue-500/50 transition-colors flex items-center justify-center gap-2">
                      <Bell className="w-4 h-4" /> Hablar en Discord
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Theme Switcher Menu */}
          <div className="relative">
            <button 
              onClick={() => { setShowThemeMenu(!showThemeMenu); setShowLFGMenu(false); }}
              className="text-zinc-400 hover:text-white transition-colors"
            >
              <Palette className="w-5 h-5" />
            </button>

            <AnimatePresence>
              {showThemeMenu && (
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute top-10 right-0 bg-black/95 border border-white/10 p-4 rounded-xl flex gap-3 shadow-2xl backdrop-blur-xl"
                >
                  {themes.map(t => (
                    <button 
                      key={t.id}
                      onClick={() => changeTheme(t.id)}
                      className={`w-6 h-6 rounded-full ${t.color} hover:scale-110 transition-transform ${currentTheme === t.id ? 'ring-2 ring-white ring-offset-2 ring-offset-black' : ''}`}
                    />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <Search className="w-5 h-5 text-zinc-400 hover:text-white transition-colors cursor-pointer" />
          <Bell className="w-5 h-5 text-zinc-400 hover:text-white transition-colors cursor-pointer" />

          {/* Menú de Usuario / Perfil / Cerrar Sesión */}
          <div className="relative">
            <button 
              onClick={() => { setShowUserMenu(!showUserMenu); setShowThemeMenu(false); setShowLFGMenu(false); }}
              className="flex items-center gap-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/30 rounded-full py-1.5 px-2 pr-4 transition-all group"
            >
              <div className="w-8 h-8 rounded-full bg-black overflow-hidden border border-white/20">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} className="w-full h-full object-cover object-top scale-110" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs font-bold text-white">
                    {profile?.nickname?.charAt(0) || '?'}
                  </div>
                )}
              </div>
              <div className="flex flex-col text-left">
                <span className="text-[11px] font-black text-white leading-tight">{profile?.username || 'Invitado'}</span>
                <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">{profile?.nickname || 'Login'}</span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-zinc-400 group-hover:text-white transition-transform duration-200" />
            </button>

            <AnimatePresence>
              {showUserMenu && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute top-12 right-0 bg-black/95 border border-white/10 p-3 rounded-2xl w-60 shadow-[0_0_50px_rgba(0,0,0,0.9)] backdrop-blur-2xl z-50 space-y-2"
                >
                  <div className="p-3 bg-white/5 rounded-xl border border-white/5 mb-2">
                    <p className="text-white font-black text-sm">{profile?.nickname || 'Usuario'}</p>
                    <p className="text-zinc-500 font-mono text-xs">@{profile?.username || 'usuario'}</p>
                  </div>

                  <Link 
                    href="/settings" 
                    onClick={() => setShowUserMenu(false)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-zinc-300 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <Settings className="w-4 h-4 text-blue-400" /> Ajustes de Perfil
                  </Link>

                  <Link 
                    href="/settings" 
                    onClick={() => setShowUserMenu(false)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-zinc-300 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <KeyRound className="w-4 h-4 text-yellow-400" /> Cambiar Contraseña
                  </Link>

                  <div className="h-px bg-white/10 my-1" />

                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-red-400 hover:text-white hover:bg-red-600/40 transition-all border border-red-500/20"
                  >
                    <LogOut className="w-4 h-4 text-red-400" /> Cerrar Sesión
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

        </div>
      </div>
    </nav>
  )
}

