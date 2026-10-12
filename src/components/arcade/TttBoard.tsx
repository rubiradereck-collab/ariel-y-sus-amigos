'use client'

import { motion } from 'framer-motion'

interface TttBoardProps {
  board: string // Cadena de 9 caracteres ('---------')
  onCellClick: (index: number) => void
  disabled?: boolean
  mySymbol?: 'X' | 'O'
  turnSymbol?: 'X' | 'O'
}

export function TttBoard({
  board,
  onCellClick,
  disabled = false,
  mySymbol,
  turnSymbol,
}: TttBoardProps) {
  const cells = board.split('')

  return (
    <div className="mx-auto aspect-square w-full max-w-[360px] p-2">
      <div className="grid h-full w-full grid-cols-3 grid-rows-3 gap-3">
        {cells.map((val, idx) => {
          const isEmpty = val === '-'
          const isInteractive = isEmpty && !disabled

          return (
            <motion.button
              key={idx}
              whileHover={isInteractive ? { scale: 1.05 } : {}}
              whileTap={isInteractive ? { scale: 0.95 } : {}}
              onClick={() => isInteractive && onCellClick(idx)}
              disabled={!isInteractive}
              className={`flex items-center justify-center rounded-2xl border-2 text-4xl font-black shadow-lg transition sm:text-5xl ${
                isEmpty
                  ? 'border-white/10 bg-zinc-900/80 hover:border-fuchsia-500/40 hover:bg-zinc-800'
                  : val === 'X'
                    ? 'border-fuchsia-500/50 bg-fuchsia-950/40 text-fuchsia-400 shadow-fuchsia-500/20'
                    : 'border-cyan-500/50 bg-cyan-950/40 text-cyan-400 shadow-cyan-500/20'
              } ${!isInteractive ? 'cursor-not-allowed' : 'cursor-pointer'}`}
            >
              {val !== '-' && (
                <motion.span
                  initial={{ scale: 0, rotate: -45 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', damping: 15 }}
                >
                  {val}
                </motion.span>
              )}
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
