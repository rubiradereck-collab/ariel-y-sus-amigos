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
  if (!s) return ''
  return s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

function parseDurationText(text?: string): number {
  if (!text) return 0
  const parts = text.trim().split(':').map((p) => parseInt(p, 10))
  if (parts.some((p) => isNaN(p))) return 0
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  return 0
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

// Fallback público de búsqueda sin API Key (scrape zero-key de YouTube)
async function searchYouTubeZeroKey(query: string): Promise<{
  videoId: string
  title: string
  channel: string
  thumb: string | null
  durationSec: number
}[]> {
  try {
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=EgIQAQ%253D%253D`
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'es-419,es;q=0.9,en;q=0.8',
      },
      cache: 'no-store',
    })
    if (!res.ok) return []
    const html = await res.text()
    const match = html.match(/var ytInitialData\s*=\s*({.+?});<\/script>/)
    if (!match) return []

    const data = JSON.parse(match[1])
    const sectionList =
      data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents
    if (!Array.isArray(sectionList)) return []

    const results: {
      videoId: string
      title: string
      channel: string
      thumb: string | null
      durationSec: number
    }[] = []

    for (const section of sectionList) {
      const items = section?.itemSectionRenderer?.contents
      if (!Array.isArray(items)) continue

      for (const item of items) {
        if (item?.videoRenderer) {
          const vr = item.videoRenderer
          if (!vr.videoId) continue
          const videoId = vr.videoId
          const title = vr.title?.runs?.map((r: any) => r.text).join('') || vr.title?.simpleText || ''
          const channel =
            vr.ownerText?.runs?.map((r: any) => r.text).join('') ||
            vr.shortBylineText?.runs?.map((r: any) => r.text).join('') ||
            ''
          const thumb =
            vr.thumbnail?.thumbnails?.[vr.thumbnail.thumbnails.length - 1]?.url ||
            `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`
          const lengthText =
            vr.lengthText?.simpleText || vr.lengthText?.runs?.map((r: any) => r.text).join('') || ''

          results.push({
            videoId,
            title: decodeEntities(title),
            channel: decodeEntities(channel),
            thumb,
            durationSec: parseDurationText(lengthText),
          })
        } else if (item?.lockupViewModel) {
          const lvm = item.lockupViewModel
          const videoId = lvm.contentId
          if (!videoId) continue
          const title = lvm.metadata?.lockupMetadataViewModel?.title?.content || ''
          const channel =
            lvm.metadata?.lockupMetadataViewModel?.metadata?.contentMetadataViewModel?.metadataRows?.[0]
              ?.metadataParts?.[0]?.text?.content || ''
          const thumb =
            lvm.contentImage?.thumbnailViewModel?.image?.sources?.[0]?.url ||
            `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`

          results.push({
            videoId,
            title: decodeEntities(title),
            channel: decodeEntities(channel),
            thumb,
            durationSec: 0,
          })
        }

        if (results.length >= 8) break
      }
      if (results.length >= 8) break
    }

    return results
  } catch (err) {
    console.error('Zero-key search failed:', err)
    return []
  }
}

// Fallback público de playlists sin API Key
async function scrapeYouTubePlaylistZeroKey(playlistId: string, maxItems: number = 100): Promise<{
  title: string
  total: number
  truncated: boolean
  items: {
    videoId: string
    title: string
    channel: string
    thumb: string | null
    durationSec: number
  }[]
} | null> {
  try {
    const url = `https://www.youtube.com/playlist?list=${encodeURIComponent(playlistId)}`
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'es-419,es;q=0.9,en;q=0.8',
      },
      cache: 'no-store',
    })
    if (!res.ok) return null
    const html = await res.text()
    const match = html.match(/var ytInitialData\s*=\s*({.+?});<\/script>/)
    if (!match) return null

    const data = JSON.parse(match[1])
    const plTitle =
      data?.metadata?.playlistMetadataRenderer?.title ||
      data?.header?.playlistHeaderRenderer?.title?.simpleText ||
      'Playlist de YouTube'

    const sec = data?.contents?.twoColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer
    const itemSec = sec?.contents?.[0]?.itemSectionRenderer
    const rawList = itemSec?.contents || []

    const items: {
      videoId: string
      title: string
      channel: string
      thumb: string | null
      durationSec: number
    }[] = []

    for (const it of rawList) {
      if (it?.lockupViewModel) {
        const lvm = it.lockupViewModel
        const videoId = lvm.contentId
        const title = lvm.metadata?.lockupMetadataViewModel?.title?.content || ''
        const channel =
          lvm.metadata?.lockupMetadataViewModel?.metadata?.contentMetadataViewModel?.metadataRows?.[0]
            ?.metadataParts?.[0]?.text?.content || ''
        const thumb =
          lvm.contentImage?.thumbnailViewModel?.image?.sources?.[0]?.url ||
          `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`
        if (videoId && title) {
          items.push({
            videoId,
            title: decodeEntities(title),
            channel: decodeEntities(channel),
            thumb,
            durationSec: 0,
          })
        }
      } else if (it?.playlistVideoRenderer) {
        const p = it.playlistVideoRenderer
        const videoId = p.videoId
        const title = p.title?.runs?.[0]?.text || p.title?.simpleText || ''
        const channel = p.shortBylineText?.runs?.[0]?.text || ''
        const thumb = p.thumbnail?.thumbnails?.[0]?.url || `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`
        const lengthText = p.lengthText?.simpleText || ''
        if (videoId && title) {
          items.push({
            videoId,
            title: decodeEntities(title),
            channel: decodeEntities(channel),
            thumb,
            durationSec: parseDurationText(lengthText),
          })
        }
      }
      if (items.length >= maxItems) break
    }

    return {
      title: plTitle,
      total: items.length,
      truncated: false,
      items,
    }
  } catch (err) {
    console.error('Zero-key playlist scrape failed:', err)
    return null
  }
}

