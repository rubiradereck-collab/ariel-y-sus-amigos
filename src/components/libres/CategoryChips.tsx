'use client';

import React from 'react';
import { GameCategory } from '@/lib/libres/types';
import {
  Gamepad2,
  Puzzle,
  Zap,
  Dice5,
  Coffee,
  Star,
} from 'lucide-react';

interface CategoryChipsProps {
  currentCategory: GameCategory;
  onSelectCategory: (cat: GameCategory) => void;
  counts: Record<GameCategory, number>;
}

const CATEGORIES: { id: GameCategory; label: string; icon: React.ReactNode }[] = [
  { id: 'todos', label: 'Todos', icon: <Gamepad2 className="w-4 h-4" /> },
  { id: 'puzzles', label: 'Puzzles', icon: <Puzzle className="w-4 h-4" /> },
  { id: 'arcade', label: 'Arcade', icon: <Zap className="w-4 h-4" /> },
  { id: 'mesa', label: 'Mesa', icon: <Dice5 className="w-4 h-4" /> },
  { id: 'casual', label: 'Casual', icon: <Coffee className="w-4 h-4" /> },
  { id: 'favoritos', label: 'Favoritos', icon: <Star className="w-4 h-4" /> },
];

export function CategoryChips({
  currentCategory,
  onSelectCategory,
  counts,
}: CategoryChipsProps) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none no-scrollbar">
      {CATEGORIES.map((cat) => {
        const isActive = currentCategory === cat.id;
        const count = counts[cat.id] ?? 0;

        return (
          <button
            key={cat.id}
            onClick={() => onSelectCategory(cat.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all duration-200 whitespace-nowrap cursor-pointer select-none ${
              isActive
                ? 'bg-gradient-to-r from-[#ff4d7a] to-[#e8365d] text-white shadow-[0_0_15px_rgba(255,77,122,0.4)] scale-[1.02]'
                : 'bg-white/[0.05] hover:bg-white/[0.1] text-[#b7a3ad] hover:text-[#f5eef2] border border-white/5 hover:border-white/10'
            }`}
          >
            {cat.icon}
            <span>{cat.label}</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                isActive
                  ? 'bg-black/30 text-white'
                  : 'bg-white/10 text-[#b7a3ad]'
              }`}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
