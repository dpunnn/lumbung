'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { User, Building2, ChevronLeft } from 'lucide-react'
import { register } from '@/lib/auth'
import api from '@/lib/api'

type Koperasi = { id: string; nama: string; komoditas?: string; jenis: string }
type Tier = 'anggota' | 'pengurus'

const inputCls = 'w-full bg-white border border-stone-300 rounded-lg px-3 py-2.5 text-stone-900 text-sm placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-500 transition-colors'

export default function DaftarPage() {
  const router = useRouter()
  const [tier, setTier] = useState<Tier | null>(null)
  const [koperasiList, setKoperasiList] = useState<Koperasi[]>([])
  const [form, setForm] = useState({ nama: '', email: '', password: '', konfirmasi: '', koperasi_id: '', role: 'pengurus' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get<Koperasi[]>('/api/koperasi')
      .then(d => setKoperasiList(Array.isArray(d) ? d : []))
      .catch(() => setKoperasiList([]))
  }, [])

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  async function handleDaftar(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (form.password !== form.konfirmasi) { setError('Password tidak cocok.'); return }
    if (form.password.length < 6) { setError('Password minimal 6 karakter.'); return }
    if (tier === 'pengurus' && !form.koperasi_id) { setError('Pilih koperasi terlebih dahulu.'); return }
    setLoading(true)

    try {
      await register({
        username: form.nama,
        email: form.email,
        password: form.password,
        koperasi_id: tier === 'pengurus' ? form.koperasi_id : undefined,
        role: tier === 'anggota' ? 'anggota' : form.role,
      })
      router.push(tier === 'anggota' ? '/member' : '/dashboard')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal membuat akun.'
      setError(msg)
      setLoading(false)
    }
  }

  if (!tier) {
    return (
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-amber-700 mb-3 shadow-sm">
            <span className="text-white text-xl font-black">L</span>
          </div>
          <h1 className="text-stone-900 text-2xl font-bold tracking-tight">Daftar ke LUMBUNG</h1>
          <p className="text-stone-500 text-sm mt-1">Pilih tipe akun</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => setTier('anggota')}
            className="bg-white border border-stone-200 hover:border-amber-400 rounded-2xl p-5 text-left transition-colors group shadow-sm">
            <div className="w-9 h-9 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center mb-3">
              <User size={18} className="text-amber-700" />
            </div>
            <p className="text-stone-900 font-semibold text-sm mb-1">Anggota</p>
            <p className="text-stone-500 text-xs leading-relaxed">Ajukan simpanan & pinjaman di satu atau beberapa koperasi</p>
          </button>

          <button onClick={() => setTier('pengurus')}
            className="bg-white border border-stone-200 hover:border-amber-400 rounded-2xl p-5 text-left transition-colors group shadow-sm">
            <div className="w-9 h-9 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center mb-3">
              <Building2 size={18} className="text-amber-700" />
            </div>
            <p className="text-stone-900 font-semibold text-sm mb-1">Pengurus</p>
            <p className="text-stone-500 text-xs leading-relaxed">Kelola operasional koperasi — ternak, stok, simpan pinjam</p>
          </button>
        </div>

        <p className="text-center text-stone-500 text-sm mt-6">
          Sudah punya akun?{' '}
          <Link href="/login" className="text-amber-700 hover:text-amber-800 font-medium">Masuk</Link>
        </p>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-amber-700 mb-3 shadow-sm">
          <span className="text-white text-xl font-black">L</span>
        </div>
        <h1 className="text-stone-900 text-2xl font-bold tracking-tight">
          {tier === 'anggota' ? 'Daftar sebagai Anggota' : 'Daftar sebagai Pengurus'}
        </h1>
        <button onClick={() => setTier(null)}
          className="text-stone-400 text-xs mt-1 hover:text-stone-600 flex items-center gap-1 mx-auto">
          <ChevronLeft size={12} /> Ganti tipe akun
        </button>
      </div>

      <form onSubmit={handleDaftar}
        className="bg-white border border-stone-200 rounded-2xl p-6 space-y-4 shadow-sm">
        <div>
          <label className="block text-stone-700 text-sm font-medium mb-1.5">Nama Lengkap *</label>
          <input required value={form.nama} onChange={e => set('nama', e.target.value)}
            placeholder="Nama lengkap" className={inputCls} />
        </div>

        {tier === 'pengurus' && (
          <>
            <div>
              <label className="block text-stone-700 text-sm font-medium mb-1.5">Koperasi *</label>
              <select required value={form.koperasi_id} onChange={e => set('koperasi_id', e.target.value)} className={inputCls}>
                <option value="">Pilih koperasi...</option>
                {koperasiList.map(k => (
                  <option key={k.id} value={k.id}>{k.nama}{k.komoditas ? ` — ${k.komoditas}` : ''}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-stone-700 text-sm font-medium mb-1.5">Jabatan *</label>
              <select value={form.role} onChange={e => set('role', e.target.value)} className={inputCls}>
                <option value="pengurus">Pengurus</option>
                <option value="kasir">Kasir</option>
                <option value="pengawas">Pengawas Eksternal</option>
                <option value="pemkab">Dinas Koperasi (Pemkab)</option>
              </select>
            </div>
          </>
        )}

        <div>
          <label className="block text-stone-700 text-sm font-medium mb-1.5">Email *</label>
          <input required type="email" value={form.email} onChange={e => set('email', e.target.value)}
            placeholder="email@kamu.com" className={inputCls} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-stone-700 text-sm font-medium mb-1.5">Password *</label>
            <input required type="password" value={form.password} onChange={e => set('password', e.target.value)}
              placeholder="Min. 6 karakter" className={inputCls} />
          </div>
          <div>
            <label className="block text-stone-700 text-sm font-medium mb-1.5">Konfirmasi *</label>
            <input required type="password" value={form.konfirmasi} onChange={e => set('konfirmasi', e.target.value)}
              placeholder="Ulangi" className={inputCls} />
          </div>
        </div>

        {error && (
          <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
        )}

        <button type="submit" disabled={loading}
          className="w-full bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white font-semibold rounded-lg px-4 py-2.5 text-sm transition-colors shadow-sm">
          {loading ? 'Mendaftar...' : 'Buat Akun'}
        </button>

        <p className="text-center text-stone-500 text-sm">
          Sudah punya akun?{' '}
          <Link href="/login" className="text-amber-700 hover:text-amber-800 font-medium">Masuk</Link>
        </p>
      </form>
    </div>
  )
}
