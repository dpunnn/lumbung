'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { login } from '@/lib/auth'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login({ email, password })
      router.push('/dashboard')
    } catch {
      setError('Email atau password salah.')
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-amber-700 mb-3 shadow-sm">
          <span className="text-white text-xl font-black">L</span>
        </div>
        <h1 className="text-stone-900 text-2xl font-bold tracking-tight">LUMBUNG</h1>
        <p className="text-stone-500 text-sm mt-1">Sistem Operasi Koperasi</p>
      </div>

      <form onSubmit={handleLogin}
        className="bg-white border border-stone-200 rounded-2xl p-6 space-y-4 shadow-sm">
        <div>
          <label className="block text-stone-700 text-sm font-medium mb-1.5">Email</label>
          <input
            type="email" required value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="pengurus@koperasi.id"
            className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2.5
                       text-stone-900 placeholder-stone-400 text-sm
                       focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-500 transition-colors"
          />
        </div>

        <div>
          <label className="block text-stone-700 text-sm font-medium mb-1.5">Password</label>
          <input
            type="password" required value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2.5
                       text-stone-900 placeholder-stone-400 text-sm
                       focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-500 transition-colors"
          />
        </div>

        {error && (
          <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <button type="submit" disabled={loading}
          className="w-full bg-amber-700 hover:bg-amber-800 disabled:opacity-50
                     text-white font-semibold rounded-lg px-4 py-2.5 text-sm
                     transition-colors shadow-sm">
          {loading ? 'Masuk...' : 'Masuk'}
        </button>

        <p className="text-center text-stone-500 text-sm">
          Belum punya akun?{' '}
          <Link href="/daftar" className="text-amber-700 hover:text-amber-800 font-medium">Daftar</Link>
        </p>
      </form>
    </div>
  )
}
