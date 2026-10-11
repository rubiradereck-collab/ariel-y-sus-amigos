'use client'

import { MainLayout } from "@/components/layout/MainLayout"
import { createClient } from "@/lib/supabase/client"
import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Save, User, Image as ImageIcon, CheckCircle, Gamepad2, Settings2, Fingerprint, AtSign, Lock, KeyRound, LogOut } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

export default function SettingsPage() {
  const router = useRouter()
  const handleLogout = async () => {
    await supabase.auth.signOut()
    toast.success('Sesión cerrada correctamente')
    router.push('/login')
  }
  const [profile, setProfile] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  
  const [nickname, setNickname] = useState('')
  const [username, setUsername] = useState('')
  const [description, setDescription] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')

  const supabase = createClient()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [updatingPassword, setUpdatingPassword] = useState(false)

  const updatePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      return toast.error('La contraseña debe tener al menos 6 caracteres')
    }
    if (newPassword !== confirmPassword) {
      return toast.error('Las contraseñas no coinciden')
    }
    setUpdatingPassword(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) {
      toast.error('Error al cambiar contraseña: ' + error.message)
    } else {
      toast.success('¡Contraseña cambiada con éxito!')
      setNewPassword('')
      setConfirmPassword('')
    }
    setUpdatingPassword(false)
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase.from('profiles').select('*').eq('id', user.id).single().then(({ data }) => {
          if (data) {
            setProfile(data)
            setNickname(data.nickname || '')
            setUsername(data.username || '')
            setDescription(data.description || '')
            setAvatarUrl(data.avatar_url || '')
          }
        })
      }
    })
  }, [])

  const saveProfile = async () => {
    if (!profile) return
    setSaving(true)
    
    const { error } = await supabase
      .from('profiles')
      .update({ 
        nickname,
        username,
        description,
        avatar_url: avatarUrl 
      })
      .eq('id', profile.id)

    if (error) {
      toast.error('Error al guardar: ' + error.message)
    } else {
      toast.success('¡Perfil actualizado con éxito!')
      setTimeout(() => window.location.reload(), 1000)
    }
    setSaving(false)
  }

  return (
    <MainLayout>
      <div className="w-full max-w-5xl mx-auto px-4 py-8">
        <header className="mb-12 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="bg-blue-600/20 p-4 rounded-2xl border border-blue-500/30">
              <Settings2 className="w-10 h-10 text-blue-400" />
            </div>
            <div>
              <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-500 uppercase tracking-widest">
                Ajustes de Perfil
              </h1>
              <p className="text-blue-200/60 font-medium text-lg">Personaliza tu identidad en la red de comunicación.</p>
            </div>
          </div>

          <button 
            onClick={handleLogout}
            className="bg-red-950/60 hover:bg-red-600 border border-red-500/40 hover:border-red-500 text-red-300 hover:text-white px-6 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2.5 transition-all shadow-xl self-start md:self-auto cursor-pointer"
          >
            <LogOut className="w-4 h-4" /> Cerrar Sesión
          </button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          <motion.div 
            initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
            className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl"
          >
            <div className="p-8 border-b border-white/5 flex items-center gap-3">
              <User className="w-6 h-6 text-blue-500" />
              <h2 className="text-xl font-black text-white uppercase tracking-widest">Datos Públicos</h2>
            </div>
            
            <div className="p-8 space-y-6">
              
              <div>
                <label className="flex items-center gap-2 text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3">
                  <AtSign className="w-4 h-4 text-blue-400" /> Usuario (ID)
                </label>
                <input 
                  type="text" 
                  value={username}
                  onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  placeholder="ej. rubiradereck"
                  className="w-full bg-zinc-900 border border-white/10 focus:border-blue-500 rounded-xl p-4 text-white font-mono transition-colors" 
                />
                <p className="text-xs text-zinc-500 mt-2">Tu identificador único. Solo minúsculas, números y guiones bajos.</p>
              </div>

              <div>
                <label className="flex items-center gap-2 text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3">
                  <User className="w-4 h-4 text-emerald-400" /> Apodo (Nickname)
                </label>
                <input 
                  type="text" 
                  value={nickname}
                  onChange={e => setNickname(e.target.value)}
                  placeholder="ej. El Causa"
                  className="w-full bg-zinc-900 border border-white/10 focus:border-emerald-500 rounded-xl p-4 text-white transition-colors font-bold" 
                />
                <p className="text-xs text-zinc-500 mt-2">Así es como te verán los demás en el chat y los minijuegos.</p>
              </div>

              <div>
                <label className="flex items-center gap-2 text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3">
                  <Gamepad2 className="w-4 h-4 text-pink-400" /> Biografía / Estado
                </label>
                <textarea 
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Escribe algo sobre ti, tus juegos favoritos o tu estado actual..."
                  className="w-full bg-zinc-900 border border-white/10 focus:border-pink-500 rounded-xl p-4 text-white transition-colors min-h-[100px] resize-none" 
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3">
                  <ImageIcon className="w-4 h-4 text-purple-400" /> URL del Avatar
                </label>
                <input 
                  type="text" 
                  value={avatarUrl}
                  onChange={e => setAvatarUrl(e.target.value)}
                  placeholder="https://i.imgur.com/..."
                  className="w-full bg-zinc-900 border border-white/10 focus:border-purple-500 rounded-xl p-4 text-white transition-colors" 
                />
                <p className="text-xs text-zinc-500 mt-2">Pega el enlace de una imagen si quieres cambiar tu foto.</p>
              </div>

              <button 
                onClick={saveProfile}
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-500 text-white font-black px-8 py-4 rounded-xl flex items-center justify-center gap-3 w-full transition-all shadow-lg hover:shadow-blue-500/25"
              >
                {saving ? <span className="animate-pulse">Guardando...</span> : <><CheckCircle className="w-5 h-5" /> GUARDAR CAMBIOS</>}
              </button>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
            className="flex flex-col gap-6"
          >
            {/* Vista Previa Card */}
            <div className="bg-zinc-900 border border-white/5 rounded-3xl p-8 relative overflow-hidden flex flex-col items-center text-center shadow-2xl">
              <div className="absolute top-0 right-0 p-4">
                <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest bg-blue-500/10 px-3 py-1 rounded-full">Vista Previa</span>
              </div>
              
              <div className="w-32 h-32 rounded-3xl bg-black border-4 border-zinc-800 shadow-xl overflow-hidden mb-6 relative">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar Preview" className="w-full h-full object-cover object-top" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-zinc-800">
                    <User className="w-12 h-12 text-zinc-600" />
                  </div>
                )}
              </div>
              
              <h3 className="text-3xl font-black text-white">{nickname || 'Sin Apodo'}</h3>
              <span className="text-sm font-bold text-blue-400 mt-1 uppercase tracking-widest">
                @{username || 'usuario'}
              </span>
              
              {description && (
                <p className="mt-6 text-zinc-400 italic bg-black/40 px-6 py-4 rounded-xl border border-white/5 w-full text-sm leading-relaxed">
                  "{description}"
                </p>
              )}
            </div>
          </motion.div>

        
            {/* Tarjeta de Seguridad y Cambio de Contraseña */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl col-span-1 md:col-span-2 mt-4"
            >
              <div className="p-8 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <KeyRound className="w-6 h-6 text-yellow-500" />
                  <div>
                    <h2 className="text-xl font-black text-white uppercase tracking-widest">Seguridad de la Cuenta</h2>
                    <p className="text-xs text-zinc-400 mt-0.5">Cambia tu contraseña para que solo tú tengas acceso a tu perfil.</p>
                  </div>
                </div>
              </div>

              <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="flex items-center gap-2 text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3">
                    <Lock className="w-4 h-4 text-yellow-400" /> Nueva Contraseña
                  </label>
                  <input 
                    type="password" 
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full bg-zinc-900 border border-white/10 focus:border-yellow-500 rounded-xl p-4 text-white font-mono transition-colors" 
                  />
                </div>

                <div>
                  <label className="flex items-center gap-2 text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3">
                    <Lock className="w-4 h-4 text-yellow-400" /> Confirmar Nueva Contraseña
                  </label>
                  <input 
                    type="password" 
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Repite la contraseña"
                    className="w-full bg-zinc-900 border border-white/10 focus:border-yellow-500 rounded-xl p-4 text-white font-mono transition-colors" 
                  />
                </div>

                <div className="md:col-span-2 flex justify-end">
                  <button 
                    onClick={updatePassword}
                    disabled={updatingPassword || !newPassword}
                    className="bg-yellow-600 hover:bg-yellow-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-black font-black px-8 py-3.5 rounded-xl uppercase tracking-widest text-xs flex items-center gap-2 transition-all shadow-lg"
                  >
                    <KeyRound className="w-4 h-4" />
                    {updatingPassword ? 'Actualizando...' : 'Actualizar Contraseña'}
                  </button>
                </div>
              </div>
            </motion.div>

          </div>
        </div>
    </MainLayout>
  )
}
