'use client'

import { Flame, Sparkles, Rocket, Layers, Zap, Star, Clock } from 'lucide-react'

export type LobbyCategoryFilter = 'todos' | 'slots' | 'crash' | 'mesa' | 'instantaneo' | 'favoritos' | 'recientes'

const CHIPS: { id: LobbyCategoryFilter; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'todos', label: 'Todos', icon: Sparkles },
  { id: 'slots', label: 'Slots', icon: Layers },
  { id: 'crash', label: 'Crash', icon: Rocket },
  { id: 'mesa', label: 'Mesa', icon: Flame },
  { id: 'instantaneo', label: 'Instantáneos', icon: Zap },
  { id: 'favoritos', label: 'Favoritos', icon: Star },
  { id: 'recientes', label: 'Recientes', icon: Clock },
]

export function CategoryChips({
  selected,
  onSelect,
  counts,
}: {
  selected: LobbyCategoryFilter
  onSelect: (cat: LobbyCategoryFilter) => void
  counts?: Partial<Record<LobbyCategoryFilter, number>>
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 pt-1 hide-scrollbar">
      {CHIPS.map((chip) => {
        const Icon = chip.icon
        const isSelected = selected === chip.id
        const count = counts?.[chip.id]

        return (
          <button
            key={chip.id}
            onClick={() => onSelect(chip.id)}
            className={`cursor-pointer whitespace-nowrap flex items-center gap-2 rounded-2xl border px-4 py-2 text-xs sm:text-sm font-bold transition active:scale-95 ${
              isSelected
                ? 'border-[#d4af37] bg-gradient-to-r from-[#d4af37]/25 to-amber-500/15 text-[#d4af37] shadow-[0_0_15px_rgba(212,175,55,0.25)]'
                : 'border-[rgba(212,175,55,0.12)] bg-[#1b1b1d] text-zinc-400 hover:border-[rgba(212,175,55,0.3)] hover:text-white'
            }`}
          >
            <Icon className={`h-4 w-4 ${isSelected ? 'text-[#d4af37]' : 'text-zinc-500'}`} />
            <span>{chip.label}</span>
            {typeof count === 'number' && (
              <span
                className={`ml-1 rounded-full px-1.5 py-0.2 text-[10px] font-black ${
                  isSelected ? 'bg-[#d4af37]/30 text-yellow-200' : 'bg-black/40 text-zinc-500'
                }`}
              >
                {count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
