import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname

  // Route publik — tidak butuh auth
  const isPassPublic = /^\/pass\/[^/]+$/.test(path)
  const isAuthRoute = path === '/login' || path === '/daftar'

  // Route per-tier
  const isDashboard = path.startsWith('/dashboard') ||
    ['/ternak', '/pakan', '/simpan-pinjam', '/pass', '/insight', '/lens', '/guard', '/pengadaan']
      .some(p => path.startsWith(p))
  const isAdmin = path.startsWith('/admin')
  const isMember = path.startsWith('/member')
  const isAtlas = path.startsWith('/atlas')

  const isProtected = !isPassPublic && (isDashboard || isAdmin || isMember || isAtlas)

  // Belum login → ke /login
  if (!user && isProtected) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Sudah login, akses auth route → redirect sesuai role
  if (user && isAuthRoute) {
    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()

    const role = profile?.role ?? 'anggota'

    if (role === 'superadmin') return NextResponse.redirect(new URL('/admin', request.url))
    if (role === 'anggota') return NextResponse.redirect(new URL('/member', request.url))
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Sudah login, cek akses ke tier yang salah
  if (user && isProtected) {
    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()

    const role = profile?.role ?? 'anggota'

    // superadmin coba akses /dashboard atau /member → ke /admin
    if (role === 'superadmin' && !isAdmin) {
      return NextResponse.redirect(new URL('/admin', request.url))
    }

    // anggota coba akses /dashboard atau /admin → ke /member
    if (role === 'anggota' && !isMember) {
      return NextResponse.redirect(new URL('/member', request.url))
    }

    // pengurus/kasir coba akses /admin → ke /dashboard
    if ((role === 'pengurus' || role === 'kasir') && isAdmin) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|icons).*)'],
}
