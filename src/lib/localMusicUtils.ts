import type { LocalTrack } from './localMusicDb'

export function getAudioDuration(file: File | Blob): Promise<number> {
  return new Promise((resolve) => {
    try {
      const url = URL.createObjectURL(file)
      const audio = new Audio(url)
      audio.preload = 'metadata'
      const cleanup = () => {
        URL.revokeObjectURL(url)
        audio.removeEventListener('loadedmetadata', onLoaded)
        audio.removeEventListener('error', onError)
      }
      const onLoaded = () => {
        const d = Math.round(audio.duration || 0)
        cleanup()
        resolve(d)
      }
      const onError = () => {
        cleanup()
        resolve(0)
      }
      audio.addEventListener('loadedmetadata', onLoaded)
      audio.addEventListener('error', onError)
    } catch {
      resolve(0)
    }
  })
}

export function parseFilenameMetadata(name: string): { title: string; artist: string } {
  // Quitar extensión
  const base = name.replace(/\.[a-zA-Z0-9]+$/, '').replace(/_/g, ' ').trim()
  // Intentar "Artista - Título"
  const match = base.match(/^(.+?)\s+-\s+(.+)$/)
  if (match) {
    return {
      artist: match[1].trim(),
      title: match[2].trim(),
    }
  }
  return {
    artist: 'Desconocido',
    title: base || 'Sin título',
  }
}

export type SortKey = 'title' | 'artist' | 'added' | 'duration'
export type SortDir = 'asc' | 'desc'

const collator = new Intl.Collator('es', { sensitivity: 'base', numeric: true })

export function sortTracks(tracks: LocalTrack[], key: SortKey, dir: SortDir = 'asc'): LocalTrack[] {
  const sorted = [...tracks].sort((a, b) => {
    if (key === 'added') {
      return a.addedAt - b.addedAt
    }
    if (key === 'duration') {
      return a.durationSec - b.durationSec
    }
    if (key === 'artist') {
      const aIsUnknown = !a.artist || a.artist === 'Desconocido'
      const bIsUnknown = !b.artist || b.artist === 'Desconocido'
      if (aIsUnknown && !bIsUnknown) return 1
      if (!aIsUnknown && bIsUnknown) return -1
      const cmp = collator.compare(a.artist, b.artist)
      return cmp !== 0 ? cmp : collator.compare(a.title, b.title)
    }
    // Por defecto title
    const cmp = collator.compare(a.title, b.title)
    return cmp !== 0 ? cmp : collator.compare(a.artist, b.artist)
  })

  return dir === 'desc' ? sorted.reverse() : sorted
}

export function shuffleArray<T>(array: T[], preserveFirst?: T): T[] {
  const arr = [...array]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  if (preserveFirst !== undefined) {
    const idx = arr.indexOf(preserveFirst)
    if (idx > -1) {
      arr.splice(idx, 1)
      arr.unshift(preserveFirst)
    }
  }
  return arr
}

export function formatDuration(sec: number): string {
  if (!sec || isNaN(sec)) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s < 10 ? '0' : ''}${s}`
}
