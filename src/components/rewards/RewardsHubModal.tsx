'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Gift, Sparkles, Flame, Coins, Zap, HelpCircle, X, Check,
  AlertTriangle, RotateCcw, Award, ChevronRight, ShieldAlert, HeartHandshake
} from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'

export interface RewardsStatus {
  coins: number
  xp: number
  level: number
  daily_available: boolean
  daily_remaining_seconds: number
  daily_streak: number
  daily_next_reward: number
  wheel_available: boolean
  wheel_remaining_seconds: number
  bankruptcy_eligible: boolean
  bankruptcy_available: boolean
  bankruptcy_remaining_seconds: number
  chat_coins_today: number
}

const WHEEL_SLOTS = [
  { label: '50 🪙', color: '#059669', icon: '🪙', bg: 'from-emerald-600 to-emerald-800' },
  { label: '100 🪙', color: '#2563eb', icon: '🪙', bg: 'from-blue-600 to-blue-800' },
  { label: '200 🪙', color: '#7c3aed', icon: '💰', bg: 'from-purple-600 to-purple-800' },
  { label: 'JACKPOT 500 🪙', color: '#d97706', icon: '👑', bg: 'from-amber-500 to-yellow-600' },
  { label: '75 XP', color: '#0891b2', icon: '⚡', bg: 'from-cyan-600 to-cyan-800' },
  { label: '150 XP', color: '#db2777', icon: '✨', bg: 'from-pink-600 to-pink-800' },
  { label: 'Poción Suerte', color: '#ea580c', icon: '🧪', bg: 'from-orange-600 to-orange-800' },
  { label: 'Dinamita', color: '#dc2626', icon: '🧨', bg: 'from-red-600 to-red-800' },
]

function formatSeconds(sec: number): string {
  if (sec <= 0) return 'Disponible'
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (h > 0) return `${h}h ${m}m`
  return `${m}m ${s}s`
}

