'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { Ternak } from '@/types'

export default function EditTernakPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [ternak, setTernak] = useState<Ternak | null>(null)
  const [form, setForm] = useState({ kode: '', jenis: '', umur_bulan: '', nilai_estimasi: '', status: '', vaksin_terakhir: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmMati, setConfirmMati] = useState(false)

  useEffect(() => {
    supabase.from('ternak').select('*').eq('id', id).single().then(({ data }) => {
      if (data) {
        setTernak(data)
        setForm({
          kode: data.kode,
          jenis: data.jenis,
          umur_bulan: data.umur_bulan?.toString() ?? '',
          nilai_estimasi: data.nilai_estimasi?.toString() ?? '',
          status: data.status,
          vaksin_terakhir: data.vaksin_terakhir ?? '',
        })
      }
    })
  }, [id])

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (form.status === 'mati' && !confirmMati) { setConfirmMati(true); return }
    setError('')
    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()

    const updates: Record<string, unknown> = {
      kode: form.kode.toUpperCase(),
      jenis: form.jenis,
      umur_bulan: form.umur_bulan ? parseInt(form.umur_bulan) : null,
      nilai_estimasi: form.nilai_estimasi ? parseInt(form.nilai_estimasi) : 0,
      status: form.status,
      vaksin_terakhir: form.vaksin_terakhir || null,
    }

    // Handle ternak mati
    if (form.status === 'mati' && ternak?.status !== 'mati') {
      updates.tanggal_mati = new Date().toISOString().split('T')[0]
      updates.dicatat_mati_oleh = user?.id ?? null
    }

    const { error: err } = await supabase.from('ternak').update(updates).eq('id', id)
    if (err) { setError(err.message); setSaving(false); return }
    router.push('/ternak')
  }

  async function handleHapus() {
    if (!confirm('Hapus data ternak ini?')) return
    await supabase.from('ternak').delete().eq('id', id)
    router.push('/ternak')
  }

  if (!ternak) return <p className="text-slate-500 text-sm p-6">Memuat...</p>

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/ternak" className="text-slate-400 hover:text-white text-sm">← Kembali</Link>
          <h1 className="text-white text-xl font-semibold">Edit Ternak</h1>
        </div>
        <button onClick={handleHapus} className="text-red-400 hover:text-red-300 text-sm border border-red-900 rounded-lg px-3 py-1.5">
          Hapus
        </button>
      </div>

      {confirmMati && (
        <div className="bg-red-950/50 border border-red-900 rounded-xl p-4 text-sm text-red-300 space-y-3">
          <p><strong>Konfirmasi: </strong>Tandai ternak ini sebagai mati? Tindakan ini akan dicatat di audit log dan mempengaruhi nilai agunan.</p>
          <div className="flex gap-2">
            <button onClick={handleSubmit as () => void}
              className="bg-red-700 hover:bg-red-600 text-white px-4 py-1.5 rounded-lg text-sm">
              Ya, tandai mati
            </button>
            <button onClick={() => { setConfirmMati(false); set('status', 'sehat') }}
              className="border border-slate-700 text-slate-300 px-4 py-1.5 rounded-lg text-sm">
              Batal
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-slate-300 text-sm mb-1.5">Kode *</label>
            <input required value={form.kode} onChange={e => set('kode', e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
          </div>
          <div>
            <label className="block text-slate-300 text-sm mb-1.5">Jenis *</label>
            <select value={form.jenis} onChange={e => set('jenis', e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-600">
              {['sapi','kambing','domba','ayam','bebek','lainnya'].map(j => (
                <option key={j} value={j}>{j}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-slate-300 text-sm mb-1.5">Umur (bulan)</label>
            <input type="number" min="0" value={form.umur_bulan} onChange={e => set('umur_bulan', e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
          </div>
          <div>
            <label className="block text-slate-300 text-sm mb-1.5">Nilai Estimasi (Rp)</label>
            <input type="number" min="0" value={form.nilai_estimasi} onChange={e => set('nilai_estimasi', e.target.value)}
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
              <option value="mati">Mati</option>
            </select>
          </div>
          <div>
            <label className="block text-slate-300 text-sm mb-1.5">Vaksin Terakhir</label>
            <input type="date" value={form.vaksin_terakhir} onChange={e => set('vaksin_terakhir', e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
          </div>
        </div>

        {error && <p className="text-red-400 text-sm bg-red-950/50 border border-red-900 rounded-lg px-3 py-2">{error}</p>}

        {!confirmMati && (
          <button type="submit" disabled={saving}
            className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-semibold rounded-lg px-4 py-2.5 text-sm transition-colors">
            {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
          </button>
        )}
      </form>
    </div>
  )
}
