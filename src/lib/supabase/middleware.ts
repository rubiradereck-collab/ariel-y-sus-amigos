import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_PAGES = ['/login', '/auth/callback']

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  const isApi = path.startsWith('/api/')
  const isCron = path.startsWith('/api/cron/') // Valida su propio token Bearer / CRON_SECRET
  const isPublicPage = PUBLIC_PAGES.some((p) => path === p || path.startsWith(p + '/'))

  const redirectTo = (pathname: string, next?: string) => {
    const url = request.nextUrl.clone()
    url.pathname = pathname
    url.search = next ? `?next=${encodeURIComponent(next)}` : ''
    const r = NextResponse.redirect(url)
    response.cookies.getAll().forEach((c) => r.cookies.set(c)) // Conserva cookies refrescadas
    return r
  }

  // Permitir endpoints de cron para su propia validación de token
  if (isCron) return response

  // Si no hay usuario autenticado
  if (!user) {
    if (isApi) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    if (!isPublicPage) return redirectTo('/login', path)
    return response
  }

  // Si ya está autenticado e intenta ir al login
  if (path === '/login') return redirectTo('/')

  return response
}
