'use client'

import { Search, X } from 'lucide-react'

export function SearchBar({
  value,
  onChange,
}: {
  value: string
  onChange: (val: string) => void
}) {
  return (
    <div className="relative flex-1 max-w-md">
      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-zinc-400">
        <Search className="h-4 w-4 text-[#d4af37]" />
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Buscar juego por nombre o tipo..."
        className="w-full rounded-2xl border border-[rgba(212,175,55,0.2)] bg-[#1b1b1d] py-2.5 pl-10 pr-9 text-xs sm:text-sm text-white placeholder-zinc-500 shadow-inner outline-none transition focus:border-[#d4af37] focus:ring-1 focus:ring-[#d4af37]/50"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-400 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
