'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Trash2, AlertTriangle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Ternak } from '@/types'

const inputCls = 'w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-500 transition-colors'

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
          kode: data.kode, jenis: data.jenis,
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
      kode: form.kode.toUpperCase(), jenis: form.jenis,
      umur_bulan: form.umur_bulan ? parseInt(form.umur_bulan) : null,
      nilai_estimasi: form.nilai_estimasi ? parseInt(form.nilai_estimasi) : 0,
      status: form.status,
      vaksin_terakhir: form.vaksin_terakhir || null,
    }
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

  if (!ternak) return (
    <div className="flex items-center justify-center h-48">
      <div className="w-5 h-5 border-2 border-amber-700 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/ternak" className="flex items-center gap-1 text-stone-500 hover:text-stone-900 text-sm transition-colors">
            <ChevronLeft size={16} /> Kembali
          </Link>
          <h1 className="text-stone-900 text-xl font-bold">Edit Ternak</h1>
        </div>
        <button onClick={handleHapus}
          className="flex items-center gap-1.5 text-red-500 hover:text-red-600 text-sm border border-red-200 hover:border-red-300 rounded-lg px-3 py-1.5 bg-white transition-colors">
          <Trash2 size={13} /> Hapus
        </button>
      </div>

      {confirmMati && (
        <div className="bg-red-50 border border-red-200 border-l-4 border-l-red-500 rounded-xl p-4 text-sm text-red-700 space-y-3">
          <div className="flex items-start gap-2">
            <AlertTriangle size={15} className="text-red-500 mt-0.5 shrink-0" />
            <p><strong>Konfirmasi:</strong> Tandai ternak ini sebagai mati? Tindakan ini akan dicatat di audit log dan mempengaruhi nilai agunan.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSubmit as () => void}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors">
              Ya, tandai mati
            </button>
            <button onClick={() => { setConfirmMati(false); set('status', 'sehat') }}
              className="border border-stone-300 text-stone-600 px-4 py-1.5 rounded-lg text-sm hover:bg-stone-50 transition-colors">
              Batal
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white border border-stone-200 rounded-xl p-5 space-y-4 shadow-sm">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-stone-700 text-sm font-medium mb-1.5">Kode *</label>
            <input required value={form.kode} onChange={e => set('kode', e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-stone-700 text-sm font-medium mb-1.5">Jenis *</label>
            <select value={form.jenis} onChange={e => set('jenis', e.target.value)} className={inputCls}>
              {['sapi', 'kambing', 'domba', 'ayam', 'bebek', 'lainnya'].map(j => (
                <option key={j} value={j}>{j}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-stone-700 text-sm font-medium mb-1.5">Umur (bulan)</label>
            <input type="number" min="0" value={form.umur_bulan} onChange={e => set('umur_bulan', e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-stone-700 text-sm font-medium mb-1.5">Nilai Estimasi (Rp)</label>
            <input type="number" min="0" value={form.nilai_estimasi} onChange={e => set('nilai_estimasi', e.target.value)} className={inputCls} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-stone-700 text-sm font-medium mb-1.5">Status</label>
            <select value={form.status} onChange={e => set('status', e.target.value)} className={inputCls}>
              <option value="sehat">Sehat</option>
              <option value="pantau">Pantau</option>
              <option value="sakit">Sakit</option>
              <option value="mati">Mati</option>
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

        {!confirmMati && (
          <button type="submit" disabled={saving}
            className="w-full bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white font-semibold rounded-lg px-4 py-2.5 text-sm transition-colors shadow-sm">
            {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
          </button>
        )}
      </form>
    </div>
  )
}
