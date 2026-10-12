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

export async function GET(req: Request) {
  // Solo usuarios con sesión: evita que cualquiera use tu API key o la ruta como proxy.
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {
          // Ruta de solo lectura: no se renuevan cookies aquí.
        },
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

  // 1) Título y miniatura de un enlace de YouTube (sin API key)
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

  // 2) Búsqueda (requiere YOUTUBE_API_KEY en las variables de entorno)
  if (q) {
    const key = process.env.YOUTUBE_API_KEY
    if (!key) return NextResponse.json({ error: 'no_api_key' }, { status: 503 })
    try {
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=8&q=${encodeURIComponent(
          q.slice(0, 100)
        )}&key=${key}`,
        { cache: 'no-store' }
      )
      if (!res.ok) return NextResponse.json({ error: 'upstream_error' }, { status: 502 })
      const data = (await res.json()) as YouTubeSearchResponse
      const results = (data.items ?? [])
        .filter((i) => i.id.videoId)
        .map((i) => ({
          videoId: i.id.videoId as string,
          title: decodeEntities(i.snippet.title),
          channel: decodeEntities(i.snippet.channelTitle),
          thumb: i.snippet.thumbnails?.medium?.url ?? i.snippet.thumbnails?.default?.url ?? null,
        }))
      return NextResponse.json({ results })
    } catch {
      return NextResponse.json({ error: 'upstream_error' }, { status: 502 })
    }
  }

  return NextResponse.json({ error: 'missing_params' }, { status: 400 })
}
