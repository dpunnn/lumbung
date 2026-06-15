import { NextResponse, type NextRequest } from 'next/server'

// Auth gate berbasis cookie refresh_token (httpOnly, di-set auth-svc).
// Access token disimpan in-memory di client, jadi middleware (server-side) hanya
// memakai keberadaan refresh_token sebagai proxy "sudah login".
// Verifikasi JWT yang sebenarnya tetap dilakukan Gateway pada tiap request API.
export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  // Pass public: /pass/[token] bisa diakses siapa saja
  const isPassPublic = /^\/pass\/[^/]+$/.test(path)
  // Auth routes
  const isAuthRoute = path === '/login' || path === '/daftar'
  // Marketplace publik
  const isMarketplace = path.startsWith('/produk') || path === '/toko'

  // Protected routes
  const isProtected = !isPassPublic && !isAuthRoute && !isMarketplace && (
    path.startsWith('/dashboard') ||
    path.startsWith('/admin') ||
    path.startsWith('/member') ||
    path.startsWith('/ternak') ||
    path.startsWith('/pakan') ||
    path.startsWith('/simpan-pinjam') ||
    path.startsWith('/pass') ||
    path.startsWith('/insight') ||
    path.startsWith('/lens') ||
    path.startsWith('/guard') ||
    path.startsWith('/pengadaan') ||
    path.startsWith('/atlas')
  )

  const hasRefreshCookie = request.cookies.has('refresh_token')

  // Di dev (HTTP), cookie Secure tidak tersimpan browser → skip server-side check.
  // Proteksi route ditangani client-side di dashboard layout (getMe() → redirect /login).
  const isDev = process.env.NODE_ENV === 'development'

  if (!isDev && isProtected && !hasRefreshCookie) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (!isDev && isAuthRoute && hasRefreshCookie) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|icons|public).*)'],
}
