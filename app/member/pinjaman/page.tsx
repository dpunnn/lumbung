'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Koperasi = { id: string; nama: string }
type Anggota = { id: string; nama: string; koperasi_id: string }
type Pinjaman = {
  id: string; jumlah_pokok: number; status: string
  created_at: string; koperasi: Koperasi | null
}

function PinjamanContent() {
  const params = useSearchParams()
  const defaultKop = params.get('koperasi') ?? ''

  const [userId, setUserId] = useState('')
  const [myAnggota, setMyAnggota] = useState<Anggota[]>([])
  const [joinedKoperasi, setJoinedKoperasi] = useState<Koperasi[]>([])
  const [pinjaman, setPinjaman] = useState<Pinjaman[]>([])
  const [tab, setTab] = useState<'list' | 'ajukan'>('list')
  const [form, setForm] = useState({ koperasi_id: defaultKop, jumlah: '', tenor_bulan: '12' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      setUserId(user.id)

      // Koperasi yang diikuti
      const { data: mem } = await supabase
        .from('anggota_koperasi').select('koperasi_id, koperasi(id, nama)').eq('anggota_id', user.id)
      const kops = (mem ?? []).map((m: any) => m.koperasi).filter(Boolean) as Koperasi[]
      setJoinedKoperasi(kops)

      // Data anggota (row di tabel anggota) untuk tiap koperasi
      const { data: ang } = await supabase
        .from('anggota').select('id, nama, koperasi_id')
        .in('koperasi_id', kops.map(k => k.id))
      setMyAnggota((ang ?? []) as Anggota[])

      // Pinjaman yang sudah ada
      const { data: pin } = await supabase
        .from('pinjaman').select('*, koperasi(id, nama)')
        .in('koperasi_id', kops.map(k => k.id))
        .order('created_at', { ascending: false })
      setPinjaman((pin ?? []) as Pinjaman[])
    })
  }, [])

  async function handleAjukan(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!form.koperasi_id) { setError('Pilih koperasi'); return }

    setSaving(true)

    // Cari atau buat anggota row di koperasi ini
    let anggotaId = myAnggota.find(a => a.koperasi_id === form.koperasi_id)?.id
    if (!anggotaId) {
      const { data: p } = await supabase.from('profiles').select('nama').eq('id', userId).single()
      const { data: newAng } = await supabase.from('anggota').insert({
        koperasi_id: form.koperasi_id, nama: p?.nama ?? 'Anggota',
      }).select().single()
      anggotaId = newAng?.id
    }

    const jumlah = parseFloat(form.jumlah)
    const tenor = parseInt(form.tenor_bulan)
    const { error: err } = await supabase.from('pinjaman').insert({
      koperasi_id: form.koperasi_id,
      anggota_id: anggotaId,
      jumlah_pokok: jumlah,
      tenor_bulan: tenor,
      angsuran_per_bulan: Math.ceil(jumlah / tenor),
      status: 'aktif',
    })

    if (err) { setError(err.message); setSaving(false); return }
    setTab('list')
    setForm({ koperasi_id: defaultKop, jumlah: '', tenor_bulan: '12' })
    setSaving(false)

    // Refresh
    const kops = joinedKoperasi.map(k => k.id)
    const { data: pin } = await supabase
      .from('pinjaman').select('*, koperasi(id, nama)')
      .in('koperasi_id', kops).order('created_at', { ascending: false })
    setPinjaman((pin ?? []) as Pinjaman[])
  }

  const STATUS_COLOR: Record<string, string> = {
    diajukan: 'bg-yellow-900/50 text-yellow-400 border-yellow-800',
    disetujui: 'bg-green-900/50 text-green-400 border-green-800',
    ditolak: 'bg-red-900/50 text-red-400 border-red-800',
    lunas: 'bg-slate-800 text-slate-400 border-slate-700',
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white text-xl font-semibold">Pinjaman Saya</h1>
          <p className="text-slate-400 text-sm">Pengajuan di semua koperasi yang kamu ikuti</p>
        </div>
        <button onClick={() => setTab('ajukan')}
          className="bg-green-600 hover:bg-green-500 text-white text-sm font-medium px-4 py-2 rounded-lg">
          + Ajukan
        </button>
      </div>

      {/* Tab */}
      <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1 w-fit">
        {(['list', 'ajukan'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm transition-colors
              ${tab === t ? 'bg-green-700 text-white' : 'text-slate-400 hover:text-white'}`}>
            {t === 'list' ? 'Riwayat' : 'Ajukan Baru'}
          </button>
        ))}
      </div>

      {tab === 'ajukan' && (
        <form onSubmit={handleAjukan} className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div>
            <label className="block text-slate-300 text-sm mb-1.5">Koperasi *</label>
            <select required value={form.koperasi_id} onChange={e => setForm(f => ({ ...f, koperasi_id: e.target.value }))}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-600">
              <option value="">Pilih koperasi...</option>
              {joinedKoperasi.map(k => <option key={k.id} value={k.id}>{k.nama}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-slate-300 text-sm mb-1.5">Jumlah Pinjaman (Rp) *</label>
            <input required type="number" min="100000" value={form.jumlah}
              onChange={e => setForm(f => ({ ...f, jumlah: e.target.value }))}
              placeholder="5000000"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
          </div>
          <div>
            <label className="block text-slate-300 text-sm mb-1.5">Tenor (bulan)</label>
            <select value={form.tenor_bulan} onChange={e => setForm(f => ({ ...f, tenor_bulan: e.target.value }))}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-600">
              {[3, 6, 12, 24, 36].map(n => <option key={n} value={n}>{n} bulan</option>)}
            </select>
          </div>
          {error && <p className="text-red-400 text-sm bg-red-950/50 border border-red-900 rounded-lg px-3 py-2">{error}</p>}
          <button type="submit" disabled={saving}
            className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-semibold rounded-lg py-2.5 text-sm">
            {saving ? 'Mengajukan...' : 'Kirim Pengajuan'}
          </button>
        </form>
      )}

      {tab === 'list' && (
        pinjaman.length === 0
          ? <div className="text-center py-16 text-slate-500"><p className="text-4xl mb-2">💰</p><p>Belum ada pinjaman.</p></div>
          : <div className="space-y-3">
              {pinjaman.map(p => (
                <div key={p.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="text-white font-medium">Rp {p.jumlah_pokok.toLocaleString('id-ID')}</p>
                      <p className="text-slate-500 text-xs mt-0.5">{p.koperasi?.nama}</p>
                    </div>
                    <span className={`text-xs border px-2 py-0.5 rounded-full ${STATUS_COLOR[p.status] ?? 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                      {p.status}
                    </span>
                  </div>
                  <p className="text-slate-600 text-xs">{new Date(p.created_at).toLocaleDateString('id-ID')}</p>
                </div>
              ))}
            </div>
      )}
    </div>
  )
}

export default function MemberPinjamanPage() {
  return <Suspense fallback={<p className='text-slate-500 text-sm p-4'>Memuat...</p>}><PinjamanContent /></Suspense>
}
