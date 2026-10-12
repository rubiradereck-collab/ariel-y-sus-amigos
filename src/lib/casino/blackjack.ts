import { Card } from '@/types/entrega3'

export const SUITS = ['♠', '♥', '♦', '♣'] as const
export const SUIT_NAMES = ['picas', 'corazones', 'diamantes', 'treboles'] as const
export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const

export function cardRank(c: Card): (typeof RANKS)[number] {
  return RANKS[c % 13]
}

export function cardSuit(c: Card): (typeof SUITS)[number] {
  return SUITS[Math.floor(c / 13)]
}

export function isCardRed(c: Card): boolean {
  const s = Math.floor(c / 13)
  return s === 1 || s === 2 // Corazones o Diamantes
}

export function cardLabel(c: Card): string {
  return `${cardRank(c)}${cardSuit(c)}`
}

export function handTotal(cards: Card[]): { total: number; isSoft: boolean; isBlackjack: boolean } {
  let total = 0
  let aces = 0

  for (const c of cards) {
    const r = c % 13
    if (r === 0) {
      aces += 1
      total += 11
    } else if (r >= 9) {
      total += 10
    } else {
      total += r + 1
    }
  }

  while (total > 21 && aces > 0) {
    total -= 10
    aces -= 1
  }

  const isSoft = aces > 0
  const isBlackjack = cards.length === 2 && total === 21

  return { total, isSoft, isBlackjack }
}
