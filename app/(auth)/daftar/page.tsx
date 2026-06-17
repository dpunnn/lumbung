'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { User, Building2, ChevronLeft, ArrowRight } from 'lucide-react'
import { register } from '@/lib/auth'
import api from '@/lib/api'

type Koperasi = { id: string; nama: string; komoditas?: string; jenis: string }
type Tier = 'anggota' | 'pengurus'

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

  const inputStyle = {
    background: 'white',
    border: '1.5px solid oklch(0.88 0.015 140)',
    color: 'oklch(0.18 0.02 150)',
    borderRadius: '0.75rem',
    padding: '0.75rem 1rem',
    fontSize: '0.875rem',
    width: '100%',
    outline: 'none',
    transition: 'all 0.15s',
  }

  const handleFocus = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    e.target.style.borderColor = 'oklch(0.32 0.09 155)'
    e.target.style.boxShadow = '0 0 0 3px oklch(0.32 0.09 155 / 0.12)'
  }
  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    e.target.style.borderColor = 'oklch(0.88 0.015 140)'
    e.target.style.boxShadow = 'none'
  }

  if (!tier) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 py-12" style={{ background: 'oklch(0.975 0.005 90)' }}>
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="flex items-center gap-3 justify-center mb-10">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-md"
              style={{ background: 'linear-gradient(135deg, oklch(0.72 0.12 70), oklch(0.62 0.15 60))' }}>
              <span className="text-white font-black">L</span>
            </div>
            <span className="font-black text-xl" style={{ color: 'oklch(0.22 0.06 155)' }}>LUMBUNG</span>
          </div>

          <div className="mb-8 text-center">
            <h1 className="text-2xl font-black tracking-tight" style={{ color: 'oklch(0.18 0.04 150)' }}>
              Daftar ke LUMBUNG
            </h1>
            <p className="mt-1.5 text-sm" style={{ color: 'oklch(0.55 0.025 140)' }}>Pilih tipe akun untuk melanjutkan</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              {
                tier: 'anggota' as Tier,
                icon: User,
                title: 'Anggota',
                desc: 'Ajukan simpanan & pinjaman di satu atau beberapa koperasi',
              },
              {
                tier: 'pengurus' as Tier,
                icon: Building2,
                title: 'Pengurus',
                desc: 'Kelola operasional koperasi — ternak, stok, simpan pinjam',
              },
            ].map(opt => {
              const Icon = opt.icon
              return (
                <button
                  key={opt.tier}
                  onClick={() => setTier(opt.tier)}
                  className="group text-left rounded-2xl p-5 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-lg"
                  style={{
                    background: 'white',
                    border: '1.5px solid oklch(0.88 0.015 140)',
                    boxShadow: '0 1px 4px oklch(0 0 0 / 0.05)',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'oklch(0.32 0.09 155)'
                    ;(e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px oklch(0.32 0.09 155 / 0.15)'
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'oklch(0.88 0.015 140)'
                    ;(e.currentTarget as HTMLElement).style.boxShadow = '0 1px 4px oklch(0 0 0 / 0.05)'
                  }}
                >
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
                    style={{ background: 'oklch(0.94 0.04 145)', border: '1px solid oklch(0.55 0.14 155 / 0.20)' }}>
                    <Icon size={17} style={{ color: 'oklch(0.38 0.12 150)' }} />
                  </div>
                  <p className="font-bold text-sm mb-1.5" style={{ color: 'oklch(0.18 0.04 150)' }}>{opt.title}</p>
                  <p className="text-xs leading-relaxed" style={{ color: 'oklch(0.58 0.02 140)' }}>{opt.desc}</p>
                </button>
              )
            })}
          </div>

          <p className="text-center text-sm mt-8" style={{ color: 'oklch(0.58 0.02 140)' }}>
            Sudah punya akun?{' '}
            <Link href="/login" className="font-semibold" style={{ color: 'oklch(0.38 0.12 150)' }}>
              Masuk
            </Link>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12" style={{ background: 'oklch(0.975 0.005 90)' }}>
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center gap-3 justify-center mb-8">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-md"
            style={{ background: 'linear-gradient(135deg, oklch(0.72 0.12 70), oklch(0.62 0.15 60))' }}>
            <span className="text-white font-black text-sm">L</span>
          </div>
          <span className="font-black text-lg" style={{ color: 'oklch(0.22 0.06 155)' }}>LUMBUNG</span>
        </div>

        <div className="mb-7">
          <button
            onClick={() => setTier(null)}
            className="flex items-center gap-1.5 text-xs font-medium mb-3 transition-colors"
            style={{ color: 'oklch(0.58 0.03 150)' }}
          >
            <ChevronLeft size={13} /> Ganti tipe akun
          </button>
          <h1 className="text-xl font-black tracking-tight" style={{ color: 'oklch(0.18 0.04 150)' }}>
            {tier === 'anggota' ? 'Daftar sebagai Anggota' : 'Daftar sebagai Pengurus'}
          </h1>
        </div>

        <form onSubmit={handleDaftar}
          className="rounded-2xl p-6 space-y-4"
          style={{ background: 'white', border: '1.5px solid oklch(0.88 0.015 140)', boxShadow: '0 4px 20px oklch(0 0 0 / 0.06)' }}>

          <div>
            <label className="block text-sm font-semibold mb-1.5" style={{ color: 'oklch(0.28 0.04 150)' }}>
              Nama Lengkap *
            </label>
            <input required value={form.nama} onChange={e => set('nama', e.target.value)}
              placeholder="Nama lengkap" style={inputStyle} onFocus={handleFocus} onBlur={handleBlur} />
          </div>

          {tier === 'pengurus' && (
            <>
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: 'oklch(0.28 0.04 150)' }}>
                  Koperasi *
                </label>
                <select required value={form.koperasi_id} onChange={e => set('koperasi_id', e.target.value)}
                  style={inputStyle} onFocus={handleFocus} onBlur={handleBlur}>
                  <option value="">Pilih koperasi...</option>
                  {koperasiList.map(k => (
                    <option key={k.id} value={k.id}>{k.nama}{k.komoditas ? ` — ${k.komoditas}` : ''}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: 'oklch(0.28 0.04 150)' }}>
                  Jabatan *
                </label>
                <select value={form.role} onChange={e => set('role', e.target.value)}
                  style={inputStyle} onFocus={handleFocus} onBlur={handleBlur}>
                  <option value="pengurus">Pengurus</option>
                  <option value="kasir">Kasir</option>
                  <option value="pengawas">Pengawas Eksternal</option>
                  <option value="pemkab">Dinas Koperasi (Pemkab)</option>
                </select>
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-semibold mb-1.5" style={{ color: 'oklch(0.28 0.04 150)' }}>
              Email *
            </label>
            <input required type="email" value={form.email} onChange={e => set('email', e.target.value)}
              placeholder="email@kamu.com" style={inputStyle} onFocus={handleFocus} onBlur={handleBlur} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold mb-1.5" style={{ color: 'oklch(0.28 0.04 150)' }}>
                Password *
              </label>
              <input required type="password" value={form.password} onChange={e => set('password', e.target.value)}
                placeholder="Min. 6 karakter" style={inputStyle} onFocus={handleFocus} onBlur={handleBlur} />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1.5" style={{ color: 'oklch(0.28 0.04 150)' }}>
                Konfirmasi *
              </label>
              <input required type="password" value={form.konfirmasi} onChange={e => set('konfirmasi', e.target.value)}
                placeholder="Ulangi" style={inputStyle} onFocus={handleFocus} onBlur={handleBlur} />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm"
              style={{
                background: 'oklch(0.577 0.245 27.325 / 0.08)',
                border: '1px solid oklch(0.577 0.245 27.325 / 0.25)',
                color: 'oklch(0.50 0.20 27)',
              }}>
              <span className="text-base leading-none">!</span>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-sm font-bold transition-all duration-150 disabled:opacity-60"
            style={{
              background: 'linear-gradient(135deg, oklch(0.32 0.09 155), oklch(0.26 0.08 155))',
              color: 'white',
              boxShadow: '0 4px 16px oklch(0.32 0.09 155 / 0.30)',
            }}
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
                  style={{ borderColor: 'white', borderTopColor: 'transparent' }} />
                Mendaftar...
              </>
            ) : (
              <>Buat Akun <ArrowRight size={15} /></>
            )}
          </button>

          <p className="text-center text-sm" style={{ color: 'oklch(0.58 0.02 140)' }}>
            Sudah punya akun?{' '}
            <Link href="/login" className="font-semibold" style={{ color: 'oklch(0.38 0.12 150)' }}>
              Masuk
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
