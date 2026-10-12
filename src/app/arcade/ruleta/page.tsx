'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import { Dices, Users, Plus, X, RotateCw, ArrowLeft, Sparkles } from 'lucide-react';
import { ArcadeLayout } from '@/components/arcade/ArcadeLayout';

export default function RoulettePage() {
  const [options, setOptions] = useState<string[]>(['Dereck', 'Ariel', 'Andre', 'Jefferson', 'Santiago', 'Joel']);
  const [newOption, setNewOption] = useState('');
  const [isSpinning, setIsSpinning] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);
  const [rotation, setRotation] = useState(0);
  const supabase = createClient();
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase.from('profiles').select('*').eq('id', user.id).single().then(({ data }) => setProfile(data));
      }
    });
  }, []);

  const addOption = (e: React.FormEvent) => {
    e.preventDefault();
    if (newOption.trim() && !options.includes(newOption.trim())) {
      setOptions([...options, newOption.trim()]);
      setNewOption('');
    }
  };

  const removeOption = (index: number) => {
    if (options.length <= 2) return alert('¡Necesitas al menos 2 opciones para la ruleta!');
    setOptions(options.filter((_, i) => i !== index));
  };

  const spin = async () => {
    if (isSpinning || options.length < 2) return;
    setIsSpinning(true);
    setWinner(null);

    const spins = 5;
    const prizeIndex = Math.floor(Math.random() * options.length);
    const degreesPerSlice = 360 / options.length;
    const prizeAngle = (prizeIndex * degreesPerSlice) + (degreesPerSlice / 2);
    const targetRotation = rotation + (360 * spins) + (360 - (prizeAngle % 360)) + (Math.random() * (degreesPerSlice * 0.6) - (degreesPerSlice * 0.3));

    setRotation(targetRotation);

    setTimeout(async () => {
      const selected = options[prizeIndex];
      setWinner(selected);
      setIsSpinning(false);

      if (profile) {
        await supabase.from('game_scores').insert([
          { user_id: profile.id, game_type: 'roulette', score: 10 },
        ]);
      }
    }, 5000);
  };

  return (
    <ArcadeLayout>
      <div className="flex flex-col gap-6 w-full">
        {/* Barra superior */}
        <div className="flex items-center justify-between bg-white/[0.04] backdrop-blur-xl border border-white/10 rounded-[20px] p-4 shadow-xl">
          <Link
            href="/arcade"
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-xs font-bold text-[#b7a3ad] hover:text-white border border-white/5 transition-all"
          >
            <ArrowLeft className="h-4 w-4" /> Volver al Arcade
          </Link>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold uppercase bg-purple-500/10 border border-purple-500/30 text-purple-400">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Decisor Grupal</span>
            </span>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-8 items-start">
          {/* Panel Izquierdo: Configuración */}
          <div className="w-full lg:w-1/3 flex flex-col gap-5 bg-white/[0.04] backdrop-blur-xl border border-white/10 rounded-[24px] p-6 shadow-2xl">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-[#ff4d7a] drop-shadow">
                RULETA DEL DESTINO
              </h1>
              <p className="text-xs text-[#b7a3ad] mt-1">
                Configura opciones y deja que el azar decida el próximo reto o turno.
              </p>
            </div>

            <div>
              <h3 className="text-white font-bold text-xs uppercase tracking-wider mb-3 flex items-center gap-2">
                <Users className="w-4 h-4 text-[#ff4d7a]" /> Opciones ({options.length})
              </h3>

              <form onSubmit={addOption} className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={newOption}
                  onChange={(e) => setNewOption(e.target.value)}
                  placeholder="Añadir opción..."
                  className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white outline-none focus:border-[#ff4d7a] transition-all"
                />
                <button
                  type="submit"
                  className="bg-gradient-to-r from-[#ff4d7a] to-[#e8365d] text-white p-2 rounded-xl transition-transform hover:scale-105 cursor-pointer shadow-md"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </form>

              <ul className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {options.map((opt, i) => (
                  <li
                    key={i}
                    className="flex justify-between items-center bg-white/[0.03] border border-white/5 px-3.5 py-2.5 rounded-xl text-xs text-white"
                  >
                    <span className="font-bold truncate max-w-[180px]">{opt}</span>
                    <button
                      onClick={() => removeOption(i)}
                      className="text-[#b7a3ad] hover:text-red-400 transition-colors p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Panel Derecho: Ruleta Visual */}
          <div className="w-full lg:w-2/3 flex flex-col items-center justify-center bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-[24px] p-6 sm:p-10 shadow-2xl">
            <div className="relative w-72 h-72 sm:w-96 sm:h-96 md:w-[440px] md:h-[440px] mb-8">
              {/* Puntero Superior */}
              <div
                className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 w-8 h-10 bg-white shadow-[0_0_15px_#ff4d7a]"
                style={{ clipPath: 'polygon(50% 100%, 0 0, 100% 0)' }}
              />

              {/* Círculo de la ruleta */}
              <div
                className="w-full h-full rounded-full border-8 border-white/10 shadow-[0_0_50px_rgba(255,77,122,0.3)] overflow-hidden relative"
                style={{
                  transform: `rotate(${rotation}deg)`,
                  transition: 'transform 5s cubic-bezier(0.2, 0.8, 0.1, 1)',
                }}
              >
                {options.map((opt, index) => {
                  const angle = 360 / options.length;
                  const skewY = 90 - angle;
                  const colors = ['#ec4899', '#f43f5e', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b'];
                  const bgColor = colors[index % colors.length];

                  return (
                    <div
                      key={index}
                      className="absolute top-0 right-0 w-1/2 h-1/2 origin-bottom-left border border-black/20"
                      style={{
                        backgroundColor: bgColor,
                        transform: `rotate(${index * angle}deg) skewY(-${skewY}deg)`,
                      }}
                    >
                      <div
                        className="absolute bottom-0 left-0 text-white font-black uppercase tracking-widest flex items-end justify-center pb-4 text-xs md:text-sm"
                        style={{
                          transform: `skewY(${skewY}deg) rotate(${angle / 2}deg) translateY(-80px)`,
                          transformOrigin: 'bottom left',
                          width: '200px',
                          textShadow: '0 2px 4px rgba(0,0,0,0.8)',
                        }}
                      >
                        <span className="truncate max-w-[120px] -rotate-90 origin-left inline-block pl-20">
                          {opt}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Centro de la ruleta */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 bg-[#14070f] rounded-full border-4 border-white/20 z-10 flex items-center justify-center shadow-2xl">
                <div className="w-5 h-5 bg-[#ff4d7a] rounded-full animate-pulse shadow-[0_0_10px_#ff4d7a]" />
              </div>
            </div>

            {winner ? (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-gradient-to-r from-[#ff4d7a] to-[#7c3aed] px-8 py-5 rounded-[20px] border border-white/30 text-center shadow-[0_0_40px_rgba(255,77,122,0.6)]"
              >
                <h2 className="text-white/80 uppercase tracking-widest text-xs font-bold mb-1">
                  El resultado es:
                </h2>
                <p className="text-3xl sm:text-4xl font-black text-white drop-shadow-md">{winner}</p>
                <button
                  onClick={spin}
                  className="mt-4 px-6 py-2 rounded-full bg-black/40 hover:bg-black/60 text-white text-xs font-bold transition-all border border-white/20"
                >
                  Girar otra vez
                </button>
              </motion.div>
            ) : (
              <button
                onClick={spin}
                disabled={isSpinning}
                className="bg-gradient-to-r from-[#ff4d7a] to-[#e8365d] hover:brightness-110 hover:scale-105 active:scale-95 transition-all text-white px-10 py-4 rounded-full font-black uppercase tracking-wider text-base shadow-[0_0_30px_rgba(255,77,122,0.5)] disabled:opacity-50 disabled:hover:scale-100 flex items-center gap-3 cursor-pointer"
              >
                {isSpinning ? <RotateCw className="w-5 h-5 animate-spin" /> : <Dices className="w-5 h-5" />}
                <span>{isSpinning ? 'GIRANDO...' : 'GIRAR LA RULETA'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </ArcadeLayout>
  );
}
