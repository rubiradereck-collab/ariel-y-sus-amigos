'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Battery, BatteryWarning, Trophy, RefreshCw, Skull, Play, ArrowLeft, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { ArcadeLayout } from '@/components/arcade/ArcadeLayout';

export default function FNAFMinigame() {
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(12);
  const [power, setPower] = useState(100);
  const [leftDoorClosed, setLeftDoorClosed] = useState(false);
  const [rightDoorClosed, setRightDoorClosed] = useState(false);
  const [animatronicPos, setAnimatronicPos] = useState<'far' | 'approaching' | 'left_door' | 'right_door' | 'jumpscare'>('far');

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const powerRef = useRef<NodeJS.Timeout | null>(null);
  const animatronicRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!playing) return;

    timerRef.current = setInterval(() => {
      setTime((t) => {
        if (t === 5) {
          endGame(true);
          return 6;
        }
        return t === 12 ? 1 : t + 1;
      });
    }, 10000);

    powerRef.current = setInterval(() => {
      setPower((p) => {
        let drain = 1;
        if (leftDoorClosed) drain += 2;
        if (rightDoorClosed) drain += 2;

        const newPower = p - drain;
        if (newPower <= 0) {
          triggerJumpscare();
          return 0;
        }
        return newPower;
      });
    }, 1000);

    animatronicRef.current = setInterval(() => {
      setAnimatronicPos((pos) => {
        const rand = Math.random();

        if (pos === 'far') {
          return rand > 0.6 ? 'approaching' : 'far';
        } else if (pos === 'approaching') {
          if (rand > 0.7) return 'left_door';
          if (rand > 0.4) return 'right_door';
          return 'approaching';
        } else if (pos === 'left_door') {
          if (leftDoorClosed) return 'far';
          triggerJumpscare();
          return 'jumpscare';
        } else if (pos === 'right_door') {
          if (rightDoorClosed) return 'far';
          triggerJumpscare();
          return 'jumpscare';
        }
        return pos;
      });
    }, 3000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (powerRef.current) clearInterval(powerRef.current);
      if (animatronicRef.current) clearInterval(animatronicRef.current);
    };
  }, [playing, leftDoorClosed, rightDoorClosed]);

  const triggerJumpscare = () => {
    setPlaying(false);
    setAnimatronicPos('jumpscare');
    if (timerRef.current) clearInterval(timerRef.current);
    if (powerRef.current) clearInterval(powerRef.current);
    if (animatronicRef.current) clearInterval(animatronicRef.current);

    const audio = new Audio('https://www.myinstants.com/media/sounds/scream_1.mp3');
    audio.volume = 1;
    audio.play().catch(() => {});

    toast.error('¡GAME OVER! Sobreviviste hasta las ' + time + ' AM');
  };

  const endGame = (win: boolean) => {
    setPlaying(false);
    if (timerRef.current) clearInterval(timerRef.current);
    if (powerRef.current) clearInterval(powerRef.current);
    if (animatronicRef.current) clearInterval(animatronicRef.current);

    if (win) {
      toast.success('¡6 AM! Sobreviviste la noche. (+1000 XP)');
      const audio = new Audio('https://www.myinstants.com/media/sounds/fnaf-6-am.mp3');
      audio.volume = 1;
      audio.play().catch(() => {});
    }
  };

  const startGame = () => {
    setPlaying(true);
    setTime(12);
    setPower(100);
    setLeftDoorClosed(false);
    setRightDoorClosed(false);
    setAnimatronicPos('far');
  };

  return (
    <ArcadeLayout>
      <div className="flex flex-col gap-6 w-full max-w-4xl mx-auto">
        {/* Barra superior */}
        <div className="flex items-center justify-between bg-zinc-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-xl">
          <Link
            href="/arcade"
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-xs font-bold text-zinc-300 hover:text-white border border-white/10 transition-all"
          >
            <ArrowLeft className="h-4 w-4" /> Volver al Arcade
          </Link>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold uppercase bg-rose-500/10 border border-rose-500/30 text-rose-400">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Supervivencia Nocturna</span>
            </span>
          </div>
        </div>

        {/* Título */}
        <div className="text-center py-2">
          <h1 className="text-3xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-rose-400 to-amber-400 uppercase tracking-wider drop-shadow-[0_0_20px_rgba(239,68,68,0.5)]">
            FIVE NIGHTS AT ARCADE
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-zinc-400">
            Cierra las puertas cuando los sensores marquen peligro. Administra tu energía hasta las 6 AM.
          </p>
        </div>

        {/* Game Container */}
        <div className="relative w-full aspect-video bg-[#0d030c] rounded-[24px] border-2 border-white/10 overflow-hidden shadow-2xl">
          {/* Background Office Image */}
          <div
            className={`absolute inset-0 bg-cover bg-center transition-opacity duration-300 ${
              power <= 0 ? 'opacity-10' : 'opacity-100'
            }`}
            style={{ backgroundImage: 'url("/images/fnaf-office.png")' }}
          />

          {/* Static overlay */}
          <div
            className="absolute inset-0 opacity-10 pointer-events-none mix-blend-screen"
            style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/tv-noise.png")' }}
          />

          {/* JUMPSCARE */}
          <AnimatePresence>
            {animatronicPos === 'jumpscare' && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: [1, 1.5, 1.2, 1.8], opacity: [0, 1, 1, 1], x: [0, -50, 50, 0] }}
                transition={{ duration: 0.5 }}
                className="absolute inset-0 z-50 flex items-center justify-center bg-black/85"
              >
                <Skull className="w-56 h-56 text-red-600 animate-pulse drop-shadow-[0_0_50px_rgba(220,38,38,1)]" />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Game UI */}
          {playing && power > 0 && (
            <div className="absolute inset-0 z-10 pointer-events-none">
              {/* Top HUD */}
              <div className="absolute top-4 left-6 text-white font-black text-3xl font-mono flex flex-col items-start drop-shadow-[0_2px_2px_rgba(0,0,0,1)]">
                <span className="text-4xl">{time} AM</span>
                <span className="text-xs uppercase tracking-wider text-rose-300 mt-1">Noche 1</span>
              </div>

              <div className="absolute top-4 right-6 flex flex-col items-end gap-1 drop-shadow-[0_2px_2px_rgba(0,0,0,1)]">
                <div className="text-white font-black text-2xl font-mono flex items-center gap-2">
                  Batería: {power}%{' '}
                  {power < 20 ? (
                    <BatteryWarning className="w-6 h-6 text-red-500 animate-pulse" />
                  ) : (
                    <Battery className="w-6 h-6 text-emerald-400" />
                  )}
                </div>
                <div className="text-rose-400 font-bold font-mono text-xs">
                  Consumo: {1 + (leftDoorClosed ? 2 : 0) + (rightDoorClosed ? 2 : 0)} barras
                </div>
              </div>

              {/* Animatronic Indicators */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-black/80 border border-white/20 px-6 py-2.5 rounded-full backdrop-blur-md pointer-events-auto">
                <span className="text-[10px] font-extrabold text-[#b7a3ad] uppercase tracking-wider">Sensores:</span>
                <div className="flex gap-2.5">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      animatronicPos === 'left_door'
                        ? 'bg-red-500 animate-ping shadow-[0_0_10px_rgba(220,38,38,1)]'
                        : 'bg-zinc-700'
                    }`}
                  />
                  <div
                    className={`w-3 h-3 rounded-full ${
                      animatronicPos === 'approaching'
                        ? 'bg-yellow-400 animate-pulse shadow-[0_0_10px_rgba(234,179,8,1)]'
                        : 'bg-zinc-700'
                    }`}
                  />
                  <div
                    className={`w-3 h-3 rounded-full ${
                      animatronicPos === 'right_door'
                        ? 'bg-red-500 animate-ping shadow-[0_0_10px_rgba(220,38,38,1)]'
                        : 'bg-zinc-700'
                    }`}
                  />
                </div>
              </div>

              {/* Doors Controls */}
              <div className="absolute inset-y-0 left-0 w-32 flex items-center pointer-events-auto">
                <button
                  onClick={() => setLeftDoorClosed(!leftDoorClosed)}
                  className={`ml-4 px-4 py-8 rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-xl cursor-pointer ${
                    leftDoorClosed
                      ? 'bg-red-600 text-white border-2 border-red-400'
                      : 'bg-green-600 text-white border-2 border-green-400 opacity-60 hover:opacity-100'
                  }`}
                >
                  {leftDoorClosed ? 'ABRIR' : 'CERRAR'}
                </button>
              </div>

              <div className="absolute inset-y-0 right-0 w-32 flex items-center justify-end pointer-events-auto">
                <button
                  onClick={() => setRightDoorClosed(!rightDoorClosed)}
                  className={`mr-4 px-4 py-8 rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-xl cursor-pointer ${
                    rightDoorClosed
                      ? 'bg-red-600 text-white border-2 border-red-400'
                      : 'bg-green-600 text-white border-2 border-green-400 opacity-60 hover:opacity-100'
                  }`}
                >
                  {rightDoorClosed ? 'ABRIR' : 'CERRAR'}
                </button>
              </div>
            </div>
          )}

          {/* Menus */}
          <AnimatePresence>
            {!playing && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-40 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center"
              >
                {animatronicPos === 'jumpscare' ? (
                  <div>
                    <h2 className="text-4xl sm:text-6xl font-black text-red-600 mb-2 drop-shadow-[0_0_30px_rgba(220,38,38,0.8)] uppercase">
                      HAS MUERTO
                    </h2>
                    <p className="text-[#b7a3ad] text-sm mb-6">Sobreviviste hasta las {time} AM</p>
                    <button
                      onClick={startGame}
                      className="bg-gradient-to-r from-red-600 to-rose-700 hover:brightness-110 text-white font-extrabold text-xs uppercase tracking-wider px-8 py-3.5 rounded-full inline-flex items-center gap-2 shadow-lg transition-transform hover:scale-105 cursor-pointer"
                    >
                      <RefreshCw className="w-4 h-4" /> Intentar de nuevo
                    </button>
                  </div>
                ) : time === 6 ? (
                  <div>
                    <h2 className="text-4xl sm:text-6xl font-black text-emerald-400 mb-2 drop-shadow-[0_0_30px_rgba(16,185,129,0.8)]">
                      6:00 AM
                    </h2>
                    <p className="text-zinc-200 text-sm mb-6 font-bold">+1000 XP Añadidos a tus estadísticas</p>
                    <button
                      onClick={startGame}
                      className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-110 text-white font-extrabold text-xs uppercase tracking-wider px-8 py-3.5 rounded-full inline-flex items-center gap-2 shadow-lg transition-transform hover:scale-105 cursor-pointer"
                    >
                      <Trophy className="w-4 h-4" /> Jugar otra vez
                    </button>
                  </div>
                ) : (
                  <div className="max-w-md">
                    <h2 className="text-xl sm:text-2xl font-black text-white mb-4 uppercase tracking-wider border-b border-white/10 pb-3">
                      Instrucciones de Guardia
                    </h2>
                    <ul className="text-[#b7a3ad] text-left space-y-3 mb-6 text-xs sm:text-sm leading-relaxed">
                      <li>
                        🔋 <strong className="text-red-400">Energía:</strong> Empiezas con 100%. Las puertas gastan batería continuamente.
                      </li>
                      <li>
                        🚪 <strong className="text-cyan-400">Puertas:</strong> Ciérralas SOLO cuando los sensores laterales se activen en rojo.
                      </li>
                      <li>
                        🕒 <strong className="text-emerald-400">Objetivo:</strong> Resiste hasta las 6:00 AM (60 segundos de reloj).
                      </li>
                    </ul>
                    <button
                      onClick={startGame}
                      className="w-full bg-white hover:bg-zinc-200 text-black font-black px-8 py-3.5 rounded-full flex items-center justify-center gap-2 uppercase tracking-wider text-xs sm:text-sm shadow-xl transition-all cursor-pointer"
                    >
                      <Play className="w-4 h-4 fill-black" /> INICIAR TURNO
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </ArcadeLayout>
  );
}
