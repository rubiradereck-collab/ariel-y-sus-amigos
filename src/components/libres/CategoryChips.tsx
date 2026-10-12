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
    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none no-scrollbar">
      {CATEGORIES.map((cat) => {
        const isActive = currentCategory === cat.id;
        const count = counts[cat.id] ?? 0;

        return (
          <button
            key={cat.id}
            onClick={() => onSelectCategory(cat.id)}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap select-none ${
              isActive
                ? 'bg-white text-black shadow-md scale-[1.02]'
                : 'bg-zinc-900/70 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-white/5'
            }`}
          >
            {cat.icon}
            <span>{cat.label}</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                isActive
                  ? 'bg-black/15 text-black'
                  : 'bg-white/10 text-zinc-400'
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