export function RewardsHubModal({
  isOpen,
  onClose,
  onUpdateCoins,
}: {
  isOpen: boolean
  onClose: () => void
  onUpdateCoins?: () => void
}) {
  const [supabase] = useState(() => createClient())
  const [status, setStatus] = useState<RewardsStatus | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [claimingDaily, setClaimingDaily] = useState<boolean>(false)
  const [claimingBroke, setClaimingBroke] = useState<boolean>(false)
  const [activeTab, setActiveTab] = useState<'daily' | 'wheel' | 'broke'>('daily')

  // Ruleta states
  const [spinning, setSpinning] = useState<boolean>(false)
  const [wheelRotation, setWheelRotation] = useState<number>(0)
  const [wheelResult, setWheelResult] = useState<any | null>(null)

  const fetchStatus = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('get_rewards_status')
      if (!error && data) {
        setStatus(data as RewardsStatus)
      }
    } catch {
      // Ignorar
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    if (isOpen) {
      void fetchStatus()
    }
  }, [isOpen, fetchStatus])

  // Sonidos Web Audio
  const playSound = (type: 'tick' | 'win' | 'faucet') => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      if (type === 'tick') {
        const osc = ctx.createOscillator()
        const g = ctx.createGain()
        osc.type = 'triangle'
        osc.frequency.setValueAtTime(600, ctx.currentTime)
        g.gain.setValueAtTime(0.08, ctx.currentTime)
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05)
        osc.connect(g)
        g.connect(ctx.destination)
        osc.start()
        osc.stop(ctx.currentTime + 0.05)
      } else if (type === 'win') {
        const notes = [523.25, 659.25, 783.99, 1046.5]
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator()
          const g = ctx.createGain()
          osc.type = 'sine'
          osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.1)
          g.gain.setValueAtTime(0.12, ctx.currentTime + idx * 0.1)
          g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.1 + 0.25)
          osc.connect(g)
          g.connect(ctx.destination)
          osc.start(ctx.currentTime + idx * 0.1)
          osc.stop(ctx.currentTime + idx * 0.1 + 0.25)
        })
      } else if (type === 'faucet') {
        const osc = ctx.createOscillator()
        const g = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(300, ctx.currentTime)
        osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.2)
        g.gain.setValueAtTime(0.15, ctx.currentTime)
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25)
        osc.connect(g)
        g.connect(ctx.destination)
        osc.start()
        osc.stop(ctx.currentTime + 0.25)
      }
    } catch {}
  }

  // 1. Reclamar Diario
  const handleClaimDaily = async () => {
    if (claimingDaily || !status?.daily_available) return
    setClaimingDaily(true)
    try {
      const { data, error } = await supabase.rpc('claim_daily_coins')
      if (error) throw error
      if (data?.success) {
        playSound('win')
        toast.success(data.message || `+${data.coins_awarded} 🪙 recibidas`)
        await fetchStatus()
        onUpdateCoins?.()
      } else {
        toast.error(data?.message || 'Aún no disponible')
      }
    } catch (e: any) {
      toast.error(e?.message || 'Error al reclamar bono diario')
    } finally {
      setClaimingDaily(false)
    }
  }

  // 2. Auxilio Bancarrota
  const handleClaimBroke = async () => {
    if (claimingBroke || !status?.bankruptcy_available) return
    setClaimingBroke(true)
    try {
      const { data, error } = await supabase.rpc('claim_bankruptcy_aid')
      if (error) throw error
      if (data?.success) {
        playSound('faucet')
        toast.success(data.message || '+50 🪙 de auxilio recibidas')
        await fetchStatus()
        onUpdateCoins?.()
      } else {
        toast.error(data?.message || 'No disponible')
      }
    } catch (e: any) {
      toast.error(e?.message || 'Error al solicitar auxilio')
    } finally {
      setClaimingBroke(false)
    }
  }

  // 3. Girar Ruleta Diaria
  const handleSpinWheel = async () => {
    if (spinning || !status?.wheel_available) return
    setSpinning(true)
    setWheelResult(null)

    try {
      const { data, error } = await supabase.rpc('spin_daily_wheel')
      if (error) throw error
      if (!data?.success) {
        toast.error(data?.message || 'Ruleta no disponible')
        setSpinning(false)
        return
      }

      // Slot index (0 a 7)
      const slotIdx = Number(data.slot_index ?? 0)
      const sliceDeg = 360 / 8 // 45 deg
      // El puntero está arriba (270° o 0°). Con offset:
      // Rotamos al menos 5 vueltas completas (1800°) + posición invertida del slice
      const targetDeg = 1800 + (360 - (slotIdx * sliceDeg + sliceDeg / 2))
      setWheelRotation((prev) => prev + targetDeg)

      // Sonido de giro
      const interval = setInterval(() => {
        playSound('tick')
      }, 180)

      setTimeout(() => {
        clearInterval(interval)
        playSound('win')
        setWheelResult(data)
        setSpinning(false)
        toast.success(`🎉 ${data.message}`)
        void fetchStatus()
        onUpdateCoins?.()
      }, 4200)

    } catch (e: any) {
      toast.error(e?.message || 'Error al girar ruleta')
      setSpinning(false)
    }
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-md"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-yellow-500/30 bg-zinc-950 p-5 shadow-[0_0_50px_rgba(234,179,8,0.2)] sm:p-6 text-white hide-scrollbar"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-gradient-to-tr from-yellow-500 to-amber-300 p-2.5 text-zinc-950 shadow-md shadow-yellow-500/20">
                <Gift className="h-6 w-6 font-black" />
              </div>
              <div>
                <h2 className="text-xl font-black tracking-wide text-yellow-300 sm:text-2xl">
                  Bóveda de Recompensas
                </h2>
                <p className="text-xs text-zinc-400">
                  Consigue monedas gratis, giros y fondos del clan
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-full border border-white/10 bg-white/5 p-2 text-zinc-400 transition hover:bg-white/10 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Navegación por Pestañas */}
          <div className="mt-4 grid grid-cols-3 gap-2">
            <button
              onClick={() => setActiveTab('daily')}
              className={`flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-xs font-bold transition ${
                activeTab === 'daily'
                  ? 'border-yellow-400 bg-yellow-500/20 text-yellow-200 shadow'
                  : 'border-white/10 bg-black/40 text-zinc-400 hover:text-white'
              }`}
            >
              <Flame className="h-4 w-4 text-orange-400" /> Sueldo Diario
            </button>
            <button
              onClick={() => setActiveTab('wheel')}
              className={`flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-xs font-bold transition ${
                activeTab === 'wheel'
                  ? 'border-fuchsia-400 bg-fuchsia-500/20 text-fuchsia-200 shadow'
                  : 'border-white/10 bg-black/40 text-zinc-400 hover:text-white'
              }`}
            >
              <Sparkles className="h-4 w-4 text-fuchsia-400" /> Ruleta Suerte
            </button>
            <button
              onClick={() => setActiveTab('broke')}
              className={`flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-xs font-bold transition ${
                activeTab === 'broke'
                  ? 'border-red-400 bg-red-500/20 text-red-200 shadow'
                  : 'border-white/10 bg-black/40 text-zinc-400 hover:text-white'
              }`}
            >
              <HeartHandshake className="h-4 w-4 text-red-400" /> Rescate
            </button>
          </div>

          {/* CONTENIDO SEGÚN PESTAÑA */}
          <div className="mt-5 space-y-4">
            {/* 1. SUELDO DIARIO CON RACHA */}
            {activeTab === 'daily' && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <div className="rounded-2xl border border-yellow-500/30 bg-gradient-to-b from-yellow-500/10 to-transparent p-4 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-yellow-500/20 text-3xl shadow-inner border border-yellow-400/30">
                    🪙
                  </div>
                  <h3 className="mt-3 text-lg font-black text-yellow-300">
                    Sueldo Diario del Clan
                  </h3>
                  <p className="text-xs text-zinc-300">
                    Gana monedas y XP gratis cada 20 horas. Mantén tu racha para multiplicar tus recompensas.
                  </p>

                  {/* Racha actual */}
                  <div className="mt-4 flex items-center justify-center gap-2">
                    <span className="text-xs font-bold text-zinc-400">Racha Actual:</span>
                    <div className="flex items-center gap-1 rounded-full bg-orange-500/20 border border-orange-500/30 px-3 py-1 text-sm font-black text-orange-300">
                      <Flame className="h-4 w-4 fill-orange-400 text-orange-400" />
                      {status?.daily_streak ?? 0} {status?.daily_streak === 1 ? 'Día' : 'Días'}
                    </div>
                  </div>

                  {/* Pasos de racha (1 al 7) */}
                  <div className="mt-4 grid grid-cols-7 gap-1">
                    {[1, 2, 3, 4, 5, 6, 7].map((day) => {
                      const isReached = (status?.daily_streak ?? 0) >= day
                      const isNext = (status?.daily_streak ?? 0) + 1 === day
                      const coinReward = 150 + day * 25
                      return (
                        <div
                          key={day}
                          className={`rounded-xl border p-1 text-center transition ${
                            isReached
                              ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-200'
                              : isNext
                              ? 'border-yellow-400 bg-yellow-500/20 text-yellow-200 animate-pulse'
                              : 'border-white/5 bg-black/40 text-zinc-600'
                          }`}
                        >
                          <span className="block text-[10px] font-black uppercase">D{day}</span>
                          <span className="block text-[11px] font-black">+{coinReward}</span>
                          {isReached && <Check className="mx-auto mt-0.5 h-3 w-3 text-emerald-400" />}
                        </div>
                      )
                    })}
                  </div>

                  {/* Botón Reclamar */}
                  <div className="mt-6">
                    {status?.daily_available ? (
                      <button
                        onClick={handleClaimDaily}
                        disabled={claimingDaily}
                        className="w-full cursor-pointer rounded-2xl bg-gradient-to-r from-yellow-500 via-amber-400 to-yellow-600 py-3.5 text-sm font-black text-zinc-950 shadow-lg shadow-yellow-500/30 transition hover:brightness-110 active:scale-95 disabled:opacity-50"
                      >
                        {claimingDaily ? 'Reclamando...' : `¡RECLAMAR +${status?.daily_next_reward ?? 175} 🪙 Y 50 XP!`}
                      </button>
                    ) : (
                      <div className="rounded-xl border border-white/10 bg-black/60 py-3 text-xs font-bold text-zinc-400">
                        ⏳ Próximo sueldo disponible en: <b className="text-yellow-400">{formatSeconds(status?.daily_remaining_seconds ?? 0)}</b>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* 2. RULETA DE LA SUERTE */}
            {activeTab === 'wheel' && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4 text-center"
              >
                <div className="rounded-2xl border border-fuchsia-500/30 bg-gradient-to-b from-fuchsia-500/10 to-transparent p-4">
                  <h3 className="text-lg font-black text-fuchsia-300">
                    Ruleta de la Suerte Diaria
                  </h3>
                  <p className="text-xs text-zinc-300">
                    Gira una vez gratis al día y gana hasta 500 🪙 o ítems legendarios
                  </p>

                  {/* Visual Wheel Container */}
                  <div className="relative mx-auto my-6 flex h-64 w-64 items-center justify-center">
                    {/* Flecha Puntero Superior */}
                    <div className="absolute -top-3 z-20 flex flex-col items-center">
                      <div className="h-0 w-0 border-x-8 border-x-transparent border-t-[18px] border-t-yellow-400 drop-shadow-[0_4px_8px_rgba(234,179,8,0.8)]" />
                    </div>

                    {/* Disco Giratorio */}
                    <div
                      style={{
                        transform: `rotate(${wheelRotation}deg)`,
                        transition: spinning ? 'transform 4.2s cubic-bezier(0.15, 0.95, 0.35, 1)' : 'none',
                      }}
                      className="relative h-60 w-60 rounded-full border-4 border-yellow-400/80 shadow-[0_0_30px_rgba(217,70,239,0.3)] overflow-hidden"
                    >
                      {/* 8 Segmentos SVG */}
                      <svg viewBox="0 0 100 100" className="h-full w-full">
                        {WHEEL_SLOTS.map((slot, i) => {
                          const angle = 360 / 8
                          const startAngle = i * angle - 90
                          const endAngle = (i + 1) * angle - 90
                          const x1 = 50 + 50 * Math.cos((Math.PI * startAngle) / 180)
                          const y1 = 50 + 50 * Math.sin((Math.PI * startAngle) / 180)
                          const x2 = 50 + 50 * Math.cos((Math.PI * endAngle) / 180)
                          const y2 = 50 + 50 * Math.sin((Math.PI * endAngle) / 180)
                          const pathData = `M 50 50 L ${x1} ${y1} A 50 50 0 0 1 ${x2} ${y2} Z`
                          return (
                            <path
                              key={i}
                              d={pathData}
                              fill={slot.color}
                              stroke="#09090b"
                              strokeWidth="0.8"
                            />
                          )
                        })}
                      </svg>

                      {/* Emojis y Textos sobre la ruleta */}
                      {WHEEL_SLOTS.map((slot, i) => {
                        const deg = i * 45 + 22.5
                        return (
                          <div
                            key={i}
                            style={{
                              transform: `rotate(${deg}deg) translateY(-85px)`,
                              transformOrigin: 'bottom center',
                            }}
                            className="absolute bottom-1/2 left-1/2 -ml-6 w-12 text-center"
                          >
                            <span className="block text-base">{slot.icon}</span>
                            <span className="block text-[8px] font-black uppercase tracking-tight text-white drop-shadow">
                              {slot.label}
                            </span>
                          </div>
                        )
                      })}
                    </div>

                    {/* Centro de la Ruleta */}
                    <div className="absolute z-10 flex h-12 w-12 items-center justify-center rounded-full border-2 border-yellow-400 bg-zinc-950 font-black text-yellow-300 shadow-lg">
                      ⭐
                    </div>
                  </div>

                  {/* Resultado animado si hubo giro */}
                  {wheelResult && (
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="mb-4 rounded-xl border border-yellow-500/50 bg-yellow-500/20 p-3 text-center"
                    >
                      <span className="text-xs font-bold text-yellow-200">¡PREMIO GANADO!</span>
                      <p className="text-lg font-black text-white">{wheelResult.prize_label}</p>
                    </motion.div>
                  )}

                  {/* Botón de Giro */}
                  {status?.wheel_available ? (
                    <button
                      onClick={handleSpinWheel}
                      disabled={spinning}
                      className="w-full cursor-pointer rounded-2xl bg-gradient-to-r from-fuchsia-600 via-pink-500 to-fuchsia-600 py-3.5 text-sm font-black text-white shadow-lg shadow-fuchsia-500/30 transition hover:brightness-110 active:scale-95 disabled:opacity-50"
                    >
                      {spinning ? '¡GIRANDO LA RULETA!...' : '🎡 ¡GIRAR RULETA GRATIS!'}
                    </button>
                  ) : (
                    <div className="rounded-xl border border-white/10 bg-black/60 py-3 text-xs font-bold text-zinc-400">
                      ⏳ Próximo giro gratis en: <b className="text-fuchsia-400">{formatSeconds(status?.wheel_remaining_seconds ?? 0)}</b>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* 3. RESCATE DE BANCARROTA */}
            {activeTab === 'broke' && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <div className="rounded-2xl border border-red-500/30 bg-gradient-to-b from-red-500/10 to-transparent p-4 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-500/20 text-3xl shadow-inner border border-red-500/40">
                    💸
                  </div>
                  <h3 className="mt-3 text-lg font-black text-red-300">
                    Fondo de Rescate Clandestino
                  </h3>
                  <p className="text-xs text-zinc-300">
                    ¿Lo perdiste todo en el Casino? El prestamista del clan te entrega un auxilio de <b>50 🪙</b> cada hora si tienes menos de 20 monedas.
                  </p>

                  <div className="mt-4 rounded-xl border border-white/10 bg-black/50 p-3 text-left space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Tus monedas actuales:</span>
                      <span className="font-mono font-black text-yellow-400">{status?.coins ?? 0} 🪙</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Requisito de auxilio:</span>
                      <span className="font-bold text-zinc-200">Menos de 20 🪙</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Auxilio otorgado:</span>
                      <span className="font-bold text-emerald-400">+50 🪙 inmediatas</span>
                    </div>
                  </div>

                  <div className="mt-6">
                    {status?.bankruptcy_available ? (
                      <button
                        onClick={handleClaimBroke}
                        disabled={claimingBroke}
                        className="w-full cursor-pointer rounded-2xl bg-gradient-to-r from-red-600 via-rose-500 to-red-700 py-3.5 text-sm font-black text-white shadow-lg shadow-red-500/30 transition hover:brightness-110 active:scale-95 disabled:opacity-50"
                      >
                        {claimingBroke ? 'Solicitando...' : '💸 ¡PEDIR 50 🪙 DE RESCATE!'}
                      </button>
                    ) : status?.bankruptcy_eligible ? (
                      <div className="rounded-xl border border-red-500/30 bg-red-950/40 py-3 text-xs font-bold text-red-300">
                        ⏳ El prestamista te vio hace poco. Vuelve en: <b>{formatSeconds(status.bankruptcy_remaining_seconds)}</b>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-white/10 bg-black/60 py-3 text-xs font-bold text-zinc-400">
                        🛡️ Tu balance ({status?.coins ?? 0} 🪙) supera el límite de pobreza. No necesitas auxilio.
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Banner Informativo de Métodos Adicionales */}
            <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4 space-y-2">
              <span className="text-xs font-black uppercase tracking-wider text-yellow-400 flex items-center gap-1.5">
                <Coins className="h-4 w-4" /> Otras formas activas de ganar monedas:
              </span>
              <ul className="text-xs text-zinc-300 space-y-1.5 list-disc list-inside">
                <li><b>Subir de Nivel:</b> Recibes automáticamente <span className="text-yellow-300 font-bold">Nivel × 100 🪙</span> cada vez que subes con tu XP.</li>
                <li><b>Interacción en Chat:</b> Ganas <span className="text-yellow-300 font-bold">+2 🪙</span> al chatear (cada 30 seg, hasta 50 🪙/día).</li>
                <li><b>Likes en el Muro:</b> Ganas <span className="text-yellow-300 font-bold">+5 🪙</span> por cada reacción que reciban tus posts.</li>
                <li><b>La Culebrita (Arcade):</b> Gana hasta <span className="text-yellow-300 font-bold">500 🪙/día</span> superando récords.</li>
                <li><b>Aventura:</b> Mina minerales y pesca peces para venderlos en tu <span className="text-yellow-300 font-bold">Mochila</span>.</li>
              </ul>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
