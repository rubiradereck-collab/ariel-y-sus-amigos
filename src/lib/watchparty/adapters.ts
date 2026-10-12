import { WpVideoType } from '@/types/entrega3'

export function detectVideoType(url: string): WpVideoType {
  const clean = url.trim()
  if (/(?:youtube\.com|youtu\.be)/i.test(clean)) {
    return 'youtube'
  }
  if (/\.m3u8($|\?)/i.test(clean)) {
    return 'hls'
  }
  return 'file'
}

export interface VideoPlayerAdapter {
  play: () => Promise<void>
  pause: () => void
  seek: (seconds: number) => void
  getCurrentTime: () => number
  setPlaybackRate: (rate: number) => void
  destroy: () => void
}
