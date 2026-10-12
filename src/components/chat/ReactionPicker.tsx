'use client'

import { motion } from 'framer-motion'

interface ReactionPickerProps {
  onSelect: (emoji: string) => void
  onClose?: () => void
}

export const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥']

export function ReactionPicker({ onSelect, onClose }: ReactionPickerProps) {
  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.8, opacity: 0 }}
      className="flex items-center gap-1 rounded-full border border-white/10 bg-zinc-900/95 px-2 py-1 shadow-2xl backdrop-blur-md"
    >
      {QUICK_EMOJIS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => {
            onSelect(emoji)
            onClose?.()
          }}
          className="cursor-pointer rounded-full p-1 text-base transition hover:scale-125 active:scale-95"
        >
          {emoji}
        </button>
      ))}
    </motion.div>
  )
}
