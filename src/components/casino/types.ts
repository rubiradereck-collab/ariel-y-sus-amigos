import type { Stats } from '@/lib/rpg'
export interface CasinoProps {
  stats: Stats | null
  notify: (msg: string, type?: 'ok' | 'err' | 'info') => void
}
export const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))
