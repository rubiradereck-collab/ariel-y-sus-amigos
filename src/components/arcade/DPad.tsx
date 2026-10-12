'use client'

import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react'

interface DPadProps {
  onDirection: (dir: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT') => void
  disabled?: boolean
}

export function DPad({ onDirection, disabled = false }: DPadProps) {
  return (
    <div className="relative mx-auto h-36 w-36 select-none sm:h-44 sm:w-44">
      {/* Botón Arriba */}
      <button
        onClick={() => onDirection('UP')}
        disabled={disabled}
        aria-label="Arriba"
        className="absolute left-1/2 top-0 -translate-x-1/2 cursor-pointer rounded-2xl border-2 border-emerald-500/40 bg-zinc-800/90 p-3 shadow-lg active:scale-95 active:bg-emerald-600 disabled:opacity-40 sm:p-4"
      >
        <ArrowUp className="h-6 w-6 text-emerald-400" />
      </button>

      {/* Botón Izquierda */}
      <button
        onClick={() => onDirection('LEFT')}
        disabled={disabled}
        aria-label="Izquierda"
        className="absolute left-0 top-1/2 -translate-y-1/2 cursor-pointer rounded-2xl border-2 border-emerald-500/40 bg-zinc-800/90 p-3 shadow-lg active:scale-95 active:bg-emerald-600 disabled:opacity-40 sm:p-4"
      >
        <ArrowLeft className="h-6 w-6 text-emerald-400" />
      </button>

      {/* Centro decorativo */}
      <div className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10 bg-zinc-900 shadow-inner" />

      {/* Botón Derecha */}
      <button
        onClick={() => onDirection('RIGHT')}
        disabled={disabled}
        aria-label="Derecha"
        className="absolute right-0 top-1/2 -translate-y-1/2 cursor-pointer rounded-2xl border-2 border-emerald-500/40 bg-zinc-800/90 p-3 shadow-lg active:scale-95 active:bg-emerald-600 disabled:opacity-40 sm:p-4"
      >
        <ArrowRight className="h-6 w-6 text-emerald-400" />
      </button>

      {/* Botón Abajo */}
      <button
        onClick={() => onDirection('DOWN')}
        disabled={disabled}
        aria-label="Abajo"
        className="absolute bottom-0 left-1/2 -translate-x-1/2 cursor-pointer rounded-2xl border-2 border-emerald-500/40 bg-zinc-800/90 p-3 shadow-lg active:scale-95 active:bg-emerald-600 disabled:opacity-40 sm:p-4"
      >
        <ArrowDown className="h-6 w-6 text-emerald-400" />
      </button>
    </div>
  )
}
