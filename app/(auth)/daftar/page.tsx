'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Koperasi = { id: string; nama: string; fokus_usaha: string }
type Tier = 'anggota' | 'pengurus'

export default function DaftarPage() {
  const router = useRouter()
  const [tier, setTier] = useState<Tier | null>(null)
  const [koperasiList, setKoperasiList] = useState<Koperasi[]>([])
  const [form, setForm] = useState({
    nama: '', email: '', password: '', konfirmasi: '',
    koperasi_id: '', role: 'pengurus',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.from('koperasi').select('id, nama, fokus_usaha').order('nama')
      .then(({ data }) => setKoperasiList(data ?? []))
  }, [])

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  async function handleDaftar(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (form.password !== form.konfirmasi) { setError('Password tidak cocok.'); return }
    if (form.password.length < 6) { setError('Password minimal 6 karakter.'); return }
    if (tier === 'pengurus' && !form.koperasi_id) { setError('Pilih koperasi terlebih dahulu.'); return }

    setLoading(true)

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
    })

    if (signUpError || !data.user) {
      setError(signUpError?.message ?? 'Gagal membuat akun.')
      setLoading(false); return
    }

    const profilePayload =
      tier === 'anggota'
        ? { id: data.user.id, role: 'anggota', nama: form.nama, koperasi_id: null }
        : { id: data.user.id, role: form.role, nama: form.nama, koperasi_id: form.koperasi_id }

    const { error: profileError } = await supabase.from('profiles').insert(profilePayload)

    if (profileError) {
      setError('Akun dibuat tapi profil gagal: ' + profileError.message)
      setLoading(false); return
    }

    router.push(tier === 'anggota' ? '/member' : '/dashboard')
  }

  // Step 1: Pilih tier
  if (!tier) {
    return (
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-green-600 mb-3">
            <span className="text-white text-2xl font-bold">L</span>
          </div>
          <h1 className="text-white text-2xl font-bold tracking-tight">Daftar ke LUMBUNG</h1>
          <p className="text-slate-400 text-sm mt-1">Pilih tipe akun</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <button onClick={() => setTier('anggota')}
            className="bg-slate-900 border border-slate-700 hover:border-green-600 rounded-2xl p-6 text-left transition-colors group">
            <div className="text-3xl mb-3">👤</div>
            <p className="text-white font-semibold mb-1">Anggota</p>
            <p className="text-slate-400 text-xs">Ajukan simpanan & pinjaman di satu atau beberapa koperasi</p>
            <div className="mt-4 text-green-400 text-xs font-medium group-hover:translate-x-1 transition-transform">
              Pilih →
            </div>
          </button>

          <button onClick={() => setTier('pengurus')}
            className="bg-slate-900 border border-slate-700 hover:border-green-600 rounded-2xl p-6 text-left transition-colors group">
            <div className="text-3xl mb-3">🏦</div>
            <p className="text-white font-semibold mb-1">Pengurus Koperasi</p>
            <p className="text-slate-400 text-xs">Kelola operasional koperasimu — ternak, stok, simpan pinjam</p>
            <div className="mt-4 text-green-400 text-xs font-medium group-hover:translate-x-1 transition-transform">
              Pilih →
            </div>
          </button>
        </div>

        <p className="text-center text-slate-500 text-sm mt-6">
          Sudah punya akun?{' '}
          <Link href="/login" className="text-green-400 hover:underline">Masuk</Link>
        </p>
      </div>
    )
  }

  // Step 2: Form
  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-green-600 mb-3">
          <span className="text-white text-2xl font-bold">L</span>
        </div>
        <h1 className="text-white text-2xl font-bold tracking-tight">
          {tier === 'anggota' ? 'Daftar sebagai Anggota' : 'Daftar sebagai Pengurus'}
        </h1>
        <button onClick={() => setTier(null)} className="text-slate-500 text-xs mt-1 hover:text-slate-300">
          ← Ganti tipe akun
        </button>
      </div>

      <form onSubmit={handleDaftar}
        className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">

        <div>
          <label className="block text-slate-300 text-sm font-medium mb-1.5">Nama Lengkap *</label>
          <input required value={form.nama} onChange={e => set('nama', e.target.value)}
            placeholder="Nama lengkap"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-green-600" />
        </div>

        {tier === 'pengurus' && (
          <>
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-1.5">Koperasi *</label>
              <select required value={form.koperasi_id} onChange={e => set('koperasi_id', e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-600">
                <option value="">Pilih koperasi...</option>
                {koperasiList.map(k => (
                  <option key={k.id} value={k.id}>{k.nama} — {k.fokus_usaha}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-300 text-sm font-medium mb-1.5">Jabatan *</label>
              <select value={form.role} onChange={e => set('role', e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-600">
                <option value="pengurus">Pengurus</option>
                <option value="kasir">Kasir</option>
                <option value="pengawas">Pengawas Eksternal</option>
                <option value="pemkab">Dinas Koperasi (Pemkab)</option>
              </select>
            </div>
          </>
        )}

        <div>
          <label className="block text-slate-300 text-sm font-medium mb-1.5">Email *</label>
          <input required type="email" value={form.email} onChange={e => set('email', e.target.value)}
            placeholder="email@kamu.com"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-green-600" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-slate-300 text-sm font-medium mb-1.5">Password *</label>
            <input required type="password" value={form.password} onChange={e => set('password', e.target.value)}
              placeholder="Min. 6 karakter"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-green-600" />
          </div>
          <div>
            <label className="block text-slate-300 text-sm font-medium mb-1.5">Konfirmasi *</label>
            <input required type="password" value={form.konfirmasi} onChange={e => set('konfirmasi', e.target.value)}
              placeholder="Ulangi"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-green-600" />
          </div>
        </div>

        {error && (
          <p className="text-red-400 text-sm bg-red-950/50 border border-red-900 rounded-lg px-3 py-2">{error}</p>
        )}

        <button type="submit" disabled={loading}
          className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-semibold rounded-lg px-4 py-2.5 text-sm transition-colors">
          {loading ? 'Mendaftar...' : 'Buat Akun'}
        </button>

        <p className="text-center text-slate-500 text-sm">
          Sudah punya akun?{' '}
          <Link href="/login" className="text-green-400 hover:underline">Masuk</Link>
        </p>
      </form>
    </div>
  )
}