export async function GET(req: Request) {
  // Nota: Verificación de sesión no bloquea búsquedas públicas
  try {
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
    await supabase.auth.getUser()
  } catch {
    // Si falla el cookieStore en background, continuar de manera segura
  }

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
      if (!res.ok) {
        return NextResponse.json({
          videoId: id,
          title: 'Video de YouTube',
          channel: '',
          thumb: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
        })
      }
      const data = (await res.json()) as OEmbedResponse
      return NextResponse.json({
        videoId: id,
        title: data.title,
        channel: data.author_name,
        thumb: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
      })
    } catch {
      return NextResponse.json({
        videoId: id,
        title: 'Video de YouTube',
        channel: '',
        thumb: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
      })
    }
  }

  // 2) Importación de Playlist de YouTube
  if (playlistId) {
    const key = process.env.YOUTUBE_API_KEY
    const maxItems = Math.min(100, parseInt(searchParams.get('max') || '100', 10))

    if (!key) {
      // Usar scraper zero-key
      const plData = await scrapeYouTubePlaylistZeroKey(playlistId, maxItems)
      if (plData && plData.items.length > 0) {
        return NextResponse.json(plData)
      }
      return NextResponse.json({ error: 'not_found' }, { status: 404 })
    }

    try {
      // Info de la playlist con API Key
      const plRes = await fetch(
        `https://www.googleapis.com/youtube/v3/playlists?part=snippet,contentDetails&id=${playlistId}&key=${key}`,
        { cache: 'no-store' }
      )
      if (!plRes.ok) {
        // Fallback a scraper si la key falló
        const fallback = await scrapeYouTubePlaylistZeroKey(playlistId, maxItems)
        if (fallback) return NextResponse.json(fallback)
        return NextResponse.json({ error: 'upstream_error' }, { status: 502 })
      }
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
      const fallback = await scrapeYouTubePlaylistZeroKey(playlistId, maxItems)
      if (fallback) return NextResponse.json(fallback)
      return NextResponse.json({ error: 'upstream_error' }, { status: 502 })
    }
  }

  // 3) Búsqueda inteligente por texto
  if (q) {
    const cleanQ = q.trim().slice(0, 100)
    const key = process.env.YOUTUBE_API_KEY

    // Si no hay key, usar scraper zero-key directamente
    if (!key) {
      const zeroResults = await searchYouTubeZeroKey(cleanQ)
      zeroResults.sort((a, b) => {
        const idxA = zeroResults.indexOf(a)
        const idxB = zeroResults.indexOf(b)
        return scoreResult(b, cleanQ, idxB) - scoreResult(a, cleanQ, idxA)
      })
      return NextResponse.json({ results: zeroResults })
    }

    try {
      let searchRes = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoCategoryId=10&videoEmbeddable=true&maxResults=8&q=${encodeURIComponent(
          cleanQ
        )}&key=${key}`,
        { cache: 'no-store' }
      )

      let sData = (await searchRes.json()) as YouTubeSearchResponse
      if (!sData.items || sData.items.length === 0) {
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
        // Fallback a scraper zero-key
        const zeroResults = await searchYouTubeZeroKey(cleanQ)
        return NextResponse.json({ results: zeroResults })
      }

      // Detalle de videos
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

        filtered.sort((a, b) => {
          const idxA = rawResults.indexOf(a)
          const idxB = rawResults.indexOf(b)
          return scoreResult(b, cleanQ, idxB) - scoreResult(a, cleanQ, idxA)
        })

        return NextResponse.json({ results: filtered })
      }

      return NextResponse.json({ results: rawResults })
    } catch {
      // Fallback a scraper zero-key en caso de error upstream con Google
      const zeroResults = await searchYouTubeZeroKey(cleanQ)
      return NextResponse.json({ results: zeroResults })
    }
  }

  return NextResponse.json({ error: 'missing_params' }, { status: 400 })
}
