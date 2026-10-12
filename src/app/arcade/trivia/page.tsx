'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import { Brain, Trophy, CheckCircle2, XCircle, Database, ArrowLeft, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { ArcadeLayout } from '@/components/arcade/ArcadeLayout';

// Preguntas base de ejemplo.
const defaultQuestions = [
  {
    question: "¿Cuál es el propósito principal de esta web?",
    correct_answer: "Administrar el caos",
    wrong_answer_1: "Hacer tareas",
    wrong_answer_2: "Jugar al buscaminas",
    wrong_answer_3: "Vender NFTs",
  },
  {
    question: "¿Cuántos integrantes principales conforman el grupo?",
    correct_answer: "6",
    wrong_answer_1: "4",
    wrong_answer_2: "5",
    wrong_answer_3: "7",
  },
  {
    question: "¿Qué botón no debería ser pulsado nunca?",
    correct_answer: "El botón de Joel",
    wrong_answer_1: "El botón rojo",
    wrong_answer_2: "Alt + F4",
    wrong_answer_3: "Borrar System32",
  },
];

export default function TriviaPage() {
  const [started, setStarted] = useState(false);
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentQ, setCurrentQ] = useState(0);
  const [score, setScore] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [isAnswering, setIsAnswering] = useState(false);
  const [finished, setFinished] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    async function loadTrivia() {
      const { data } = await supabase.from('arcade_trivia').select('*');
      let loadedQuestions = defaultQuestions;
      if (data && data.length >= 3) {
        loadedQuestions = data;
      }

      const formatted = loadedQuestions.map((q) => {
        const options = [q.correct_answer, q.wrong_answer_1, q.wrong_answer_2, q.wrong_answer_3].sort(
          () => Math.random() - 0.5
        );
        return {
          text: q.question,
          options,
          correct: q.correct_answer,
        };
      });

      setQuestions(formatted.sort(() => Math.random() - 0.5));
      setLoading(false);
    }
    loadTrivia();
  }, []);

  const handleSelect = (option: string) => {
    if (isAnswering) return;
    setSelected(option);
    setIsAnswering(true);

    if (option === questions[currentQ].correct) {
      setScore((s) => s + 500);
    }

    setTimeout(() => {
      if (currentQ < questions.length - 1) {
        setCurrentQ((c) => c + 1);
        setSelected(null);
        setIsAnswering(false);
      } else {
        setFinished(true);
      }
    }, 1500);
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
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold uppercase bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Desafío Comunitario</span>
            </span>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center min-h-[50vh] bg-white/[0.03] rounded-[24px] border border-white/10">
            <Database className="w-12 h-12 text-blue-400 animate-pulse mb-3" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Cargando trivia...</h2>
          </div>
        ) : !started && !finished ? (
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white/[0.04] backdrop-blur-xl border border-white/10 p-8 sm:p-12 rounded-[24px] text-center shadow-2xl"
          >
            <div className="w-20 h-20 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-amber-500/10">
              <Brain className="w-10 h-10" />
            </div>
            <h1 className="text-3xl sm:text-5xl font-black text-white mb-3 uppercase tracking-tight">
              TRIVIA DEL GRUPO
            </h1>
            <p className="text-[#b7a3ad] max-w-lg mx-auto mb-8 text-xs sm:text-sm leading-relaxed">
              Demuestra cuánto conoces anécdotas, gustos y secretos de tus amigos. Responde rápido para sumar XP.
            </p>
            <button
              onClick={() => setStarted(true)}
              className="bg-gradient-to-r from-[#ff4d7a] to-[#e8365d] hover:brightness-110 text-white font-extrabold text-sm uppercase tracking-wider px-10 py-4 rounded-full transition-all hover:scale-105 shadow-[0_0_25px_rgba(255,77,122,0.5)] cursor-pointer"
            >
              Comenzar Reto
            </button>
            <div className="mt-8 pt-6 border-t border-white/5">
              <Link
                href="/arcade/aportar"
                className="text-xs text-[#ff4d7a] hover:text-[#ff8aa6] font-bold transition-colors"
              >
                ¿Quieres agregar tus preguntas? Aporta a la base de datos →
              </Link>
            </div>
          </motion.div>
        ) : finished ? (
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white/[0.04] backdrop-blur-xl border border-white/10 p-8 sm:p-12 rounded-[24px] text-center shadow-2xl relative overflow-hidden"
          >
            <Trophy className="w-24 h-24 text-yellow-400 mx-auto mb-4 drop-shadow-[0_0_25px_rgba(250,204,21,0.6)]" />
            <h2 className="text-3xl font-black text-white mb-1">¡Trivia Completada!</h2>
            <p className="text-xs text-[#b7a3ad] mb-6">Puntuación Final Obtenida</p>
            <div className="text-5xl sm:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-yellow-300 mb-8">
              {score} XP
            </div>

            <button
              onClick={() => {
                setQuestions([...questions].sort(() => Math.random() - 0.5));
                setCurrentQ(0);
                setScore(0);
                setSelected(null);
                setIsAnswering(false);
                setFinished(false);
              }}
              className="bg-white/10 hover:bg-white/20 text-white text-xs font-bold px-8 py-3 rounded-full transition-colors cursor-pointer border border-white/15"
            >
              Jugar de Nuevo
            </button>
          </motion.div>
        ) : (
          <div className="flex flex-col gap-6">
            <div className="flex justify-between items-center bg-white/[0.04] border border-white/10 px-6 py-3 rounded-2xl">
              <span className="font-bold text-xs text-[#38bdf8]">
                Pregunta {currentQ + 1} de {questions.length}
              </span>
              <span className="font-black text-xs text-yellow-400 flex items-center gap-1.5">
                <Trophy className="w-4 h-4" /> {score} XP
              </span>
            </div>

            <div className="bg-white/[0.04] backdrop-blur-xl border border-white/10 rounded-[24px] p-6 sm:p-10 shadow-2xl">
              <h2 className="text-xl sm:text-3xl font-black text-white leading-snug mb-8 text-center">
                {questions[currentQ].text}
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {questions[currentQ].options.map((opt: string, i: number) => {
                  const isSelected = selected === opt;
                  const isCorrect = opt === questions[currentQ].correct;

                  let btnClass = 'bg-white/[0.03] border-white/10 hover:border-[#ff4d7a]/50 hover:bg-white/[0.08] text-white';

                  if (isAnswering) {
                    if (isCorrect) btnClass = 'bg-emerald-500/20 border-emerald-500 text-emerald-300';
                    else if (isSelected && !isCorrect) btnClass = 'bg-red-500/20 border-red-500 text-red-300';
                    else btnClass = 'bg-white/[0.01] border-white/5 text-[#b7a3ad]/50 opacity-40';
                  }

                  return (
                    <button
                      key={i}
                      onClick={() => handleSelect(opt)}
                      disabled={isAnswering}
                      className={`p-4 sm:p-5 rounded-2xl border font-bold text-sm sm:text-base transition-all flex justify-between items-center text-left cursor-pointer ${btnClass}`}
                    >
                      <span>{opt}</span>
                      {isAnswering && isCorrect && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 ml-2" />}
                      {isAnswering && isSelected && !isCorrect && <XCircle className="w-5 h-5 text-red-400 shrink-0 ml-2" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </ArcadeLayout>
  );
}
