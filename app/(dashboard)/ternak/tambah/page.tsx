'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { db, addToOutbox } from '@/lib/db'

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

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Sesi habis'); setSaving(false); return }

    const { data: profile } = await supabase
      .from('profiles').select('koperasi_id').eq('id', user.id).single()
    if (!profile) { setError('Profil tidak ditemukan'); setSaving(false); return }

    const row_id = crypto.randomUUID()
    const payload = {
      id: row_id,
      koperasi_id: profile.koperasi_id,
      kode: form.kode.toUpperCase(),
      jenis: form.jenis,
      umur_bulan: form.umur_bulan ? parseInt(form.umur_bulan) : null,
      nilai_estimasi: form.nilai_estimasi ? parseInt(form.nilai_estimasi) : 0,
      status: form.status,
      vaksin_terakhir: form.vaksin_terakhir || null,
    }

    // Coba kirim ke Supabase, fallback ke outbox kalau gagal/offline
    const isOffline = !navigator.onLine
    if (isOffline) {
      await db.ternak.add({ ...payload, terverifikasi: false, synced: false, created_at: new Date().toISOString() })
      await addToOutbox('ternak', 'INSERT', row_id, payload)
      router.push('/ternak')
      return
    }

    const { error: err } = await supabase.from('ternak').insert(payload)
    if (err) {
      // Network error → simpan ke outbox
      await db.ternak.add({ ...payload, terverifikasi: false, synced: false, created_at: new Date().toISOString() })
      await addToOutbox('ternak', 'INSERT', row_id, payload)
      router.push('/ternak')
      return
    }
    router.push('/ternak')
  }

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/ternak" className="text-slate-400 hover:text-white text-sm">← Kembali</Link>
        <h1 className="text-white text-xl font-semibold">Tambah Ternak</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-slate-300 text-sm mb-1.5">Kode *</label>
            <input required value={form.kode} onChange={e => set('kode', e.target.value)}
              placeholder="TRN-001"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
          </div>
          <div>
            <label className="block text-slate-300 text-sm mb-1.5">Jenis *</label>
            <select value={form.jenis} onChange={e => set('jenis', e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-600">
              {['sapi','kambing','domba','ayam','bebek','lainnya'].map(j => (
                <option key={j} value={j} className="capitalize">{j}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-slate-300 text-sm mb-1.5">Umur (bulan)</label>
            <input type="number" min="0" value={form.umur_bulan} onChange={e => set('umur_bulan', e.target.value)}
              placeholder="24"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
          </div>
          <div>
            <label className="block text-slate-300 text-sm mb-1.5">Nilai Estimasi (Rp)</label>
            <input type="number" min="0" value={form.nilai_estimasi} onChange={e => set('nilai_estimasi', e.target.value)}
              placeholder="5000000"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-slate-300 text-sm mb-1.5">Status</label>
            <select value={form.status} onChange={e => set('status', e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-600">
              <option value="sehat">Sehat</option>
              <option value="pantau">Pantau</option>
              <option value="sakit">Sakit</option>
            </select>
          </div>
          <div>
            <label className="block text-slate-300 text-sm mb-1.5">Vaksin Terakhir</label>
            <input type="date" value={form.vaksin_terakhir} onChange={e => set('vaksin_terakhir', e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
          </div>
        </div>

        {error && <p className="text-red-400 text-sm bg-red-950/50 border border-red-900 rounded-lg px-3 py-2">{error}</p>}

        <button type="submit" disabled={saving}
          className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-semibold rounded-lg px-4 py-2.5 text-sm transition-colors">
          {saving ? 'Menyimpan...' : 'Simpan Ternak'}
        </button>
      </form>
    </div>
  )
}
