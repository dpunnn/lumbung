// lib/auth.ts
// Helper autentikasi client-side via auth-svc (lewat Gateway).
import api, { setAccessToken, getAccessToken } from './api'

export interface UserProfile {
  id: string
  email: string
  username: string
  role: string
  koperasi_id: string | null
}

export interface LoginInput {
  email: string
  password: string
  koperasi_id?: string
}

export interface RegisterInput {
  username: string
  email: string
  password: string
  koperasi_id?: string
  role?: string
}

export async function login(input: LoginInput): Promise<{ access_token: string }> {
  const data = await api.post<{ access_token: string }>('/api/auth/login', input, { skipAuth: true })
  setAccessToken(data.access_token)
  return data
}

export async function logout(): Promise<void> {
  try {
    await api.post('/api/auth/logout')
  } finally {
    setAccessToken(null)
  }
}

export async function getMe(): Promise<UserProfile | null> {
  if (!getAccessToken()) return null
  try {
    return await api.get<UserProfile>('/api/auth/me')
  } catch {
    return null
  }
}

export async function register(input: RegisterInput): Promise<UserProfile> {
  return api.post<UserProfile>('/api/auth/register', input, { skipAuth: true })
}

export function isLoggedIn(): boolean {
  return getAccessToken() !== null
}
