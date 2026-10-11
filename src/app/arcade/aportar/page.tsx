'use client'

import { MainLayout } from "@/components/layout/MainLayout"
import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { createClient } from "@/lib/supabase/client"
import { Send, Target, Trophy, Info } from "lucide-react"
import { toast } from "sonner"

export default function AportarPage() {
  const [activeTab, setActiveTab] = useState<'phrase' | 'trivia'>('phrase')
  const supabase = createClient()

  // Form states - Phrase
  const [phraseText, setPhraseText] = useState('')
  const [phraseAuthor, setPhraseAuthor] = useState('Dereck')

  // Form states - Trivia
  const [triviaQ, setTriviaQ] = useState('')
  const [triviaCorrect, setTriviaCorrect] = useState('')
  const [triviaW1, setTriviaW1] = useState('')
  const [triviaW2, setTriviaW2] = useState('')
  const [triviaW3, setTriviaW3] = useState('')

  const members = ["Ariel", "Joel", "Santiago", "Andre", "Dereck", "Jefferson"]

  const submitPhrase = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!phraseText.trim()) return
    
    const { error } = await supabase.from('arcade_phrases').insert([{
      text: phraseText.trim(),
      author: phraseAuthor
    }])

    if (error) {
      toast.error('Error: ' + error.message)
    } else {
      toast.success('¡Frase añadida al juego con éxito!')
      setPhraseText('')
    }
  }

  const submitTrivia = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!triviaQ.trim() || !triviaCorrect.trim() || !triviaW1.trim() || !triviaW2.trim() || !triviaW3.trim()) {
      toast.error('Rellena todas las opciones')
      return
    }

    const { error } = await supabase.from('arcade_trivia').insert([{
      question: triviaQ.trim(),
      correct_answer: triviaCorrect.trim(),
      wrong_answer_1: triviaW1.trim(),
      wrong_answer_2: triviaW2.trim(),
      wrong_answer_3: triviaW3.trim()
    }])

    if (error) {
      toast.error('Error: ' + error.message)
    } else {
      toast.success('¡Pregunta de trivia añadida con éxito!')
      setTriviaQ('')
      setTriviaCorrect('')
      setTriviaW1('')
      setTriviaW2('')
      setTriviaW3('')
    }
  }

  return (
    <MainLayout>
      <div className="w-full max-w-4xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-500 uppercase tracking-tighter mb-4">
            Aportar al Arcade
          </h1>
          <p className="text-xl text-emerald-100/60 font-medium max-w-2xl mx-auto">
            Añade tus propias frases y preguntas a la base de datos para que aparezcan en los minijuegos.
          </p>
        </div>

        <div className="bg-zinc-950/80 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
          
          <div className="flex border-b border-white/10">
            <button 
              onClick={() => setActiveTab('phrase')}
              className={`flex-1 py-6 font-black text-lg uppercase tracking-widest transition-colors flex items-center justify-center gap-3 ${activeTab === 'phrase' ? 'bg-orange-500/10 text-orange-400 border-b-2 border-orange-500' : 'text-zinc-500 hover:text-white hover:bg-white/5'}`}
            >
              <Target className="w-5 h-5" /> Frases
            </button>
            <button 
              onClick={() => setActiveTab('trivia')}
              className={`flex-1 py-6 font-black text-lg uppercase tracking-widest transition-colors flex items-center justify-center gap-3 ${activeTab === 'trivia' ? 'bg-blue-500/10 text-blue-400 border-b-2 border-blue-500' : 'text-zinc-500 hover:text-white hover:bg-white/5'}`}
            >
              <Trophy className="w-5 h-5" /> Trivia
            </button>
          </div>

          <div className="p-8">
            <AnimatePresence mode="wait">
              {activeTab === 'phrase' ? (
                <motion.form key="phrase" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} onSubmit={submitPhrase} className="space-y-6">
                  
                  <div className="bg-orange-500/10 border border-orange-500/30 p-4 rounded-xl flex items-start gap-3 text-orange-200 text-sm">
                    <Info className="w-5 h-5 flex-shrink-0 text-orange-400" />
                    <p>Agrega una frase graciosa, épica o fuera de contexto que alguien haya dicho. Aparecerá en el minijuego <strong>"¿Quién dijo eso?"</strong>.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">La Frase</label>
                    <textarea 
                      value={phraseText}
                      onChange={e => setPhraseText(e.target.value)}
                      placeholder='"Literalmente estaba a un toque de vida..."'
                      className="w-full bg-black border border-white/10 rounded-xl p-4 text-white placeholder-zinc-600 focus:outline-none focus:border-orange-500 resize-none h-32 text-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">¿Quién lo dijo?</label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {members.map(m => (
                        <div 
                          key={m} 
                          onClick={() => setPhraseAuthor(m)}
                          className={`p-4 rounded-xl border cursor-pointer font-bold text-center transition-all ${phraseAuthor === m ? 'bg-orange-500/20 border-orange-500 text-orange-400' : 'bg-black border-white/10 text-zinc-400 hover:border-white/30'}`}
                        >
                          {m}
                        </div>
                      ))}
                    </div>
                  </div>

                  <button type="submit" disabled={!phraseText.trim()} className="w-full bg-orange-500 hover:bg-orange-400 disabled:bg-zinc-800 disabled:text-zinc-500 text-black font-black py-4 rounded-xl transition-all flex items-center justify-center gap-2 text-lg">
                    <Send className="w-5 h-5" /> GUARDAR FRASE
                  </button>

                </motion.form>
              ) : (
                <motion.form key="trivia" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} onSubmit={submitTrivia} className="space-y-6">
                  
                  <div className="bg-blue-500/10 border border-blue-500/30 p-4 rounded-xl flex items-start gap-3 text-blue-200 text-sm">
                    <Info className="w-5 h-5 flex-shrink-0 text-blue-400" />
                    <p>Crea una pregunta sobre el grupo. Aparecerá en el minijuego <strong>"Trivia del Grupo"</strong>. Pon la respuesta correcta en el primer campo, el juego se encargará de mezclarlas al azar cuando alguien juegue.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Pregunta</label>
                    <input type="text" value={triviaQ} onChange={e => setTriviaQ(e.target.value)} placeholder="¿Quién fue el primero en morirse en la campaña de Minecraft?" className="w-full bg-black border border-white/10 rounded-xl p-4 text-white focus:outline-none focus:border-blue-500 text-lg" />
                  </div>

                  <div className="space-y-4 pt-4 border-t border-white/10">
                    <div>
                      <label className="block text-xs font-black text-emerald-500 uppercase tracking-widest mb-2">Respuesta Correcta</label>
                      <input type="text" value={triviaCorrect} onChange={e => setTriviaCorrect(e.target.value)} placeholder="La respuesta real" className="w-full bg-emerald-950/30 border border-emerald-500/30 rounded-xl p-4 text-emerald-100 focus:outline-none focus:border-emerald-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-red-500 uppercase tracking-widest mb-2">Respuesta Falsa 1</label>
                      <input type="text" value={triviaW1} onChange={e => setTriviaW1(e.target.value)} placeholder="Opción incorrecta" className="w-full bg-black border border-white/10 rounded-xl p-4 text-white focus:outline-none focus:border-red-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-red-500 uppercase tracking-widest mb-2">Respuesta Falsa 2</label>
                      <input type="text" value={triviaW2} onChange={e => setTriviaW2(e.target.value)} placeholder="Opción incorrecta" className="w-full bg-black border border-white/10 rounded-xl p-4 text-white focus:outline-none focus:border-red-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-red-500 uppercase tracking-widest mb-2">Respuesta Falsa 3</label>
                      <input type="text" value={triviaW3} onChange={e => setTriviaW3(e.target.value)} placeholder="Opción incorrecta" className="w-full bg-black border border-white/10 rounded-xl p-4 text-white focus:outline-none focus:border-red-500" />
                    </div>
                  </div>

                  <button type="submit" className="w-full bg-blue-500 hover:bg-blue-400 text-black font-black py-4 rounded-xl transition-all flex items-center justify-center gap-2 text-lg">
                    <Send className="w-5 h-5" /> GUARDAR PREGUNTA
                  </button>

                </motion.form>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </MainLayout>
  )
}
