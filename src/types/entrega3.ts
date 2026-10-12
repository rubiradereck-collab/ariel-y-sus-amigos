export type Card = number // 0..51 → rank = c%13, suit = ⌊c/13⌋
export type BjResult = 'win' | 'lose' | 'push' | 'blackjack'

export interface BjState {
  id: string
  status: 'playing' | 'finished'
  bet: number
  doubled: boolean
  player: Card[]
  player_total: number
  dealer: Card[] // en 'playing' solo trae la carta visible
  dealer_total: number | null
  dealer_hidden: boolean
  result: BjResult | null
  payout: number
  balance: number
}

export type RouletteBet =
  | { type: 'red' | 'black' | 'even' | 'odd'; amount: number }
  | { type: 'dozen'; n: 1 | 2 | 3; amount: number }
  | { type: 'straight'; n: number; amount: number }

export interface RouletteResult {
  number: number
  total_bet: number
  payout: number
  balance: number
}

export type SlotSymbol = 'cherry' | 'lemon' | 'bell' | 'star' | 'diamond' | 'seven'

export interface SlotResult {
  reels: SlotSymbol[]
  multiplier: number
  payout: number
  balance: number
}

export type WpVideoType = 'file' | 'hls' | 'youtube'

export interface WpState {
  room_id: string
  video_type: WpVideoType | null
  video_url: string | null
  is_playing: boolean
  position_sec: number
  updated_at: string
  updated_by: string | null
  rev: number
}

export type WpCtrl =
  | { a: 'play' | 'pause' | 'seek'; t: number; at: number; rev: number; from: string }
  | { a: 'load'; type: WpVideoType; url: string; at: number; rev: number; from: string }
  | { a: 'hb'; t: number; playing: boolean; at: number; from: string }

export interface WpRoom {
  id: string
  name: string
  is_general: boolean
  host_id: string | null
  control: 'everyone' | 'host'
  created_at: string
}

export interface WpMessage {
  id: string
  room_id: string
  user_id: string
  content: string
  created_at: string
  profiles?: {
    username: string | null
    avatar_url: string | null
  }
}

export interface TttGame {
  id: string
  host_id: string
  guest_id: string | null
  board: string
  turn_user: string | null
  status: 'waiting' | 'playing' | 'finished'
  winner: string | null
  is_draw: boolean
  created_at: string
  updated_at: string
}

export interface ArcadeLeaderboardEntry {
  game: string
  user_id: string
  username: string | null
  avatar_url: string | null
  best: number
  last_play: string
}
