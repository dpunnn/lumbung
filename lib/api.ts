// lib/api.ts
// Thin fetch client ke API Gateway Go (:8080). Pengganti lib/supabase.ts.
const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'

// In-memory access token (bukan localStorage — lebih aman, hilang saat refresh = re-login).
// Refresh token disimpan di httpOnly cookie oleh auth-svc.
let _accessToken: string | null = null

export function setAccessToken(token: string | null) {
  _accessToken = token
}

export function getAccessToken(): string | null {
  return _accessToken
}

interface APIErrorBody {
  error?: { message?: string }
}

interface RefreshResponse {
  access_token: string
}

export interface FetchOptions extends RequestInit {
  skipAuth?: boolean
}

async function fetchAPI<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { skipAuth = false, ...init } = options

  const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData

  const headers: Record<string, string> = {
    // Jangan set Content-Type untuk FormData — browser mengisi boundary multipart sendiri.
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...((init.headers as Record<string, string> | undefined) ?? {}),
  }

  if (!skipAuth && _accessToken) {
    headers['Authorization'] = `Bearer ${_accessToken}`
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers,
    credentials: 'include', // kirim cookie refresh_token
  })

  // Auto-refresh jika 401 (token kedaluwarsa)
  if (res.status === 401 && !skipAuth) {
    const refreshed = await tryRefresh()
    if (refreshed) {
      headers['Authorization'] = `Bearer ${_accessToken}`
      const retry = await fetch(`${BASE_URL}${path}`, { ...init, headers, credentials: 'include' })
      if (!retry.ok) {
        const err = (await retry.json().catch(() => ({}))) as APIErrorBody
        throw new APIError(err.error?.message ?? 'Request gagal', retry.status)
      }
      if (retry.status === 204) return undefined as T
      return retry.json() as Promise<T>
    }
    throw new APIError('Sesi berakhir, silakan login ulang', 401)
  }

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as APIErrorBody
    throw new APIError(err.error?.message ?? 'Terjadi kesalahan', res.status)
  }

  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

async function tryRefresh(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    })
    if (!res.ok) return false
    const data = (await res.json()) as RefreshResponse
    setAccessToken(data.access_token)
    return true
  } catch {
    return false
  }
}

export class APIError extends Error {
  constructor(message: string, public status: number) {
    super(message)
    this.name = 'APIError'
  }
}

// API helpers
export const api = {
  get: <T>(path: string, opts?: FetchOptions) =>
    fetchAPI<T>(path, { method: 'GET', ...opts }),

  post: <T>(path: string, body?: unknown, opts?: FetchOptions) =>
    fetchAPI<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined, ...opts }),

  put: <T>(path: string, body?: unknown, opts?: FetchOptions) =>
    fetchAPI<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined, ...opts }),

  patch: <T>(path: string, body?: unknown, opts?: FetchOptions) =>
    fetchAPI<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined, ...opts }),

  delete: <T>(path: string, opts?: FetchOptions) =>
    fetchAPI<T>(path, { method: 'DELETE', ...opts }),

  // Upload multipart/form-data (untuk foto Saksi AI).
  // Content-Type sengaja TIDAK di-set agar browser mengisi boundary multipart otomatis.
  upload: <T>(path: string, form: FormData, opts?: FetchOptions) => {
    const headers: Record<string, string> = {}
    if (_accessToken) headers['Authorization'] = `Bearer ${_accessToken}`
    return fetchAPI<T>(path, {
      method: 'POST',
      body: form,
      ...opts,
      headers: { ...headers, ...((opts?.headers as Record<string, string> | undefined) ?? {}) },
    })
  },
}

export default api
