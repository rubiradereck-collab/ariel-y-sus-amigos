import { SlotSymbol } from '@/types/entrega3'

export const ROULETTE_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20,
  14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
]

export const RED_NUMBERS = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
])

export const SLOT_SYMBOLS: SlotSymbol[] = [
  'cherry',
  'lemon',
  'bell',
  'star',
  'diamond',
  'seven',
]

export const SLOT_EMOJIS: Record<SlotSymbol, string> = {
  cherry: '🍒',
  lemon: '🍋',
  bell: '🔔',
  star: '⭐',
  diamond: '💎',
  seven: '7️⃣',
}

export const SLOT_LABELS: Record<SlotSymbol, string> = {
  cherry: 'Cerezas',
  lemon: 'Limones',
  bell: 'Campanas',
  star: 'Estrellas',
  diamond: 'Diamantes',
  seven: 'Sietes',
}

export const SLOT_PAYTABLE: Record<SlotSymbol, number> = {
  cherry: 5,
  lemon: 8,
  bell: 15,
  star: 40,
  diamond: 100,
  seven: 250,
}
