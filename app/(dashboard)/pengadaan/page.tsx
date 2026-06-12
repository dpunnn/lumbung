'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Koperasi = { id: string; nama: string }

type Alokasi = {
  id: string
  koperasi_id: string
  kebutuhan: number
  alokasi_dapat: number
  status_rekening: 'terhubung' | 'belum_terhubung'
  catatan: string | null
  koperasi: Koperasi
}

type Pengadaan = {
  id: string
  judul: string
  item: string
  satuan: string
  total_kebutuhan: number
  status: 'draft' | 'aktif' | 'selesai'
  dibuat_oleh_koperasi_id: string
  created_at: string
  pengadaan_alokasi: Alokasi[]
  koperasi: Koperasi
}

export default function PengadaanPage() {
  const [tab, setTab] = useState<'daftar' | 'buat'>('daftar')
  const [data, setData] = useState<Pengadaan[]>([])
  const [koperasiList, setKoperasiList] = useState<Koperasi[]>([])
  const [myKoperasiId, setMyKoperasiId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Form buat pengadaan baru
  const [form, setForm] = useState({ judul: '', item: '', satuan: 'kg', kebutuhan: '' })
  // Form ajukan kebutuhan
  const [ajukanForm, setAjukanForm] = useState<Record<string, { kebutuhan: string; status_rekening: string }>>({})

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: p } = await supabase.from('profiles').select('koperasi_id').eq('id', user.id).single()
      if (p) setMyKoperasiId(p.koperasi_id)

      const { data: kop } = await supabase.from('koperasi').select('id, nama').order('nama')
      setKoperasiList(kop ?? [])
    }
    init()
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    const { data: rows } = await supabase
      .from('pengadaan')
      .select('*, koperasi(id, nama), pengadaan_alokasi(*, koperasi(id, nama))')
      .order('created_at', { ascending: false })
    setData((rows as Pengadaan[]) ?? [])
    setLoading(false)
  }

  async function handleBuat(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { data: pengadaan } = await supabase.from('pengadaan').insert({
      judul: form.judul,
      item: form.item,
      satuan: form.satuan,
      status: 'aktif',
      dibuat_oleh_koperasi_id: myKoperasiId,
    }).select().single()

    if (pengadaan) {
      // Auto-daftarkan koperasi pembuat
      await supabase.from('pengadaan_alokasi').insert({
        pengadaan_id: pengadaan.id,
        koperasi_id: myKoperasiId,
        kebutuhan: parseFloat(form.kebutuhan) || 0,
        status_rekening: 'terhubung',
      })
    }
    setSaving(false)
    setForm({ judul: '', item: '', satuan: 'kg', kebutuhan: '' })
    setTab('daftar')
    loadData()
  }

  async function handleAjukan(pengadaanId: string) {
    const f = ajukanForm[pengadaanId]
    if (!f?.kebutuhan) return
    setSaving(true)

    // Cek sudah daftar belum
    const { data: existing } = await supabase
      .from('pengadaan_alokasi')
      .select('id')
      .eq('pengadaan_id', pengadaanId)
      .eq('koperasi_id', myKoperasiId)
      .single()

    if (existing) {
      await supabase.from('pengadaan_alokasi')
        .update({ kebutuhan: parseFloat(f.kebutuhan), status_rekening: f.status_rekening })
        .eq('id', existing.id)
    } else {
      await supabase.from('pengadaan_alokasi').insert({
        pengadaan_id: pengadaanId,
        koperasi_id: myKoperasiId,
        kebutuhan: parseFloat(f.kebutuhan),
        status_rekening: f.status_rekening ?? 'terhubung',
      })
    }

    // Update total_kebutuhan
    const { data: alloc } = await supabase
      .from('pengadaan_alokasi')
      .select('kebutuhan')
      .eq('pengadaan_id', pengadaanId)
    const total = (alloc ?? []).reduce((s, r) => s + (r.kebutuhan ?? 0), 0)
    await supabase.from('pengadaan').update({ total_kebutuhan: total }).eq('id', pengadaanId)

    setSaving(false)
    setAjukanForm(f => ({ ...f, [pengadaanId]: { kebutuhan: '', status_rekening: 'terhubung' } }))
    loadData()
  }

  const STATUS_COLOR: Record<string, string> = {
    draft:   'bg-slate-800 text-slate-400 border-slate-700',
    aktif:   'bg-green-900/50 text-green-400 border-green-800',
    selesai: 'bg-blue-900/50 text-blue-400 border-blue-800',
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white text-xl font-semibold">Lumbung Pasar</h1>
          <p className="text-slate-400 text-sm">Pengadaan bersama antar koperasi</p>
        </div>
        <button onClick={() => setTab('buat')}
          className="bg-green-600 hover:bg-green-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          + Buat Pengadaan
        </button>
      </div>

     
      <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1 w-fit">
        {(['daftar', 'buat'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm transition-colors
              ${tab === t ? 'bg-green-700 text-white' : 'text-slate-400 hover:text-white'}`}>
            {t === 'buat' ? 'Buat Baru' : 'Daftar Pengadaan'}
          </button>
        ))}
      </div>

      {/* Form buat baru */}
      {tab === 'buat' && (
        <form onSubmit={handleBuat} className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <h2 className="text-white font-medium">Buat Pengadaan Bersama</h2>
          <div>
            <label className="block text-slate-300 text-sm mb-1.5">Judul *</label>
            <input required value={form.judul} onChange={e => setForm(f => ({ ...f, judul: e.target.value }))}
              placeholder="Pengadaan Pupuk Urea Juni 2026"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-slate-300 text-sm mb-1.5">Item *</label>
              <input required value={form.item} onChange={e => setForm(f => ({ ...f, item: e.target.value }))}
                placeholder="Pupuk Urea"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
            </div>
            <div>
              <label className="block text-slate-300 text-sm mb-1.5">Satuan</label>
              <select value={form.satuan} onChange={e => setForm(f => ({ ...f, satuan: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-600">
                {['kg','sak','liter','ton','karung'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-slate-300 text-sm mb-1.5">Kebutuhan Koperasi Kamu ({form.satuan})</label>
            <input type="number" min="0" value={form.kebutuhan} onChange={e => setForm(f => ({ ...f, kebutuhan: e.target.value }))}
              placeholder="50"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
          </div>
          <button type="submit" disabled={saving}
            className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-semibold rounded-lg px-4 py-2.5 text-sm">
            {saving ? 'Membuat...' : 'Buat & Daftarkan Kebutuhan'}
          </button>
        </form>
      )}

      {/* Daftar pengadaan */}
      {tab === 'daftar' && (
        loading ? (
          <p className="text-slate-500 text-sm">Memuat...</p>
        ) : data.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <p className="text-4xl mb-2">🛒</p>
            <p>Belum ada pengadaan bersama.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {data.map(p => {
              const totalKebutuhan = p.pengadaan_alokasi.reduce((s, a) => s + (a.kebutuhan ?? 0), 0)
              const adaBelumTerhubung = p.pengadaan_alokasi.some(a => a.status_rekening === 'belum_terhubung')
              const sudahDaftar = p.pengadaan_alokasi.some(a => a.koperasi_id === myKoperasiId)
              const isExpanded = expandedId === p.id

              return (
                <div key={p.id} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                  {/* Header */}
                  <div className="p-4 cursor-pointer hover:bg-slate-800/30 transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : p.id)}>
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="text-white font-medium">{p.judul}</p>
                        <p className="text-slate-400 text-sm">{p.item} · {p.koperasi?.nama}</p>
                      </div>
                      <span className={`text-xs border px-2 py-0.5 rounded-full ${STATUS_COLOR[p.status]}`}>
                        {p.status}
                      </span>
                    </div>

                    {/* Ringkasan */}
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-slate-400">
                        Total: <strong className="text-white">{totalKebutuhan} {p.satuan}</strong>
                      </span>
                      <span className="text-slate-400">
                        {p.pengadaan_alokasi.length} koperasi
                      </span>
                      {adaBelumTerhubung && (
                        <span className="text-red-400 text-xs flex items-center gap-1">
                          ⚠ Ada koperasi belum punya rekening
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Detail rekapitulasi */}
                  {isExpanded && (
                    <div className="border-t border-slate-800 p-4 space-y-3">
                      <p className="text-slate-400 text-xs">Rekapitulasi Kebutuhan</p>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-slate-500 text-xs border-b border-slate-800">
                            <th className="text-left pb-2">Koperasi</th>
                            <th className="text-right pb-2">Kebutuhan</th>
                            <th className="text-right pb-2">Dapat</th>
                            <th className="text-center pb-2">Rekening</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                          {p.pengadaan_alokasi.map(a => (
                            <tr key={a.id}>
                              <td className="py-2 text-slate-300">{a.koperasi?.nama ?? '—'}</td>
                              <td className="py-2 text-right text-white">{a.kebutuhan} {p.satuan}</td>
                              <td className="py-2 text-right text-slate-400">{a.alokasi_dapat || '—'}</td>
                              <td className="py-2 text-center">
                                {a.status_rekening === 'terhubung'
                                  ? <span className="text-green-400 text-xs">✓ Terhubung</span>
                                  : <span className="text-red-400 text-xs">⚠ Belum</span>}
                              </td>
                            </tr>
                          ))}
                          <tr className="border-t border-slate-700">
                            <td className="pt-2 text-white font-semibold">Total</td>
                            <td className="pt-2 text-right text-green-400 font-semibold">{totalKebutuhan} {p.satuan}</td>
                            <td colSpan={2} />
                          </tr>
                        </tbody>
                      </table>

                      {/* Ajukan kebutuhan kalau belum daftar */}
                      {!sudahDaftar && p.status === 'aktif' && (
                        <div className="bg-slate-800 rounded-xl p-3 space-y-3">
                          <p className="text-slate-300 text-sm font-medium">Daftarkan Kebutuhan Koperasimu</p>
                          <div className="flex gap-2">
                            <input
                              type="number" min="0" placeholder={`Jumlah (${p.satuan})`}
                              value={ajukanForm[p.id]?.kebutuhan ?? ''}
                              onChange={e => setAjukanForm(f => ({ ...f, [p.id]: { ...f[p.id], kebutuhan: e.target.value } }))}
                              className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
                            <select
                              value={ajukanForm[p.id]?.status_rekening ?? 'terhubung'}
                              onChange={e => setAjukanForm(f => ({ ...f, [p.id]: { ...f[p.id], status_rekening: e.target.value } }))}
                              className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-600">
                              <option value="terhubung">Rekening Terhubung</option>
                              <option value="belum_terhubung">Belum Punya Rekening</option>
                            </select>
                          </div>
                          <button
                            onClick={() => handleAjukan(p.id)}
                            disabled={saving || !ajukanForm[p.id]?.kebutuhan}
                            className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg py-2">
                            {saving ? 'Mendaftar...' : 'Ajukan Kebutuhan'}
                          </button>
                        </div>
                      )}

                      {sudahDaftar && (
                        <p className="text-green-400 text-xs">✓ Koperasimu sudah terdaftar di pengadaan ini</p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      )}
    </div>
  )
}
