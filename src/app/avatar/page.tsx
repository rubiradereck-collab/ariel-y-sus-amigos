'use client'

import { MainLayout } from "@/components/layout/MainLayout"
import { useState, useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { motion } from "framer-motion"
import { Save, Upload, ExternalLink, ImageIcon } from "lucide-react"

export default function AvatarEditorPage() {
  const [profile, setProfile] = useState<any>(null)
  const [avatarUrl, setAvatarUrl] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        setProfile(data)
        setAvatarUrl(data.avatar_url || '')
      }
    }
    loadData()
  }, [])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !profile) return

    setSaving(true)
    
    const fileExt = file.name.split('.').pop()
    const fileName = `avatar-${profile.id}-${Math.random()}.${fileExt}`
    
    // Asume que tienes un bucket "avatars". Si falla, mostrará error.
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, file, { upsert: true })

    if (uploadError) {
      alert("Error al subir imagen. ¿Creaste el bucket 'avatars' público en Supabase? Detalle: " + uploadError.message)
      setSaving(false)
      return
    }

    const { data: publicUrlData } = supabase.storage
      .from('avatars')
      .getPublicUrl(fileName)

    setAvatarUrl(publicUrlData.publicUrl)
    setSaving(false)
  }

  const handleSave = async () => {
    if (!profile) return
    setSaving(true)
    
    // Limpiamos avatar_url (el viejo sistema feo) y guardamos la URL real
    const { error } = await supabase.from('profiles').update({ 
      avatar_url: avatarUrl
    }).eq('id', profile.id)

    if (error) {
      alert("Error al guardar en la base de datos.")
    } else {
      alert("¡Avatar RPG guardado correctamente! Se actualizará en toda la página.")
      window.location.reload()
    }
    setSaving(false)
  }

  return (
    <MainLayout>
      <div className="w-full h-full max-w-4xl mx-auto px-4 pt-10 pb-32 overflow-y-auto hide-scrollbar">
        <header className="mb-12 text-center">
          <h1 className="text-4xl md:text-5xl font-black uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-500 drop-shadow-[0_0_15px_rgba(52,211,153,0.5)]">
            Tu Personaje
          </h1>
          <p className="text-zinc-400 mt-2">Sube tu sprite personalizado de Stardew Valley o RPG.</p>
        </header>

        <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-[0_0_50px_rgba(0,0,0,0.8)]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            
            {/* Vista Previa */}
            <div className="flex flex-col items-center justify-center">
              <div className="w-64 h-64 bg-zinc-900 rounded-2xl border-4 border-white/10 flex items-center justify-center overflow-hidden relative shadow-[0_0_30px_rgba(0,0,0,0.5)]">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay" />
                
                {avatarUrl ? (
                  <img 
                    src={avatarUrl} 
                    alt="Tu Avatar" 
                    className="w-full h-full object-contain relative z-10"
                    style={{ imageRendering: 'pixelated' }}
                  />
                ) : (
                  <div className="text-center text-zinc-500 relative z-10">
                    <ImageIcon className="w-16 h-16 mx-auto mb-2 opacity-50" />
                    <p className="text-sm font-bold uppercase tracking-widest">Sin Avatar</p>
                  </div>
                )}
              </div>
            </div>

            {/* Controles */}
            <div className="space-y-6">
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
                <h3 className="text-emerald-400 font-bold mb-2">Instrucciones para un Avatar Perfecto</h3>
                <p className="text-sm text-zinc-300 mb-4">
                  El generador de la web no era lo suficientemente bueno. Para tener un avatar idéntico a Stardew Valley, 
                  créalo en una página especializada y sube la imagen aquí.
                </p>
                <a 
                  href="https://jazzybee.itch.io/sdvcharactercreator" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" /> Abrir Creador de Stardew Valley
                </a>
              </div>

              <div className="space-y-3">
                <input 
                  type="file" 
                  accept="image/png, image/jpeg, image/gif" 
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                />
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={saving}
                  className="w-full flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border-2 border-dashed border-white/20 hover:border-emerald-500 rounded-xl py-4 text-white font-bold uppercase tracking-widest text-sm transition-all"
                >
                  {saving ? <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" /> : <Upload className="w-5 h-5" />}
                  Subir Imagen
                </button>

                <div className="flex items-center gap-4 py-2">
                  <div className="h-px bg-white/10 flex-1" />
                  <span className="text-xs text-zinc-500 font-bold uppercase">O pega una URL</span>
                  <div className="h-px bg-white/10 flex-1" />
                </div>

                <input 
                  type="text" 
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-emerald-500 outline-none"
                />
              </div>

              <button 
                onClick={handleSave}
                disabled={saving || !avatarUrl}
                className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl py-4 font-black uppercase tracking-widest text-lg transition-all shadow-[0_0_20px_rgba(52,211,153,0.4)] disabled:opacity-50"
              >
                <Save className="w-6 h-6" />
                Confirmar Personaje
              </button>
            </div>

          </div>
        </div>
      </div>
    </MainLayout>
  )
}
