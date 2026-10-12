export interface YTPlayer {
  playVideo(): void
  pauseVideo(): void
  seekTo(seconds: number, allowSeekAhead: boolean): void
  getCurrentTime(): number
  getDuration(): number
  getPlayerState(): number
  loadVideoById(options: { videoId: string; startSeconds?: number }): void
  setVolume(volume: number): void
  destroy(): void
}

export interface YTPlayerEvent {
  target: YTPlayer
  data: number
}

interface YTPlayerOptions {
  videoId?: string
  width?: string | number
  height?: string | number
  playerVars?: Record<string, number | string>
  events?: {
    onReady?: (e: YTPlayerEvent) => void
    onStateChange?: (e: YTPlayerEvent) => void
    onError?: (e: YTPlayerEvent) => void
  }
}

export interface YTNamespace {
  Player: new (element: HTMLElement, options: YTPlayerOptions) => YTPlayer
}

declare global {
  interface Window {
    YT?: YTNamespace
    onYouTubeIframeAPIReady?: () => void
  }
}

export const YT_STATE = { ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 } as const

let apiPromise: Promise<YTNamespace> | null = null

/** Carga el script de la IFrame API una sola vez, aunque lo pidan varios componentes. */
export function loadYouTubeApi(): Promise<YTNamespace> {
  if (typeof window === 'undefined') return Promise.reject(new Error('YouTube API: solo en el navegador'))
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT)
  if (apiPromise) return apiPromise

  apiPromise = new Promise<YTNamespace>((resolve) => {
    const previous = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      previous?.()
      if (window.YT) resolve(window.YT)
    }
    const script = document.createElement('script')
    script.src = 'https://www.youtube.com/iframe_api'
    script.async = true
    document.head.appendChild(script)
  })
  return apiPromise
}

const YT_REGEX = /^.*(?:youtu\.be\/|youtube\.com\/(?:v\/|u\/\w\/|embed\/|shorts\/|watch\?v=|watch\?.*&v=))([A-Za-z0-9_-]{11}).*/

export function extractYouTubeId(url: string): string | null {
  const match = url.trim().match(YT_REGEX)
  return match ? match[1] : null
}
