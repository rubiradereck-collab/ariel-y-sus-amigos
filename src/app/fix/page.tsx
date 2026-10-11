'use client'

import { createClient } from "@/lib/supabase/client"
import { useEffect, useState } from "react"
import { CheckCircle } from "lucide-react"

export default function FixAvatarPage() {
  const [status, setStatus] = useState("Actualizando tu avatar...")
  const supabase = createClient()

  useEffect(() => {
    async function fixIt() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        // Encontrar el nombre de usuario de los metadatos o del correo para saber qué avatar poner
        let avatarName = 'dereck.jpg' // Por defecto
        if (user.email?.includes('maldonado')) avatarName = 'ariel.jpg'
        if (user.email?.includes('js88')) avatarName = 'joel.jpg'
        if (user.email?.includes('ordonez')) avatarName = 'santiago.jpg'
        if (user.email?.includes('andre')) avatarName = 'andre.jpg'
        if (user.email?.includes('efferson')) avatarName = 'jefferson.jpg'

        const { error } = await supabase
          .from('profiles')
          .update({ avatar_url: `/images/avatars/${avatarName}` })
          .eq('id', user.id)

        if (error) setStatus("Error: " + error.message)
        else setStatus("¡Avatar actualizado a " + avatarName + " exitosamente! Ya puedes volver a Integrantes.")
      } else {
        setStatus("No estás logueado.")
      }
    }
    fixIt()
  }, [])

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
      <CheckCircle className="w-16 h-16 text-green-500 mb-4" />
      <h1 className="text-2xl font-bold text-center">{status}</h1>
      <a href="/profiles" className="mt-8 bg-white/10 px-6 py-2 rounded-full hover:bg-white/20 transition-colors">Volver a Integrantes</a>
    </div>
  )
}
