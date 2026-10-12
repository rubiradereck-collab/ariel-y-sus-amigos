import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { extractYouTubeId } from '@/lib/youtube'

interface YouTubeSearchItem {
  id: { videoId?: string }
  snippet: {
    title: string
    channelTitle: string
    thumbnails?: { medium?: { url: string }; default?: { url: string } }
  }
}

interface YouTubeSearchResponse {
  items?: YouTubeSearchItem[]
}

interface YouTubeVideoItem {
  id: string
  contentDetails?: { duration?: string }
  status?: { embeddable?: boolean }
}

interface YouTubeVideosResponse {
  items?: YouTubeVideoItem[]
}

interface YouTubePlaylistsResponse {
  items?: {
    snippet?: { title?: string }
    contentDetails?: { itemCount?: number }
  }[]
}

interface YouTubePlaylistItemsResponse {
  nextPageToken?: string
  items?: {
    contentDetails?: { videoId?: string }
    snippet?: {
      title?: string
      videoOwnerChannelTitle?: string
      thumbnails?: { medium?: { url: string }; default?: { url: string } }
    }
  }[]
}

interface OEmbedResponse {
  title: string
  author_name: string
  thumbnail_url: string
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

function parseIsoDuration(iso?: string): number {
  if (!iso) return 0
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return 0
  const hours = parseInt(match[1] || '0', 10)
  const minutes = parseInt(match[2] || '0', 10)
  const seconds = parseInt(match[3] || '0', 10)
  return hours * 3600 + minutes * 60 + seconds
}

const BAD_TERMS = /\b(karaoke|cover|reaction|reacci[oó]n|loop|1 ?hour|slowed|nightcore|sped ?up|8d)\b/i

function scoreResult(
  r: { title: string; channel: string; durationSec: number },
  query: string,
  index: number
): number {
  let s = -index * 0.1
  if (/- topic$/i.test(r.channel)) s += 3
  if (/vevo$/i.test(r.channel) || /official/i.test(r.title)) s += 2
  const m = BAD_TERMS.exec(r.title)
  if (m && !query.toLowerCase().includes(m[1].toLowerCase())) s -= 4
  if (r.durationSec > 600 || (r.durationSec > 0 && r.durationSec < 45)) s -= 3
  return s
}

export async function GET(req: Request) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  )
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')
  const url = searchParams.get('url')
  const playlistId = searchParams.get('playlist')

  // 1) Enlace directo (oEmbed sin gastar API key)
  if (url) {
    const id = extractYouTubeId(url)
    if (!id) return NextResponse.json({ error: 'invalid_url' }, { status: 400 })
    try {
      const res = await fetch(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}&format=json`,
        { cache: 'no-store' }
      )
      if (!res.ok) return NextResponse.json({ error: 'not_found' }, { status: 404 })
      const data = (await res.json()) as OEmbedResponse
      return NextResponse.json({
        videoId: id,
        title: data.title,
        channel: data.author_name,
        thumb: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
      })
    } catch {
      return NextResponse.json({ error: 'upstream_error' }, { status: 502 })
    }
  }

  // 2) Importación de Playlist de YouTube
  if (playlistId) {
    const key = process.env.YOUTUBE_API_KEY
    if (!key) return NextResponse.json({ error: 'no_api_key' }, { status: 503 })
    const maxItems = Math.min(100, parseInt(searchParams.get('max') || '100', 10))

    try {
      // Info de la playlist
      const plRes = await fetch(
        `https://www.googleapis.com/youtube/v3/playlists?part=snippet,contentDetails&id=${playlistId}&key=${key}`,
        { cache: 'no-store' }
      )
      if (!plRes.ok) return NextResponse.json({ error: 'upstream_error' }, { status: 502 })
      const plData = (await plRes.json()) as YouTubePlaylistsResponse
      if (!plData.items || plData.items.length === 0) {
        return NextResponse.json({ error: 'not_found' }, { status: 404 })
      }
      const plTitle = plData.items[0].snippet?.title || 'Playlist de YouTube'
      const totalCount = plData.items[0].contentDetails?.itemCount || 0

      // Pistas de la playlist
      const rawItems: { videoId: string; title: string; channel: string; thumb: string | null }[] = []
      let pageToken: string | undefined = undefined

      while (rawItems.length < maxItems) {
        const fetchCount = Math.min(50, maxItems - rawItems.length)
        const itemsUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&maxResults=${fetchCount}&playlistId=${playlistId}&key=${key}${
          pageToken ? `&pageToken=${pageToken}` : ''
        }`
        const itemsRes = await fetch(itemsUrl, { cache: 'no-store' })
        if (!itemsRes.ok) break
        const itemsData = (await itemsRes.json()) as YouTubePlaylistItemsResponse
        const entries = itemsData.items || []

        for (const it of entries) {
          const vId = it.contentDetails?.videoId
          const title = it.snippet?.title || ''
          if (!vId || title === 'Private video' || title === 'Deleted video') continue
          rawItems.push({
            videoId: vId,
            title: decodeEntities(title),
            channel: decodeEntities(it.snippet?.videoOwnerChannelTitle || ''),
            thumb: it.snippet?.thumbnails?.medium?.url ?? it.snippet?.thumbnails?.default?.url ?? null,
          })
        }

        pageToken = itemsData.nextPageToken
        if (!pageToken || entries.length === 0) break
      }

      // Obtener duraciones y verificar embeddable en lotes de 50
      const finalItems: { videoId: string; title: string; channel: string; thumb: string | null; durationSec: number }[] = []
      for (let i = 0; i < rawItems.length; i += 50) {
        const chunk = rawItems.slice(i, i + 50)
        const vIds = chunk.map((c) => c.videoId).join(',')
        const vRes = await fetch(
          `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,status&id=${vIds}&key=${key}`,
          { cache: 'no-store' }
        )
        if (vRes.ok) {
          const vData = (await vRes.json()) as YouTubeVideosResponse
          const vMap = new Map((vData.items || []).map((v) => [v.id, v]))
          for (const item of chunk) {
            const detail = vMap.get(item.videoId)
            if (detail?.status?.embeddable === false) continue
            finalItems.push({
              ...item,
              durationSec: parseIsoDuration(detail?.contentDetails?.duration),
            })
          }
        } else {
          // Fallback sin verificar embeddable
          chunk.forEach((c) => finalItems.push({ ...c, durationSec: 0 }))
        }
      }

      return NextResponse.json({
        title: plTitle,
        total: totalCount,
        truncated: totalCount > finalItems.length,
        items: finalItems,
      })
    } catch {
      return NextResponse.json({ error: 'upstream_error' }, { status: 502 })
    }
  }

  // 3) Búsqueda inteligente (con categoría Música, scoring y duraciones)
  if (q) {
    const key = process.env.YOUTUBE_API_KEY
    if (!key) return NextResponse.json({ error: 'no_api_key' }, { status: 503 })

    try {
      const cleanQ = q.slice(0, 100)
      // Primero intentar con categoryId=10 (Música)
      let searchRes = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoCategoryId=10&videoEmbeddable=true&maxResults=8&q=${encodeURIComponent(
          cleanQ
        )}&key=${key}`,
        { cache: 'no-store' }
      )

      let sData = (await searchRes.json()) as YouTubeSearchResponse
      if (!sData.items || sData.items.length === 0) {
        // Fallback sin categoría de música
        searchRes = await fetch(
          `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoEmbeddable=true&maxResults=8&q=${encodeURIComponent(
            cleanQ
          )}&key=${key}`,
          { cache: 'no-store' }
        )
        sData = (await searchRes.json()) as YouTubeSearchResponse
      }

      const rawResults = (sData.items ?? [])
        .filter((i) => i.id.videoId)
        .map((i) => ({
          videoId: i.id.videoId as string,
          title: decodeEntities(i.snippet.title),
          channel: decodeEntities(i.snippet.channelTitle),
          thumb: i.snippet.thumbnails?.medium?.url ?? i.snippet.thumbnails?.default?.url ?? null,
          durationSec: 0,
        }))

      if (rawResults.length === 0) {
        return NextResponse.json({ results: [] })
      }

      // Detalle de videos (duraciones y embeddable)
      const ids = rawResults.map((r) => r.videoId).join(',')
      const detailsRes = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,status&id=${ids}&key=${key}`,
        { cache: 'no-store' }
      )

      if (detailsRes.ok) {
        const dData = (await detailsRes.json()) as YouTubeVideosResponse
        const dMap = new Map((dData.items || []).map((d) => [d.id, d]))
        const filtered = rawResults.filter((r) => {
          const d = dMap.get(r.videoId)
          if (d?.status?.embeddable === false) return false
          r.durationSec = parseIsoDuration(d?.contentDetails?.duration)
          return true
        })

        // Ordenar por score para priorizar pistas oficiales sobre covers/loops
        filtered.sort((a, b) => {
          const idxA = rawResults.indexOf(a)
          const idxB = rawResults.indexOf(b)
          return scoreResult(b, cleanQ, idxB) - scoreResult(a, cleanQ, idxA)
        })

        return NextResponse.json({ results: filtered })
      }

      return NextResponse.json({ results: rawResults })
    } catch {
      return NextResponse.json({ error: 'upstream_error' }, { status: 502 })
    }
  }

  return NextResponse.json({ error: 'missing_params' }, { status: 400 })
}
