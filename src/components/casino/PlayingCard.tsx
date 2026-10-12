'use client'

import { motion } from 'framer-motion'
import { Card } from '@/types/entrega3'
import { cardRank, cardSuit, isCardRed } from '@/lib/casino/blackjack'

interface PlayingCardProps {
  card?: Card
  hidden?: boolean
  delay?: number
}

export function PlayingCard({ card, hidden = false, delay = 0 }: PlayingCardProps) {
  if (hidden || card === undefined) {
    return (
      <motion.div
        initial={{ scale: 0.8, opacity: 0, rotateY: 180 }}
        animate={{ scale: 1, opacity: 1, rotateY: 0 }}
        transition={{ duration: 0.3, delay }}
        className="relative flex h-28 w-20 flex-col items-center justify-center rounded-xl border-2 border-fuchsia-500/40 bg-gradient-to-br from-purple-900 via-indigo-950 to-black shadow-lg shadow-purple-950/50 sm:h-32 sm:w-24"
      >
        <div className="absolute inset-1 rounded-lg border border-dashed border-fuchsia-400/30 bg-[radial-gradient(circle_at_center,#a855f7_1px,transparent_1px)] bg-[size:10px_10px]" />
        <span className="relative z-10 text-2xl font-black text-fuchsia-400 drop-shadow">🂠</span>
      </motion.div>
    )
  }

  const rank = cardRank(card)
  const suit = cardSuit(card)
  const isRed = isCardRed(card)

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0, y: -20 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className={`relative flex h-28 w-20 select-none flex-col justify-between rounded-xl border-2 bg-white p-2 shadow-xl sm:h-32 sm:w-24 ${
        isRed ? 'border-red-500/30 text-red-600' : 'border-zinc-300 text-zinc-900'
      }`}
    >
      <div className="flex flex-col items-start leading-none">
        <span className="text-base font-black sm:text-lg">{rank}</span>
        <span className="text-sm sm:text-base">{suit}</span>
      </div>

      <div className="flex items-center justify-center text-2xl sm:text-3xl">
        <span>{suit}</span>
      </div>

      <div className="flex flex-col items-end leading-none">
        <span className="text-sm sm:text-base">{suit}</span>
        <span className="text-base font-black sm:text-lg">{rank}</span>
      </div>
    </motion.div>
  )
}
