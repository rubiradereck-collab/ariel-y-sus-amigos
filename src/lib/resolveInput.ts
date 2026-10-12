import { extractYouTubeId } from '@/lib/youtube'

export type Resolved =
  | { type: 'ytVideo'; videoId: string }
  | { type: 'ytPlaylist'; listId: string; alsoVideoId?: string }
  | { type: 'ytPlaylistUnsupported'; reason: string }
  | { type: 'soundcloud'; url: string }
  | { type: 'spotify'; kind: 'track' | 'playlist' | 'album'; id: string }
  | { type: 'audioUrl'; url: string }
  | { type: 'search'; query: string; forceList: boolean }

const HOSTS = /^(www\.|m\.|music\.)?(youtube\.com|youtu\.be|soundcloud\.com|on\.soundcloud\.com|open\.spotify\.com)\//i

export function resolveInput(raw: string): Resolved {
  let text = raw.trim()
  let forceList = false

  const cmd = text.match(/^[/!](play|p|search|s|playlist)\s+/i)
  if (cmd) {
    forceList = /^(search|s)$/i.test(cmd[1])
    text = text.slice(cmd[0].length).trim()
  }

  if (HOSTS.test(text)) text = 'https://' + text

  let u: URL | null = null
  try {
    if (/^https?:\/\//i.test(text)) u = new URL(text)
  } catch {
    /* no es URL */
  }

  if (!u) return { type: 'search', query: text, forceList }

  const host = u.hostname.replace(/^(www|m|music)\./, '')

  // 1. YouTube
  if (host === 'youtube.com' || host === 'youtu.be') {
    const list = u.searchParams.get('list')
    const v = extractYouTubeId(u.toString())
    const importable = !!list && !/^(RD|UL|LL|WL)/.test(list)

    if (u.pathname === '/playlist' && list) {
      return importable
        ? { type: 'ytPlaylist', listId: list }
        : { type: 'ytPlaylistUnsupported', reason: 'Las listas automáticas o privadas (Mix, Me gusta) no se pueden importar.' }
    }

    if (v && list && importable) {
      return { type: 'ytPlaylist', listId: list, alsoVideoId: v }
    }

    if (v) {
      return { type: 'ytVideo', videoId: v }
    }

    return { type: 'search', query: text, forceList }
  }

  // 2. SoundCloud
  if (host.endsWith('soundcloud.com')) {
    return { type: 'soundcloud', url: u.toString() }
  }

  // 3. Spotify
  if (host === 'open.spotify.com') {
    const m = u.pathname.match(/\/(?:intl-[a-z]+\/)?(track|playlist|album)\/([A-Za-z0-9]+)/)
    if (m) {
      return { type: 'spotify', kind: m[1] as 'track' | 'playlist' | 'album', id: m[2] }
    }
  }

  // 4. URL directa de audio
  if (u.protocol === 'https:' && /\.(mp3|wav|ogg|m4a|aac)($|\?)/i.test(u.pathname)) {
    return { type: 'audioUrl', url: u.toString() }
  }

  if (u.protocol === 'https:') {
    return { type: 'audioUrl', url: u.toString() }
  }

  return { type: 'search', query: text, forceList }
}
