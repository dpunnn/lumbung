'use client'

import { useEffect, useState } from 'react'
import { Plus, ShoppingBag, AlertTriangle, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react'
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

const inputCls = 'w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-stone-900 text-sm placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-500 transition-colors'

const STATUS_COLOR: Record<string, string> = {
  draft:   'bg-stone-100 text-stone-600 border-stone-200',
  aktif:   'bg-green-50 text-green-700 border-green-200',
  selesai: 'bg-blue-50 text-blue-700 border-blue-200',
}

export default function PengadaanPage() {
  const [tab, setTab] = useState<'daftar' | 'buat'>('daftar')
  const [data, setData] = useState<Pengadaan[]>([])
  const [myKoperasiId, setMyKoperasiId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [finalisasiError, setFinalisasiError] = useState<string | null>(null)
  const [form, setForm] = useState({ judul: '', item: '', satuan: 'kg', kebutuhan: '' })
  const [ajukanForm, setAjukanForm] = useState<Record<string, { kebutuhan: string; status_rekening: string }>>({})

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: p } = await supabase.from('profiles').select('koperasi_id').eq('id', user.id).single()
      if (p) setMyKoperasiId(p.koperasi_id)
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
      judul: form.judul, item: form.item, satuan: form.satuan,
      status: 'aktif', dibuat_oleh_koperasi_id: myKoperasiId,
    }).select().single()
    if (pengadaan) {
      await supabase.from('pengadaan_alokasi').insert({
        pengadaan_id: pengadaan.id, koperasi_id: myKoperasiId,
        kebutuhan: parseFloat(form.kebutuhan) || 0, status_rekening: 'terhubung',
      })
    }
    setSaving(false)
    setForm({ judul: '', item: '', satuan: 'kg', kebutuhan: '' })
    setTab('daftar')
    loadData()
  }

  async function handleFinalisasi(pengadaanId: string) {
    setSaving(true)
    setFinalisasiError(null)
    const { data: allocs } = await supabase
      .from('pengadaan_alokasi').select('id, kebutuhan').eq('pengadaan_id', pengadaanId)
    for (const a of allocs ?? []) {
      await supabase.from('pengadaan_alokasi')
        .update({ alokasi_dapat: a.kebutuhan }).eq('id', a.id)
    }
    const { error } = await supabase.from('pengadaan').update({ status: 'selesai' }).eq('id', pengadaanId)
    if (error) {
      setFinalisasiError('Gagal memperbarui status: ' + error.message)
      setSaving(false)
      return
    }

    setData(prev => prev.map(p =>
      p.id === pengadaanId
        ? { ...p, status: 'selesai', pengadaan_alokasi: p.pengadaan_alokasi.map(a => ({ ...a, alokasi_dapat: a.kebutuhan })) }
        : p
    ))
    setConfirmId(null)
    setSaving(false)
  }

  async function handleAjukan(pengadaanId: string) {
    const f = ajukanForm[pengadaanId]
    if (!f?.kebutuhan) return
    setSaving(true)
    const { data: existing } = await supabase.from('pengadaan_alokasi').select('id')
      .eq('pengadaan_id', pengadaanId).eq('koperasi_id', myKoperasiId).single()
    if (existing) {
      await supabase.from('pengadaan_alokasi')
        .update({ kebutuhan: parseFloat(f.kebutuhan), status_rekening: f.status_rekening })
        .eq('id', existing.id)
    } else {
      await supabase.from('pengadaan_alokasi').insert({
        pengadaan_id: pengadaanId, koperasi_id: myKoperasiId,
        kebutuhan: parseFloat(f.kebutuhan), status_rekening: f.status_rekening ?? 'terhubung',
      })
    }
    const { data: alloc } = await supabase.from('pengadaan_alokasi').select('kebutuhan').eq('pengadaan_id', pengadaanId)
    const total = (alloc ?? []).reduce((s, r) => s + (r.kebutuhan ?? 0), 0)
    await supabase.from('pengadaan').update({ total_kebutuhan: total }).eq('id', pengadaanId)
    setSaving(false)
    setAjukanForm(f => ({ ...f, [pengadaanId]: { kebutuhan: '', status_rekening: 'terhubung' } }))
    loadData()
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-stone-900 text-xl font-bold">Lumbung Pasar</h1>
          <p className="text-stone-500 text-sm">Pengadaan bersama antar koperasi</p>
        </div>
        <button onClick={() => setTab('buat')}
          className="flex items-center gap-1.5 bg-amber-700 hover:bg-amber-800 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors shadow-sm">
          <Plus size={15} /> Buat Pengadaan
        </button>
      </div>

      <div className="flex gap-1 bg-stone-100 border border-stone-200 rounded-xl p-1 w-fit">
        {(['daftar', 'buat'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm transition-colors
              ${tab === t ? 'bg-amber-700 text-white' : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'}`}>
            {t === 'buat' ? 'Buat Baru' : 'Daftar Pengadaan'}
          </button>
        ))}
      </div>

      {tab === 'buat' && (
        <form onSubmit={handleBuat} className="bg-white border border-stone-200 rounded-xl p-5 space-y-4 shadow-sm">
          <h2 className="text-stone-900 font-semibold">Buat Pengadaan Bersama</h2>
          <div>
            <label className="block text-stone-700 text-sm font-medium mb-1.5">Judul *</label>
            <input required value={form.judul} onChange={e => setForm(f => ({ ...f, judul: e.target.value }))}
              placeholder="Pengadaan Pupuk Urea Juni 2026" className={inputCls} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-stone-700 text-sm font-medium mb-1.5">Item *</label>
              <input required value={form.item} onChange={e => setForm(f => ({ ...f, item: e.target.value }))}
                placeholder="Pupuk Urea" className={inputCls} />
            </div>
            <div>
              <label className="block text-stone-700 text-sm font-medium mb-1.5">Satuan</label>
              <select value={form.satuan} onChange={e => setForm(f => ({ ...f, satuan: e.target.value }))} className={inputCls}>
                {['kg', 'sak', 'liter', 'ton', 'karung'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-stone-700 text-sm font-medium mb-1.5">Kebutuhan Koperasi Kamu ({form.satuan})</label>
            <input type="number" min="0" value={form.kebutuhan} onChange={e => setForm(f => ({ ...f, kebutuhan: e.target.value }))}
              placeholder="50" className={inputCls} />
          </div>
          <button type="submit" disabled={saving}
            className="w-full bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white font-semibold rounded-lg px-4 py-2.5 text-sm transition-colors">
            {saving ? 'Membuat...' : 'Buat & Daftarkan Kebutuhan'}
          </button>
        </form>
      )}

      {tab === 'daftar' && (
        loading ? (
          <div className="flex justify-center py-12">
            <div className="w-5 h-5 border-2 border-amber-700 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : data.length === 0 ? (
          <div className="text-center py-16 text-stone-400 bg-white border border-stone-200 rounded-xl">
            <ShoppingBag size={32} className="mx-auto mb-2 text-stone-300" />
            <p className="text-sm">Belum ada pengadaan bersama.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {data.map(p => {
              const totalKebutuhan = p.pengadaan_alokasi.reduce((s, a) => s + (a.kebutuhan ?? 0), 0)
              const adaBelumTerhubung = p.pengadaan_alokasi.some(a => a.status_rekening === 'belum_terhubung')
              const sudahDaftar = p.pengadaan_alokasi.some(a => a.koperasi_id === myKoperasiId)
              const isExpanded = expandedId === p.id

              return (
                <div key={p.id} className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-sm">
                  <div className="p-4 cursor-pointer hover:bg-stone-50 transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : p.id)}>
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="text-stone-900 font-medium">{p.judul}</p>
                        <p className="text-stone-500 text-sm">{p.item} · {p.koperasi?.nama}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs border px-2 py-0.5 rounded-full ${STATUS_COLOR[p.status]}`}>
                          {p.status}
                        </span>
                        {isExpanded ? <ChevronUp size={14} className="text-stone-400" /> : <ChevronDown size={14} className="text-stone-400" />}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-stone-500 text-xs">
                        Total: <strong className="text-stone-900">{totalKebutuhan} {p.satuan}</strong>
                      </span>
                      <span className="text-stone-400 text-xs">{p.pengadaan_alokasi.length} koperasi</span>
                      {adaBelumTerhubung && (
                        <span className="text-amber-600 text-xs flex items-center gap-1">
                          <AlertTriangle size={12} /> Ada koperasi belum punya rekening
                        </span>
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-stone-100 p-4 space-y-3 bg-stone-50">
                      <p className="text-stone-500 text-xs font-medium uppercase tracking-wide">Rekapitulasi Kebutuhan</p>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-stone-500 text-xs border-b border-stone-200">
                            <th className="text-left pb-2 font-medium">Koperasi</th>
                            <th className="text-right pb-2 font-medium">Kebutuhan</th>
                            <th className="text-right pb-2 font-medium">Dapat</th>
                            <th className="text-center pb-2 font-medium">Rekening</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100">
                          {p.pengadaan_alokasi.map(a => (
                            <tr key={a.id}>
                              <td className="py-2 text-stone-700">{a.koperasi?.nama ?? '—'}</td>
                              <td className="py-2 text-right text-stone-900 font-medium">{a.kebutuhan} {p.satuan}</td>
                              <td className="py-2 text-right text-stone-400">{a.alokasi_dapat || '—'}</td>
                              <td className="py-2 text-center">
                                {a.status_rekening === 'terhubung'
                                  ? <span className="text-green-600 text-xs flex items-center justify-center gap-1"><CheckCircle size={11} /> Terhubung</span>
                                  : <span className="text-red-500 text-xs flex items-center justify-center gap-1"><AlertTriangle size={11} /> Belum</span>}
                              </td>
                            </tr>
                          ))}
                          <tr className="border-t border-stone-200">
                            <td className="pt-2 text-stone-900 font-semibold">Total</td>
                            <td className="pt-2 text-right text-amber-700 font-semibold">{totalKebutuhan} {p.satuan}</td>
                            <td colSpan={2} />
                          </tr>
                        </tbody>
                      </table>

                      {!sudahDaftar && p.status === 'aktif' && (
                        <div className="bg-white border border-stone-200 rounded-xl p-4 space-y-3">
                          <p className="text-stone-800 text-sm font-medium">Daftarkan Kebutuhan Koperasimu</p>
                          <div className="flex gap-2">
                            <input type="number" min="0" placeholder={`Jumlah (${p.satuan})`}
                              value={ajukanForm[p.id]?.kebutuhan ?? ''}
                              onChange={e => setAjukanForm(f => ({ ...f, [p.id]: { ...f[p.id], kebutuhan: e.target.value } }))}
                              className="flex-1 bg-white border border-stone-300 rounded-lg px-3 py-2 text-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-500" />
                            <select value={ajukanForm[p.id]?.status_rekening ?? 'terhubung'}
                              onChange={e => setAjukanForm(f => ({ ...f, [p.id]: { ...f[p.id], status_rekening: e.target.value } }))}
                              className="bg-white border border-stone-300 rounded-lg px-3 py-2 text-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200">
                              <option value="terhubung">Rekening Terhubung</option>
                              <option value="belum_terhubung">Belum Punya Rekening</option>
                            </select>
                          </div>
                          <button onClick={() => handleAjukan(p.id)}
                            disabled={saving || !ajukanForm[p.id]?.kebutuhan}
                            className="w-full bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white text-sm font-medium rounded-lg py-2 transition-colors">
                            {saving ? 'Mendaftar...' : 'Ajukan Kebutuhan'}
                          </button>
                        </div>
                      )}

                      {sudahDaftar && (
                        <p className="text-green-600 text-xs flex items-center gap-1">
                          <CheckCircle size={12} /> Koperasimu sudah terdaftar di pengadaan ini
                        </p>
                      )}

                      {p.pengadaan_alokasi.length > 0 && (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs text-stone-500">
                            <span>Rekening terhubung</span>
                            <span className="font-medium text-stone-700">
                              {p.pengadaan_alokasi.filter(a => a.status_rekening === 'terhubung').length} / {p.pengadaan_alokasi.length} koperasi
                            </span>
                          </div>
                          <div className="w-full bg-stone-200 rounded-full h-1.5">
                            <div
                              className="bg-green-500 h-1.5 rounded-full transition-all"
                              style={{ width: `${(p.pengadaan_alokasi.filter(a => a.status_rekening === 'terhubung').length / p.pengadaan_alokasi.length) * 100}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {p.dibuat_oleh_koperasi_id === myKoperasiId && p.status === 'aktif' && confirmId !== p.id && (
                        <button onClick={() => { setConfirmId(p.id); setFinalisasiError(null) }}
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors">
                          Finalisasi & Tetapkan Alokasi
                        </button>
                      )}

                      {confirmId === p.id && p.status === 'aktif' && (
                        <div className="bg-blue-50 border border-blue-300 rounded-xl p-4 space-y-3">
                          <p className="text-blue-900 font-semibold text-sm">Konfirmasi Finalisasi</p>
                          <p className="text-blue-700 text-xs leading-relaxed">
                            Status pengadaan akan diubah menjadi <strong>selesai</strong> dan alokasi untuk setiap koperasi
                            akan ditetapkan sesuai kebutuhan yang sudah didaftarkan. Tindakan ini tidak dapat dibatalkan.
                          </p>
                          {finalisasiError && (
                            <p className="text-red-600 text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                              {finalisasiError}
                            </p>
                          )}
                          <div className="flex gap-2">
                            <button onClick={() => handleFinalisasi(p.id)} disabled={saving}
                              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold py-2 rounded-lg transition-colors">
                              {saving ? 'Memproses...' : 'Ya, Finalisasi'}
                            </button>
                            <button onClick={() => { setConfirmId(null); setFinalisasiError(null) }} disabled={saving}
                              className="flex-1 border border-stone-300 hover:border-stone-400 text-stone-600 text-sm py-2 rounded-lg transition-colors">
                              Batal
                            </button>
                          </div>
                        </div>
                      )}

                      {p.status === 'selesai' && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-blue-700 text-xs font-medium flex items-center gap-1.5">
                          <CheckCircle size={13} /> Pengadaan selesai — alokasi sudah ditetapkan
                        </div>
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
