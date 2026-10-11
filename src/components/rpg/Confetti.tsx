'use client'
import { useMemo } from 'react'
import { motion } from 'framer-motion'

const BITS = ['💎', '🪙', '✨', '🎉', '⭐', '💜']
/** Lluvia de confeti/gemas. Se monta con `key` distinto para repetirla. */
export default function Confetti({ count = 36 }: { count?: number }) {
  const bits = useMemo(() => Array.from({ length: count }, (_, i) => ({
    i, x: Math.random() * 100, d: Math.random() * 0.6, s: 14 + Math.random() * 18,
    e: BITS[i % BITS.length], r: Math.random() * 720 - 360,
  })), [count])
  return (
    <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
      {bits.map(b => (
        <motion.span key={b.i} className="absolute" style={{ left: `${b.x}%`, top: -40, fontSize: b.s }}
          initial={{ y: 0, opacity: 1, rotate: 0 }} animate={{ y: '110vh', opacity: [1, 1, 0], rotate: b.r }}
          transition={{ duration: 2.2 + Math.random(), delay: b.d, ease: 'easeIn' }}>{b.e}</motion.span>
      ))}
    </div>
  )
}
