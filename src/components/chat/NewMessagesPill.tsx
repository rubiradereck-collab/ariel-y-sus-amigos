'use client'

import { ChevronDown } from 'lucide-react'

interface NewMessagesPillProps {
  count: number
  onClick: () => void
}

export function NewMessagesPill({ count, onClick }: NewMessagesPillProps) {
  if (count <= 0) return null

  return (
    <div className="absolute bottom-24 left-1/2 z-30 -translate-x-1/2 animate-bounce">
      <button
        onClick={onClick}
        className="flex cursor-pointer items-center gap-1.5 rounded-full border border-fuchsia-500/50 bg-gradient-to-r from-fuchsia-600 to-indigo-600 px-4 py-1.5 text-xs font-black tracking-wider text-white shadow-xl shadow-fuchsia-600/30 transition hover:scale-105 active:scale-95"
      >
        <span>
          {count} {count === 1 ? 'nuevo mensaje' : 'nuevos mensajes'}
        </span>
        <ChevronDown className="h-4 w-4" />
      </button>
    </div>
  )
}
