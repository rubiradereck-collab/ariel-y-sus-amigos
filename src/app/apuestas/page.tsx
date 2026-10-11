'use client'

import { MainLayout } from "@/components/layout/MainLayout"
import { createClient } from "@/lib/supabase/client"
import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Coins, Sparkles, Flame, Bomb, Gem, Play, RefreshCw, Trophy, 
  ArrowUpRight, AlertTriangle, Dice5, Zap, ShieldAlert, Award
} from "lucide-react"
import { toast } from "sonner"

export default function ApuestasPage() {
  const supabase = createClient()
  const [profile, setProfile] = useState<any>(null)
  const [coins, setCoins] = useState<number>(2000)
  const [activeGame, setActiveGame] = useState<'minas' | 'bonanza' | 'coinflip'>('minas')

  // Estado del juego BUSCAMINAS (Mines)
  const [minesBet, setMinesBet] = useState<number>(100)
  const [mineCount, setMineCount] = useState<number>(3)
  const [minesGameActive, setMinesGameActive] = useState<boolean>(false)
  const [minefield, setMinefield] = useState<{ isMine: boolean, revealed: boolean }[]>([])
  const [revealedCount, setRevealedCount] = useState<number>(0)
  const [currentMultiplier, setCurrentMultiplier] = useState<number>(1.0)
  const [gameOver, setGameOver] = useState<boolean>(false)

  // Estado del juego SWEET BONANZA (Slots)
  const [slotBet, setSlotBet] = useState<number>(50)
  const [slotReels, setSlotReels] = useState<string[]>(['💎', '🍒', '🍇'])
  const [isSpinning, setIsSpinning] = useState<boolean>(false)

  // Estado CARA O CRUZ (Coinflip)
  const [coinBet, setCoinBet] = useState<number>(100)
  const [selectedSide, setSelectedSide] = useState<'cara' | 'cruz'>('cara')
  const [isFlipping, setIsFlipping] = useState<boolean>(false)
  const [coinResult, setCoinResult] = useState<'cara' | 'cruz' | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase.from('profiles').select('*').eq('id', user.id).single().then(({ data }) => {
          if (data) setProfile(data)
        })
      }
    })
  }, [])

  const playSynth = (freq = 440, type: OscillatorType = 'sine', duration = 0.1) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      if (!AudioCtx) return
      const ctx = new AudioCtx()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = type
      osc.frequency.setValueAtTime(freq, ctx.currentTime)
      gain.gain.setValueAtTime(0.12, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + duration)
    } catch (e) {}
  }

  // --- LÓGICA BUSCAMINAS (MINES) ---
  const startMinesGame = () => {
    if (coins < minesBet) {
      toast.error('Saldo insuficiente para apostar.')
      return
    }

    setCoins(c => c - minesBet)
    playSynth(300, 'triangle', 0.1)

    // Crear 25 casillas
    const totalTiles = 25
    const minesIndices = new Set<number>()
    while (minesIndices.size < mineCount) {
      minesIndices.add(Math.floor(Math.random() * totalTiles))
    }

    const field = Array.from({ length: totalTiles }, (_, i) => ({
      isMine: minesIndices.has(i),
      revealed: false
    }))

    setMinefield(field)
    setRevealedCount(0)
    setCurrentMultiplier(1.0)
    setGameOver(false)
    setMinesGameActive(true)
    toast.success(`Partida iniciada. ¡Apuesta: ${minesBet} monedas!`)
  }

  const handleTileClick = (index: number) => {
    if (!minesGameActive || gameOver || minefield[index].revealed) return

    const tile = minefield[index]
    const updated = [...minefield]
    updated[index].revealed = true
    setMinefield(updated)

    if (tile.isMine) {
      // ¡BOMBA!
      setGameOver(true)
      setMinesGameActive(false)
      playSynth(130, 'sawtooth', 0.5)
      toast.error(`💥 ¡BOOM! Pisaste una mina. Has perdido ${minesBet} monedas.`)
      // Revelar todas las minas
      setMinefield(prev => prev.map(t => ({ ...t, revealed: true })))
    } else {
      // GEMA ENCONTRADA
      playSynth(600 + revealedCount * 80, 'sine', 0.15)
      const newRevealed = revealedCount + 1
      setRevealedCount(newRevealed)

      // Cálculo de multiplicador progresivo
      const baseMult = 1 + (newRevealed * 0.28 * (mineCount / 2))
      const rounded = Math.round(baseMult * 100) / 100
      setCurrentMultiplier(rounded)
    }
  }

  const cashOutMines = () => {
    if (!minesGameActive || gameOver || revealedCount === 0) return

    const winAmount = Math.floor(minesBet * currentMultiplier)
    setCoins(c => c + winAmount)
    setMinesGameActive(false)
    setGameOver(true)
    playSynth(880, 'triangle', 0.4)
    toast.success(`🎉 ¡RETIRADA EXITOSA! Ganaste ${winAmount} monedas (${currentMultiplier}x)`)
    // Revelar todo
    setMinefield(prev => prev.map(t => ({ ...t, revealed: true })))
  }

  // --- LÓGICA SWEET BONANZA (SLOTS) ---
  const spinSlots = () => {
    if (coins < slotBet) {
      toast.error('Saldo insuficiente.')
      return
    }

    setCoins(c => c - slotBet)
    setIsSpinning(true)
    playSynth(520, 'square', 0.1)

    const symbols = ['💎', '🍒', '🍇', '🪙', '⭐', '💣']
    let ticks = 0
    const interval = setInterval(() => {
      setSlotReels([
        symbols[Math.floor(Math.random() * symbols.length)],
        symbols[Math.floor(Math.random() * symbols.length)],
        symbols[Math.floor(Math.random() * symbols.length)]
      ])
      ticks++
      if (ticks > 12) {
        clearInterval(interval)
        setIsSpinning(false)

        // Resultado final con probabilidad
        const rand = Math.random()
        let finalReels: string[]
        let won = 0

        if (rand > 0.85) {
          // Triple Diamante (x20)
          finalReels = ['💎', '💎', '💎']
          won = slotBet * 20
        } else if (rand > 0.6) {
          // Triple Estrella o Moneda (x5)
          finalReels = ['⭐', '⭐', '⭐']
          won = slotBet * 5
        } else if (rand > 0.35) {
          // Doble match (x2)
          finalReels = ['🍇', '🍇', '🍒']
          won = slotBet * 2
        } else {
          finalReels = ['🍒', '💣', '🪙']
          won = 0
        }

        setSlotReels(finalReels)

        if (won > 0) {
          setCoins(c => c + won)
          playSynth(950, 'triangle', 0.4)
          toast.success(`💰 ¡PREMIO! Has ganado ${won} monedas!`)
        } else {
          toast.info('Sigue intentando... La Bonanza está cerca.')
        }
      }
    }, 100)
  }

  // --- LÓGICA CARA O CRUZ ---
  const flipCoin = () => {
    if (coins < coinBet) {
      toast.error('Saldo insuficiente.')
      return
    }

    setCoins(c => c - coinBet)
    setIsFlipping(true)
    playSynth(440, 'triangle', 0.15)

    setTimeout(() => {
      const outcome: 'cara' | 'cruz' = Math.random() > 0.5 ? 'cara' : 'cruz'
      setCoinResult(outcome)
      setIsFlipping(false)

      if (outcome === selectedSide) {
        const prize = Math.floor(coinBet * 1.95)
        setCoins(c => c + prize)
        playSynth(880, 'sine', 0.3)
        toast.success(`🪙 ¡SALIÓ ${outcome.toUpperCase()}! Ganaste ${prize} monedas`)
      } else {
        toast.error(`Salió ${outcome.toUpperCase()}. Perdiste ${coinBet} monedas.`)
      }
    }, 1200)
  }

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-6">

        {/* HERO BANNER ESTILO CASINO PS5 */}
        <div className="relative rounded-3xl overflow-hidden border border-fuchsia-500/30 shadow-2xl mb-8 bg-zinc-950">
          <div 
            className="absolute inset-0 bg-cover bg-center opacity-40 filter saturate-150"
            style={{ backgroundImage: 'url("/images/game-casino.jpg")' }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/85 to-transparent" />
          
          <div className="relative z-10 p-8 md:p-12 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="px-3 py-1 rounded-full text-xs font-black tracking-widest uppercase bg-fuchsia-500/20 text-fuchsia-400 border border-fuchsia-500/40 animate-pulse">
                  CASINO CLANDESTINO PS5
                </span>
                <span className="text-white/60 text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5 text-pink-400" /> Multiplicadores hasta 100x
                </span>
              </div>
              <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight uppercase">
                Casino Royal: <span className="text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 via-pink-500 to-amber-300">Neon Heist</span>
              </h1>
              <p className="text-zinc-300 text-sm md:text-base max-w-xl mt-2 font-medium">
                Arriesga tu fortuna con los panas. Desafía el Buscaminas, haz rodar la Sweet Bonanza y duplica tu saldo en juegos de azar en tiempo real.
              </p>
            </div>

            {/* BALANCE DISPLAY */}
            <div className="bg-black/80 backdrop-blur-xl border border-fuchsia-500/30 rounded-2xl p-5 flex items-center gap-6 shadow-2xl flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-fuchsia-500/20 border border-fuchsia-500/40 flex items-center justify-center">
                  <Coins className="w-6 h-6 text-fuchsia-400" />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">Fichas / Monedas</span>
                  <span className="text-2xl font-black text-amber-300 font-mono">{coins.toLocaleString()}</span>
                </div>
              </div>

              <div className="h-10 w-[1px] bg-white/10" />

              <button
                onClick={() => {
                  setCoins(c => c + 500)
                  toast.success('¡Recibiste un bono diario de cortesía de +500 monedas!')
                }}
                className="px-4 py-2 bg-gradient-to-r from-fuchsia-600 to-pink-600 hover:from-fuchsia-500 hover:to-pink-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md cursor-pointer"
              >
                + Recargar
              </button>
            </div>
          </div>
        </div>

        {/* SELECTOR DE MINIJUEGOS */}
        <div className="flex gap-2 overflow-x-auto pb-4 mb-6 border-b border-white/10 hide-scrollbar">
          <button
            onClick={() => setActiveGame('minas')}
            className={`px-6 py-3 rounded-xl font-black text-xs uppercase tracking-wider flex items-center gap-2.5 transition-all cursor-pointer whitespace-nowrap ${
              activeGame === 'minas'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-black shadow-[0_0_25px_rgba(16,185,129,0.4)] scale-105'
                : 'bg-zinc-900/80 text-zinc-300 hover:bg-zinc-800 border border-white/5'
            }`}
          >
            <Bomb className="w-4 h-4" /> Buscaminas (Mines)
          </button>

          <button
            onClick={() => setActiveGame('bonanza')}
            className={`px-6 py-3 rounded-xl font-black text-xs uppercase tracking-wider flex items-center gap-2.5 transition-all cursor-pointer whitespace-nowrap ${
              activeGame === 'bonanza'
                ? 'bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white shadow-[0_0_25px_rgba(236,72,153,0.4)] scale-105'
                : 'bg-zinc-900/80 text-zinc-300 hover:bg-zinc-800 border border-white/5'
            }`}
          >
            <Gem className="w-4 h-4" /> Sweet Bonanza (Slots)
          </button>

          <button
            onClick={() => setActiveGame('coinflip')}
            className={`px-6 py-3 rounded-xl font-black text-xs uppercase tracking-wider flex items-center gap-2.5 transition-all cursor-pointer whitespace-nowrap ${
              activeGame === 'coinflip'
                ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-black shadow-[0_0_25px_rgba(245,158,11,0.4)] scale-105'
                : 'bg-zinc-900/80 text-zinc-300 hover:bg-zinc-800 border border-white/5'
            }`}
          >
            <Coins className="w-4 h-4" /> Cara o Cruz (Coinflip)
          </button>
        </div>

        {/* 1. JUEGO BUSCAMINAS */}
        {activeGame === 'minas' && (
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* PANEL DE CONTROL DE APUESTA */}
            <div className="bg-zinc-900/90 border border-white/10 rounded-3xl p-6 flex flex-col justify-between">
              <div>
                <h3 className="text-xl font-black text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Bomb className="w-5 h-5 text-emerald-400" /> Configurar Apuesta
                </h3>

                <div className="space-y-4 mb-6">
                  <div>
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-2">Monto a Apostar</label>
                    <div className="flex gap-2">
                      {[50, 100, 250, 500].map(val => (
                        <button
                          key={val}
                          disabled={minesGameActive}
                          onClick={() => setMinesBet(val)}
                          className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${
                            minesBet === val 
                              ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300' 
                              : 'bg-black border-white/10 text-zinc-400 hover:border-white/20'
                          }`}
                        >
                          {val}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-2">Cantidad de Minas (Riesgo)</label>
                    <div className="flex gap-2">
                      {[1, 3, 5, 8].map(count => (
                        <button
                          key={count}
                          disabled={minesGameActive}
                          onClick={() => setMineCount(count)}
                          className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${
                            mineCount === count 
                              ? 'bg-rose-500/20 border-rose-500 text-rose-300' 
                              : 'bg-black border-white/10 text-zinc-400 hover:border-white/20'
                          }`}
                        >
                          {count} 💣
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* MULTIPLICADOR EN TIEMPO REAL */}
                {minesGameActive && (
                  <div className="bg-black/60 border border-emerald-500/30 rounded-2xl p-4 text-center mb-6">
                    <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-widest block">Multiplicador Actual</span>
                    <span className="text-3xl font-black text-white font-mono">{currentMultiplier}x</span>
                    <span className="text-xs text-zinc-400 block mt-1">
                      Premio si te retiras: <strong className="text-amber-300">{Math.floor(minesBet * currentMultiplier)}</strong> monedas
                    </span>
                  </div>
                )}
              </div>

              <div>
                {!minesGameActive ? (
                  <button
                    onClick={startMinesGame}
                    className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black font-black text-sm uppercase tracking-widest rounded-2xl shadow-xl shadow-emerald-500/20 transition-all cursor-pointer"
                  >
                    Iniciar Partida
                  </button>
                ) : (
                  <button
                    disabled={revealedCount === 0}
                    onClick={cashOutMines}
                    className={`w-full py-4 font-black text-sm uppercase tracking-widest rounded-2xl shadow-xl transition-all cursor-pointer ${
                      revealedCount > 0 
                        ? 'bg-gradient-to-r from-amber-500 to-yellow-400 text-black hover:scale-105 shadow-amber-500/30 animate-pulse' 
                        : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                    }`}
                  >
                    Retirar Ganancias ({Math.floor(minesBet * currentMultiplier)} 🪙)
                  </button>
                )}
              </div>
            </div>

            {/* TABLERO 5x5 DE CASILLAS */}
            <div className="lg:col-span-2 bg-black/60 border border-white/10 rounded-3xl p-6 md:p-8 flex items-center justify-center">
              <div className="grid grid-cols-5 gap-3 w-full max-w-md aspect-square">
                {Array.from({ length: 25 }).map((_, i) => {
                  const tile = minefield[i]
                  const isRevealed = tile?.revealed

                  return (
                    <motion.button
                      key={i}
                      whileHover={minesGameActive && !isRevealed ? { scale: 1.05 } : {}}
                      whileTap={minesGameActive && !isRevealed ? { scale: 0.95 } : {}}
                      onClick={() => handleTileClick(i)}
                      disabled={!minesGameActive || isRevealed}
                      className={`rounded-2xl flex items-center justify-center font-bold text-2xl transition-all border ${
                        !minesGameActive && !isRevealed
                          ? 'bg-zinc-900 border-white/10 opacity-70'
                          : isRevealed
                          ? tile.isMine
                            ? 'bg-rose-950 border-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.6)]'
                            : 'bg-emerald-950/80 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]'
                          : 'bg-zinc-800 hover:bg-zinc-700 border-white/20 cursor-pointer shadow-md'
                      }`}
                    >
                      {isRevealed ? (
                        tile.isMine ? '💣' : '💎'
                      ) : (
                        <div className="w-3 h-3 rounded-full bg-white/10" />
                      )}
                    </motion.button>
                  )
                })}
              </div>
            </div>

          </motion.div>
        )}

        {/* 2. JUEGO SWEET BONANZA (SLOTS) */}
        {activeGame === 'bonanza' && (
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto">
            <div className="bg-gradient-to-b from-zinc-900 to-black border border-fuchsia-500/40 rounded-3xl p-8 text-center shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-fuchsia-500 via-pink-500 to-amber-400" />
              
              <h3 className="text-2xl font-black text-white uppercase tracking-wider mb-2">Tragamonedas Sweet Bonanza</h3>
              <p className="text-xs text-zinc-400 mb-8">Consigue tres diamantes 💎 para llevarte el bote de 20x.</p>

              {/* RODILLOS */}
              <div className="flex justify-center gap-4 mb-8">
                {slotReels.map((symbol, idx) => (
                  <motion.div
                    key={idx}
                    animate={isSpinning ? { y: [-15, 15, -15] } : { y: 0 }}
                    transition={{ repeat: Infinity, duration: 0.15 }}
                    className="w-24 h-32 md:w-32 md:h-40 bg-black/80 border-2 border-fuchsia-500/50 rounded-2xl flex items-center justify-center text-5xl md:text-6xl shadow-[0_0_30px_rgba(236,72,153,0.3)]"
                  >
                    {symbol}
                  </motion.div>
                ))}
              </div>

              {/* APUESTA Y ACCIÓN */}
              <div className="flex items-center justify-center gap-4 mb-6">
                <span className="text-xs font-bold text-zinc-400 uppercase">Apuesta:</span>
                {[25, 50, 100, 200].map(val => (
                  <button
                    key={val}
                    disabled={isSpinning}
                    onClick={() => setSlotBet(val)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${
                      slotBet === val ? 'bg-fuchsia-500 text-white border-fuchsia-400' : 'bg-black text-zinc-400 border-white/10'
                    }`}
                  >
                    {val} 🪙
                  </button>
                ))}
              </div>

              <button
                disabled={isSpinning}
                onClick={spinSlots}
                className="w-full max-w-sm py-4 bg-gradient-to-r from-fuchsia-600 via-pink-600 to-rose-600 hover:scale-105 text-white font-black text-sm uppercase tracking-widest rounded-2xl shadow-xl shadow-fuchsia-500/30 transition-all cursor-pointer"
              >
                {isSpinning ? 'Girando Rodillos...' : `Girar por ${slotBet} Monedas`}
              </button>
            </div>
          </motion.div>
        )}

        {/* 3. JUEGO CARA O CRUZ (COINFLIP) */}
        {activeGame === 'coinflip' && (
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="max-w-xl mx-auto">
            <div className="bg-zinc-900 border border-amber-500/30 rounded-3xl p-8 text-center shadow-2xl">
              <h3 className="text-2xl font-black text-white uppercase tracking-wider mb-2">Cara o Cruz 50/50</h3>
              <p className="text-xs text-zinc-400 mb-8">Elige tu bando y duplica tu apuesta al instante.</p>

              {/* MONEDA ANIMADA */}
              <div className="flex justify-center mb-8">
                <motion.div
                  animate={isFlipping ? { rotateY: [0, 1800], scale: [1, 1.2, 1] } : {}}
                  transition={{ duration: 1.2 }}
                  className="w-32 h-32 rounded-full bg-gradient-to-br from-amber-300 via-yellow-500 to-amber-700 border-4 border-yellow-200 flex items-center justify-center text-4xl font-black text-black shadow-[0_0_40px_rgba(245,158,11,0.5)] font-mono"
                >
                  {coinResult ? (coinResult === 'cara' ? '👑' : '⚔️') : '🪙'}
                </motion.div>
              </div>

              {/* SELECTOR DE BANDO */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <button
                  disabled={isFlipping}
                  onClick={() => setSelectedSide('cara')}
                  className={`py-3 rounded-2xl font-black text-sm uppercase tracking-wider border transition-all cursor-pointer ${
                    selectedSide === 'cara'
                      ? 'bg-amber-500 text-black border-amber-400 shadow-lg shadow-amber-500/20'
                      : 'bg-black text-zinc-400 border-white/10'
                  }`}
                >
                  👑 Cara
                </button>
                <button
                  disabled={isFlipping}
                  onClick={() => setSelectedSide('cruz')}
                  className={`py-3 rounded-2xl font-black text-sm uppercase tracking-wider border transition-all cursor-pointer ${
                    selectedSide === 'cruz'
                      ? 'bg-amber-500 text-black border-amber-400 shadow-lg shadow-amber-500/20'
                      : 'bg-black text-zinc-400 border-white/10'
                  }`}
                >
                  ⚔️ Cruz
                </button>
              </div>

              <button
                disabled={isFlipping}
                onClick={flipCoin}
                className="w-full py-4 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black font-black text-sm uppercase tracking-widest rounded-2xl shadow-xl shadow-amber-500/30 transition-all cursor-pointer"
              >
                {isFlipping ? 'Lanzando moneda...' : `Lanzar (${coinBet} Monedas)`}
              </button>
            </div>
          </motion.div>
        )}

      </div>
    </MainLayout>
  )
}
