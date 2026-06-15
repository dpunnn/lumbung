'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import api from '@/lib/api'
import { getMe } from '@/lib/auth'
import { db, addToOutbox } from '@/lib/db'

const inputCls = 'w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-stone-900 text-sm placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-500 transition-colors'

export default function TambahTernakPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    kode: '', jenis: 'sapi', umur_bulan: '', nilai_estimasi: '',
    status: 'sehat', vaksin_terakhir: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)

    const me = await getMe()
    if (!me) { setError('Sesi habis'); setSaving(false); return }

    const row_id = crypto.randomUUID()
    const payload = {
      id: row_id,
      koperasi_id: me.koperasi_id,
      kode: form.kode.toUpperCase(),
      jenis: form.jenis,
      umur_bulan: form.umur_bulan ? parseInt(form.umur_bulan) : null,
      nilai_estimasi: form.nilai_estimasi ? parseInt(form.nilai_estimasi) : 0,
      status: form.status,
      vaksin_terakhir: form.vaksin_terakhir || null,
    }

    const isOffline = !navigator.onLine
    if (isOffline) {
      await db.ternak.add({ ...payload, terverifikasi: false, synced: false, created_at: new Date().toISOString() })
      await addToOutbox('ternak', 'INSERT', row_id, payload)
      router.push('/ternak')
      return
    }

    try {
      await api.post('/api/stok/ternak', payload)
    } catch {
      await db.ternak.add({ ...payload, terverifikasi: false, synced: false, created_at: new Date().toISOString() })
      await addToOutbox('ternak', 'INSERT', row_id, payload)
    }
    router.push('/ternak')
  }

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/ternak" className="flex items-center gap-1 text-stone-500 hover:text-stone-900 text-sm transition-colors">
          <ChevronLeft size={16} /> Kembali
        </Link>
        <h1 className="text-stone-900 text-xl font-bold">Tambah Ternak</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white border border-stone-200 rounded-xl p-5 space-y-4 shadow-sm">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-stone-700 text-sm font-medium mb-1.5">Kode *</label>
            <input required value={form.kode} onChange={e => set('kode', e.target.value)}
              placeholder="TRN-001" className={inputCls} />
          </div>
          <div>
            <label className="block text-stone-700 text-sm font-medium mb-1.5">Jenis *</label>
            <select value={form.jenis} onChange={e => set('jenis', e.target.value)} className={inputCls}>
              {['sapi', 'kambing', 'domba', 'ayam', 'bebek', 'lainnya'].map(j => (
                <option key={j} value={j} className="capitalize">{j}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-stone-700 text-sm font-medium mb-1.5">Umur (bulan)</label>
            <input type="number" min="0" value={form.umur_bulan} onChange={e => set('umur_bulan', e.target.value)}
              placeholder="24" className={inputCls} />
          </div>
          <div>
            <label className="block text-stone-700 text-sm font-medium mb-1.5">Nilai Estimasi (Rp)</label>
            <input type="number" min="0" value={form.nilai_estimasi} onChange={e => set('nilai_estimasi', e.target.value)}
              placeholder="5000000" className={inputCls} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-stone-700 text-sm font-medium mb-1.5">Status</label>
            <select value={form.status} onChange={e => set('status', e.target.value)} className={inputCls}>
              <option value="sehat">Sehat</option>
              <option value="pantau">Pantau</option>
              <option value="sakit">Sakit</option>
            </select>
          </div>
          <div>
            <label className="block text-stone-700 text-sm font-medium mb-1.5">Vaksin Terakhir</label>
            <input type="date" value={form.vaksin_terakhir} onChange={e => set('vaksin_terakhir', e.target.value)} className={inputCls} />
          </div>
        </div>

        {error && (
          <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
        )}

        <button type="submit" disabled={saving}
          className="w-full bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white font-semibold rounded-lg px-4 py-2.5 text-sm transition-colors shadow-sm">
          {saving ? 'Menyimpan...' : 'Simpan Ternak'}
        </button>
      </form>
    </div>
  )
}
