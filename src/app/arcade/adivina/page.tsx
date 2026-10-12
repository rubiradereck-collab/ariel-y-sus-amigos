'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HelpCircle, Trophy, RefreshCw, CheckCircle2, XCircle, Database, ArrowLeft, Sparkles } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { ArcadeLayout } from '@/components/arcade/ArcadeLayout';

const defaultPhrases = [
  { text: "¿Alguien quiere jugar o sigo durmiendo?", author: "Ariel" },
  { text: "No es por presumir, pero ayer gané una partida casi sin ver.", author: "Joel" },
  { text: "¡¿Cómo que hay tarea para mañana?!", author: "Santiago" },
  { text: "Gente, me robaron en el juego otra vez...", author: "Andre" },
  { text: "Yo solo entro para reírme un rato.", author: "Dereck" },
  { text: "El lag me está matando, juro que le di en la cabeza.", author: "Jefferson" },
];

const members = ["Ariel", "Joel", "Santiago", "Andre", "Dereck", "Jefferson"];

export default function AdivinaPage() {
  const [phrases, setPhrases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPhrase, setCurrentPhrase] = useState(0);
  const [score, setScore] = useState(0);
  const [status, setStatus] = useState<'playing' | 'correct' | 'wrong' | 'finished'>('playing');
  const [selected, setSelected] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    async function loadPhrases() {
      const { data } = await supabase.from('arcade_phrases').select('*');
      if (data && data.length >= 3) {
        setPhrases(data.sort(() => Math.random() - 0.5));
      } else {
        setPhrases(defaultPhrases.sort(() => Math.random() - 0.5));
      }
      setLoading(false);
    }
    loadPhrases();
  }, []);

  const handleGuess = (author: string) => {
    if (status !== 'playing') return;
    setSelected(author);
    if (author === phrases[currentPhrase].author) {
      setScore((s) => s + 100);
      setStatus('correct');
    } else {
      setStatus('wrong');
    }

    setTimeout(() => {
      if (currentPhrase < phrases.length - 1) {
        setCurrentPhrase((c) => c + 1);
        setStatus('playing');
        setSelected(null);
      } else {
        setStatus('finished');
      }
    }, 1500);
  };

  const restart = () => {
    setPhrases([...phrases].sort(() => Math.random() - 0.5));
    setCurrentPhrase(0);
    setScore(0);
    setStatus('playing');
    setSelected(null);
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
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold uppercase bg-orange-500/10 border border-orange-500/30 text-orange-400">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Frases Célebres</span>
            </span>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center min-h-[50vh] bg-white/[0.03] rounded-[24px] border border-white/10">
            <Database className="w-12 h-12 text-orange-400 animate-pulse mb-3" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Cargando frases...</h2>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <div className="text-center">
              <h1 className="text-3xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-pink-400 to-[#ff4d7a] uppercase tracking-tight flex items-center justify-center gap-3">
                <HelpCircle className="w-8 h-8 sm:w-10 sm:h-10 text-orange-400" />
                <span>¿Quién dijo eso?</span>
              </h1>
              <p className="text-xs sm:text-sm text-[#b7a3ad] mt-1">
                Adivina quién del grupo inmortalizó esta frase fuera de contexto.
              </p>
              <div className="mt-2">
                <Link
                  href="/arcade/aportar"
                  className="text-xs font-bold text-[#ff4d7a] hover:text-[#ff8aa6] transition-colors"
                >
                  ¿Tienes frases nuevas? Añádelas aquí →
                </Link>
              </div>
            </div>

            <div className="bg-white/[0.04] backdrop-blur-xl border border-white/10 rounded-[24px] p-6 sm:p-10 shadow-2xl">
              <div className="flex justify-between items-center mb-6 border-b border-white/5 pb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-[#b7a3ad]">
                  Frase {currentPhrase + 1} de {phrases.length}
                </span>
                <span className="flex items-center gap-1.5 text-xs font-black text-yellow-400 bg-yellow-500/10 px-3 py-1.5 rounded-xl border border-yellow-500/20">
                  <Trophy className="w-4 h-4" /> {score} XP
                </span>
              </div>

              <AnimatePresence mode="wait">
                {status !== 'finished' ? (
                  <motion.div
                    key={currentPhrase}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    className="text-center"
                  >
                    <div className="bg-black/40 border border-white/10 rounded-2xl p-6 sm:p-10 mb-8 relative overflow-hidden shadow-inner">
                      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-400 to-[#ff4d7a]" />
                      <p className="text-xl sm:text-3xl font-black text-white italic leading-snug">
                        &ldquo;{phrases[currentPhrase].text}&rdquo;
                      </p>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {members.map((member) => {
                        const isSelected = selected === member;
                        const isCorrect = member === phrases[currentPhrase].author;

                        let btnClass = 'bg-white/[0.03] border-white/10 hover:border-[#ff4d7a]/50 hover:bg-white/[0.08] text-white';

                        if (status !== 'playing') {
                          if (isCorrect) btnClass = 'bg-emerald-500/20 border-emerald-500 text-emerald-300';
                          else if (isSelected && !isCorrect) btnClass = 'bg-red-500/20 border-red-500 text-red-300';
                          else btnClass = 'bg-white/[0.01] border-white/5 text-[#b7a3ad]/40 opacity-40';
                        }

                        return (
                          <button
                            key={member}
                            onClick={() => handleGuess(member)}
                            disabled={status !== 'playing'}
                            className={`p-4 sm:p-5 rounded-2xl border font-black text-base sm:text-lg uppercase tracking-wider transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer ${btnClass}`}
                          >
                            <div className="flex items-center gap-2">
                              {status !== 'playing' && isCorrect && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
                              {status !== 'playing' && isSelected && !isCorrect && <XCircle className="w-5 h-5 text-red-400" />}
                              <span>{member}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="finished"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-center py-8"
                  >
                    <Trophy className="w-20 h-20 text-yellow-400 mx-auto mb-4 drop-shadow-[0_0_20px_rgba(250,204,21,0.5)]" />
                    <h2 className="text-3xl font-black text-white mb-1">¡Juego Terminado!</h2>
                    <p className="text-xs text-[#b7a3ad] mb-6">
                      Has acumulado <strong className="text-yellow-400">{score} XP</strong> en total.
                    </p>

                    <button
                      onClick={restart}
                      className="bg-gradient-to-r from-[#ff4d7a] to-[#e8365d] hover:brightness-110 text-white font-extrabold text-xs uppercase px-8 py-3.5 rounded-full inline-flex items-center gap-2 shadow-[0_0_20px_rgba(255,77,122,0.4)] transition-all cursor-pointer"
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>JUGAR DE NUEVO</span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>
    </ArcadeLayout>
  );
}
