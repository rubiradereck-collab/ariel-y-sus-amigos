'use client'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Coins, Sparkles, Volume2, VolumeX } from 'lucide-react'
import { levelProgress, type Currency, type Stats } from '@/lib/rpg'
import { sfx } from '@/lib/sfx'

export const fmt = (n: number | string) => Number(n).toLocaleString('es-EC')

export function Card({ children, className = '', glow = 'fuchsia' }: { children: ReactNode; className?: string; glow?: 'fuchsia' | 'cyan' | 'amber' | 'red' }) {
  const g = { fuchsia: 'border-fuchsia-500/30 shadow-fuchsia-500/10', cyan: 'border-cyan-400/30 shadow-cyan-400/10', amber: 'border-amber-400/30 shadow-amber-400/10', red: 'border-red-500/30 shadow-red-500/10' }[glow]
  return <div className={`rounded-2xl border bg-zinc-950/70 p-4 shadow-lg backdrop-blur-md ${g} ${className}`}>{children}</div>
}

export function NeonButton({ children, onClick, disabled, variant = 'fuchsia', className = '' }: {
  children: ReactNode; onClick?: () => void; disabled?: boolean; className?: string
  variant?: 'fuchsia' | 'cyan' | 'green' | 'red' | 'amber' | 'ghost'
}) {
  const v = {
    fuchsia: 'bg-fuchsia-600 hover:bg-fuchsia-500 shadow-fuchsia-500/40', cyan: 'bg-cyan-600 hover:bg-cyan-500 shadow-cyan-500/40',
    green: 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/40', red: 'bg-red-600 hover:bg-red-500 shadow-red-500/40',
    amber: 'bg-amber-500 hover:bg-amber-400 text-black shadow-amber-400/40', ghost: 'bg-white/5 hover:bg-white/10 border border-white/10',
  }[variant]
  return (
    <motion.button whileTap={{ scale: 0.95 }} whileHover={{ scale: disabled ? 1 : 1.03 }} disabled={disabled}
      onClick={() => { sfx.click(); onClick?.() }}
      className={`rounded-xl px-4 py-2 text-sm font-bold text-white shadow-lg transition disabled:cursor-not-allowed disabled:opacity-40 ${v} ${className}`}>
      {children}
    </motion.button>
  )
}

/** Toast: avisos ok/error con auto-cierre (limpia su timer al desmontar). */
export function useNotice() {
  const [n, setN] = useState<{ t: 'ok' | 'err' | 'info'; msg: string } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  const show = useCallback((msg: string, t: 'ok' | 'err' | 'info' = 'info') => {
    setN({ t, msg }); if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setN(null), 4200)
  }, [])
  const node = (
    <AnimatePresence>
      {n && (
        <motion.div initial={{ y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }}
          className={`fixed left-1/2 top-4 z-50 max-w-[92vw] -translate-x-1/2 rounded-xl border px-4 py-2 text-sm font-semibold backdrop-blur-md ${
            n.t === 'ok' ? 'border-emerald-400/50 bg-emerald-950/80 text-emerald-200' :
            n.t === 'err' ? 'border-red-500/50 bg-red-950/80 text-red-200' : 'border-cyan-400/50 bg-cyan-950/80 text-cyan-200'}`}>
          {n.msg}
        </motion.div>
      )}
    </AnimatePresence>
  )
  return { show, node }
}

/** Ejecuta una acción async con bloqueo anti doble clic y aviso de error. */
export function useBusy(notify: (m: string, t?: 'ok' | 'err' | 'info') => void) {
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  const run = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    if (lock.current) return
    lock.current = true; setBusy(true)
    try { return await fn() }
    catch (e) { sfx.lose(); notify((e as Error).message, 'err') }
    finally { lock.current = false; setBusy(false) }
  }, [notify])
  return { busy, run }
}

export function BalanceBar({ stats }: { stats: Stats | null }) {
  const [muted, setMuted] = useState(false)
  useEffect(() => setMuted(sfx.isMuted()), [])
  if (!stats) return <Card className="h-16 animate-pulse"><span /></Card>
  const lp = levelProgress(stats.lifetime_xp)
  return (
    <Card glow="cyan" className="flex flex-wrap items-center gap-x-6 gap-y-2">
      <div className="min-w-[140px] flex-1">
        <div className="flex justify-between text-xs text-cyan-200"><span>Nivel {stats.level}{stats.active_title ? ` · ${stats.active_title}` : ''}</span><span>{fmt(stats.lifetime_xp)}/{fmt(lp.next)} XP</span></div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10">
          <motion.div className="h-full bg-gradient-to-r from-cyan-400 to-fuchsia-500" animate={{ width: `${lp.pct}%` }} />
        </div>
      </div>
      <motion.div key={stats.coins} initial={{ scale: 1.25 }} animate={{ scale: 1 }} className="flex items-center gap-1 font-black text-amber-300"><Coins size={18} />{fmt(stats.coins)}</motion.div>
      <motion.div key={stats.xp} initial={{ scale: 1.25 }} animate={{ scale: 1 }} className="flex items-center gap-1 font-black text-fuchsia-300"><Sparkles size={18} />{fmt(stats.xp)} XP</motion.div>
      <button aria-label="Silenciar" onClick={() => { sfx.setMuted(!muted); setMuted(!muted) }} className="text-zinc-400 hover:text-white">
        {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
      </button>
    </Card>
  )
}

export function BetControls({ amount, setAmount, currency, setCurrency, stats, disabled }: {
  amount: number; setAmount: (n: number) => void; currency: Currency; setCurrency: (c: Currency) => void
  stats: Stats | null; disabled?: boolean
}) {
  const bal = stats ? Number(stats[currency]) : 0
  const clamp = (n: number) => Math.max(1, Math.min(10000, Math.floor(n) || 1))
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        {(['coins', 'xp'] as const).map(c => (
          <button key={c} disabled={disabled} onClick={() => setCurrency(c)}
            className={`flex-1 rounded-lg border px-2 py-1 text-xs font-bold ${currency === c ? 'border-fuchsia-400 bg-fuchsia-500/20 text-fuchsia-100' : 'border-white/10 text-zinc-400'}`}>
            {c === 'coins' ? '🪙 Monedas' : '✨ XP'}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1">
        <input type="number" min={1} max={10000} value={amount} disabled={disabled}
          onChange={e => setAmount(clamp(Number(e.target.value)))}
          className="w-full min-w-0 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-right font-mono text-white outline-none focus:border-fuchsia-400" />
        <button disabled={disabled} onClick={() => setAmount(clamp(amount / 2))} className="rounded-lg bg-white/5 px-2 py-2 text-xs hover:bg-white/10">½</button>
        <button disabled={disabled} onClick={() => setAmount(clamp(amount * 2))} className="rounded-lg bg-white/5 px-2 py-2 text-xs hover:bg-white/10">2×</button>
        <button disabled={disabled} onClick={() => setAmount(clamp(Math.min(bal, 10000)))} className="rounded-lg bg-white/5 px-2 py-2 text-xs hover:bg-white/10">Máx</button>
      </div>
      <p className="text-right text-[11px] text-zinc-500">Saldo: {fmt(bal)} · Apuesta máx. 10.000</p>
    </div>
  )
}
