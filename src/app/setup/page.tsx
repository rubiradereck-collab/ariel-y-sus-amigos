'use client'

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Flame, Check, AlertTriangle } from "lucide-react"

export default function SetupUsersPage() {
  const [status, setStatus] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const emails = [
    { email: "maldonadoariel803@gmail.com", nickname: "Ariel", username: "ariel" },
    { email: "js8895602@gmail.com", nickname: "Joel Satanas", username: "joel" },
    { email: "ordonezsantiago43@gmail.com", nickname: "Santiago", username: "santiago" },
    { email: "andregranda200@gmail.com", nickname: "Andre", username: "andre" },
    { email: "Jeffersonlalangui03@gmail.com", nickname: "Jefferson", username: "jefferson" },
    { email: "rubiradereck@gmail.com", nickname: "Dereck", username: "dereck" } // Usando uno genérico para Dereck si no existe
  ]

  const password = "ArielYAmigos2026"

  const createUsers = async () => {
    setLoading(true)
    setStatus(["Iniciando creación de usuarios..."])

    for (const user of emails) {
      setStatus(prev => [...prev, `Creando cuenta para ${user.email}...`])
      
      const { data, error } = await supabase.auth.signUp({
        email: user.email,
        password: password,
        options: {
          data: {
            nickname: user.nickname,
            username: user.username
          }
        }
      })

      if (error) {
        setStatus(prev => [...prev, `❌ Error en ${user.email}: ${error.message}`])
      } else {
        setStatus(prev => [...prev, `✅ Éxito: ${user.email} (Revisar correo para confirmar)`])
        // Update avatar url
        if (data.user) {
          await supabase.from('profiles').update({ avatar_url: `/images/avatars/${user.username}.jpg` }).eq('id', data.user.id)
        }
      }
      
      // Pequeña pausa para no saturar la API
      await new Promise(r => setTimeout(r, 1000))
    }

    setStatus(prev => [...prev, "🎉 Proceso terminado. La contraseña para todos es: " + password])
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-black text-white p-10 font-sans">
      <div className="max-w-2xl mx-auto bg-zinc-900 p-8 rounded-2xl border border-white/10">
        <h1 className="text-3xl font-black mb-4 flex items-center gap-3">
          <Flame className="text-red-500" /> Creador de Cuentas Automático
        </h1>
        <p className="text-zinc-400 mb-8">
          Este panel registrará los 6 correos del grupo con la misma contraseña. 
          <br/><br/>
          <strong>ATENCIÓN:</strong> Si tienes activada la confirmación por correo en Supabase, a cada uno le llegará un correo para verificar su cuenta antes de poder entrar. (Si quieres evitar esto, debes desactivar "Confirm email" en Supabase - Authentication - Providers - Email).
        </p>

        <button 
          onClick={createUsers}
          disabled={loading}
          className="w-full bg-red-600 hover:bg-red-500 text-white font-black py-4 rounded-xl text-xl transition-all disabled:opacity-50"
        >
          {loading ? "CREANDO..." : "CREAR LOS 6 USUARIOS AHORA"}
        </button>

        <div className="mt-8 bg-black p-4 rounded-xl border border-white/5 min-h-[200px] font-mono text-sm text-green-400 space-y-2">
          {status.length === 0 && <span className="text-zinc-600">Esperando ejecución...</span>}
          {status.map((msg, i) => (
            <div key={i}>{msg}</div>
          ))}
        </div>
      </div>
    </div>
  )
}
