'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import { Send, Target, Trophy, Info, ArrowLeft, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { ArcadeLayout } from '@/components/arcade/ArcadeLayout';

export default function AportarPage() {
  const [activeTab, setActiveTab] = useState<'phrase' | 'trivia'>('phrase');
  const supabase = createClient();

  // Form states - Phrase
  const [phraseText, setPhraseText] = useState('');
  const [phraseAuthor, setPhraseAuthor] = useState('Dereck');

  // Form states - Trivia
  const [triviaQ, setTriviaQ] = useState('');
  const [triviaCorrect, setTriviaCorrect] = useState('');
  const [triviaW1, setTriviaW1] = useState('');
  const [triviaW2, setTriviaW2] = useState('');
  const [triviaW3, setTriviaW3] = useState('');

  const members = ["Ariel", "Joel", "Santiago", "Andre", "Dereck", "Jefferson"];

  const submitPhrase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phraseText.trim()) return;

    const { error } = await supabase.from('arcade_phrases').insert([
      {
        text: phraseText.trim(),
        author: phraseAuthor,
      },
    ]);

    if (error) {
      toast.error('Error: ' + error.message);
    } else {
      toast.success('¡Frase añadida al juego con éxito!');
      setPhraseText('');
    }
  };

  const submitTrivia = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!triviaQ.trim() || !triviaCorrect.trim() || !triviaW1.trim() || !triviaW2.trim() || !triviaW3.trim()) {
      toast.error('Rellena todas las opciones');
      return;
    }

    const { error } = await supabase.from('arcade_trivia').insert([
      {
        question: triviaQ.trim(),
        correct_answer: triviaCorrect.trim(),
        wrong_answer_1: triviaW1.trim(),
        wrong_answer_2: triviaW2.trim(),
        wrong_answer_3: triviaW3.trim(),
      },
    ]);

    if (error) {
      toast.error('Error: ' + error.message);
    } else {
      toast.success('¡Pregunta de trivia añadida con éxito!');
      setTriviaQ('');
      setTriviaCorrect('');
      setTriviaW1('');
      setTriviaW2('');
      setTriviaW3('');
    }
  };

  return (
    <ArcadeLayout>
      <div className="flex flex-col gap-6 w-full max-w-4xl mx-auto">
        {/* Barra superior */}
        <div className="flex items-center justify-between bg-white/[0.04] backdrop-blur-xl border border-white/10 rounded-[20px] p-4 shadow-xl">
          <Link
            href="/arcade"
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-xs font-bold text-[#b7a3ad] hover:text-white border border-white/5 transition-all"
          >
            <ArrowLeft className="h-4 w-4" /> Volver al Arcade
          </Link>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold uppercase bg-blue-500/10 border border-blue-500/30 text-blue-400">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Base Comunitaria</span>
            </span>
          </div>
        </div>

        {/* Título */}
        <div className="text-center py-2">
          <h1 className="text-3xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400 uppercase tracking-tight">
            APORTAR AL ARCADE
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-[#b7a3ad] max-w-xl mx-auto">
            Añade frases épicas o preguntas desafiantes para que aparezcan en los minijuegos de todos tus amigos.
          </p>
        </div>

        {/* Contenedor del formulario */}
        <div className="bg-white/[0.04] backdrop-blur-xl border border-white/10 rounded-[24px] overflow-hidden shadow-2xl">
          <div className="flex border-b border-white/10 bg-black/20">
            <button
              onClick={() => setActiveTab('phrase')}
              className={`flex-1 py-4 font-black text-xs sm:text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2.5 cursor-pointer ${
                activeTab === 'phrase'
                  ? 'bg-[#ff4d7a]/15 text-[#ff8aa6] border-b-2 border-[#ff4d7a]'
                  : 'text-[#b7a3ad] hover:text-white hover:bg-white/[0.03]'
              }`}
            >
              <Target className="w-4 h-4" /> Frases Célebres
            </button>
            <button
              onClick={() => setActiveTab('trivia')}
              className={`flex-1 py-4 font-black text-xs sm:text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2.5 cursor-pointer ${
                activeTab === 'trivia'
                  ? 'bg-blue-500/15 text-blue-400 border-b-2 border-blue-500'
                  : 'text-[#b7a3ad] hover:text-white hover:bg-white/[0.03]'
              }`}
            >
              <Trophy className="w-4 h-4" /> Trivia Preguntas
            </button>
          </div>

          <div className="p-6 sm:p-8">
            <AnimatePresence mode="wait">
              {activeTab === 'phrase' ? (
                <motion.form
                  key="phrase"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  onSubmit={submitPhrase}
                  className="space-y-6"
                >
                  <div className="bg-orange-500/10 border border-orange-500/20 p-4 rounded-2xl flex items-start gap-3 text-orange-200 text-xs sm:text-sm leading-relaxed">
                    <Info className="w-5 h-5 shrink-0 text-orange-400 mt-0.5" />
                    <p>
                      Agrega una frase graciosa o fuera de contexto que alguien haya dicho. Aparecerá en el minijuego{' '}
                      <strong>&ldquo;¿Quién dijo eso?&rdquo;</strong>.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#b7a3ad] uppercase tracking-wider mb-2">
                      La Frase
                    </label>
                    <textarea
                      value={phraseText}
                      onChange={(e) => setPhraseText(e.target.value)}
                      placeholder="&ldquo;Literalmente estaba a un toque de vida...&rdquo;"
                      className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-white placeholder-zinc-600 focus:outline-none focus:border-[#ff4d7a] resize-none h-32 text-sm sm:text-base leading-relaxed"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#b7a3ad] uppercase tracking-wider mb-2">
                      ¿Quién lo dijo?
                    </label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
                      {members.map((m) => (
                        <div
                          key={m}
                          onClick={() => setPhraseAuthor(m)}
                          className={`p-3.5 rounded-xl border cursor-pointer font-bold text-center transition-all text-xs sm:text-sm ${
                            phraseAuthor === m
                              ? 'bg-[#ff4d7a]/20 border-[#ff4d7a] text-white shadow-md'
                              : 'bg-black/30 border-white/10 text-[#b7a3ad] hover:border-white/30'
                          }`}
                        >
                          {m}
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={!phraseText.trim()}
                    className="w-full bg-gradient-to-r from-[#ff4d7a] to-[#e8365d] hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black py-4 rounded-2xl transition-all flex items-center justify-center gap-2 text-sm uppercase tracking-wider cursor-pointer shadow-lg shadow-[#ff4d7a]/20"
                  >
                    <Send className="w-4 h-4" /> GUARDAR FRASE
                  </button>
                </motion.form>
              ) : (
                <motion.form
                  key="trivia"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  onSubmit={submitTrivia}
                  className="space-y-6"
                >
                  <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-2xl flex items-start gap-3 text-blue-200 text-xs sm:text-sm leading-relaxed">
                    <Info className="w-5 h-5 shrink-0 text-blue-400 mt-0.5" />
                    <p>
                      Crea una pregunta sobre el grupo. Aparecerá en el minijuego{' '}
                      <strong>&ldquo;Trivia del Grupo&rdquo;</strong>. Pon la respuesta correcta en el primer campo; el
                      juego mezclará las opciones automáticamente al jugar.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#b7a3ad] uppercase tracking-wider mb-2">
                      Pregunta
                    </label>
                    <input
                      type="text"
                      value={triviaQ}
                      onChange={(e) => setTriviaQ(e.target.value)}
                      placeholder="¿Quién fue el primero en conseguir diamantes en Minecraft?"
                      className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-white focus:outline-none focus:border-blue-500 text-sm sm:text-base"
                    />
                  </div>

                  <div className="space-y-3 pt-3 border-t border-white/10">
                    <div>
                      <label className="block text-xs font-black text-emerald-400 uppercase tracking-wider mb-1.5">
                        Respuesta Correcta
                      </label>
                      <input
                        type="text"
                        value={triviaCorrect}
                        onChange={(e) => setTriviaCorrect(e.target.value)}
                        placeholder="La respuesta real"
                        className="w-full bg-emerald-950/20 border border-emerald-500/30 rounded-xl p-3 text-xs sm:text-sm text-emerald-100 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-red-400 uppercase tracking-wider mb-1.5">
                        Respuesta Falsa 1
                      </label>
                      <input
                        type="text"
                        value={triviaW1}
                        onChange={(e) => setTriviaW1(e.target.value)}
                        placeholder="Opción incorrecta"
                        className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs sm:text-sm text-white focus:outline-none focus:border-red-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-red-400 uppercase tracking-wider mb-1.5">
                        Respuesta Falsa 2
                      </label>
                      <input
                        type="text"
                        value={triviaW2}
                        onChange={(e) => setTriviaW2(e.target.value)}
                        placeholder="Opción incorrecta"
                        className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs sm:text-sm text-white focus:outline-none focus:border-red-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-red-400 uppercase tracking-wider mb-1.5">
                        Respuesta Falsa 3
                      </label>
                      <input
                        type="text"
                        value={triviaW3}
                        onChange={(e) => setTriviaW3(e.target.value)}
                        placeholder="Opción incorrecta"
                        className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs sm:text-sm text-white focus:outline-none focus:border-red-500"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:brightness-110 text-white font-black py-4 rounded-2xl transition-all flex items-center justify-center gap-2 text-sm uppercase tracking-wider cursor-pointer shadow-lg shadow-blue-500/20"
                  >
                    <Send className="w-4 h-4" /> GUARDAR PREGUNTA
                  </button>
                </motion.form>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </ArcadeLayout>
  );
}
