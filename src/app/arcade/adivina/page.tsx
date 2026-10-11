'use client'

import { MainLayout } from "@/components/layout/MainLayout"
import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { HelpCircle, Trophy, RefreshCw, CheckCircle2, XCircle, Database } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import Link from "next/link"

const defaultPhrases = [
  { text: "¿Alguien quiere jugar o sigo durmiendo?", author: "Ariel" },
  { text: "No es por presumir, pero ayer gané una partida casi sin ver.", author: "Joel" },
  { text: "¡¿Cómo que hay tarea para mañana?!", author: "Santiago" },
  { text: "Gente, me robaron en el juego otra vez...", author: "Andre" },
  { text: "Yo solo entro para reírme un rato.", author: "Dereck" },
  { text: "El lag me está matando, juro que le di en la cabeza.", author: "Jefferson" }
]

const members = ["Ariel", "Joel", "Santiago", "Andre", "Dereck", "Jefferson"]

export default function AdivinaPage() {
  const [phrases, setPhrases] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPhrase, setCurrentPhrase] = useState(0)
  const [score, setScore] = useState(0)
  const [status, setStatus] = useState<'playing' | 'correct' | 'wrong' | 'finished'>('playing')
  const [selected, setSelected] = useState<string | null>(null)
  
  const supabase = createClient()

  useEffect(() => {
    async function loadPhrases() {
      const { data, error } = await supabase.from('arcade_phrases').select('*')
      if (data && data.length >= 3) {
        // Mezclar aleatoriamente las frases de la DB
        setPhrases(data.sort(() => Math.random() - 0.5))
      } else {
        // Si no hay frases en la BD o son muy pocas, usar las por defecto
        setPhrases(defaultPhrases.sort(() => Math.random() - 0.5))
      }
      setLoading(false)
    }
    loadPhrases()
  }, [])

  const handleGuess = (author: string) => {
    if (status !== 'playing') return
    setSelected(author)
    if (author === phrases[currentPhrase].author) {
      setScore(s => s + 100)
      setStatus('correct')
    } else {
      setStatus('wrong')
    }

    setTimeout(() => {
      if (currentPhrase < phrases.length - 1) {
        setCurrentPhrase(c => c + 1)
        setStatus('playing')
        setSelected(null)
      } else {
        setStatus('finished')
      }
    }, 1500)
  }

  const restart = () => {
    setPhrases([...phrases].sort(() => Math.random() - 0.5))
    setCurrentPhrase(0)
    setScore(0)
    setStatus('playing')
    setSelected(null)
  }

  if (loading) {
    return (
      <MainLayout>
        <div className="w-full h-full flex flex-col items-center justify-center min-h-[60vh]">
          <Database className="w-12 h-12 text-orange-500 animate-pulse mb-4" />
          <h2 className="text-xl font-bold text-white uppercase tracking-widest">Cargando base de datos...</h2>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="w-full max-w-4xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-red-500 uppercase tracking-tighter mb-4 flex items-center justify-center gap-4">
            <HelpCircle className="w-12 h-12 text-orange-500" /> ¿Quién dijo eso?
          </h1>
          <p className="text-xl text-orange-200/60 font-medium">Adivina quién del grupo inmortalizó esta frase.</p>
          <div className="mt-4">
            <Link href="/arcade/aportar" className="text-sm font-bold text-orange-400 hover:text-white underline transition-colors">
              ¿Faltan frases? ¡Añade las tuyas aquí!
            </Link>
          </div>
        </div>

        <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-[0_0_50px_rgba(249,115,22,0.1)]">
          <div className="flex justify-between items-center mb-8 border-b border-white/10 pb-4">
            <div className="text-zinc-400 font-bold uppercase tracking-widest">
              Frase {currentPhrase + 1} de {phrases.length}
            </div>
            <div className="flex items-center gap-2 text-2xl font-black text-orange-400 bg-orange-500/10 px-4 py-2 rounded-xl border border-orange-500/20">
              <Trophy className="w-6 h-6" /> {score} XP
            </div>
          </div>

          <AnimatePresence mode="wait">
            {status !== 'finished' ? (
              <motion.div
                key={currentPhrase}
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                className="text-center"
              >
                <div className="bg-zinc-900 border border-white/10 rounded-2xl p-8 mb-12 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-500 to-red-500" />
                  <p className="text-3xl md:text-5xl font-black text-white italic leading-tight">
                    "{phrases[currentPhrase].text}"
                  </p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {members.map(member => {
                    const isSelected = selected === member;
                    const isCorrect = member === phrases[currentPhrase].author;
                    
                    let btnClass = "bg-zinc-900 border-white/10 hover:border-orange-500/50 hover:bg-orange-500/10 text-white";
                    
                    if (status !== 'playing') {
                      if (isCorrect) btnClass = "bg-emerald-500/20 border-emerald-500 text-emerald-400";
                      else if (isSelected && !isCorrect) btnClass = "bg-red-500/20 border-red-500 text-red-400";
                      else btnClass = "bg-zinc-900/50 border-white/5 text-zinc-600 grayscale";
                    }

                    return (
                      <button
                        key={member}
                        onClick={() => handleGuess(member)}
                        disabled={status !== 'playing'}
                        className={`p-6 rounded-2xl border-2 font-black text-xl uppercase tracking-widest transition-all duration-300 flex flex-col items-center gap-2 ${btnClass}`}
                      >
                        {status !== 'playing' && isCorrect && <CheckCircle2 className="w-6 h-6 text-emerald-500" />}
                        {status !== 'playing' && isSelected && !isCorrect && <XCircle className="w-6 h-6 text-red-500" />}
                        {member}
                      </button>
                    )
                  })}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="finished"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-12"
              >
                <Trophy className="w-24 h-24 text-orange-500 mx-auto mb-6" />
                <h2 className="text-4xl font-black text-white mb-2">¡Juego Terminado!</h2>
                <p className="text-xl text-zinc-400 mb-8">Has conseguido <span className="text-orange-400 font-bold">{score} XP</span> en total.</p>
                
                <button
                  onClick={restart}
                  className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-400 hover:to-red-400 text-white font-black px-8 py-4 rounded-xl flex items-center gap-3 mx-auto transition-transform hover:scale-105"
                >
                  <RefreshCw className="w-6 h-6" /> JUGAR DE NUEVO
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </MainLayout>
  )
}
