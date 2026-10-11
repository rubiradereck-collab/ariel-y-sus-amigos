'use client'

import { MainLayout } from "@/components/layout/MainLayout"
import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { createClient } from "@/lib/supabase/client"
import { Brain, Trophy, Timer, ChevronRight, CheckCircle2, XCircle, Database } from "lucide-react"
import Link from "next/link"

// Preguntas base de ejemplo.
const defaultQuestions = [
  {
    question: "¿Cuál es el propósito principal de esta web?",
    correct_answer: "Administrar el caos",
    wrong_answer_1: "Hacer tareas",
    wrong_answer_2: "Jugar al buscaminas",
    wrong_answer_3: "Vender NFTs"
  },
  {
    question: "¿Cuántos integrantes principales conforman el grupo?",
    correct_answer: "6",
    wrong_answer_1: "4",
    wrong_answer_2: "5",
    wrong_answer_3: "7"
  },
  {
    question: "¿Qué botón no debería ser pulsado nunca?",
    correct_answer: "El botón de Joel",
    wrong_answer_1: "El botón rojo",
    wrong_answer_2: "Alt + F4",
    wrong_answer_3: "Borrar System32"
  }
]

export default function TriviaPage() {
  const [started, setStarted] = useState(false)
  const [questions, setQuestions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [currentQ, setCurrentQ] = useState(0)
  const [score, setScore] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [isAnswering, setIsAnswering] = useState(false)
  const [finished, setFinished] = useState(false)
  
  const supabase = createClient()

  useEffect(() => {
    async function loadTrivia() {
      const { data, error } = await supabase.from('arcade_trivia').select('*')
      let loadedQuestions = defaultQuestions
      if (data && data.length >= 3) {
        loadedQuestions = data
      }

      // Format questions for UI (mix options)
      const formatted = loadedQuestions.map(q => {
        const options = [q.correct_answer, q.wrong_answer_1, q.wrong_answer_2, q.wrong_answer_3]
          .sort(() => Math.random() - 0.5)
        return {
          text: q.question,
          options,
          correct: q.correct_answer
        }
      })
      
      setQuestions(formatted.sort(() => Math.random() - 0.5))
      setLoading(false)
    }
    loadTrivia()
  }, [])

  const handleSelect = (option: string) => {
    if (isAnswering) return
    setSelected(option)
    setIsAnswering(true)
    
    if (option === questions[currentQ].correct) {
      setScore(s => s + 500)
    }

    setTimeout(() => {
      if (currentQ < questions.length - 1) {
        setCurrentQ(c => c + 1)
        setSelected(null)
        setIsAnswering(false)
      } else {
        setFinished(true)
      }
    }, 1500)
  }

  if (loading) {
    return (
      <MainLayout>
        <div className="w-full h-full flex flex-col items-center justify-center min-h-[60vh]">
          <Database className="w-12 h-12 text-blue-500 animate-pulse mb-4" />
          <h2 className="text-xl font-bold text-white uppercase tracking-widest">Cargando trivia...</h2>
        </div>
      </MainLayout>
    )
  }

  if (!started && !finished) {
    return (
      <MainLayout>
        <div className="w-full h-full flex flex-col items-center justify-center min-h-[70vh] px-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-black/60 backdrop-blur-xl border border-white/10 p-12 rounded-3xl text-center max-w-2xl w-full"
          >
            <Brain className="w-24 h-24 text-blue-500 mx-auto mb-6" />
            <h1 className="text-4xl md:text-6xl font-black text-white mb-4 uppercase tracking-tighter">Trivia del Grupo</h1>
            <p className="text-blue-200/80 mb-8 text-lg">
              Demuestra cuánto conoces a tus amigos. Responde rápido, responde bien.
            </p>
            <button 
              onClick={() => setStarted(true)}
              className="bg-blue-600 hover:bg-blue-500 text-white font-black text-xl uppercase tracking-widest px-12 py-5 rounded-full transition-all hover:scale-105 hover:shadow-[0_0_40px_rgba(37,99,235,0.6)]"
            >
              Comenzar Reto
            </button>
            <div className="mt-8 pt-6 border-t border-white/10">
              <Link href="/arcade/aportar" className="text-blue-400 hover:text-white font-bold underline transition-colors">
                ¿Faltan preguntas? Aporta a la base de datos
              </Link>
            </div>
          </motion.div>
        </div>
      </MainLayout>
    )
  }

  if (finished) {
    return (
      <MainLayout>
        <div className="w-full h-full flex flex-col items-center justify-center min-h-[70vh] px-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-black/60 backdrop-blur-xl border border-white/10 p-12 rounded-3xl text-center max-w-2xl w-full relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-t from-blue-900/30 to-transparent pointer-events-none" />
            <Trophy className="w-32 h-32 text-yellow-500 mx-auto mb-6 relative z-10 drop-shadow-[0_0_30px_rgba(234,179,8,0.5)]" />
            <h2 className="text-4xl font-black text-white mb-2 relative z-10">¡Trivia Completada!</h2>
            <p className="text-xl text-zinc-400 mb-8 relative z-10">Puntuación Final</p>
            <div className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400 mb-10 relative z-10">
              {score} XP
            </div>
            
            <button
              onClick={() => {
                setQuestions([...questions].sort(() => Math.random() - 0.5))
                setCurrentQ(0)
                setScore(0)
                setSelected(null)
                setIsAnswering(false)
                setFinished(false)
              }}
              className="bg-zinc-800 hover:bg-zinc-700 text-white font-bold px-8 py-3 rounded-full transition-colors relative z-10"
            >
              Jugar de Nuevo
            </button>
          </motion.div>
        </div>
      </MainLayout>
    )
  }

  const q = questions[currentQ]

  return (
    <MainLayout>
      <div className="w-full max-w-4xl mx-auto px-4 py-12 min-h-[80vh] flex flex-col justify-center">
        
        <div className="flex justify-between items-center mb-8">
          <div className="bg-black/50 border border-white/10 px-6 py-2 rounded-full font-bold text-blue-400">
            Pregunta {currentQ + 1} / {questions.length}
          </div>
          <div className="bg-black/50 border border-white/10 px-6 py-2 rounded-full font-black text-yellow-500 flex items-center gap-2">
            <Trophy className="w-4 h-4" /> {score} XP
          </div>
        </div>

        <div className="bg-gradient-to-b from-blue-900/20 to-black/60 backdrop-blur-xl border border-blue-500/30 rounded-3xl p-8 md:p-12 shadow-[0_0_50px_rgba(37,99,235,0.1)]">
          <h2 className="text-3xl md:text-5xl font-black text-white leading-tight mb-12 text-center">
            {q.text}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {q.options.map((opt: string, i: number) => {
              const isSelected = selected === opt;
              const isCorrect = opt === q.correct;
              
              let btnClass = "bg-zinc-900 border-white/10 hover:border-blue-500 hover:bg-blue-500/10 text-white";
              
              if (isAnswering) {
                if (isCorrect) btnClass = "bg-emerald-500/20 border-emerald-500 text-emerald-400";
                else if (isSelected && !isCorrect) btnClass = "bg-red-500/20 border-red-500 text-red-400";
                else btnClass = "bg-zinc-900/50 border-white/5 text-zinc-600 grayscale";
              }

              return (
                <button
                  key={i}
                  onClick={() => handleSelect(opt)}
                  disabled={isAnswering}
                  className={`p-6 rounded-2xl border-2 font-bold text-lg md:text-xl transition-all duration-300 flex justify-between items-center text-left ${btnClass}`}
                >
                  <span>{opt}</span>
                  {isAnswering && isCorrect && <CheckCircle2 className="w-6 h-6 text-emerald-500 flex-shrink-0" />}
                  {isAnswering && isSelected && !isCorrect && <XCircle className="w-6 h-6 text-red-500 flex-shrink-0" />}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </MainLayout>
  )
}
